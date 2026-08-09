package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.DashboardDtos;

import ec.edu.bellini.sagab.model.Asistencia;
import ec.edu.bellini.sagab.model.EventoCalendario;
import ec.edu.bellini.sagab.model.ObligacionPago;
import ec.edu.bellini.sagab.repository.AsistenciaRepository;
import ec.edu.bellini.sagab.repository.CalificacionRepository;
import ec.edu.bellini.sagab.repository.EstudianteRepository;
import ec.edu.bellini.sagab.repository.EventoCalendarioRepository;
import ec.edu.bellini.sagab.repository.MensajeDestinatarioRepository;
import ec.edu.bellini.sagab.repository.ObligacionPagoRepository;
import ec.edu.bellini.sagab.repository.PagoRepository;
import ec.edu.bellini.sagab.repository.PeriodoAcademicoRepository;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Service
public class DashboardService {

    private final CalificacionRepository calificaciones;
    private final AsistenciaRepository asistencias;
    private final ObligacionPagoRepository obligaciones;
    private final MensajeDestinatarioRepository destinatarios;
    private final UsuarioRepository usuarios;
    private final EstudianteRepository estudiantes;
    private final PeriodoAcademicoRepository periodos;
    private final PagoRepository pagos;
    private final EventoCalendarioRepository eventos;

    public DashboardService(CalificacionRepository calificaciones, AsistenciaRepository asistencias,
                            ObligacionPagoRepository obligaciones, MensajeDestinatarioRepository destinatarios,
                            UsuarioRepository usuarios, EstudianteRepository estudiantes,
                            PeriodoAcademicoRepository periodos, PagoRepository pagos,
                            EventoCalendarioRepository eventos) {
        this.calificaciones = calificaciones;
        this.asistencias = asistencias;
        this.obligaciones = obligaciones;
        this.destinatarios = destinatarios;
        this.usuarios = usuarios;
        this.estudiantes = estudiantes;
        this.periodos = periodos;
        this.pagos = pagos;
        this.eventos = eventos;
    }

    @Transactional(readOnly = true)
    public DashboardDtos.ResumenDashboard resumen(Authentication auth) {
        Long idUsuario = usuarios.findByEmail(auth.getName()).orElseThrow().getId();

        boolean soloDocente = auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_DOCENTE"))
                && !auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ADMIN"))
                && !auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"));
        long ausenciasHoy = soloDocente
                ? asistencias.countAusenciasDocenteFecha(LocalDate.now(), auth.getName())
                : asistencias.countByFechaAndEstadoIn(LocalDate.now(),
                    List.of(Asistencia.EstadoAsistencia.AUSENCIA_JUSTIFICADA,
                            Asistencia.EstadoAsistencia.AUSENCIA_INJUSTIFICADA));
        long estudiantesEnMora = soloDocente ? 0
                : obligaciones.contarEstudiantesPorEstado(ObligacionPago.EstadoPago.VENCIDO);
        long mensajesPendientes = soloDocente
                ? destinatarios.countNoLeidosDocenteDesdeAdmin(idUsuario)
                : destinatarios.countByIdDestinatarioAndLeidoEnIsNull(idUsuario);

        List<DashboardDtos.RendimientoParalelo> rendimiento = soloDocente ? List.of()
                : calificaciones.rendimientoPorParalelo().stream()
                    .map(p -> new DashboardDtos.RendimientoParalelo(p.getParalelo(), p.getPromedio()))
                    .toList();

        return new DashboardDtos.ResumenDashboard(
                soloDocente ? null : calificaciones.promedioInstitucional(), estudiantesEnMora,
                ausenciasHoy, mensajesPendientes, rendimiento);
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

    /** Inicio de Secretaría. Cada bloque usa una consulta agregada o un Pageable pequeño; los
     * listados completos se reservan para sus endpoints de drill-down. */
    @Transactional(readOnly = true)
    public DashboardDtos.ResumenAdministrativo administrativo(Authentication auth) {
        Long idUsuario = usuarios.findByEmail(auth.getName()).orElseThrow().getId();
        String anioLectivo = periodos.findFirstByActivoTrueOrderByFechaInicioDesc()
                .map(p -> p.getAnioLectivo()).orElse(null);

        long totalMatriculados = anioLectivo == null ? 0 : estudiantes.contarMatriculadosDelAnio(anioLectivo);
        var matriculasRecientes = anioLectivo == null ? List.<DashboardDtos.MatriculaReciente>of()
                : estudiantes.matriculasRecientesDelAnio(anioLectivo, PageRequest.of(0, 5)).stream()
                    .map(p -> new DashboardDtos.MatriculaReciente(
                            p.getIdEstudiante(), p.getCodigo(), p.getNombreCompleto(), p.getCurso(),
                            p.getParalelo(), p.getAnioLectivo(), p.getCreadoEn().atOffset(ZoneOffset.UTC)))
                    .toList();
        OffsetDateTime ahora = OffsetDateTime.now();
        var proximosEventos = eventos.proximosPublicados(
                        ahora, ahora.plusDays(45), EventoCalendario.Estado.PUBLICADO,
                        EventoCalendario.Estado.PROGRAMADO, PageRequest.of(0, 5)).stream()
                .map(e -> new DashboardDtos.EventoProximo(
                        e.getId(), e.getTitulo(), e.getInicio(), e.getFin(), e.getLugar(), e.getCategoria().name()))
                .toList();
        var mensajesRecientes = destinatarios.mensajesRecientes(idUsuario, PageRequest.of(0, 5)).stream()
                .map(m -> new DashboardDtos.MensajeReciente(
                        m.getIdMensaje(), m.getAsunto(), m.getRemitente(),
                        m.getEnviadoEn().atOffset(ZoneOffset.UTC), m.getLeido()))
                .toList();

        return new DashboardDtos.ResumenAdministrativo(
                anioLectivo, totalMatriculados, matriculasRecientes,
                pagos.countByEstadoRevision(ec.edu.bellini.sagab.model.Pago.EstadoRevision.EN_REVISION),
                obligaciones.contarEstudiantesConValoresPendientes(), proximosEventos,
                destinatarios.countByIdDestinatarioAndLeidoEnIsNull(idUsuario), mensajesRecientes);
    }

}
