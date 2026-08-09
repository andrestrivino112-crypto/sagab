package ec.edu.bellini.sagab.controller;

import ec.edu.bellini.sagab.dto.AsistenciaDtos;
import ec.edu.bellini.sagab.service.AsistenciaService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/asistencia")
public class AsistenciaController {

    private final AsistenciaService service;

    public AsistenciaController(AsistenciaService service) { this.service = service; }

    @PostMapping
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN','SUPER_ADMIN')")
    public Map<String, Object> registrar(@Valid @RequestBody AsistenciaDtos.RegistroDiarioRequest req, Authentication auth) {
        return service.registrar(req, auth);
    }

    /** Registro de un paralelo — DOCENTE solo el suyo, ADMIN/DECE cualquiera (DECE monitorea ausentismo institucional). */
    @GetMapping("/paralelo/{idParalelo}")
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN','SUPER_ADMIN','DECE')")
    public List<AsistenciaDtos.RegistroParaleloResponse> porParalelo(@PathVariable Integer idParalelo,
                                        @RequestParam(required = false) LocalDate fecha, Authentication auth) {
        return service.porParalelo(idParalelo, fecha, auth);
    }

    /** Ausencias injustificadas consecutivas de cada estudiante del paralelo (alerta DECE en la tabla de registro). */
    @GetMapping("/paralelo/{idParalelo}/consecutivas")
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN','SUPER_ADMIN','DECE')")
    public Map<Long, Long> consecutivasPorParalelo(@PathVariable Integer idParalelo, Authentication auth) {
        return service.consecutivasPorParalelo(idParalelo, auth);
    }

    /** Historial de asistencia de un estudiante (últimos 6 meses por defecto) — Portal Familiar. */
    @GetMapping("/estudiante/{idEstudiante}")
    @PreAuthorize("hasAnyRole('DOCENTE','ADMIN','SUPER_ADMIN','REPRESENTANTE','ESTUDIANTE')")
    public List<AsistenciaDtos.RegistroResponse> porEstudiante(@PathVariable Long idEstudiante,
                                                @RequestParam(required = false) LocalDate desde,
                                                @RequestParam(required = false) LocalDate hasta,
                                                Authentication auth) {
        return service.porEstudiante(idEstudiante, desde, hasta, auth);
    }

    /** Drill-down "Ausencias" del Dashboard: faltas y atrasos institucionales, con filtros. */
    @GetMapping("/reporte")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN','DOCENTE','AUDITOR','DECE')")
    public List<AsistenciaDtos.ReporteAusenciaResponse> reporte(
            @RequestParam(required = false) LocalDate desde,
            @RequestParam(required = false) LocalDate hasta,
            @RequestParam(required = false) Integer idParalelo,
            @RequestParam(required = false) String curso,
            Authentication auth) {
        return service.reporteAusencias(desde, hasta, idParalelo, curso, auth);
    }
}
