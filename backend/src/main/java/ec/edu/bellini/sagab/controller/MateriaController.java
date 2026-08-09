package ec.edu.bellini.sagab.controller;

import ec.edu.bellini.sagab.dto.MateriaDtos;
import ec.edu.bellini.sagab.service.MateriaService;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/materias")
public class MateriaController {

    private final MateriaService service;

    public MateriaController(MateriaService service) { this.service = service; }

    /** Materias del estudiante en el período académico vigente, con avance de deberes — Portal Familiar. */
    @GetMapping("/estudiante/{idEstudiante}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN','REPRESENTANTE','ESTUDIANTE')")
    public List<MateriaDtos.MateriaEstudianteResponse> porEstudiante(@PathVariable Long idEstudiante, Authentication auth) {
        return service.porEstudiante(idEstudiante, auth);
    }
}
