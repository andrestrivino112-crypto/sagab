package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.model.Rol;
import ec.edu.bellini.sagab.model.Usuario;
import ec.edu.bellini.sagab.repository.RolRepository;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class SuperAdminServiceTest {

    private UsuarioRepository usuarios;
    private RolRepository roles;
    private EventoSeguridadService eventos;
    private BCryptPasswordEncoder encoder;
    private SuperAdminService service;
    private Authentication auth;
    private Usuario actor;

    @BeforeEach
    void setUp() {
        usuarios = mock(UsuarioRepository.class);
        roles = mock(RolRepository.class);
        eventos = mock(EventoSeguridadService.class);
        encoder = new BCryptPasswordEncoder(4);
        service = new SuperAdminService(usuarios, roles, encoder, eventos);

        actor = usuario(1L, "superadmin@bellini.edu.ec");
        actor.setRoles(Set.of(rol("SUPER_ADMIN")));
        auth = new UsernamePasswordAuthenticationToken(actor.getEmail(), null, List.of());
        when(usuarios.findByEmail(actor.getEmail())).thenReturn(Optional.of(actor));
        when(usuarios.findByEmailForUpdate(actor.getEmail())).thenReturn(Optional.of(actor));
        Rol mutex = rol("SUPER_ADMIN");
        when(roles.findByCodigoForUpdate("SUPER_ADMIN")).thenReturn(Optional.of(mutex));
    }

    @Test
    void restableceConBcryptYRevocaSesionesSinExponerLaClave() {
        String documentoTemporal = "0".repeat(10);
        Usuario objetivo = usuario(2L, "cuenta@bellini.edu.ec");
        objetivo.setCedula(documentoTemporal);
        objetivo.setHashPassword("hash-anterior");
        objetivo.setDebeCambiarClave(false);
        objetivo.setIntentosFallidos((short) 4);
        objetivo.setBloqueadoHasta(OffsetDateTime.now().plusMinutes(10));
        objetivo.setEstado(Usuario.EstadoUsuario.BLOQUEADO);
        objetivo.setAuthVersion(7);
        when(usuarios.findByIdForUpdate(2L)).thenReturn(Optional.of(objetivo));

        service.restablecerClave(2L, auth, "127.0.0.1", "JUnit");

        assertAll(
                () -> assertFalse(documentoTemporal.equals(objetivo.getHashPassword())),
                () -> assertTrue(encoder.matches(documentoTemporal, objetivo.getHashPassword())),
                () -> assertTrue(objetivo.isDebeCambiarClave()),
                () -> assertEquals(0, objetivo.getIntentosFallidos()),
                () -> assertNull(objetivo.getBloqueadoHasta()),
                () -> assertEquals(Usuario.EstadoUsuario.ACTIVO, objetivo.getEstado()),
                () -> assertEquals(8, objetivo.getAuthVersion()));
        verify(usuarios).revocarRefreshTokens(2L);
        verify(usuarios).saveAndFlush(objetivo);
        verify(eventos).cuentaGestionada(actor.getEmail(), "RESTABLECIMIENTO_CLAVE",
                objetivo.getId(), objetivo.getUsername(), "127.0.0.1", "JUnit");
    }

    @Test
    void rechazaCuentaSinDocumentoValidoAntesDeCifrarOMutar() {
        Usuario sinDocumento = usuario(2L, "sin-documento@bellini.edu.ec");
        sinDocumento.setCedula(null);
        sinDocumento.setHashPassword("hash-anterior");
        sinDocumento.setAuthVersion(3);
        when(usuarios.findByIdForUpdate(2L)).thenReturn(Optional.of(sinDocumento));

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.restablecerClave(2L, auth, "127.0.0.1", "JUnit"));

        assertTrue(error.getMessage().contains("no tiene una cédula registrada"));
        assertEquals("hash-anterior", sinDocumento.getHashPassword());
        assertEquals(3, sinDocumento.getAuthVersion());
        verify(usuarios, never()).saveAndFlush(any());
        verify(usuarios, never()).revocarRefreshTokens(any());
        verifyNoInteractions(eventos);
    }

    @Test
    void rechazaDocumentoRegistradoConFormatoInvalido() {
        Usuario objetivo = usuario(2L, "documento-invalido@bellini.edu.ec");
        objetivo.setCedula("formato-invalido");
        objetivo.setHashPassword("hash-anterior");
        objetivo.setAuthVersion(3);
        when(usuarios.findByIdForUpdate(2L)).thenReturn(Optional.of(objetivo));

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.restablecerClave(2L, auth, "127.0.0.1", "JUnit"));

        assertTrue(error.getMessage().contains("no es válida"));
        assertEquals("hash-anterior", objetivo.getHashPassword());
        assertEquals(3, objetivo.getAuthVersion());
        verify(usuarios, never()).saveAndFlush(any());
        verify(usuarios, never()).revocarRefreshTokens(any());
        verifyNoInteractions(eventos);
    }

    @Test
    void rechazaRestablecerLaPropiaCuentaYAuditaElIntento() {
        assertThrows(AccessDeniedException.class,
                () -> service.restablecerClave(actor.getId(), auth, "127.0.0.1", "JUnit"));

        verify(eventos).accesoDenegado(eq(actor.getEmail()),
                eq("Intento de restablecer su propia contraseña; cuentaObjetivo=" + actor.getId()),
                eq("127.0.0.1"), eq("JUnit"));
        verify(usuarios, never()).findByIdForUpdate(any());
        verify(usuarios, never()).saveAndFlush(any());
    }

    @Test
    void rechazaAutodeshabilitacionTrasRevalidarAlActorYAuditaElIntento() {
        assertThrows(AccessDeniedException.class,
                () -> service.cambiarEstado(actor.getId(), "INACTIVO", auth, "127.0.0.1", "JUnit"));

        verify(eventos).accesoDenegado(eq(actor.getEmail()),
                eq("Intento de autodeshabilitación; cuentaObjetivo=" + actor.getId()),
                eq("127.0.0.1"), eq("JUnit"));
        verify(roles).findByCodigoForUpdate("SUPER_ADMIN");
        verify(usuarios, never()).findByIdForUpdate(any());
        verify(usuarios, never()).saveAndFlush(any());
    }

    @Test
    void impideDeshabilitarAlUltimoSuperAdminAuditaYTomaLosLocksEnOrden() {
        Usuario objetivo = usuario(2L, "otro-superadmin@bellini.edu.ec");
        objetivo.setEstado(Usuario.EstadoUsuario.ACTIVO);
        objetivo.setRoles(Set.of(rol("SUPER_ADMIN")));
        Rol mutex = rol("SUPER_ADMIN");
        List<String> locks = new ArrayList<>();
        when(roles.findByCodigoForUpdate("SUPER_ADMIN")).thenAnswer(invocacion -> {
            locks.add("rol");
            return Optional.of(mutex);
        });
        when(usuarios.findByIdForUpdate(2L)).thenAnswer(invocacion -> {
            locks.add("usuario");
            return Optional.of(objetivo);
        });
        when(usuarios.countByRolAndEstado("SUPER_ADMIN", Usuario.EstadoUsuario.ACTIVO))
                .thenReturn(1L);

        assertThrows(AccessDeniedException.class,
                () -> service.cambiarEstado(2L, "INACTIVO", auth, "127.0.0.1", "JUnit"));

        assertEquals(List.of("rol", "usuario"), locks);
        assertEquals(Usuario.EstadoUsuario.ACTIVO, objetivo.getEstado());
        verify(eventos).accesoDenegado(eq(actor.getEmail()),
                eq("Intento de deshabilitar al último SUPER_ADMIN activo; cuentaObjetivo=2"),
                eq("127.0.0.1"), eq("JUnit"));
        verify(usuarios, never()).saveAndFlush(any());
        verify(usuarios, never()).revocarRefreshTokens(any());
    }

    @Test
    void deshabilitaCuentaConMutexAntesDelLockObjetivoYAuditaElCambio() {
        Usuario objetivo = usuario(3L, "docente@bellini.edu.ec");
        objetivo.setEstado(Usuario.EstadoUsuario.ACTIVO);
        objetivo.setIntentosFallidos((short) 2);
        objetivo.setBloqueadoHasta(OffsetDateTime.now().plusMinutes(5));
        objetivo.setAuthVersion(4);
        objetivo.setRoles(Set.of(rol("DOCENTE")));
        List<String> locks = new ArrayList<>();
        when(roles.findByCodigoForUpdate("SUPER_ADMIN")).thenAnswer(invocacion -> {
            locks.add("rol");
            return Optional.of(rol("SUPER_ADMIN"));
        });
        when(usuarios.findByIdForUpdate(3L)).thenAnswer(invocacion -> {
            locks.add("usuario");
            return Optional.of(objetivo);
        });

        service.cambiarEstado(3L, "INACTIVO", auth, "127.0.0.1", "JUnit");

        assertAll(
                () -> assertEquals(List.of("rol", "usuario"), locks),
                () -> assertEquals(Usuario.EstadoUsuario.INACTIVO, objetivo.getEstado()),
                () -> assertEquals(0, objetivo.getIntentosFallidos()),
                () -> assertNull(objetivo.getBloqueadoHasta()),
                () -> assertEquals(5, objetivo.getAuthVersion()));
        verify(usuarios).revocarRefreshTokens(3L);
        verify(usuarios).saveAndFlush(objetivo);
        verify(eventos).cuentaGestionada(actor.getEmail(), "CUENTA_DESHABILITADA",
                objetivo.getId(), objetivo.getUsername(), "127.0.0.1", "JUnit");
    }

    @Test
    void habilitaCuentaLimpiaBloqueosEInvalidaTokensAnteriores() {
        Usuario objetivo = usuario(4L, "auditor@bellini.edu.ec");
        objetivo.setEstado(Usuario.EstadoUsuario.INACTIVO);
        objetivo.setIntentosFallidos((short) 3);
        objetivo.setBloqueadoHasta(OffsetDateTime.now().plusHours(1));
        objetivo.setAuthVersion(11);
        objetivo.setRoles(Set.of(rol("AUDITOR")));
        when(usuarios.findByIdForUpdate(4L)).thenReturn(Optional.of(objetivo));

        service.cambiarEstado(4L, "ACTIVO", auth, "127.0.0.1", "JUnit");

        assertAll(
                () -> assertEquals(Usuario.EstadoUsuario.ACTIVO, objetivo.getEstado()),
                () -> assertEquals(0, objetivo.getIntentosFallidos()),
                () -> assertNull(objetivo.getBloqueadoHasta()),
                () -> assertEquals(12, objetivo.getAuthVersion()));
        verify(usuarios).revocarRefreshTokens(4L);
        verify(eventos).cuentaGestionada(actor.getEmail(), "CUENTA_HABILITADA",
                objetivo.getId(), objetivo.getUsername(), "127.0.0.1", "JUnit");
    }

    @Test
    void listadoConservaPorSeparadoCuentasConElMismoNombre() {
        UsuarioRepository.UsuarioCuentaProjection primera = proyeccion(10L, "María Pérez", "maria.uno");
        UsuarioRepository.UsuarioCuentaProjection segunda = proyeccion(11L, "María Pérez", "maria.dos");
        when(usuarios.buscarCuentas(eq("maría pérez"), eq(""), eq(""), any()))
                .thenReturn(new PageImpl<>(List.of(primera, segunda)));

        var pagina = service.listar("  maría pérez  ", "", "", 0, 10, auth);

        assertAll(
                () -> assertEquals(2, pagina.contenido().size()),
                () -> assertEquals(10L, pagina.contenido().get(0).idUsuario()),
                () -> assertEquals(11L, pagina.contenido().get(1).idUsuario()),
                () -> assertEquals("maria.uno", pagina.contenido().get(0).username()),
                () -> assertEquals("maria.dos", pagina.contenido().get(1).username()),
                () -> assertEquals(Instant.parse("2026-08-08T20:00:00Z"),
                        pagina.contenido().get(0).creadoEn().toInstant()));
    }

    private Usuario usuario(Long id, String email) {
        Usuario usuario = new Usuario();
        usuario.setId(id);
        usuario.setEmail(email);
        usuario.setUsername("usuario-" + id);
        usuario.setNombres("Nombre");
        usuario.setApellidos("Apellido");
        usuario.setEstado(Usuario.EstadoUsuario.ACTIVO);
        return usuario;
    }

    private Rol rol(String codigo) {
        Rol rol = mock(Rol.class);
        when(rol.getCodigo()).thenReturn(codigo);
        return rol;
    }

    private UsuarioRepository.UsuarioCuentaProjection proyeccion(
            Long id, String nombre, String username) {
        UsuarioRepository.UsuarioCuentaProjection p = mock(UsuarioRepository.UsuarioCuentaProjection.class);
        when(p.getIdUsuario()).thenReturn(id);
        when(p.getNombreCompleto()).thenReturn(nombre);
        when(p.getUsername()).thenReturn(username);
        when(p.getEmail()).thenReturn(username + "@bellini.edu.ec");
        when(p.getRoles()).thenReturn("ESTUDIANTE");
        when(p.getEstado()).thenReturn("ACTIVO");
        when(p.getCedulaEnmascarada()).thenReturn("******1234");
        when(p.getDebeCambiarClave()).thenReturn(false);
        when(p.getCreadoEn()).thenReturn(Instant.parse("2026-08-08T20:00:00Z"));
        return p;
    }
}
