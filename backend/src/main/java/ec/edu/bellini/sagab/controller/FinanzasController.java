package ec.edu.bellini.sagab.controller;

import ec.edu.bellini.sagab.dto.FinanzasDtos;
import ec.edu.bellini.sagab.service.FinanzasService;

import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/finanzas")
public class FinanzasController {

    private final FinanzasService service;

    public FinanzasController(FinanzasService service) { this.service = service; }

    /** Estado de cuenta de un estudiante — ADMIN sin restricción, REPRESENTANTE solo sus representados. */
    @GetMapping("/estudiante/{idEstudiante}")
    @PreAuthorize("hasAnyRole('ADMIN','REPRESENTANTE')")
    public List<FinanzasDtos.ObligacionResponse> porEstudiante(@PathVariable Long idEstudiante, Authentication auth) {
        return service.porEstudiante(idEstudiante, auth);
    }

    @PostMapping("/pagos")
    @PreAuthorize("hasRole('ADMIN')")
    public FinanzasDtos.ObligacionResponse registrarPago(@Valid @RequestBody FinanzasDtos.PagoRequest req,
                                                          Authentication auth) {
        return service.registrarPago(req, auth);
    }
}
