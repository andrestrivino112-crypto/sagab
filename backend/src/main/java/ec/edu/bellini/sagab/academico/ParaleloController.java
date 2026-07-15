package ec.edu.bellini.sagab.academico;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/paralelos")
public class ParaleloController {

    private final ParaleloService service;

    public ParaleloController(ParaleloService service) { this.service = service; }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<ParaleloDtos.ParaleloResponse> listar() {
        return service.delAnioLectivoVigente();
    }
}
