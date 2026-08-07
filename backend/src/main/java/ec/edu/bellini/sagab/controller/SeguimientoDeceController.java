package ec.edu.bellini.sagab.controller;

import ec.edu.bellini.sagab.dto.SeguimientoDeceDtos;
import ec.edu.bellini.sagab.model.SeguimientoDece;
import ec.edu.bellini.sagab.service.SeguimientoDeceService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/dece/seguimientos")
@PreAuthorize("hasRole('DECE')")
@Validated
public class SeguimientoDeceController {

    private final SeguimientoDeceService service;

    public SeguimientoDeceController(SeguimientoDeceService service) {
        this.service = service;
    }

    @GetMapping("/estudiantes")
    public List<SeguimientoDeceDtos.BusquedaEstudianteResponse> buscarEstudiantes(
            @RequestParam @Size(min = 2, max = 120) String q) {
        return service.buscarEstudiantes(q);
    }

    @GetMapping
    public List<SeguimientoDeceDtos.SeguimientoResponse> listar(
            @RequestParam(required = false) @Size(max = 120) String q,
            @RequestParam(required = false) SeguimientoDece.EstadoSeguimiento estado) {
        return service.listar(q, estado);
    }

    @GetMapping("/{id}")
    public SeguimientoDeceDtos.SeguimientoResponse detalle(@PathVariable Long id) {
        return service.detalle(id);
    }

    @PostMapping
    public SeguimientoDeceDtos.SeguimientoResponse crear(
            @Valid @RequestBody SeguimientoDeceDtos.CrearRequest req, Authentication auth) {
        return service.crear(req, auth);
    }

    @PutMapping("/{id}")
    public SeguimientoDeceDtos.SeguimientoResponse editar(@PathVariable Long id,
            @Valid @RequestBody SeguimientoDeceDtos.EditarRequest req, Authentication auth) {
        return service.editar(id, req, auth);
    }

    @DeleteMapping("/{id}")
    public void eliminar(@PathVariable Long id, Authentication auth) {
        service.eliminar(id, auth);
    }

    @GetMapping("/{id}/historial")
    public List<SeguimientoDeceDtos.HistorialResponse> historial(@PathVariable Long id) {
        return service.historial(id);
    }

    @PostMapping("/{id}/mensajes")
    public SeguimientoDeceDtos.MensajeHistorialResponse enviarMensaje(@PathVariable Long id,
            @Valid @RequestBody SeguimientoDeceDtos.EnviarMensajeRequest req, Authentication auth) {
        return service.enviarMensaje(id, req, auth);
    }

    @GetMapping("/{id}/mensajes")
    public List<SeguimientoDeceDtos.MensajeHistorialResponse> historialMensajes(@PathVariable Long id) {
        return service.historialMensajes(id);
    }
}
