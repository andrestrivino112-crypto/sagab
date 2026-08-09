package ec.edu.bellini.sagab.controller;

import ec.edu.bellini.sagab.dto.TareaDtos;
import ec.edu.bellini.sagab.service.TareaService;

import jakarta.validation.Valid;
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
@RequestMapping("/api/tareas")
@Validated
public class TareaController {

    private final TareaService service;

    public TareaController(TareaService service) { this.service = service; }

    /** Publicar un deber es exclusivo del docente — el admin solo puede ver (ver los demás endpoints). */
    @PostMapping
    @PreAuthorize("hasRole('DOCENTE')")
    public TareaDtos.TareaResponse crear(@Valid @RequestBody TareaDtos.CrearTareaRequest req, Authentication auth) {
        return service.crear(req, auth);
    }

    /** Editar (título, descripción, fecha límite, parcial, puntaje) es exclusivo del docente dueño. */
    @PutMapping("/{idTarea}")
    @PreAuthorize("hasRole('DOCENTE')")
    public TareaDtos.TareaResponse editar(@PathVariable Long idTarea,
            @Valid @RequestBody TareaDtos.EditarTareaRequest req, Authentication auth) {
        return service.editar(idTarea, req, auth);
    }

    /** Solo se puede eliminar un deber sin entregas subidas ni calificadas (ver TareaService.eliminar). */
    @DeleteMapping("/{idTarea}")
    @PreAuthorize("hasRole('DOCENTE')")
    public void eliminar(@PathVariable Long idTarea, Authentication auth) {
        service.eliminar(idTarea, auth);
    }

    @GetMapping("/asignacion/{idAsignacion}")
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN','SUPER_ADMIN')")
    public List<TareaDtos.TareaResponse> porAsignacion(@PathVariable Long idAsignacion, Authentication auth) {
        return service.porAsignacion(idAsignacion, auth);
    }

    /** Entregas de todos los estudiantes para una tarea — el docente las revisa aquí. */
    @GetMapping("/{idTarea}/entregas")
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN','SUPER_ADMIN')")
    public List<TareaDtos.EntregaResponse> entregasDeTarea(@PathVariable Long idTarea, Authentication auth) {
        return service.entregasDeTarea(idTarea, auth);
    }

    /** Entregas de un estudiante en concreto — Portal Familiar. */
    @GetMapping("/estudiante/{idEstudiante}")
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN','SUPER_ADMIN','REPRESENTANTE','ESTUDIANTE')")
    public List<TareaDtos.EntregaResponse> misEntregas(@PathVariable Long idEstudiante, Authentication auth) {
        return service.misEntregas(idEstudiante, auth);
    }

    /** Sube el archivo de la entrega — el propio estudiante o su representante (mismo rol "familiar"). */
    @PostMapping(value = "/{idTarea}/estudiante/{idEstudiante}/entrega", consumes = "multipart/form-data")
    @PreAuthorize("hasAnyRole('REPRESENTANTE','ESTUDIANTE')")
    public TareaDtos.EntregaResponse subirEntrega(@PathVariable Long idTarea, @PathVariable Long idEstudiante,
                                                   @RequestParam("archivo") MultipartFile archivo, Authentication auth) {
        return service.subirEntrega(idTarea, idEstudiante, archivo, auth);
    }

    /** Revisar/calificar una entrega es exclusivo del docente — mismo criterio que publicar el deber. */
    @PostMapping("/entregas/{idEntrega}/revisar")
    @PreAuthorize("hasRole('DOCENTE')")
    public TareaDtos.EntregaResponse revisar(@PathVariable Long idEntrega,
                                              @Valid @RequestBody TareaDtos.RevisarEntregaRequest req, Authentication auth) {
        return service.revisar(idEntrega, req, auth);
    }

    @GetMapping("/entregas/{idEntrega}/descarga")
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN','SUPER_ADMIN','REPRESENTANTE','ESTUDIANTE')")
    public ResponseEntity<Map<String, String>> urlDescarga(@PathVariable Long idEntrega, Authentication auth) {
        return ResponseEntity.ok(Map.of("url", service.urlDescarga(idEntrega, auth)));
    }

    /** Material de apoyo de la tarea (no la entrega del estudiante) — guías, imágenes de referencia, etc. */
    @GetMapping("/{idTarea}/adjuntos")
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN','SUPER_ADMIN','REPRESENTANTE','ESTUDIANTE')")
    public List<TareaDtos.AdjuntoTareaResponse> adjuntosDeTarea(@PathVariable Long idTarea,
            @RequestParam(required = false) Long idEstudiante, Authentication auth) {
        return service.adjuntosDeTarea(idTarea, idEstudiante, auth);
    }

    /** Publica material de apoyo — exclusivo del docente dueño de la asignación. */
    @PostMapping(value = "/{idTarea}/adjuntos", consumes = "multipart/form-data")
    @PreAuthorize("hasRole('DOCENTE')")
    public TareaDtos.AdjuntoTareaResponse subirAdjunto(@PathVariable Long idTarea,
            @RequestParam @Size(max = 150) String nombre,
            @RequestParam("archivo") MultipartFile archivo, Authentication auth) {
        return service.subirAdjunto(idTarea, nombre, archivo, auth);
    }

    @GetMapping("/adjuntos/{idAdjunto}/descarga")
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN','SUPER_ADMIN','REPRESENTANTE','ESTUDIANTE')")
    public ResponseEntity<Map<String, String>> urlDescargaAdjunto(@PathVariable Long idAdjunto,
            @RequestParam(required = false) Long idEstudiante, Authentication auth) {
        return ResponseEntity.ok(Map.of("url", service.urlDescargaAdjunto(idAdjunto, idEstudiante, auth)));
    }

    @DeleteMapping("/adjuntos/{idAdjunto}")
    @PreAuthorize("hasRole('DOCENTE')")
    public void eliminarAdjunto(@PathVariable Long idAdjunto, Authentication auth) {
        service.eliminarAdjunto(idAdjunto, auth);
    }
}
