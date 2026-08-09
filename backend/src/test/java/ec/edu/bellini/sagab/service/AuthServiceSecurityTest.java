package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.model.Rol;
import ec.edu.bellini.sagab.model.Usuario;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceSecurityTest {

    private UsuarioRepository usuarios;
    private JwtService jwt;
    private EventoSeguridadService eventos;
    private BCryptPasswordEncoder encoder;
    private AuthService service;

    @BeforeEach
    void setUp() {
        usuarios = mock(UsuarioRepository.class);
        jwt = mock(JwtService.class);
        eventos = mock(EventoSeguridadService.class);
        encoder = new BCryptPasswordEncoder(4);
        service = new AuthService(usuarios, encoder, jwt, eventos, 5, 20, 30);
    }

    @Test
    void cuentaInactivaNoPuedeIniciarSesion() {
        Usuario cuenta = cuenta(9L, Usuario.EstadoUsuario.INACTIVO, "Clave-prueba-1");
        when(usuarios.findByUsernameForUpdate(cuenta.getUsername())).thenReturn(Optional.of(cuenta));

        assertThrows(LockedException.class, () ->
                service.login(cuenta.getUsername(), "Clave-prueba-1", "127.0.0.1", "JUnit"));

        verify(eventos).loginFallido(cuenta.getUsername(), "Cuenta INACTIVO", "127.0.0.1", "JUnit");
    }

    @Test
    void falloDeClaveActualizaIntentosYEstaConfiguradoParaNoHacerRollback() throws Exception {
        Usuario cuenta = cuenta(9L, Usuario.EstadoUsuario.ACTIVO, "Clave-correcta-1");
        when(usuarios.findByUsernameForUpdate(cuenta.getUsername())).thenReturn(Optional.of(cuenta));

        assertThrows(BadCredentialsException.class, () ->
                service.login(cuenta.getUsername(), "Clave-incorrecta-1", "127.0.0.1", "JUnit"));

        assertEquals(1, cuenta.getIntentosFallidos());
        verify(usuarios).save(cuenta);
        verify(eventos).loginFallido(cuenta.getUsername(), "Contraseña incorrecta", "127.0.0.1", "JUnit");

        Method login = AuthService.class.getMethod("login", String.class, String.class,
                String.class, String.class);
        Transactional tx = login.getAnnotation(Transactional.class);
        assertTrue(Arrays.asList(tx.noRollbackFor()).contains(BadCredentialsException.class));
        assertTrue(Arrays.asList(tx.noRollbackFor()).contains(LockedException.class));
    }

    @Test
    void cambioObligatorioRotaVersionRevocaSesionesYLaClaveAnteriorDejaDeServir() {
        String claveAnterior = "Temporal-prueba-1";
        String claveNueva = "Nueva-prueba-2";
        Usuario cuenta = cuenta(9L, Usuario.EstadoUsuario.ACTIVO, claveAnterior);
        cuenta.setDebeCambiarClave(true);
        cuenta.setAuthVersion(4);
        when(usuarios.findByEmailForUpdate(cuenta.getEmail())).thenReturn(Optional.of(cuenta));
        when(jwt.generarAccessToken(cuenta)).thenReturn("token-renovado");

        var respuesta = service.cambiarClave(cuenta.getEmail(), claveAnterior, claveNueva);

        assertAll(
                () -> assertEquals("token-renovado", respuesta.accessToken()),
                () -> assertFalse(cuenta.isDebeCambiarClave()),
                () -> assertEquals(5, cuenta.getAuthVersion()),
                () -> assertTrue(encoder.matches(claveNueva, cuenta.getHashPassword())),
                () -> assertFalse(encoder.matches(claveAnterior, cuenta.getHashPassword())));
        verify(usuarios).revocarRefreshTokens(cuenta.getId());
        verify(usuarios).saveAndFlush(cuenta);
    }

    private Usuario cuenta(Long id, Usuario.EstadoUsuario estado, String clave) {
        Rol rol = mock(Rol.class);
        when(rol.getCodigo()).thenReturn("SUPER_ADMIN");
        Usuario cuenta = new Usuario();
        cuenta.setId(id);
        cuenta.setUsername("cuenta-prueba");
        cuenta.setEmail("cuenta-prueba@bellini.edu.ec");
        cuenta.setNombres("Cuenta");
        cuenta.setApellidos("Prueba");
        cuenta.setEstado(estado);
        cuenta.setHashPassword(encoder.encode(clave));
        cuenta.setRoles(Set.of(rol));
        return cuenta;
    }
}
