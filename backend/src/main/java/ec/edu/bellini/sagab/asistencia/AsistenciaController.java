package ec.edu.bellini.sagab.asistencia;

import ec.edu.bellini.sagab.entity.Asistencia;
import ec.edu.bellini.sagab.entity.Estudiante;
import ec.edu.bellini.sagab.estudiante.EstudianteService;
import ec.edu.bellini.sagab.repository.AsistenciaRepository;
import ec.edu.bellini.sagab.repository.EstudianteRepository;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/asistencia")
public class AsistenciaController {

    public record MarcaRequest(@NotNull Long idEstudiante,
                               @NotNull Asistencia.EstadoAsistencia estado,
                               String justificacion) {}
    public record RegistroDiarioRequest(@NotNull Integer idParalelo,
                                        LocalDate fecha,
                                        @NotEmpty List<MarcaRequest> marcas) {}
    public record RegistroResponse(LocalDate fecha, Asistencia.EstadoAsistencia estado, String justificacion) {}

    private final AsistenciaRepository asistencias;
    private final EstudianteRepository estudiantes;
    private final UsuarioRepository usuarios;
    private final EstudianteService estudianteService;

    public AsistenciaController(AsistenciaRepository a, EstudianteRepository e, UsuarioRepository u,
                                EstudianteService estudianteService) {
        this.asistencias = a; this.estudiantes = e; this.usuarios = u;
        this.estudianteService = estudianteService;
    }

    /**
     * Registro diario por paralelo (RF-04). Devuelve además los estudiantes
     * que acumulan 3+ ausencias injustificadas consecutivas (alerta DECE, RF-05).
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN')")
    @Transactional
    public Map<String, Object> registrar(@Valid @RequestBody RegistroDiarioRequest req, Authentication auth) {
        Long idUsuario = usuarios.findByEmail(auth.getName()).orElseThrow().getId();
        LocalDate fecha = req.fecha() != null ? req.fecha() : LocalDate.now();

        var alertas = new java.util.ArrayList<Map<String, Object>>();
        for (MarcaRequest m : req.marcas()) {
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

    @GetMapping("/paralelo/{idParalelo}")
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN')")
    public List<Asistencia> porParalelo(@PathVariable Integer idParalelo,
                                        @RequestParam(required = false) LocalDate fecha) {
        return asistencias.findByIdParaleloAndFecha(idParalelo,
                fecha != null ? fecha : LocalDate.now());
    }

    /** Ausencias injustificadas consecutivas de cada estudiante del paralelo (alerta DECE en la tabla de registro). */
    @GetMapping("/paralelo/{idParalelo}/consecutivas")
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN')")
    public Map<Long, Long> consecutivasPorParalelo(@PathVariable Integer idParalelo) {
        return estudiantes.findByParaleloIdAndActivoTrueOrderByApellidosAscNombresAsc(idParalelo).stream()
                .collect(Collectors.toMap(Estudiante::getId, e -> asistencias.contarAusenciasConsecutivas(e.getId())));
    }

    /** Historial de asistencia de un estudiante (últimos 6 meses por defecto) — Portal Familiar. */
    @GetMapping("/estudiante/{idEstudiante}")
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN','REPRESENTANTE')")
    public List<RegistroResponse> porEstudiante(@PathVariable Long idEstudiante,
                                                @RequestParam(required = false) LocalDate desde,
                                                @RequestParam(required = false) LocalDate hasta,
                                                Authentication auth) {
        if (!estudianteService.esPropio(idEstudiante, auth)) {
            throw new AccessDeniedException("No autorizado para consultar este estudiante");
        }
        LocalDate d = desde != null ? desde : LocalDate.now().minusMonths(6);
        LocalDate h = hasta != null ? hasta : LocalDate.now();
        return asistencias.findByEstudianteIdAndFechaBetweenOrderByFechaDesc(idEstudiante, d, h).stream()
                .map(a -> new RegistroResponse(a.getFecha(), a.getEstado(), a.getJustificacion()))
                .toList();
    }
}
