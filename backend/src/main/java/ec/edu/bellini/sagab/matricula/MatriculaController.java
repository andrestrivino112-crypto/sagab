package ec.edu.bellini.sagab.matricula;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/matriculas")
public class MatriculaController {

    private final MatriculaService service;

    public MatriculaController(MatriculaService service) { this.service = service; }

    /** Alta de estudiante — solo ADMIN (los docentes no gestionan matrículas). */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<MatriculaDtos.MatriculaResponse> crear(@Valid @RequestBody MatriculaDtos.MatriculaRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.crear(req));
    }
}
