package ec.edu.bellini.sagab.controller;

import ec.edu.bellini.sagab.dto.FinanzasDtos;
import ec.edu.bellini.sagab.service.FinanzasService;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/finanzas")
public class FinanzasController {

    private final FinanzasService service;

    public FinanzasController(FinanzasService service) { this.service = service; }

    /** Estado de cuenta de un estudiante — ADMIN sin restricción, REPRESENTANTE solo sus representados. */
    @GetMapping("/estudiante/{idEstudiante}")
    @PreAuthorize("hasAnyRole('ADMIN','REPRESENTANTE','ESTUDIANTE')")
    public List<FinanzasDtos.ObligacionResponse> porEstudiante(@PathVariable Long idEstudiante, Authentication auth) {
        return service.porEstudiante(idEstudiante, auth);
    }

    @PostMapping("/pagos")
    @PreAuthorize("hasRole('ADMIN')")
    public FinanzasDtos.ObligacionResponse registrarPago(@Valid @RequestBody FinanzasDtos.PagoRequest req,
                                                          Authentication auth) {
        return service.registrarPago(req, auth);
    }

    /** Solo el representante sube comprobantes; el admin únicamente revisa (aprobar/rechazar más abajo). */
    @PostMapping(value = "/pagos/transferencia", consumes = "multipart/form-data")
    @PreAuthorize("hasRole('REPRESENTANTE')")
    public FinanzasDtos.PagoRevisionResponse subirComprobante(
            @RequestParam Long idObligacion,
            @RequestParam BigDecimal valorPagado,
            @RequestParam String banco,
            @RequestParam String asunto,
            @RequestParam String numeroReferencia,
            @RequestParam LocalDate fechaPago,
            @RequestParam("comprobante") MultipartFile comprobante,
            Authentication auth) {
        return service.subirComprobante(idObligacion, valorPagado, banco, asunto, numeroReferencia, fechaPago, comprobante, auth);
    }

    @GetMapping("/pagos/revision")
    @PreAuthorize("hasRole('ADMIN')")
    public List<FinanzasDtos.PagoRevisionResponse> colaRevision() {
        return service.colaRevision();
    }

    @PostMapping("/pagos/{idPago}/aprobar")
    @PreAuthorize("hasRole('ADMIN')")
    public FinanzasDtos.PagoRevisionResponse aprobar(@PathVariable Long idPago,
            @RequestBody(required = false) FinanzasDtos.RevisionPagoRequest req, Authentication auth) {
        return service.aprobar(idPago, req != null ? req.observaciones() : null, auth);
    }

    @PostMapping("/pagos/{idPago}/rechazar")
    @PreAuthorize("hasRole('ADMIN')")
    public FinanzasDtos.PagoRevisionResponse rechazar(@PathVariable Long idPago,
            @RequestBody(required = false) FinanzasDtos.RevisionPagoRequest req, Authentication auth) {
        return service.rechazar(idPago, req != null ? req.observaciones() : null, auth);
    }

    @GetMapping("/pagos/{idPago}/comprobante")
    @PreAuthorize("hasAnyRole('ADMIN','REPRESENTANTE')")
    public ResponseEntity<Map<String, String>> urlComprobante(@PathVariable Long idPago, Authentication auth) {
        return ResponseEntity.ok(Map.of("url", service.urlDescargaComprobante(idPago, auth)));
    }
}
