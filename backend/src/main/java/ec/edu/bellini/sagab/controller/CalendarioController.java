package ec.edu.bellini.sagab.controller;

import ec.edu.bellini.sagab.dto.CalendarioDtos;
import ec.edu.bellini.sagab.service.CalendarioService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/calendario")
public class CalendarioController {
    private final CalendarioService service;

    public CalendarioController(CalendarioService service) { this.service = service; }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','DOCENTE','DECE','ESTUDIANTE','REPRESENTANTE','AUDITOR')")
    public List<CalendarioDtos.CalendarioItemResponse> listar(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            Authentication auth) {
        return service.listar(desde, hasta, auth);
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public CalendarioDtos.CalendarioItemResponse crear(@Valid @RequestBody CalendarioDtos.GuardarEventoRequest req,
                                                        Authentication auth) {
        return service.crear(req, auth);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public CalendarioDtos.CalendarioItemResponse editar(@PathVariable Long id,
            @Valid @RequestBody CalendarioDtos.GuardarEventoRequest req) {
        return service.editar(id, req);
    }

    @PostMapping("/{id}/duplicar")
    @PreAuthorize("hasRole('ADMIN')")
    public CalendarioDtos.CalendarioItemResponse duplicar(@PathVariable Long id, Authentication auth) {
        return service.duplicar(id, auth);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void eliminar(@PathVariable Long id) { service.eliminar(id); }

    @PostMapping(value = "/{id}/adjuntos", consumes = "multipart/form-data")
    @PreAuthorize("hasRole('ADMIN')")
    public CalendarioDtos.AdjuntoResponse subirAdjunto(@PathVariable Long id,
            @RequestParam(required = false) String nombre,
            @RequestParam("archivo") MultipartFile archivo, Authentication auth) {
        return service.subirAdjunto(id, nombre, archivo, auth);
    }

    @GetMapping("/adjuntos/{idAdjunto}/descarga")
    @PreAuthorize("hasAnyRole('ADMIN','DOCENTE','DECE','ESTUDIANTE','REPRESENTANTE','AUDITOR')")
    public ResponseEntity<Map<String, String>> descargarAdjunto(@PathVariable Long idAdjunto,
                                                                 Authentication auth) {
        return ResponseEntity.ok(Map.of("url", service.urlDescargaAdjunto(idAdjunto, auth)));
    }

    @DeleteMapping("/adjuntos/{idAdjunto}")
    @PreAuthorize("hasRole('ADMIN')")
    public void eliminarAdjunto(@PathVariable Long idAdjunto) { service.eliminarAdjunto(idAdjunto); }
}
