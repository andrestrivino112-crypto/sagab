package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.CalificacionDtos;

import ec.edu.bellini.sagab.model.AsignacionDocente;
import ec.edu.bellini.sagab.model.Calificacion;
import ec.edu.bellini.sagab.model.Docente;
import ec.edu.bellini.sagab.model.Estudiante;
import ec.edu.bellini.sagab.repository.AsignacionDocenteRepository;
import ec.edu.bellini.sagab.repository.CalificacionRepository;
import ec.edu.bellini.sagab.repository.DocenteRepository;
import ec.edu.bellini.sagab.repository.EstudianteRepository;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class CalificacionService {

    private static final BigDecimal NOTA_MINIMA_APROBACION = new BigDecimal("7.00");

    private final CalificacionRepository calificaciones;
    private final EstudianteRepository estudiantes;
    private final UsuarioRepository usuarios;
    private final AsignacionDocenteRepository asignaciones;
    private final DocenteRepository docentes;
    private final EstudianteService estudianteService;
    private final NotificacionService notificacionService;
    private final AsignacionDocenteService asignacionDocenteService;
    private final PapeletaPdfService papeletaPdfService;

    public CalificacionService(CalificacionRepository c, EstudianteRepository e, UsuarioRepository u,
                               AsignacionDocenteRepository asignaciones, DocenteRepository docentes,
                               EstudianteService estudianteService, NotificacionService notificacionService,
                               AsignacionDocenteService asignacionDocenteService, PapeletaPdfService papeletaPdfService) {
        this.calificaciones = c; this.estudiantes = e; this.usuarios = u;
        this.asignaciones = asignaciones; this.docentes = docentes; this.estudianteService = estudianteService;
        this.notificacionService = notificacionService;
        this.asignacionDocenteService = asignacionDocenteService;
        this.papeletaPdfService = papeletaPdfService;
    }

    /**
     * Ingreso masivo tipo tabla (RF-01). Idempotente: si la nota ya existe
     * para (estudiante, asignación, parcial) se actualiza; el historial de
     * cambios queda en auditoria.registro_cambio con el usuario y la fecha.
     */
    @Transactional
    public List<CalificacionDtos.NotaResponse> registrarMasivo(CalificacionDtos.RegistroMasivoRequest req,
                                                               Authentication auth) {
        AsignacionDocente asignacionDestino = asignaciones.findById(req.idAsignacion())
                .orElseThrow(() -> new NoSuchElementException("La asignación no existe"));
        asignacionDocenteService.exigirDueñoDeAsignacion(asignacionDestino, auth);

        Long idUsuario = usuarios.findByEmail(auth.getName()).orElseThrow().getId();

        List<Long> idsEstudiantes = req.notas().stream().map(CalificacionDtos.NotaRequest::idEstudiante).toList();

        Map<Long, Estudiante> estudiantesPorId = estudiantes.findAllById(idsEstudiantes).stream()
                .collect(Collectors.toMap(Estudiante::getId, Function.identity()));

        Map<Long, Calificacion> existentesPorEstudiante = calificaciones
                .findByIdAsignacionAndParcialAndEstudianteIdIn(req.idAsignacion(), req.parcial(), idsEstudiantes)
                .stream()
                .collect(Collectors.toMap(c -> c.getEstudiante().getId(), Function.identity()));

        List<Calificacion> paraGuardar = req.notas().stream().map(n -> {
            Estudiante est = estudiantesPorId.get(n.idEstudiante());
            if (est == null) {
                throw new IllegalArgumentException("Estudiante no existe: " + n.idEstudiante());
            }
            Calificacion cal = existentesPorEstudiante.getOrDefault(n.idEstudiante(), new Calificacion());
            cal.setEstudiante(est);
            cal.setIdAsignacion(req.idAsignacion());
            cal.setParcial(req.parcial());
            cal.setNotaTarea(n.notaTarea());
            cal.setNotaClase(n.notaClase());
            cal.setNotaExamen(n.notaExamen());
            cal.setObservacion(n.observacion());
            cal.setRegistradoPor(idUsuario);
            // La columna promedio es GENERATED en PostgreSQL (Calificacion.promedio es insertable=false/
            // updatable=false); la calculamos aquí con la misma fórmula para construir la respuesta sin
            // tener que volver a consultar la BD fila por fila.
            cal.setPromedio(calcularPromedio(n.notaTarea(), n.notaClase(), n.notaExamen()));
            return cal;
        }).toList();

        calificaciones.saveAll(paraGuardar);

        // Notificaciones automáticas por nota < 7 (todas las notas del request son de la misma
        // asignación, ya cargada arriba para el chequeo de propiedad).
        String materia = asignacionDestino.getMateria().getNombre();
        paraGuardar.forEach(cal -> notificacionService.notificarSiEnRiesgo(
                cal.getEstudiante(), materia, cal.getPromedio(), cal.getId()));

        return paraGuardar.stream().map(cal -> {
            BigDecimal prom = cal.getPromedio();
            return new CalificacionDtos.NotaResponse(
                    cal.getId(), cal.getEstudiante().getId(), cal.getEstudiante().nombreCompleto(),
                    cal.getNotaTarea(), cal.getNotaClase(), cal.getNotaExamen(),
                    prom, prom != null && prom.compareTo(NOTA_MINIMA_APROBACION) < 0);
        }).toList();
    }

    /** Replica en Java la fórmula GENERATED de sagab.calificacion.promedio (tarea 20% + clase 20% + examen 60%). */
    private static BigDecimal calcularPromedio(BigDecimal tarea, BigDecimal clase, BigDecimal examen) {
        if (tarea == null || clase == null || examen == null) {
            return null;
        }
        return tarea.multiply(new BigDecimal("0.20"))
                .add(clase.multiply(new BigDecimal("0.20")))
                .add(examen.multiply(new BigDecimal("0.60")))
                .setScale(2, RoundingMode.HALF_UP);
    }

    @Transactional(readOnly = true)
    public List<CalificacionDtos.NotaResponse> porAsignacion(Long idAsignacion, short parcial, Authentication auth) {
        AsignacionDocente asignacion = asignaciones.findById(idAsignacion)
                .orElseThrow(() -> new NoSuchElementException("La asignación no existe"));
        asignacionDocenteService.exigirDueñoDeAsignacion(asignacion, auth);
        return calificaciones.findByIdAsignacionAndParcial(idAsignacion, parcial).stream()
                .map(c -> new CalificacionDtos.NotaResponse(
                        c.getId(), c.getEstudiante().getId(), c.getEstudiante().nombreCompleto(),
                        c.getNotaTarea(), c.getNotaClase(), c.getNotaExamen(),
                        c.getPromedio(),
                        c.getPromedio() != null && c.getPromedio().compareTo(NOTA_MINIMA_APROBACION) < 0))
                .toList();
    }

    /**
     * Búsqueda avanzada por estudiante, curso, materia y/o parcial (RF-02).
     * ADMIN busca sin restricción; DOCENTE solo puede ver sus propias asignaciones.
     */
    @Transactional(readOnly = true)
    public List<CalificacionDtos.NotaBusquedaResponse> buscar(Long idEstudiante, Integer idParalelo,
            Integer idMateria, Short parcial, Authentication auth) {
        boolean esAdmin = auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ADMIN"))
                || auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"));
        Long idDocenteEfectivo = null;
        if (!esAdmin) {
            Docente propio = docentes.findByUsuarioEmail(auth.getName())
                    .orElseThrow(() -> new AccessDeniedException("No tiene un perfil de docente asociado"));
            idDocenteEfectivo = propio.getId();
        }
        return calificaciones.buscar(idEstudiante, idParalelo, idMateria, idDocenteEfectivo, parcial)
                .stream()
                .map(p -> new CalificacionDtos.NotaBusquedaResponse(
                        p.getIdCalificacion(), p.getIdEstudiante(), p.getEstudiante(), p.getCurso(),
                        p.getMateria(), p.getParcial(),
                        p.getNotaTarea(), p.getNotaClase(), p.getNotaExamen(), p.getPromedio(),
                        p.getPromedio() != null && p.getPromedio().compareTo(NOTA_MINIMA_APROBACION) < 0))
                .toList();
    }

    /** Genera la papeleta de calificaciones en PDF de un estudiante — botón "Generar Papeleta" de la búsqueda avanzada. */
    @Transactional(readOnly = true)
    public byte[] generarPapeleta(Long idEstudiante, Integer idPeriodo) {
        return papeletaPdfService.generar(idEstudiante, idPeriodo);
    }

    /** Elimina una calificación. ADMIN puede eliminar cualquiera; DOCENTE solo las de sus propias asignaciones. */
    @Transactional
    public void eliminar(Long idCalificacion, Authentication auth) {
        Calificacion cal = calificaciones.findById(idCalificacion)
                .orElseThrow(() -> new NoSuchElementException("La calificación no existe"));

        boolean esAdmin = auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ADMIN"))
                || auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"));
        if (!esAdmin) {
            AsignacionDocente asignacion = asignaciones.findById(cal.getIdAsignacion())
                    .orElseThrow(() -> new NoSuchElementException("La asignación de la calificación no existe"));
            if (!asignacion.getDocente().getUsuario().getEmail().equalsIgnoreCase(auth.getName())) {
                throw new AccessDeniedException("No puede eliminar calificaciones de otro docente");
            }
        }
        calificaciones.delete(cal);
    }

    /** Notas de un estudiante en todas sus materias — Portal Familiar. */
    @Transactional(readOnly = true)
    public List<CalificacionDtos.NotaEstudianteResponse> porEstudiante(Long idEstudiante, Authentication auth) {
        if (!estudianteService.esPropio(idEstudiante, auth)) {
            throw new AccessDeniedException("No autorizado para consultar este estudiante");
        }
        List<Calificacion> notas = calificaciones.findByEstudianteIdOrderByParcialAsc(idEstudiante);
        List<Long> idsAsignacion = notas.stream().map(Calificacion::getIdAsignacion).distinct().toList();
        Map<Long, AsignacionDocente> asignacionesPorId = asignaciones.findAllById(idsAsignacion).stream()
                .collect(Collectors.toMap(AsignacionDocente::getId, Function.identity()));

        return notas.stream()
                .map(c -> {
                    AsignacionDocente a = asignacionesPorId.get(c.getIdAsignacion());
                    String materia = a != null ? a.getMateria().getNombre() : "—";
                    return new CalificacionDtos.NotaEstudianteResponse(
                            c.getId(), materia, c.getParcial(),
                            c.getNotaTarea(), c.getNotaClase(), c.getNotaExamen(),
                            c.getPromedio(),
                            c.getPromedio() != null && c.getPromedio().compareTo(NOTA_MINIMA_APROBACION) < 0);
                }).toList();
    }
}
