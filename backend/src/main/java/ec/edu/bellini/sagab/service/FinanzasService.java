package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.FinanzasDtos;
import ec.edu.bellini.sagab.dto.MensajeDtos;

import ec.edu.bellini.sagab.model.Estudiante;
import ec.edu.bellini.sagab.model.Notificacion;
import ec.edu.bellini.sagab.model.ObligacionPago;
import ec.edu.bellini.sagab.model.Pago;
import ec.edu.bellini.sagab.model.Rubro;
import ec.edu.bellini.sagab.repository.EstudianteRepository;
import ec.edu.bellini.sagab.repository.ObligacionPagoRepository;
import ec.edu.bellini.sagab.repository.PagoRepository;
import ec.edu.bellini.sagab.repository.PeriodoAcademicoRepository;
import ec.edu.bellini.sagab.repository.RubroRepository;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.data.domain.PageRequest;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

@Service
public class FinanzasService {

    private final ObligacionPagoRepository obligaciones;
    private final PagoRepository pagos;
    private final UsuarioRepository usuarios;
    private final EstudianteRepository estudiantes;
    private final RubroRepository rubros;
    private final PeriodoAcademicoRepository periodos;
    private final EstudianteService estudianteService;
    private final StorageService storage;
    private final FileValidationService validacion;
    private final NotificacionService notificacionService;
    private final MensajeService mensajeService;
    private final EmailService emailService;
    private final long maxBytesComprobante;
    private final SecureRandom random = new SecureRandom();

    public FinanzasService(ObligacionPagoRepository obligaciones, PagoRepository pagos,
                           UsuarioRepository usuarios, EstudianteRepository estudiantes,
                           RubroRepository rubros, PeriodoAcademicoRepository periodos,
                           EstudianteService estudianteService,
                           StorageService storage, FileValidationService validacion,
                           NotificacionService notificacionService, MensajeService mensajeService,
                           EmailService emailService,
                           @Value("${sagab.uploads.max-mb-comprobante}") long maxMbComprobante) {
        this.obligaciones = obligaciones;
        this.pagos = pagos;
        this.usuarios = usuarios;
        this.estudiantes = estudiantes;
        this.rubros = rubros;
        this.periodos = periodos;
        this.estudianteService = estudianteService;
        this.storage = storage;
        this.validacion = validacion;
        this.notificacionService = notificacionService;
        this.mensajeService = mensajeService;
        this.emailService = emailService;
        this.maxBytesComprobante = maxMbComprobante * 1024 * 1024;
    }

    /** Motivos de pago disponibles (rubros del año lectivo vigente) — selector del Portal Familiar. */
    @Transactional(readOnly = true)
    public List<FinanzasDtos.RubroResponse> rubrosDisponibles() {
        List<Rubro> lista = periodos.findFirstByActivoTrueOrderByFechaInicioDesc()
                .map(p -> rubros.findByAnioLectivoOrderByNombreAsc(p.getAnioLectivo()))
                .orElseGet(rubros::findAll);
        return lista.stream()
                .map(r -> new FinanzasDtos.RubroResponse(r.getId(), r.getNombre(), r.getTipo().name(), r.getValor()))
                .toList();
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

    /**
     * Transiciona a VENCIDO las obligaciones PENDIENTE cuya fecha de vencimiento ya pasó —
     * llamado por ObligacionVencidaScheduler. Sin este job, EstadoPago.VENCIDO no lo asignaba
     * ningún código y el KPI "estudiantes en mora" del Dashboard quedaba siempre en 0.
     */
    @Transactional
    public int marcarObligacionesVencidas() {
        return obligaciones.actualizarEstadoPorVencimiento(
                ObligacionPago.EstadoPago.PENDIENTE, ObligacionPago.EstadoPago.VENCIDO, LocalDate.now());
    }

    /**
     * ADMIN origina a mano la obligación del mes en curso de un estudiante para un rubro, sin
     * esperar a que la familia suba una transferencia primero (hallazgo FE-07 de la auditoría
     * funcional: un estudiante recién matriculado no tenía ninguna obligación que pagar, y
     * "Registrar pago" solo aparecía si ya existía una). Reutiliza el mismo mecanismo idempotente
     * que ya usa subirComprobante() — no duplica la obligación si ya existe.
     */
    @Transactional
    public FinanzasDtos.ObligacionResponse crearObligacion(Long idEstudiante, Integer idRubro) {
        ObligacionPago obligacion = obtenerOCrearObligacionDelMes(idEstudiante, idRubro);
        return toResponse(obligacion, pagos.findByObligacionIdOrderByFechaPagoDesc(obligacion.getId()));
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
     * El representante (o el propio estudiante) sube el comprobante de una transferencia. Queda
     * EN_REVISION: no marca la obligación como pagada todavía, eso lo decide un admin en aprobar().
     * <p>
     * Admite dos formas de indicar qué se está pagando:
     * <ul>
     *   <li>{@code idObligacion}: una obligación ya generada (por un admin, o por una subida anterior).</li>
     *   <li>{@code idRubro} + {@code idEstudiante}: el motivo de pago directamente — evita que un admin
     *       tenga que crear a mano la obligación de cada estudiante antes de que puedan pagar. Se
     *       busca (o se crea, con el valor del rubro) la obligación del mes en curso para ese
     *       estudiante y ese rubro.</li>
     * </ul>
     */
    @Transactional
    public FinanzasDtos.PagoRevisionResponse subirComprobante(Long idObligacion, Long idEstudiante, Integer idRubro,
            BigDecimal valorPagado, String banco, String asunto, String numeroReferencia, LocalDate fechaPago,
            MultipartFile archivo, Authentication auth) {

        ObligacionPago obligacion;
        if (idObligacion != null) {
            obligacion = obligaciones.findById(idObligacion)
                    .orElseThrow(() -> new NoSuchElementException("La obligación de pago no existe"));
            if (!estudianteService.esPropio(obligacion.getEstudiante().getId(), auth)) {
                throw new AccessDeniedException("No autorizado para pagar esta obligación");
            }
        } else if (idRubro != null && idEstudiante != null) {
            if (!estudianteService.esPropio(idEstudiante, auth)) {
                throw new AccessDeniedException("No autorizado para pagar a nombre de este estudiante");
            }
            obligacion = obtenerOCrearObligacionDelMes(idEstudiante, idRubro);
        } else {
            throw new IllegalArgumentException("Debe indicar la obligación a pagar, o el motivo de pago y el estudiante.");
        }

        // Motivos de monto variable ("Otro, especifique"): si lo declarado supera el valor que
        // tenía la obligación, se ajusta hacia arriba — si no, el trigger de suma de pagos lo
        // rechazaría más tarde al aprobar (fn_validar_suma_pagos, 16_pagos_transferencia.sql).
        // Para el resto de rubros (MATRICULA/PENSION/EXTRACURRICULAR, de valor fijo) NO se ajusta:
        // un monto mayor al valor fijo es un error del formulario, no un pago legítimo, y se
        // rechaza aquí mismo (aplica igual si el pago llegó por idObligacion o por idRubro+idEstudiante).
        if (valorPagado != null && valorPagado.compareTo(obligacion.getValor()) > 0) {
            if (obligacion.getRubro().getTipo() != Rubro.TipoRubro.OTRO) {
                throw new IllegalArgumentException("El monto de \"" + obligacion.getRubro().getNombre()
                        + "\" es fijo (" + obligacion.getValor() + ") — no puede pagar un monto mayor. "
                        + "Si el valor cambió, contacte a administración.");
            }
            obligacion.setValor(valorPagado);
            obligacion = obligaciones.save(obligacion);
        }

        if (fechaPago.isAfter(LocalDate.now())) {
            throw new IllegalArgumentException("La fecha de la transferencia no puede ser futura.");
        }

        FileValidationService.Resultado r = validacion.validarComprobante(archivo, maxBytesComprobante);
        if (pagos.existsByObligacionIdAndComprobanteHash(obligacion.getId(), r.hashSha256())) {
            throw new IllegalArgumentException("Este comprobante ya fue subido antes para esta obligación.");
        }

        Long idUsuario = usuarios.findByEmail(auth.getName()).orElseThrow().getId();
        String clave = storage.generarClave("comprobantes/" + obligacion.getId(), archivo.getOriginalFilename());
        storage.subir(clave, r.contenido(), r.mimeType());

        Pago pago = new Pago();
        pago.setObligacion(obligacion);
        pago.setValorPagado(valorPagado != null ? valorPagado : obligacion.getValor());
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

    /**
     * Encuentra la obligación del estudiante para ese rubro y el mes en curso; si no existe
     * todavía (nadie la había generado a mano), la crea con el valor vigente del rubro. Así el
     * admin no necesita dar de alta una obligación por cada estudiante antes de que puedan pagar.
     */
    private ObligacionPago obtenerOCrearObligacionDelMes(Long idEstudiante, Integer idRubro) {
        LocalDate primerDiaMes = LocalDate.now().withDayOfMonth(1);
        return obligaciones.findByEstudianteIdAndRubroIdAndMes(idEstudiante, idRubro, primerDiaMes)
                .orElseGet(() -> {
                    Rubro rubro = rubros.findById(idRubro)
                            .orElseThrow(() -> new NoSuchElementException("El motivo de pago (rubro) no existe"));
                    ObligacionPago nueva = new ObligacionPago();
                    nueva.setEstudiante(estudiantes.getReferenceById(idEstudiante));
                    nueva.setRubro(rubro);
                    nueva.setMes(primerDiaMes);
                    nueva.setValor(rubro.getValor());
                    nueva.setFechaVencimiento(primerDiaMes.plusMonths(1).minusDays(1));
                    nueva.setEstado(ObligacionPago.EstadoPago.PENDIENTE);
                    return obligaciones.save(nueva);
                });
    }

    /** Cola de revisión del admin: transferencias con comprobante, esperando aprobación. Acotada
     * a 200 (ver INFORME_AUDITORIA_FUNCIONAL.md, BE-16) — misma cota que usa AuditoriaController. */
    @Transactional(readOnly = true)
    public List<FinanzasDtos.PagoRevisionResponse> colaRevision() {
        return pagos.findByEstadoRevisionOrderByFechaPagoAsc(Pago.EstadoRevision.EN_REVISION, PageRequest.of(0, 200)).stream()
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
        try {
            pago = pagos.save(pago); // dispara fn_validar_suma_pagos: rechaza si se excede el valor de la obligación
        } catch (DataAccessException e) {
            // El trigger de Postgres rechaza con RAISE EXCEPTION (SQLSTATE genérico, no una
            // violación de constraint estándar) — sin este catch caía en el manejador
            // genérico de Exception y el admin recibía un 500 en vez de un mensaje de negocio.
            String causa = e.getMostSpecificCause().getMessage();
            throw new IllegalArgumentException(causa != null && causa.contains("suma de pagos")
                    ? "La suma de pagos aprobados superaría el valor de la obligación."
                    : "No se pudo aprobar el pago: la operación fue rechazada por una regla de integridad de datos.");
        }

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

    /** Drill-down "Estudiantes en mora" del Dashboard — un registro por estudiante con al menos
     * una obligación VENCIDO. Ver ObligacionPagoRepository.buscarEstudiantesEnMora(). */
    @Transactional(readOnly = true)
    public List<FinanzasDtos.EstudianteMoraResponse> listaMora() {
        return obligaciones.buscarEstudiantesEnMora().stream()
                .map(p -> new FinanzasDtos.EstudianteMoraResponse(
                        p.getIdEstudiante(), p.getCodigo(), p.getNombreCompleto(), p.getParalelo(),
                        p.getRepresentante(), p.getRepresentanteTelefono(), p.getRepresentanteEmail(),
                        p.getValorPendiente(), p.getFechaVencimientoMasAntigua(), p.getObligacionesVencidas()))
                .toList();
    }

    /**
     * Envía una comunicación sobre la mora de un estudiante por el canal indicado. RECORDATORIO y
     * NOTIFICACION comparten la misma implementación (notificación dentro de la app): la diferencia
     * entre ambos botones es solo el texto que el admin ve precargado en el frontend, no la lógica
     * de envío — evita duplicar la resolución de destinatarios en el backend.
     */
    @Transactional
    public void enviarComunicacionMora(Long idEstudiante, FinanzasDtos.ComunicacionMoraRequest req, Authentication auth) {
        Estudiante estudiante = estudiantes.findById(idEstudiante)
                .orElseThrow(() -> new NoSuchElementException("El estudiante no existe"));
        String asunto = (req.asunto() == null || req.asunto().isBlank()) ? "Pago pendiente" : req.asunto();

        switch (req.canal()) {
            case RECORDATORIO, NOTIFICACION -> {
                if (estudiante.getUsuario() != null) {
                    notificacionService.crearGenerica(estudiante.getUsuario().getId(),
                            Notificacion.TipoNotificacion.PAGO, req.mensaje());
                }
                if (estudiante.getRepresentante() != null) {
                    notificacionService.crearGenerica(estudiante.getRepresentante().getUsuario().getId(),
                            Notificacion.TipoNotificacion.PAGO, req.mensaje());
                }
            }
            case MENSAJE_INTERNO -> {
                List<Long> destinatarios = new ArrayList<>();
                if (estudiante.getUsuario() != null) destinatarios.add(estudiante.getUsuario().getId());
                if (estudiante.getRepresentante() != null) destinatarios.add(estudiante.getRepresentante().getUsuario().getId());
                if (destinatarios.isEmpty()) {
                    throw new IllegalArgumentException("Este estudiante no tiene representante ni cuenta propia a la cual enviar el mensaje.");
                }
                mensajeService.enviar(new MensajeDtos.EnviarMensajeRequest(destinatarios, asunto, req.mensaje()), auth);
            }
            case EMAIL -> {
                if (estudiante.getRepresentante() == null) {
                    throw new IllegalArgumentException("Este estudiante no tiene representante registrado con correo electrónico.");
                }
                emailService.enviar(estudiante.getRepresentante().getUsuario().getEmail(), asunto, req.mensaje());
            }
        }
    }

    private String generarNumeroRecibo() {
        StringBuilder sb = new StringBuilder("REC-");
        for (int i = 0; i < 10; i++) sb.append(random.nextInt(10));
        return sb.toString();
    }
}
