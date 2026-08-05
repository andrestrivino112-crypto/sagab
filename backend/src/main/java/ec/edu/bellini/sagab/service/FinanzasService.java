package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.FinanzasDtos;

import ec.edu.bellini.sagab.model.ObligacionPago;
import ec.edu.bellini.sagab.model.Pago;
import ec.edu.bellini.sagab.repository.ObligacionPagoRepository;
import ec.edu.bellini.sagab.repository.PagoRepository;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

@Service
public class FinanzasService {

    private final ObligacionPagoRepository obligaciones;
    private final PagoRepository pagos;
    private final UsuarioRepository usuarios;
    private final EstudianteService estudianteService;
    private final StorageService storage;
    private final FileValidationService validacion;
    private final long maxBytesComprobante;
    private final SecureRandom random = new SecureRandom();

    public FinanzasService(ObligacionPagoRepository obligaciones, PagoRepository pagos,
                           UsuarioRepository usuarios, EstudianteService estudianteService,
                           StorageService storage, FileValidationService validacion,
                           @Value("${sagab.uploads.max-mb-comprobante}") long maxMbComprobante) {
        this.obligaciones = obligaciones;
        this.pagos = pagos;
        this.usuarios = usuarios;
        this.estudianteService = estudianteService;
        this.storage = storage;
        this.validacion = validacion;
        this.maxBytesComprobante = maxMbComprobante * 1024 * 1024;
    }

    @Transactional(readOnly = true)
    public List<FinanzasDtos.ObligacionResponse> porEstudiante(Long idEstudiante, Authentication auth) {
        if (!estudianteService.esPropio(idEstudiante, auth)) {
            throw new AccessDeniedException("No autorizado para consultar este estudiante");
        }
        List<ObligacionPago> obligacionesEstudiante = obligaciones.findByEstudianteIdOrderByFechaVencimientoDesc(idEstudiante);
        List<Long> idsObligacion = obligacionesEstudiante.stream().map(ObligacionPago::getId).toList();
        Map<Long, List<Pago>> pagosPorObligacion = pagos.findByObligacionIdInOrderByFechaPagoDesc(idsObligacion)
                .stream()
                .collect(Collectors.groupingBy(p -> p.getObligacion().getId()));

        return obligacionesEstudiante.stream()
                .map(o -> toResponse(o, pagosPorObligacion.getOrDefault(o.getId(), List.of())))
                .toList();
    }

    /** Registro directo (efectivo/cheque/tarjeta) por un ADMIN — se da por aprobado en el acto. */
    @Transactional
    public FinanzasDtos.ObligacionResponse registrarPago(FinanzasDtos.PagoRequest req, Authentication auth) {
        Long idUsuario = usuarios.findByEmail(auth.getName()).orElseThrow().getId();
        ObligacionPago obligacion = obligaciones.findById(req.idObligacion())
                .orElseThrow(() -> new IllegalArgumentException("La obligación de pago no existe"));

        Pago pago = new Pago();
        pago.setObligacion(obligacion);
        pago.setValorPagado(req.valorPagado());
        pago.setMetodo(req.metodo() != null && !req.metodo().isBlank() ? req.metodo() : "EFECTIVO");
        pago.setNumeroRecibo(generarNumeroRecibo());
        pago.setRegistradoPor(idUsuario);
        pago.setEstadoRevision(Pago.EstadoRevision.APROBADO);
        pagos.save(pago);

        actualizarEstadoSiCorresponde(obligacion);
        return toResponse(obligacion, pagos.findByObligacionIdOrderByFechaPagoDesc(obligacion.getId()));
    }

    /**
     * El representante (o un admin) sube el comprobante de una transferencia. Queda EN_REVISION:
     * no marca la obligación como pagada todavía, eso lo decide un admin en aprobar().
     */
    @Transactional
    public FinanzasDtos.PagoRevisionResponse subirComprobante(Long idObligacion, BigDecimal valorPagado,
            String banco, String asunto, String numeroReferencia, LocalDate fechaPago, MultipartFile archivo, Authentication auth) {
        ObligacionPago obligacion = obligaciones.findById(idObligacion)
                .orElseThrow(() -> new NoSuchElementException("La obligación de pago no existe"));
        if (!estudianteService.esPropio(obligacion.getEstudiante().getId(), auth)) {
            throw new AccessDeniedException("No autorizado para pagar esta obligación");
        }

        FileValidationService.Resultado r = validacion.validarComprobante(archivo, maxBytesComprobante);
        if (pagos.existsByObligacionIdAndComprobanteHash(idObligacion, r.hashSha256())) {
            throw new IllegalArgumentException("Este comprobante ya fue subido antes para esta obligación.");
        }

        Long idUsuario = usuarios.findByEmail(auth.getName()).orElseThrow().getId();
        String clave = storage.generarClave("comprobantes/" + idObligacion, archivo.getOriginalFilename());
        storage.subir(clave, r.contenido(), r.mimeType());

        Pago pago = new Pago();
        pago.setObligacion(obligacion);
        pago.setValorPagado(valorPagado);
        pago.setMetodo("TRANSFERENCIA");
        pago.setNumeroRecibo(generarNumeroRecibo());
        pago.setRegistradoPor(idUsuario);
        pago.setFechaPago(fechaPago.atStartOfDay().atOffset(OffsetDateTime.now().getOffset()));
        pago.setBancoOrigen(banco);
        pago.setAsunto(asunto);
        pago.setNumeroReferencia(numeroReferencia);
        pago.setComprobanteUrl(clave);
        pago.setComprobanteNombreOriginal(archivo.getOriginalFilename());
        pago.setComprobanteMimeType(r.mimeType());
        pago.setComprobanteTamanoBytes((long) r.contenido().length);
        pago.setComprobanteHash(r.hashSha256());
        pago.setEstadoRevision(Pago.EstadoRevision.EN_REVISION);
        pago = pagos.save(pago);

        return toRevisionResponse(pago);
    }

    /** Cola de revisión del admin: transferencias con comprobante, esperando aprobación. */
    @Transactional(readOnly = true)
    public List<FinanzasDtos.PagoRevisionResponse> colaRevision() {
        return pagos.findByEstadoRevisionOrderByFechaPagoAsc(Pago.EstadoRevision.EN_REVISION).stream()
                .map(this::toRevisionResponse)
                .toList();
    }

    @Transactional
    public FinanzasDtos.PagoRevisionResponse aprobar(Long idPago, String observaciones, Authentication auth) {
        Pago pago = revisarPrevio(idPago);
        Long idUsuario = usuarios.findByEmail(auth.getName()).orElseThrow().getId();
        pago.setEstadoRevision(Pago.EstadoRevision.APROBADO);
        pago.setObservacionesAdmin(observaciones);
        pago.setRevisadoPor(idUsuario);
        pago.setFechaRevision(OffsetDateTime.now());
        pago = pagos.save(pago); // dispara fn_validar_suma_pagos: rechaza si se excede el valor de la obligación

        actualizarEstadoSiCorresponde(pago.getObligacion());
        return toRevisionResponse(pago);
    }

    @Transactional
    public FinanzasDtos.PagoRevisionResponse rechazar(Long idPago, String observaciones, Authentication auth) {
        Pago pago = revisarPrevio(idPago);
        Long idUsuario = usuarios.findByEmail(auth.getName()).orElseThrow().getId();
        pago.setEstadoRevision(Pago.EstadoRevision.RECHAZADO);
        pago.setObservacionesAdmin(observaciones);
        pago.setRevisadoPor(idUsuario);
        pago.setFechaRevision(OffsetDateTime.now());
        pago = pagos.save(pago);
        return toRevisionResponse(pago);
    }

    /** URL de descarga temporal del comprobante, verificando permisos primero. */
    @Transactional(readOnly = true)
    public String urlDescargaComprobante(Long idPago, Authentication auth) {
        Pago pago = pagos.findById(idPago).orElseThrow(() -> new NoSuchElementException("El pago no existe"));
        boolean esAdmin = auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ADMIN"));
        if (!esAdmin && !estudianteService.esPropio(pago.getObligacion().getEstudiante().getId(), auth)) {
            throw new AccessDeniedException("No autorizado para ver este comprobante");
        }
        if (pago.getComprobanteUrl() == null) {
            throw new NoSuchElementException("Este pago no tiene comprobante adjunto");
        }
        return storage.urlDescargaTemporal(pago.getComprobanteUrl());
    }

    private Pago revisarPrevio(Long idPago) {
        Pago pago = pagos.findById(idPago).orElseThrow(() -> new NoSuchElementException("El pago no existe"));
        if (pago.getEstadoRevision() != Pago.EstadoRevision.EN_REVISION) {
            throw new IllegalArgumentException("Este pago ya fue revisado (" + pago.getEstadoRevision() + ")");
        }
        return pago;
    }

    /** Solo cuentan los pagos ya APROBADOS: uno EN_REVISION o RECHAZADO no marca la obligación como pagada. */
    private void actualizarEstadoSiCorresponde(ObligacionPago obligacion) {
        BigDecimal totalAprobado = pagos.findByObligacionIdOrderByFechaPagoDesc(obligacion.getId()).stream()
                .filter(p -> p.getEstadoRevision() == Pago.EstadoRevision.APROBADO)
                .map(Pago::getValorPagado)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (totalAprobado.compareTo(obligacion.getValor()) >= 0
                && obligacion.getEstado() != ObligacionPago.EstadoPago.PAGADO) {
            obligacion.setEstado(ObligacionPago.EstadoPago.PAGADO);
            obligaciones.save(obligacion);
        }
    }

    private FinanzasDtos.ObligacionResponse toResponse(ObligacionPago o, List<Pago> pagosDeLaObligacion) {
        Pago ultimoPago = pagosDeLaObligacion.stream().findFirst().orElse(null);
        FinanzasDtos.PagoResponse pagoResponse = ultimoPago == null ? null : new FinanzasDtos.PagoResponse(
                ultimoPago.getId(), ultimoPago.getValorPagado(), ultimoPago.getMetodo(),
                ultimoPago.getNumeroRecibo(), ultimoPago.getFechaPago(), ultimoPago.getEstadoRevision().name());
        return new FinanzasDtos.ObligacionResponse(
                o.getId(), o.getRubro().getNombre(), o.getRubro().getTipo().name(),
                o.getMes(), o.getValor(), o.getFechaVencimiento(), o.getEstado().name(),
                pagoResponse);
    }

    private FinanzasDtos.PagoRevisionResponse toRevisionResponse(Pago p) {
        return new FinanzasDtos.PagoRevisionResponse(
                p.getId(), p.getObligacion().getId(), p.getObligacion().getEstudiante().nombreCompleto(),
                p.getObligacion().getRubro().getNombre(), p.getValorPagado(), p.getBancoOrigen(), p.getAsunto(),
                p.getNumeroReferencia(), p.getFechaPago(), p.getComprobanteNombreOriginal(),
                p.getEstadoRevision().name(), p.getObservacionesAdmin());
    }

    private String generarNumeroRecibo() {
        StringBuilder sb = new StringBuilder("REC-");
        for (int i = 0; i < 10; i++) sb.append(random.nextInt(10));
        return sb.toString();
    }
}
