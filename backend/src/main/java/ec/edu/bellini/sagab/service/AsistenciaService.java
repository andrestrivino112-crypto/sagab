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
import java.util.stream.Collectors;

@Service
public class AsistenciaService {

    private final AsistenciaRepository asistencias;
    private final EstudianteRepository estudiantes;
    private final UsuarioRepository usuarios;
    private final EstudianteService estudianteService;

    public AsistenciaService(AsistenciaRepository a, EstudianteRepository e, UsuarioRepository u,
                             EstudianteService estudianteService) {
        this.asistencias = a; this.estudiantes = e; this.usuarios = u;
        this.estudianteService = estudianteService;
    }

    /**
     * Registro diario por paralelo (RF-04). Devuelve además los estudiantes
     * que acumulan 3+ ausencias injustificadas consecutivas (alerta DECE, RF-05).
     */
    @Transactional
    public Map<String, Object> registrar(AsistenciaDtos.RegistroDiarioRequest req, String emailDocente) {
        Long idUsuario = usuarios.findByEmail(emailDocente).orElseThrow().getId();
        LocalDate fecha = req.fecha() != null ? req.fecha() : LocalDate.now();

        var alertas = new ArrayList<Map<String, Object>>();
        for (AsistenciaDtos.MarcaRequest m : req.marcas()) {
            var est = estudiantes.findById(m.idEstudiante()).orElseThrow();
            Asistencia a = asistencias.findByIdParaleloAndFecha(req.idParalelo(), fecha).stream()
                    .filter(x -> x.getEstudiante().getId().equals(m.idEstudiante()))
                    .findFirst().orElseGet(Asistencia::new);
            a.setEstudiante(est);
            a.setIdParalelo(req.idParalelo());
            a.setFecha(fecha);
            a.setEstado(m.estado());
            a.setJustificacion(m.justificacion());
            a.setRegistradoPor(idUsuario);
            asistencias.save(a);

            if (m.estado() == Asistencia.EstadoAsistencia.AUSENCIA_INJUSTIFICADA) {
                long consecutivas = asistencias.contarAusenciasConsecutivas(m.idEstudiante());
                if (consecutivas >= 3) {
                    alertas.add(Map.of("idEstudiante", est.getId(),
                                       "estudiante", est.nombreCompleto(),
                                       "ausenciasConsecutivas", consecutivas));
                }
            }
        }
        return Map.of("fecha", fecha, "registrados", req.marcas().size(), "alertasDece", alertas);
    }

    @Transactional(readOnly = true)
    public List<Asistencia> porParalelo(Integer idParalelo, LocalDate fecha) {
        return asistencias.findByIdParaleloAndFecha(idParalelo, fecha != null ? fecha : LocalDate.now());
    }

    /** Ausencias injustificadas consecutivas de cada estudiante del paralelo (alerta DECE en la tabla de registro). */
    @Transactional(readOnly = true)
    public Map<Long, Long> consecutivasPorParalelo(Integer idParalelo) {
        return estudiantes.findByParaleloIdAndActivoTrueOrderByApellidosAscNombresAsc(idParalelo).stream()
                .collect(Collectors.toMap(Estudiante::getId, e -> asistencias.contarAusenciasConsecutivas(e.getId())));
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
}
