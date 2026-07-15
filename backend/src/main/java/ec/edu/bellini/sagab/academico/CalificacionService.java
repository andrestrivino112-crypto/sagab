package ec.edu.bellini.sagab.academico;

import ec.edu.bellini.sagab.entity.AsignacionDocente;
import ec.edu.bellini.sagab.entity.Calificacion;
import ec.edu.bellini.sagab.entity.Estudiante;
import ec.edu.bellini.sagab.estudiante.EstudianteService;
import ec.edu.bellini.sagab.repository.AsignacionDocenteRepository;
import ec.edu.bellini.sagab.repository.CalificacionRepository;
import ec.edu.bellini.sagab.repository.EstudianteRepository;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
public class CalificacionService {

    private static final BigDecimal NOTA_MINIMA_APROBACION = new BigDecimal("7.00");

    private final CalificacionRepository calificaciones;
    private final EstudianteRepository estudiantes;
    private final UsuarioRepository usuarios;
    private final AsignacionDocenteRepository asignaciones;
    private final EstudianteService estudianteService;

    public CalificacionService(CalificacionRepository c, EstudianteRepository e, UsuarioRepository u,
                               AsignacionDocenteRepository asignaciones, EstudianteService estudianteService) {
        this.calificaciones = c; this.estudiantes = e; this.usuarios = u;
        this.asignaciones = asignaciones; this.estudianteService = estudianteService;
    }

    /**
     * Ingreso masivo tipo tabla (RF-01). Idempotente: si la nota ya existe
     * para (estudiante, asignación, parcial) se actualiza; el historial de
     * cambios queda en auditoria.registro_cambio con el usuario y la fecha.
     */
    @Transactional
    public List<CalificacionDtos.NotaResponse> registrarMasivo(CalificacionDtos.RegistroMasivoRequest req,
                                                               String emailDocente) {
        Long idUsuario = usuarios.findByEmail(emailDocente).orElseThrow().getId();

        return req.notas().stream().map(n -> {
            Estudiante est = estudiantes.findById(n.idEstudiante())
                    .orElseThrow(() -> new IllegalArgumentException("Estudiante no existe: " + n.idEstudiante()));

            Calificacion cal = calificaciones
                    .findByEstudianteIdAndIdAsignacionAndParcial(n.idEstudiante(), req.idAsignacion(), req.parcial())
                    .orElseGet(Calificacion::new);

            cal.setEstudiante(est);
            cal.setIdAsignacion(req.idAsignacion());
            cal.setParcial(req.parcial());
            cal.setNotaTarea(n.notaTarea());
            cal.setNotaClase(n.notaClase());
            cal.setNotaExamen(n.notaExamen());
            cal.setObservacion(n.observacion());
            cal.setRegistradoPor(idUsuario);
            cal = calificaciones.saveAndFlush(cal);
            // saveAndFlush no relee columnas GENERATED de la BD hacia la entidad en memoria;
            // se vuelve a cargar para que el promedio calculado viaje en la respuesta.
            cal = calificaciones.findById(cal.getId()).orElseThrow();

            BigDecimal prom = cal.getPromedio();
            return new CalificacionDtos.NotaResponse(
                    cal.getId(), est.getId(), est.nombreCompleto(),
                    cal.getNotaTarea(), cal.getNotaClase(), cal.getNotaExamen(),
                    prom, prom != null && prom.compareTo(NOTA_MINIMA_APROBACION) < 0);
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<CalificacionDtos.NotaResponse> porAsignacion(Long idAsignacion, short parcial) {
        return calificaciones.findByIdAsignacionAndParcial(idAsignacion, parcial).stream()
                .map(c -> new CalificacionDtos.NotaResponse(
                        c.getId(), c.getEstudiante().getId(), c.getEstudiante().nombreCompleto(),
                        c.getNotaTarea(), c.getNotaClase(), c.getNotaExamen(),
                        c.getPromedio(),
                        c.getPromedio() != null && c.getPromedio().compareTo(NOTA_MINIMA_APROBACION) < 0))
                .toList();
    }

    /** Notas de un estudiante en todas sus materias — Portal Familiar. */
    @Transactional(readOnly = true)
    public List<CalificacionDtos.NotaEstudianteResponse> porEstudiante(Long idEstudiante, Authentication auth) {
        if (!estudianteService.esPropio(idEstudiante, auth)) {
            throw new AccessDeniedException("No autorizado para consultar este estudiante");
        }
        return calificaciones.findByEstudianteIdOrderByParcialAsc(idEstudiante).stream()
                .map(c -> {
                    AsignacionDocente a = asignaciones.findById(c.getIdAsignacion()).orElse(null);
                    String materia = a != null ? a.getMateria().getNombre() : "—";
                    return new CalificacionDtos.NotaEstudianteResponse(
                            c.getId(), materia, c.getParcial(),
                            c.getNotaTarea(), c.getNotaClase(), c.getNotaExamen(),
                            c.getPromedio(),
                            c.getPromedio() != null && c.getPromedio().compareTo(NOTA_MINIMA_APROBACION) < 0);
                }).toList();
    }
}
