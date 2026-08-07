package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.AsistenciaDtos;
import ec.edu.bellini.sagab.model.Asistencia;
import ec.edu.bellini.sagab.model.Estudiante;
import ec.edu.bellini.sagab.repository.AsistenciaRepository;
import ec.edu.bellini.sagab.repository.EstudianteRepository;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

@Service
public class AsistenciaService {

    private final AsistenciaRepository asistencias;
    private final EstudianteRepository estudiantes;
    private final UsuarioRepository usuarios;
    private final EstudianteService estudianteService;
    private final AsignacionDocenteService asignacionDocenteService;

    public AsistenciaService(AsistenciaRepository a, EstudianteRepository e, UsuarioRepository u,
                             EstudianteService estudianteService, AsignacionDocenteService asignacionDocenteService) {
        this.asistencias = a; this.estudiantes = e; this.usuarios = u;
        this.estudianteService = estudianteService;
        this.asignacionDocenteService = asignacionDocenteService;
    }

    /**
     * Registro diario por paralelo (RF-04). Devuelve además los estudiantes
     * que acumulan 3+ ausencias injustificadas consecutivas (alerta DECE, RF-05).
     */
    @Transactional
    public Map<String, Object> registrar(AsistenciaDtos.RegistroDiarioRequest req, Authentication auth) {
        asignacionDocenteService.exigirDocenteDelParalelo(req.idParalelo(), auth);
        Long idUsuario = usuarios.findByEmail(auth.getName()).orElseThrow().getId();
        LocalDate fecha = req.fecha() != null ? req.fecha() : LocalDate.now();

        List<Long> idsEstudiantes = req.marcas().stream().map(AsistenciaDtos.MarcaRequest::idEstudiante).toList();
        Map<Long, Estudiante> estudiantesPorId = estudiantes.findAllById(idsEstudiantes).stream()
                .collect(Collectors.toMap(Estudiante::getId, e -> e));
        Map<Long, Asistencia> existentesPorEstudiante = asistencias.findByIdParaleloAndFecha(req.idParalelo(), fecha)
                .stream()
                .collect(Collectors.toMap(x -> x.getEstudiante().getId(), x -> x));

        var alertas = new ArrayList<Map<String, Object>>();
        List<Asistencia> paraGuardar = new ArrayList<>();
        for (AsistenciaDtos.MarcaRequest m : req.marcas()) {
            Estudiante est = estudiantesPorId.get(m.idEstudiante());
            if (est == null) {
                throw new NoSuchElementException("Estudiante no existe: " + m.idEstudiante());
            }
            Asistencia a = existentesPorEstudiante.getOrDefault(m.idEstudiante(), new Asistencia());
            a.setEstudiante(est);
            a.setIdParalelo(req.idParalelo());
            a.setFecha(fecha);
            a.setEstado(m.estado());
            a.setJustificacion(m.justificacion());
            a.setRegistradoPor(idUsuario);
            paraGuardar.add(a);
        }
        asistencias.saveAll(paraGuardar);

        for (AsistenciaDtos.MarcaRequest m : req.marcas()) {
            if (m.estado() == Asistencia.EstadoAsistencia.AUSENCIA_INJUSTIFICADA) {
                long consecutivas = asistencias.contarAusenciasConsecutivas(m.idEstudiante());
                if (consecutivas >= 3) {
                    Estudiante est = estudiantesPorId.get(m.idEstudiante());
                    alertas.add(Map.of("idEstudiante", est.getId(),
                                       "estudiante", est.nombreCompleto(),
                                       "ausenciasConsecutivas", consecutivas));
                }
            }
        }
        return Map.of("fecha", fecha, "registrados", req.marcas().size(), "alertasDece", alertas);
    }

    /** Registro de un paralelo en una fecha, con el nombre del estudiante ya resuelto (evita entidades lazy en la respuesta). */
    @Transactional(readOnly = true)
    public List<AsistenciaDtos.RegistroParaleloResponse> porParalelo(Integer idParalelo, LocalDate fecha, Authentication auth) {
        asignacionDocenteService.exigirDocenteDelParalelo(idParalelo, auth);
        List<Asistencia> registros = asistencias.findByIdParaleloAndFecha(idParalelo, fecha != null ? fecha : LocalDate.now());
        List<Long> idsEstudiantes = registros.stream().map(a -> a.getEstudiante().getId()).distinct().toList();
        Map<Long, Estudiante> estudiantesPorId = estudiantes.findAllById(idsEstudiantes).stream()
                .collect(Collectors.toMap(Estudiante::getId, e -> e));

        return registros.stream()
                .map(a -> new AsistenciaDtos.RegistroParaleloResponse(
                        a.getEstudiante().getId(), estudiantesPorId.get(a.getEstudiante().getId()).nombreCompleto(),
                        a.getEstado(), a.getJustificacion()))
                .toList();
    }

    /** Ausencias injustificadas consecutivas de cada estudiante del paralelo (alerta DECE en la tabla de registro). */
    @Transactional(readOnly = true)
    public Map<Long, Long> consecutivasPorParalelo(Integer idParalelo, Authentication auth) {
        asignacionDocenteService.exigirDocenteDelParalelo(idParalelo, auth);
        return asistencias.contarAusenciasConsecutivasPorParalelo(idParalelo).stream()
                .collect(Collectors.toMap(
                        AsistenciaRepository.AusenciasConsecutivasProjection::getIdEstudiante,
                        AsistenciaRepository.AusenciasConsecutivasProjection::getConsecutivas));
    }

    /** Historial de asistencia de un estudiante (últimos 6 meses por defecto) — Portal Familiar. */
    @Transactional(readOnly = true)
    public List<AsistenciaDtos.RegistroResponse> porEstudiante(Long idEstudiante, LocalDate desde, LocalDate hasta,
                                                                Authentication auth) {
        if (!estudianteService.esPropio(idEstudiante, auth)) {
            throw new AccessDeniedException("No autorizado para consultar este estudiante");
        }
        LocalDate d = desde != null ? desde : LocalDate.now().minusMonths(6);
        LocalDate h = hasta != null ? hasta : LocalDate.now();
        return asistencias.findByEstudianteIdAndFechaBetweenOrderByFechaDesc(idEstudiante, d, h).stream()
                .map(a -> new AsistenciaDtos.RegistroResponse(a.getFecha(), a.getEstado(), a.getJustificacion()))
                .toList();
    }

    /** Drill-down "Ausencias" del Dashboard — mismos roles que ya ven el KPI (institucional, no
     * acotado al paralelo del docente que consulta, a diferencia de porParalelo()). */
    @Transactional(readOnly = true)
    public List<AsistenciaDtos.ReporteAusenciaResponse> reporteAusencias(LocalDate desde, LocalDate hasta,
                                                                          Integer idParalelo, String curso) {
        return asistencias.reporteAusencias(desde, hasta, idParalelo, curso).stream()
                .map(p -> new AsistenciaDtos.ReporteAusenciaResponse(
                        p.getIdAsistencia(), p.getIdEstudiante(), p.getEstudiante(), p.getCurso(), p.getParalelo(),
                        p.getFecha(), p.getEstado(), p.getJustificacion(), p.getRegistradoPor()))
                .toList();
    }
}
