package ec.edu.bellini.sagab.controller;

import ec.edu.bellini.sagab.dto.AsignacionDocenteDtos;
import ec.edu.bellini.sagab.service.AsignacionDocenteService;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/asignaciones")
public class AsignacionDocenteController {

    private final AsignacionDocenteService service;

    public AsignacionDocenteController(AsignacionDocenteService service) { this.service = service; }

    /** Asignaciones (paralelo+materia+período) del docente autenticado; todas si es ADMIN. */
    @GetMapping("/mias")
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN','SUPER_ADMIN')")
    public List<AsignacionDocenteDtos.AsignacionResponse> mias(Authentication auth) {
        return service.mias(auth);
    }

    @GetMapping("/catalogos")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public AsignacionDocenteDtos.CatalogosResponse catalogos() { return service.catalogos(); }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public List<AsignacionDocenteDtos.AsignacionResponse> crear(
            @Valid @RequestBody AsignacionDocenteDtos.CrearAsignacionesRequest req) {
        return service.crear(req);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public AsignacionDocenteDtos.AsignacionResponse editar(@PathVariable Long id,
            @Valid @RequestBody AsignacionDocenteDtos.EditarAsignacionRequest req) {
        return service.editar(id, req);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public void eliminar(@PathVariable Long id) { service.eliminar(id); }
}
