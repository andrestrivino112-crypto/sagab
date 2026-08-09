package ec.edu.bellini.sagab.controller;

import ec.edu.bellini.sagab.dto.EstudianteDtos;
import ec.edu.bellini.sagab.service.EstudianteService;

import jakarta.validation.constraints.NotBlank;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/estudiantes")
@Validated
public class EstudianteController {

    private final EstudianteService service;

    public EstudianteController(EstudianteService service) { this.service = service; }

    /** DOCENTE solo ve la nómina de un paralelo donde dicta; ADMIN y DECE (monitoreo de ausentismo) cualquiera. */
    @GetMapping("/paralelo/{idParalelo}")
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN','SUPER_ADMIN','DECE')")
    public List<EstudianteDtos.EstudianteResumen> porParalelo(@PathVariable Integer idParalelo, Authentication auth) {
        return service.porParalelo(idParalelo, auth);
    }

    /** Estudiantes a los que el usuario tiene acceso propio (representados, o el propio estudiante) — Portal Familiar. */
    @GetMapping("/mios")
    @PreAuthorize("hasAnyRole('REPRESENTANTE','ESTUDIANTE')")
    public List<EstudianteDtos.EstudianteConParalelo> mios(Authentication auth) {
        return service.mios(auth);
    }

    /**
     * Búsqueda por nombre o cédula (propia o del representante) — selector de estudiante en
     * Financiero (ADMIN) y en la búsqueda avanzada de Calificaciones (también DOCENTE: el
     * resultado solo trae nombre/código/paralelo, sin datos sensibles; la consulta de notas
     * en sí sigue restringida a las asignaciones propias del docente en CalificacionService).
     */
    @GetMapping("/buscar")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN','DOCENTE')")
    public List<EstudianteDtos.EstudianteConParalelo> buscar(@RequestParam @NotBlank String q) {
        return service.buscar(q);
    }

    @GetMapping("/matriculados")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public List<EstudianteDtos.EstudianteMatriculado> matriculados() {
        return service.matriculadosPeriodoActivo();
    }
}
