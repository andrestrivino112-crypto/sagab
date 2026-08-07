package ec.edu.bellini.sagab.controller;

import ec.edu.bellini.sagab.dto.FinanzasDtos;
import ec.edu.bellini.sagab.service.FinanzasService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/finanzas")
@Validated
public class FinanzasController {

    private final FinanzasService service;

    public FinanzasController(FinanzasService service) { this.service = service; }

    /** Estado de cuenta de un estudiante — ADMIN sin restricción, REPRESENTANTE solo sus representados. */
    @GetMapping("/estudiante/{idEstudiante}")
    @PreAuthorize("hasAnyRole('ADMIN','REPRESENTANTE','ESTUDIANTE')")
    public List<FinanzasDtos.ObligacionResponse> porEstudiante(@PathVariable Long idEstudiante, Authentication auth) {
        return service.porEstudiante(idEstudiante, auth);
    }

    /** Drill-down de la tarjeta "Estudiantes en mora" del Dashboard — mismos roles que ya lo ven ahí
     * (DashboardController.resumen); REPRESENTANTE/ESTUDIANTE quedan fuera (datos de otros estudiantes). */
    @GetMapping("/mora")
    @PreAuthorize("hasAnyRole('ADMIN','DOCENTE','AUDITOR','DECE')")
    public List<FinanzasDtos.EstudianteMoraResponse> mora() {
        return service.listaMora();
    }

    /** Envía un recordatorio de pago o un mensaje privado a un estudiante en mora — mismos roles
     * que ven la tarjeta "Estudiantes en mora" del Dashboard y pueden actuar sobre ella. */
    @PostMapping("/mora/{idEstudiante}/comunicacion")
    @PreAuthorize("hasAnyRole('ADMIN','DOCENTE')")
    public void enviarComunicacionMora(@PathVariable Long idEstudiante,
            @Valid @RequestBody FinanzasDtos.ComunicacionMoraRequest req, Authentication auth) {
        service.enviarComunicacionMora(idEstudiante, req, auth);
    }

    @PostMapping("/pagos")
    @PreAuthorize("hasRole('ADMIN')")
    public FinanzasDtos.ObligacionResponse registrarPago(@Valid @RequestBody FinanzasDtos.PagoRequest req,
                                                          Authentication auth) {
        return service.registrarPago(req, auth);
    }

    /** Origina a mano la obligación de un estudiante para un rubro, sin esperar a que la familia pague primero. */
    @PostMapping("/obligaciones")
    @PreAuthorize("hasRole('ADMIN')")
    public FinanzasDtos.ObligacionResponse crearObligacion(@Valid @RequestBody FinanzasDtos.CrearObligacionRequest req) {
        return service.crearObligacion(req.idEstudiante(), req.idRubro());
    }

    /**
     * El estudiante o su representante suben comprobantes (mismo rol "familiar"); el admin únicamente
     * revisa. Se indica {@code idObligacion} (una obligación ya generada) o, si todavía no existe
     * ninguna para este estudiante, {@code idRubro} + {@code idEstudiante} (el motivo de pago) y el
     * backend genera la obligación del mes automáticamente — ver FinanzasService.
     */
    @PostMapping(value = "/pagos/transferencia", consumes = "multipart/form-data")
    @PreAuthorize("hasAnyRole('REPRESENTANTE','ESTUDIANTE')")
    public FinanzasDtos.PagoRevisionResponse subirComprobante(
            @RequestParam(required = false) Long idObligacion,
            @RequestParam(required = false) Long idEstudiante,
            @RequestParam(required = false) Integer idRubro,
            @RequestParam(required = false) BigDecimal valorPagado,
            @RequestParam @Size(max = 60) String banco,
            @RequestParam @Size(max = 150) String asunto,
            @RequestParam @Size(max = 50) String numeroReferencia,
            @RequestParam LocalDate fechaPago,
            @RequestParam("comprobante") MultipartFile comprobante,
            Authentication auth) {
        return service.subirComprobante(idObligacion, idEstudiante, idRubro, valorPagado, banco, asunto,
                numeroReferencia, fechaPago, comprobante, auth);
    }

    /** Motivos de pago disponibles (rubros del año lectivo vigente) — selector del Portal Familiar. */
    @GetMapping("/rubros")
    @PreAuthorize("hasAnyRole('ADMIN','REPRESENTANTE','ESTUDIANTE')")
    public List<FinanzasDtos.RubroResponse> rubros() {
        return service.rubrosDisponibles();
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
    @PreAuthorize("hasAnyRole('ADMIN','REPRESENTANTE','ESTUDIANTE')")
    public ResponseEntity<Map<String, String>> urlComprobante(@PathVariable Long idPago, Authentication auth) {
        return ResponseEntity.ok(Map.of("url", service.urlDescargaComprobante(idPago, auth)));
    }
}
