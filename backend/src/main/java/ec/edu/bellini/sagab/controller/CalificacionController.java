package ec.edu.bellini.sagab.controller;

import ec.edu.bellini.sagab.dto.CalificacionDtos;
import ec.edu.bellini.sagab.service.CalificacionService;

import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
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
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN','SUPER_ADMIN')")
    public List<CalificacionDtos.NotaResponse> registrar(
            @Valid @RequestBody CalificacionDtos.RegistroMasivoRequest req,
            Authentication auth) {
        return service.registrarMasivo(req, auth);
    }

    /** Consulta por asignación y parcial — DOCENTE solo la suya, ADMIN cualquiera. */
    @GetMapping("/asignacion/{idAsignacion}/parcial/{parcial}")
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN','SUPER_ADMIN')")
    public List<CalificacionDtos.NotaResponse> porAsignacion(
            @PathVariable Long idAsignacion, @PathVariable short parcial, Authentication auth) {
        return service.porAsignacion(idAsignacion, parcial, auth);
    }

    /** Notas de un estudiante en todas sus materias — Portal Familiar. */
    @GetMapping("/estudiante/{idEstudiante}")
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN','SUPER_ADMIN','REPRESENTANTE','ESTUDIANTE')")
    public List<CalificacionDtos.NotaEstudianteResponse> porEstudiante(
            @PathVariable Long idEstudiante, Authentication auth) {
        return service.porEstudiante(idEstudiante, auth);
    }

    /** Búsqueda avanzada por estudiante, curso, materia y/o parcial. */
    @GetMapping("/buscar")
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN','SUPER_ADMIN')")
    public List<CalificacionDtos.NotaBusquedaResponse> buscar(
            @RequestParam(required = false) Long idEstudiante,
            @RequestParam(required = false) Integer idParalelo,
            @RequestParam(required = false) Integer idMateria,
            @RequestParam(required = false) Short parcial,
            Authentication auth) {
        return service.buscar(idEstudiante, idParalelo, idMateria, parcial, auth);
    }

    /** Papeleta de calificaciones en PDF de un estudiante — botón "Generar Papeleta" de la búsqueda avanzada. */
    @GetMapping("/{idEstudiante}/papeleta")
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN','SUPER_ADMIN')")
    public ResponseEntity<byte[]> papeleta(@PathVariable Long idEstudiante,
            @RequestParam(required = false) Integer idPeriodo) {
        byte[] pdf = service.generarPapeleta(idEstudiante, idPeriodo);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"papeleta-" + idEstudiante + ".pdf\"")
                .body(pdf);
    }

    /** Elimina una calificación — DOCENTE solo las propias, ADMIN cualquiera. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN','SUPER_ADMIN')")
    public ResponseEntity<Void> eliminar(@PathVariable Long id, Authentication auth) {
        service.eliminar(id, auth);
        return ResponseEntity.noContent().build();
    }
}
