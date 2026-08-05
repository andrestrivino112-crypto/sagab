package ec.edu.bellini.sagab.controller;

import ec.edu.bellini.sagab.dto.EstudianteDtos;
import ec.edu.bellini.sagab.service.EstudianteService;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/estudiantes")
public class EstudianteController {

    private final EstudianteService service;

    public EstudianteController(EstudianteService service) { this.service = service; }

    @GetMapping("/paralelo/{idParalelo}")
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN')")
    public List<EstudianteDtos.EstudianteResumen> porParalelo(@PathVariable Integer idParalelo) {
        return service.porParalelo(idParalelo);
    }

    /** Estudiantes a los que el usuario tiene acceso propio (representados, o el propio estudiante) — Portal Familiar. */
    @GetMapping("/mios")
    @PreAuthorize("hasAnyRole('REPRESENTANTE','ESTUDIANTE')")
    public List<EstudianteDtos.EstudianteConParalelo> mios(Authentication auth) {
        return service.mios(auth);
    }

    /** Búsqueda por nombre — selector de estudiante en Financiero. */
    @GetMapping("/buscar")
    @PreAuthorize("hasRole('ADMIN')")
    public List<EstudianteDtos.EstudianteConParalelo> buscar(@RequestParam String q) {
        return service.buscar(q);
    }
}
