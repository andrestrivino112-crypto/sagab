package ec.edu.bellini.sagab.controller;

import ec.edu.bellini.sagab.dto.DashboardDtos;
import ec.edu.bellini.sagab.dto.FinanzasDtos;
import ec.edu.bellini.sagab.service.DashboardService;
import ec.edu.bellini.sagab.service.EstudianteService;
import ec.edu.bellini.sagab.service.FinanzasService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@SpringJUnitConfig(AdminEndpointSecurityTest.Config.class)
class AdminEndpointSecurityTest {

    @Configuration
    @EnableMethodSecurity
    static class Config {
        @Bean DashboardService dashboardService() { return mock(DashboardService.class); }
        @Bean EstudianteService estudianteService() { return mock(EstudianteService.class); }
        @Bean FinanzasService finanzasService() { return mock(FinanzasService.class); }
        @Bean DashboardController dashboardController(DashboardService service) { return new DashboardController(service); }
        @Bean EstudianteController estudianteController(EstudianteService service) { return new EstudianteController(service); }
        @Bean FinanzasController finanzasController(FinanzasService service) { return new FinanzasController(service); }
    }

    @Autowired private DashboardController dashboard;
    @Autowired private DashboardService dashboardService;
    @Autowired private EstudianteController estudiantes;
    @Autowired private EstudianteService estudianteService;
    @Autowired private FinanzasController finanzas;
    @Autowired private FinanzasService finanzasService;

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminPuedeConsultarEndpointsAdministrativos() {
        when(dashboardService.administrativo(any(Authentication.class))).thenReturn(
                new DashboardDtos.ResumenAdministrativo(null, 0, List.of(), 0, 0, List.of(), 0, List.of()));
        when(estudianteService.matriculadosPeriodoActivo()).thenReturn(List.of());
        when(finanzasService.valoresPendientes()).thenReturn(List.of());

        assertDoesNotThrow(() -> dashboard.administrativo(org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication()));
        assertDoesNotThrow(() -> estudiantes.matriculados());
        assertDoesNotThrow(() -> finanzas.pendientes());
        assertDoesNotThrow(() -> finanzas.notificarPendiente(1L,
                new FinanzasDtos.NotificacionValorPendienteRequest("Recordatorio")));
    }

    @Test
    @WithMockUser(roles = "DOCENTE")
    void docenteNoPuedeConsultarEndpointsAdministrativos() {
        Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        assertThrows(AccessDeniedException.class, () -> dashboard.administrativo(auth));
        assertThrows(AccessDeniedException.class, () -> estudiantes.matriculados());
        assertThrows(AccessDeniedException.class, () -> finanzas.pendientes());
        assertThrows(AccessDeniedException.class, () -> finanzas.notificarPendiente(1L,
                new FinanzasDtos.NotificacionValorPendienteRequest("Recordatorio")));
    }

    @Test
    @WithMockUser(roles = "REPRESENTANTE")
    void representanteNoPuedeConsultarEndpointsAdministrativos() {
        Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        assertThrows(AccessDeniedException.class, () -> dashboard.administrativo(auth));
        assertThrows(AccessDeniedException.class, () -> estudiantes.matriculados());
        assertThrows(AccessDeniedException.class, () -> finanzas.pendientes());
        assertThrows(AccessDeniedException.class, () -> finanzas.notificarPendiente(1L,
                new FinanzasDtos.NotificacionValorPendienteRequest("Recordatorio")));
    }
}
