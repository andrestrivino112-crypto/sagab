package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.NotificacionDtos;
import ec.edu.bellini.sagab.model.Estudiante;
import ec.edu.bellini.sagab.model.Notificacion;
import ec.edu.bellini.sagab.repository.NotificacionRepository;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.NoSuchElementException;

/**
 * Notificaciones automáticas dentro de la aplicación. Hoy solo se disparan por calificación
 * baja (&lt; 7/10), desde CalificacionService justo después de guardar la nota — sin
 * intervención del administrador, como pide el requerimiento.
 */
@Service
public class NotificacionService {

    private static final BigDecimal NOTA_MINIMA_APROBACION = new BigDecimal("7.00");
    /** Tope de notificaciones propias: sin paginación en el frontend, se acota en el servidor
     * (ver INFORME_AUDITORIA_FUNCIONAL.md, BE-16). */
    private static final int MAX_NOTIFICACIONES = 100;

    private final NotificacionRepository notificaciones;
    private final UsuarioRepository usuarios;

    public NotificacionService(NotificacionRepository notificaciones, UsuarioRepository usuarios) {
        this.notificaciones = notificaciones;
        this.usuarios = usuarios;
    }

    /** No hace nada si el promedio es null o &gt;= 7: no hay nada que notificar. */
    @Transactional
    public void notificarSiEnRiesgo(Estudiante estudiante, String materia, BigDecimal promedio, Long idCalificacion) {
        if (promedio == null || promedio.compareTo(NOTA_MINIMA_APROBACION) >= 0) {
            return;
        }
        if (estudiante.getUsuario() != null) {
            String mensaje = "Obtuviste una calificación de " + promedio + " en " + materia +
                    ". Debes mejorar tu rendimiento académico.";
            crear(estudiante.getUsuario().getId(), Notificacion.TipoNotificacion.CALIFICACION, materia, promedio, mensaje, idCalificacion);
        }
        if (estudiante.getRepresentante() != null) {
            String mensaje = "Su representado/a " + estudiante.nombreCompleto() + " obtuvo una calificación de " +
                    promedio + " en " + materia + ". Debe mejorar su rendimiento académico.";
            crear(estudiante.getRepresentante().getUsuario().getId(), Notificacion.TipoNotificacion.CALIFICACION, materia, promedio, mensaje, idCalificacion);
        }
    }

    /**
     * Notificación no académica (p. ej. recordatorios de pago) — reutiliza la misma tabla/entidad
     * que las alertas de calificación, sin materia/calificación/id de calificación asociados.
     */
    @Transactional
    public void crearGenerica(Long idDestinatario, Notificacion.TipoNotificacion tipo, String mensaje) {
        crear(idDestinatario, tipo, null, null, mensaje, null);
    }

    private void crear(Long idDestinatario, Notificacion.TipoNotificacion tipo, String materia,
                        BigDecimal calificacion, String mensaje, Long idCalificacion) {
        Notificacion n = new Notificacion();
        n.setIdDestinatario(idDestinatario);
        n.setIdCalificacion(idCalificacion);
        n.setTipo(tipo);
        n.setMateria(materia);
        n.setCalificacion(calificacion);
        n.setMensaje(mensaje);
        notificaciones.save(n);
    }

    @Transactional(readOnly = true)
    public List<NotificacionDtos.NotificacionResponse> mias(Authentication auth) {
        Long idUsuario = usuarios.findByEmail(auth.getName()).orElseThrow().getId();
        return notificaciones.findByIdDestinatarioOrderByCreadoEnDesc(idUsuario, PageRequest.of(0, MAX_NOTIFICACIONES)).stream()
                .map(n -> new NotificacionDtos.NotificacionResponse(
                        n.getId(), n.getTipo().name(), n.getMateria(), n.getCalificacion(), n.getMensaje(),
                        n.getCreadoEn(), n.getLeidoEn() != null))
                .toList();
    }

    @Transactional
    public void marcarLeida(Long idNotificacion, Authentication auth) {
        Long idUsuario = usuarios.findByEmail(auth.getName()).orElseThrow().getId();
        int actualizadas = notificaciones.marcarLeida(idNotificacion, idUsuario, OffsetDateTime.now());
        if (actualizadas == 0) {
            throw new NoSuchElementException("La notificación no existe, no le pertenece, o ya estaba leída");
        }
    }
}
