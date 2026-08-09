package ec.edu.bellini.sagab.controller;

import ec.edu.bellini.sagab.dto.RecursoAcademicoDtos;
import ec.edu.bellini.sagab.model.RecursoAcademico;
import ec.edu.bellini.sagab.service.RecursoAcademicoService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/recursos-academicos")
@Validated
public class RecursoAcademicoController {

    private final RecursoAcademicoService service;

    public RecursoAcademicoController(RecursoAcademicoService service) { this.service = service; }

    /** Sílabo, formatos y link de clase de una asignación — "Información Académica" del Portal Familiar. */
    @GetMapping("/asignacion/{idAsignacion}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN','DOCENTE','REPRESENTANTE','ESTUDIANTE')")
    public List<RecursoAcademicoDtos.RecursoResponse> porAsignacion(@PathVariable Long idAsignacion,
            @RequestParam(required = false) Long idEstudiante, Authentication auth) {
        return service.porAsignacion(idAsignacion, idEstudiante, auth);
    }

    /** Sube el sílabo, un formato, o material de clase (PDF/Word/PPT/Excel/ZIP/RAR/imagen/video/audio
     * si tipo=MATERIAL) — exclusivo del docente dueño de la asignación. */
    @PostMapping(value = "/archivo", consumes = "multipart/form-data")
    @PreAuthorize("hasRole('DOCENTE')")
    public RecursoAcademicoDtos.RecursoResponse subirArchivo(
            @RequestParam Long idAsignacion,
            @RequestParam RecursoAcademico.TipoRecurso tipo,
            @RequestParam @NotBlank @Size(max = 150) String nombre,
            @RequestParam(required = false) @Size(max = 500) String descripcion,
            @RequestParam(required = false) @Min(1) @Max(52) Short semana,
            @RequestParam(required = false) java.time.OffsetDateTime fechaLimite,
            @RequestParam("archivo") MultipartFile archivo,
            Authentication auth) {
        return service.subirArchivo(idAsignacion, tipo, nombre, descripcion, semana, fechaLimite, archivo, auth);
    }

    /** Publica el link de la clase virtual (o un enlace de la semana) — exclusivo del docente dueño. */
    @PostMapping("/link")
    @PreAuthorize("hasRole('DOCENTE')")
    public RecursoAcademicoDtos.RecursoResponse crearLink(@Valid @RequestBody RecursoAcademicoDtos.CrearLinkRequest req,
            Authentication auth) {
        return service.crearLink(req, auth);
    }

    /** Edita nombre/descripción/semana de un recurso ya publicado — exclusivo del docente dueño. */
    @PatchMapping("/{idRecurso}")
    @PreAuthorize("hasRole('DOCENTE')")
    public RecursoAcademicoDtos.RecursoResponse editar(@PathVariable Long idRecurso,
            @Valid @RequestBody RecursoAcademicoDtos.EditarRecursoRequest req, Authentication auth) {
        return service.editar(idRecurso, req, auth);
    }

    /** Elimina un recurso (y su archivo en el bucket, si tenía) — exclusivo del docente dueño. */
    @DeleteMapping("/{idRecurso}")
    @PreAuthorize("hasRole('DOCENTE')")
    public void eliminar(@PathVariable Long idRecurso, Authentication auth) {
        service.eliminar(idRecurso, auth);
    }

    /** URL de descarga temporal de un sílabo/formato/material (no aplica a LINK_CLASE). */
    @GetMapping("/{idRecurso}/descarga")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN','DOCENTE','REPRESENTANTE','ESTUDIANTE')")
    public ResponseEntity<Map<String, String>> urlDescarga(@PathVariable Long idRecurso,
            @RequestParam(required = false) Long idEstudiante, Authentication auth) {
        return ResponseEntity.ok(Map.of("url", service.urlDescarga(idRecurso, idEstudiante, auth)));
    }
}
