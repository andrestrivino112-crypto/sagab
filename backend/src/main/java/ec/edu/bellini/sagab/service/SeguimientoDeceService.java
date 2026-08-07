package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.MensajeDtos;
import ec.edu.bellini.sagab.dto.SeguimientoDeceDtos;
import ec.edu.bellini.sagab.model.*;
import ec.edu.bellini.sagab.repository.*;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.NoSuchElementException;

@Service
public class SeguimientoDeceService {

    private final SeguimientoDeceRepository seguimientos;
    private final SeguimientoDeceHistorialRepository historiales;
    private final SeguimientoDeceMensajeRepository mensajesSeguimiento;
    private final EstudianteRepository estudiantes;
    private final UsuarioRepository usuarios;
    private final MensajeRepository mensajes;
    private final MensajeService mensajeService;
    private final NotificacionService notificacionService;

    public SeguimientoDeceService(SeguimientoDeceRepository seguimientos,
                                  SeguimientoDeceHistorialRepository historiales,
                                  SeguimientoDeceMensajeRepository mensajesSeguimiento,
                                  EstudianteRepository estudiantes, UsuarioRepository usuarios,
                                  MensajeRepository mensajes, MensajeService mensajeService,
                                  NotificacionService notificacionService) {
        this.seguimientos = seguimientos;
        this.historiales = historiales;
        this.mensajesSeguimiento = mensajesSeguimiento;
        this.estudiantes = estudiantes;
        this.usuarios = usuarios;
        this.mensajes = mensajes;
        this.mensajeService = mensajeService;
        this.notificacionService = notificacionService;
    }

    @Transactional(readOnly = true)
    public List<SeguimientoDeceDtos.BusquedaEstudianteResponse> buscarEstudiantes(String q) {
        String termino = q.trim();
        if (termino.length() < 2) throw new IllegalArgumentException("Ingrese al menos 2 caracteres para buscar");
        return estudiantes.buscarParaSeguimiento(termino).stream()
                .map(p -> new SeguimientoDeceDtos.BusquedaEstudianteResponse(
                        p.getIdEstudiante(), p.getCodigo(), p.getEstudiante(), p.getCurso(), p.getParalelo(),
                        p.getEmail(), p.getIdSeguimiento() != null, p.getIdSeguimiento()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SeguimientoDeceDtos.SeguimientoResponse> listar(String q, SeguimientoDece.EstadoSeguimiento estado) {
        String termino = q == null || q.isBlank() ? null : q.trim();
        return seguimientos.listarDetalle(termino, estado == null ? null : estado.name()).stream()
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public SeguimientoDeceDtos.SeguimientoResponse detalle(Long idSeguimiento) {
        return seguimientos.detalle(idSeguimiento).map(this::toResponse)
                .orElseThrow(() -> new NoSuchElementException("El seguimiento no existe"));
    }

    @Transactional
    public SeguimientoDeceDtos.SeguimientoResponse crear(SeguimientoDeceDtos.CrearRequest req, Authentication auth) {
        Usuario usuarioDece = usuario(auth);
        Estudiante estudiante = estudiantes.findById(req.idEstudiante())
                .filter(Estudiante::isActivo)
                .orElseThrow(() -> new NoSuchElementException("El estudiante no existe o no está activo"));

        SeguimientoDece seguimiento;
        SeguimientoDece.EstadoSeguimiento anterior = null;
        var existente = seguimientos.findByEstudianteId(req.idEstudiante());
        if (existente.isPresent()) {
            seguimiento = existente.get();
            if (!seguimiento.isEliminado()) {
                throw new IllegalArgumentException("El estudiante ya se encuentra en seguimiento");
            }
            anterior = seguimiento.getEstado();
            seguimiento.setEliminado(false);
            seguimiento.setRegistradoPor(usuarioDece);
        } else {
            seguimiento = new SeguimientoDece();
            seguimiento.setEstudiante(estudiante);
            seguimiento.setRegistradoPor(usuarioDece);
        }
        seguimiento.setFechaInicio(req.fechaInicio() == null ? LocalDate.now() : req.fechaInicio());
        seguimiento.setEstado(req.estado());
        seguimiento.setObservacion(limpiar(req.observacion()));
        seguimiento = seguimientos.saveAndFlush(seguimiento);
        registrarHistorial(seguimiento, anterior, req.estado(), seguimiento.getObservacion(), usuarioDece);
        return detalle(seguimiento.getId());
    }

    @Transactional
    public SeguimientoDeceDtos.SeguimientoResponse editar(Long idSeguimiento,
            SeguimientoDeceDtos.EditarRequest req, Authentication auth) {
        SeguimientoDece seguimiento = activo(idSeguimiento);
        Usuario usuarioDece = usuario(auth);
        SeguimientoDece.EstadoSeguimiento anterior = seguimiento.getEstado();
        seguimiento.setFechaInicio(req.fechaInicio());
        seguimiento.setEstado(req.estado());
        seguimiento.setObservacion(limpiar(req.observacion()));
        seguimientos.saveAndFlush(seguimiento);
        registrarHistorial(seguimiento, anterior, req.estado(), seguimiento.getObservacion(), usuarioDece);
        return detalle(idSeguimiento);
    }

    /** Eliminación lógica: el expediente desaparece del listado, pero su historial legal/auditable se conserva. */
    @Transactional
    public void eliminar(Long idSeguimiento, Authentication auth) {
        SeguimientoDece seguimiento = activo(idSeguimiento);
        Usuario usuarioDece = usuario(auth);
        SeguimientoDece.EstadoSeguimiento anterior = seguimiento.getEstado();
        seguimiento.setEstado(SeguimientoDece.EstadoSeguimiento.ARCHIVADO);
        seguimiento.setEliminado(true);
        seguimientos.save(seguimiento);
        registrarHistorial(seguimiento, anterior, SeguimientoDece.EstadoSeguimiento.ARCHIVADO,
                "Seguimiento eliminado y archivado", usuarioDece);
    }

    @Transactional(readOnly = true)
    public List<SeguimientoDeceDtos.HistorialResponse> historial(Long idSeguimiento) {
        exigirExiste(idSeguimiento);
        return historiales.findBySeguimientoIdOrderByCambiadoEnDesc(idSeguimiento).stream()
                .map(h -> new SeguimientoDeceDtos.HistorialResponse(
                        h.getId(), h.getEstadoAnterior() == null ? null : h.getEstadoAnterior().name(),
                        h.getEstadoNuevo().name(), h.getObservacion(), h.getCambiadoPor().nombreCompleto(),
                        h.getCambiadoEn()))
                .toList();
    }

    @Transactional
    public SeguimientoDeceDtos.MensajeHistorialResponse enviarMensaje(Long idSeguimiento,
            SeguimientoDeceDtos.EnviarMensajeRequest req, Authentication auth) {
        SeguimientoDece seguimiento = activo(idSeguimiento);
        Estudiante estudiante = seguimiento.getEstudiante();
        if (estudiante.getUsuario() == null || estudiante.getUsuario().getEstado() != Usuario.EstadoUsuario.ACTIVO) {
            throw new IllegalArgumentException("El estudiante no tiene una cuenta activa para recibir mensajes");
        }
        Long idDestinatario = estudiante.getUsuario().getId();
        MensajeDtos.MensajeResponse enviado = mensajeService.enviar(
                new MensajeDtos.EnviarMensajeRequest(List.of(idDestinatario), req.asunto().trim(), req.cuerpo().trim()), auth);
        Mensaje mensaje = mensajes.findById(enviado.idMensaje()).orElseThrow();

        SeguimientoDeceMensaje enlace = new SeguimientoDeceMensaje();
        enlace.setSeguimiento(seguimiento);
        enlace.setMensaje(mensaje);
        enlace.setIdDestinatario(idDestinatario);
        enlace.setEnviadoPor(usuario(auth));
        mensajesSeguimiento.save(enlace);
        notificacionService.crearGenerica(idDestinatario, Notificacion.TipoNotificacion.MENSAJE,
                "Tiene un nuevo mensaje de Consejería DECE: " + req.asunto().trim());
        return new SeguimientoDeceDtos.MensajeHistorialResponse(
                enviado.idMensaje(), enviado.asunto(), enviado.cuerpo(), enviado.remitente(),
                enviado.enviadoEn(), null, false);
    }

    @Transactional(readOnly = true)
    public List<SeguimientoDeceDtos.MensajeHistorialResponse> historialMensajes(Long idSeguimiento) {
        exigirExiste(idSeguimiento);
        return mensajesSeguimiento.historial(idSeguimiento).stream()
                .map(m -> new SeguimientoDeceDtos.MensajeHistorialResponse(
                        m.getIdMensaje(), m.getAsunto(), m.getCuerpo(), m.getRemitente(),
                        offset(m.getEnviadoEn()), offset(m.getLeidoEn()), m.getLeidoEn() != null))
                .toList();
    }

    private SeguimientoDece activo(Long id) {
        return seguimientos.findById(id).filter(s -> !s.isEliminado())
                .orElseThrow(() -> new NoSuchElementException("El seguimiento no existe"));
    }

    private void exigirExiste(Long id) {
        if (!seguimientos.existsById(id)) throw new NoSuchElementException("El seguimiento no existe");
    }

    private Usuario usuario(Authentication auth) {
        return usuarios.findByEmail(auth.getName()).orElseThrow();
    }

    private void registrarHistorial(SeguimientoDece seguimiento, SeguimientoDece.EstadoSeguimiento anterior,
                                    SeguimientoDece.EstadoSeguimiento nuevo, String observacion, Usuario usuario) {
        SeguimientoDeceHistorial h = new SeguimientoDeceHistorial();
        h.setSeguimiento(seguimiento);
        h.setEstadoAnterior(anterior);
        h.setEstadoNuevo(nuevo);
        h.setObservacion(observacion);
        h.setCambiadoPor(usuario);
        historiales.save(h);
    }

    private SeguimientoDeceDtos.SeguimientoResponse toResponse(SeguimientoDeceRepository.DetalleProjection p) {
        return new SeguimientoDeceDtos.SeguimientoResponse(
                p.getIdSeguimiento(), p.getIdEstudiante(), p.getCodigo(), p.getEstudiante(), p.getCedula(),
                p.getEmail(), p.getFechaNacimiento(), p.getGenero(), p.getTelefono(), p.getTipoSangre(),
                p.getCondicionMedica(), p.getContactoEmergencia(), p.getCurso(), p.getParalelo(),
                p.getPromedioGeneral(), p.getTotalCalificaciones(), p.getAusenciasInjustificadas(),
                p.getFechaInicio(), p.getEstado(), p.getObservacion(), p.getRegistradoPor(),
                offset(p.getCreadoEn()), offset(p.getActualizadoEn()));
    }

    private OffsetDateTime offset(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }

    private String limpiar(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }
}
