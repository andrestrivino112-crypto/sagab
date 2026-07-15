package ec.edu.bellini.sagab.academico;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/calificaciones")
public class CalificacionController {

    private final CalificacionService service;

    public CalificacionController(CalificacionService service) { this.service = service; }

    /** Ingreso/edición masiva de notas — solo DOCENTE y ADMIN. */
    @PostMapping
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN')")
    public List<CalificacionDtos.NotaResponse> registrar(
            @Valid @RequestBody CalificacionDtos.RegistroMasivoRequest req,
            Authentication auth) {
        return service.registrarMasivo(req, auth.getName());
    }

    /** Consulta por asignación y parcial (docentes, dirección). */
    @GetMapping("/asignacion/{idAsignacion}/parcial/{parcial}")
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN')")
    public List<CalificacionDtos.NotaResponse> porAsignacion(
            @PathVariable Long idAsignacion, @PathVariable short parcial) {
        return service.porAsignacion(idAsignacion, parcial);
    }

    /** Notas de un estudiante en todas sus materias — Portal Familiar. */
    @GetMapping("/estudiante/{idEstudiante}")
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN','REPRESENTANTE')")
    public List<CalificacionDtos.NotaEstudianteResponse> porEstudiante(
            @PathVariable Long idEstudiante, Authentication auth) {
        return service.porEstudiante(idEstudiante, auth);
    }

    /** Búsqueda avanzada por estudiante, curso, materia, período y/o docente. */
    @GetMapping("/buscar")
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN')")
    public List<CalificacionDtos.NotaBusquedaResponse> buscar(
            @RequestParam(required = false) Long idEstudiante,
            @RequestParam(required = false) Integer idParalelo,
            @RequestParam(required = false) Integer idMateria,
            @RequestParam(required = false) Integer idPeriodo,
            @RequestParam(required = false) Long idDocente,
            @RequestParam(required = false) Short parcial,
            Authentication auth) {
        return service.buscar(idEstudiante, idParalelo, idMateria, idPeriodo, idDocente, parcial, auth);
    }

    /** Elimina una calificación — DOCENTE solo las propias, ADMIN cualquiera. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN')")
    public ResponseEntity<Void> eliminar(@PathVariable Long id, Authentication auth) {
        service.eliminar(id, auth);
        return ResponseEntity.noContent().build();
    }
}
