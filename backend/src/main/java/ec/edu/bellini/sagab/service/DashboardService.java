package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.DashboardDtos;

import ec.edu.bellini.sagab.model.Asistencia;
import ec.edu.bellini.sagab.model.ObligacionPago;
import ec.edu.bellini.sagab.repository.AsistenciaRepository;
import ec.edu.bellini.sagab.repository.CalificacionRepository;
import ec.edu.bellini.sagab.repository.MensajeDestinatarioRepository;
import ec.edu.bellini.sagab.repository.ObligacionPagoRepository;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class DashboardService {

    private final CalificacionRepository calificaciones;
    private final AsistenciaRepository asistencias;
    private final ObligacionPagoRepository obligaciones;
    private final MensajeDestinatarioRepository destinatarios;
    private final UsuarioRepository usuarios;

    public DashboardService(CalificacionRepository calificaciones, AsistenciaRepository asistencias,
                            ObligacionPagoRepository obligaciones, MensajeDestinatarioRepository destinatarios,
                            UsuarioRepository usuarios) {
        this.calificaciones = calificaciones;
        this.asistencias = asistencias;
        this.obligaciones = obligaciones;
        this.destinatarios = destinatarios;
        this.usuarios = usuarios;
    }

    @Transactional(readOnly = true)
    public DashboardDtos.ResumenDashboard resumen(Authentication auth) {
        Long idUsuario = usuarios.findByEmail(auth.getName()).orElseThrow().getId();

        long ausenciasHoy = asistencias.countByFechaAndEstadoIn(LocalDate.now(),
                List.of(Asistencia.EstadoAsistencia.AUSENCIA_JUSTIFICADA, Asistencia.EstadoAsistencia.AUSENCIA_INJUSTIFICADA));
        long estudiantesEnMora = obligaciones.contarEstudiantesPorEstado(ObligacionPago.EstadoPago.VENCIDO);
        long mensajesPendientes = destinatarios.countByIdDestinatarioAndLeidoEnIsNull(idUsuario);

        List<DashboardDtos.RendimientoParalelo> rendimiento = calificaciones.rendimientoPorParalelo().stream()
                .map(p -> new DashboardDtos.RendimientoParalelo(p.getParalelo(), p.getPromedio()))
                .toList();

        return new DashboardDtos.ResumenDashboard(
                calificaciones.promedioInstitucional(), estudiantesEnMora, ausenciasHoy, mensajesPendientes, rendimiento);
    }

    /** Drill-down de la tarjeta "Promedio institucional": la misma agregación en varias dimensiones. */
    @Transactional(readOnly = true)
    public DashboardDtos.PromedioDetalle promedioDetalle() {
        return new DashboardDtos.PromedioDetalle(
                calificaciones.promedioInstitucional(),
                agrupar(calificaciones.promedioPorCurso()),
                agrupar(calificaciones.promedioPorParalelo()),
                agrupar(calificaciones.promedioPorMateria()),
                calificaciones.tendenciaPorAnioLectivo().stream()
                        .map(t -> new DashboardDtos.TendenciaAnual(t.getAnioLectivo(), t.getCurso(), t.getParalelo(), t.getPromedio(), t.getTotal()))
                        .toList());
    }

    private List<DashboardDtos.PromedioAgrupado> agrupar(List<CalificacionRepository.PromedioAgrupadoProjection> filas) {
        return filas.stream()
                .map(p -> new DashboardDtos.PromedioAgrupado(p.getEtiqueta(), p.getPromedio(), p.getTotal()))
                .toList();
    }
}
