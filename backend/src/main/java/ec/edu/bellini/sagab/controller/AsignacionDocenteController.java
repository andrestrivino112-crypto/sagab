package ec.edu.bellini.sagab.controller;

import ec.edu.bellini.sagab.dto.AsignacionDocenteDtos;
import ec.edu.bellini.sagab.service.AsignacionDocenteService;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/asignaciones")
public class AsignacionDocenteController {

    private final AsignacionDocenteService service;

    public AsignacionDocenteController(AsignacionDocenteService service) { this.service = service; }

    /** Asignaciones (paralelo+materia+período) del docente autenticado; todas si es ADMIN. */
    @GetMapping("/mias")
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN')")
    public List<AsignacionDocenteDtos.AsignacionResponse> mias(Authentication auth) {
        return service.mias(auth);
    }
}
