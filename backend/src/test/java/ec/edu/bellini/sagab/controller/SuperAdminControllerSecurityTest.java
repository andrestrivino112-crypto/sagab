package ec.edu.bellini.sagab.controller;

import ec.edu.bellini.sagab.dto.SuperAdminDtos;
import ec.edu.bellini.sagab.service.SuperAdminService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@SpringJUnitConfig(SuperAdminControllerSecurityTest.Config.class)
class SuperAdminControllerSecurityTest {

    @Configuration
    @EnableMethodSecurity
    static class Config {
        @Bean SuperAdminService superAdminService() { return mock(SuperAdminService.class); }
        @Bean SuperAdminController superAdminController(SuperAdminService service) {
            return new SuperAdminController(service);
        }
    }

    @Autowired private SuperAdminController controller;
    @Autowired private SuperAdminService service;

    @Test
    @WithMockUser(username = "superadmin@bellini.edu.ec", roles = "SUPER_ADMIN")
    void superAdminPuedeUsarLosTresEndpoints() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        HttpServletRequest request = mock(HttpServletRequest.class);
        var pagina = new SuperAdminDtos.PaginaUsuarios(List.of(), 0, 20, 0, 0);
        when(service.listar("", "", "", 0, 20, auth)).thenReturn(pagina);

        assertEquals(pagina, controller.usuarios("", "", "", 0, 20, auth));
        assertDoesNotThrow(() -> controller.restablecerClave(2L, auth, request));
        assertDoesNotThrow(() -> controller.cambiarEstado(2L,
                new SuperAdminDtos.CambiarEstadoRequest("INACTIVO"), auth, request));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminRecibeDenegacion() { verificarDenegado(); }

    @Test
    @WithMockUser(roles = "DOCENTE")
    void docenteRecibeDenegacion() { verificarDenegado(); }

    @Test
    @WithMockUser(roles = "DECE")
    void deceRecibeDenegacion() { verificarDenegado(); }

    @Test
    @WithMockUser(roles = "ESTUDIANTE")
    void estudianteRecibeDenegacion() { verificarDenegado(); }

    @Test
    @WithMockUser(roles = "REPRESENTANTE")
    void representanteRecibeDenegacion() { verificarDenegado(); }

    @Test
    @WithMockUser(roles = "AUDITOR")
    void auditorRecibeDenegacion() { verificarDenegado(); }

    private void verificarDenegado() {
        clearInvocations(service);
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        HttpServletRequest request = mock(HttpServletRequest.class);

        assertThrows(AccessDeniedException.class,
                () -> controller.usuarios("", "", "", 0, 20, auth));
        assertThrows(AccessDeniedException.class,
                () -> controller.restablecerClave(2L, auth, request));
        assertThrows(AccessDeniedException.class,
                () -> controller.cambiarEstado(2L,
                        new SuperAdminDtos.CambiarEstadoRequest("INACTIVO"), auth, request));
        verifyNoInteractions(service);
    }
}
