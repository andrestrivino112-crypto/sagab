package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.MateriaDtos;
import ec.edu.bellini.sagab.model.AsignacionDocente;
import ec.edu.bellini.sagab.model.EntregaTarea;
import ec.edu.bellini.sagab.model.Estudiante;
import ec.edu.bellini.sagab.repository.AsignacionDocenteRepository;
import ec.edu.bellini.sagab.repository.EntregaTareaRepository;
import ec.edu.bellini.sagab.repository.EstudianteRepository;
import ec.edu.bellini.sagab.repository.PeriodoAcademicoRepository;
import ec.edu.bellini.sagab.model.PeriodoAcademico;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

/** Materias del estudiante en el período académico vigente — "Mis materias" del Portal Familiar. */
@Service
public class MateriaService {

    private final EstudianteRepository estudiantes;
    private final AsignacionDocenteRepository asignaciones;
    private final PeriodoAcademicoRepository periodos;
    private final EntregaTareaRepository entregas;
    private final EstudianteService estudianteService;

    public MateriaService(EstudianteRepository estudiantes, AsignacionDocenteRepository asignaciones,
                          PeriodoAcademicoRepository periodos, EntregaTareaRepository entregas,
                          EstudianteService estudianteService) {
        this.estudiantes = estudiantes;
        this.asignaciones = asignaciones;
        this.periodos = periodos;
        this.entregas = entregas;
        this.estudianteService = estudianteService;
    }

    /**
     * Materias del paralelo del estudiante en el período académico activo, con el porcentaje de
     * avance de deberes de cada una.
     * <p>
     * <b>porcentajeAvance</b> = (entregas en estado REVISADO del estudiante para esa asignación)
     * / (total de entregas del estudiante para esa asignación) × 100, redondeado al entero más
     * cercano. Si el estudiante todavía no tiene ninguna entrega registrada en la asignación
     * (total = 0), el porcentaje es 0 — nunca se divide por cero.
     */
    @Transactional(readOnly = true)
    public List<MateriaDtos.MateriaEstudianteResponse> porEstudiante(Long idEstudiante, Authentication auth) {
        if (!estudianteService.esPropio(idEstudiante, auth)) {
            throw new AccessDeniedException("No autorizado para consultar este estudiante");
        }
        Estudiante estudiante = estudiantes.findById(idEstudiante)
                .orElseThrow(() -> new NoSuchElementException("El estudiante no existe"));
        if (estudiante.getParalelo() == null) {
            return List.of();
        }

        Integer idPeriodoActivo = periodos.findFirstByActivoTrueOrderByFechaInicioDesc()
                .map(PeriodoAcademico::getId)
                .orElse(null);
        if (idPeriodoActivo == null) {
            return List.of();
        }

        List<AsignacionDocente> asignacionesDelParalelo =
                asignaciones.findByParaleloIdAndPeriodoId(estudiante.getParalelo().getId(), idPeriodoActivo);

        Map<Long, int[]> conteoPorAsignacion = new HashMap<>(); // idAsignacion -> {total, revisadas}
        for (EntregaTarea e : entregas.findByEstudianteIdOrderByFechaEntregaDesc(idEstudiante)) {
            Long idAsignacion = e.getTarea().getAsignacion().getId();
            int[] conteo = conteoPorAsignacion.computeIfAbsent(idAsignacion, k -> new int[2]);
            conteo[0]++; // total
            if (e.getEstado() == EntregaTarea.EstadoEntrega.REVISADO) {
                conteo[1]++; // revisadas
            }
        }

        return asignacionesDelParalelo.stream().map(a -> {
            int[] conteo = conteoPorAsignacion.getOrDefault(a.getId(), new int[2]);
            int porcentaje = conteo[0] == 0 ? 0 : Math.round(conteo[1] * 100f / conteo[0]);
            return new MateriaDtos.MateriaEstudianteResponse(
                    a.getMateria().getId(), a.getMateria().getCodigo(), a.getMateria().getNombre(),
                    a.getMateria().getArea(), a.getId(), a.getDocente().getUsuario().nombreCompleto(),
                    porcentaje);
        }).toList();
    }
}
