package ec.edu.bellini.sagab.controller;

import ec.edu.bellini.sagab.dto.DashboardDtos;
import ec.edu.bellini.sagab.service.DashboardService;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardService service;

    public DashboardController(DashboardService service) { this.service = service; }

    /** REPRESENTANTE tiene su propio Portal Familiar, no esta pantalla. */
    @GetMapping("/resumen")
    @PreAuthorize("hasAnyRole('ADMIN','DOCENTE','AUDITOR')")
    public DashboardDtos.ResumenDashboard resumen(Authentication auth) {
        return service.resumen(auth);
    }

    /** Drill-down de la tarjeta "Promedio institucional": desglose por curso/paralelo/materia/docente/año. */
    @GetMapping("/promedio")
    @PreAuthorize("hasAnyRole('ADMIN','DOCENTE','AUDITOR')")
    public DashboardDtos.PromedioDetalle promedio() {
        return service.promedioDetalle();
    }
}
