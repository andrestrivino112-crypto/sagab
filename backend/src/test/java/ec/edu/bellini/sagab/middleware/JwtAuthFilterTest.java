package ec.edu.bellini.sagab.middleware;

import ec.edu.bellini.sagab.model.Rol;
import ec.edu.bellini.sagab.model.Usuario;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import ec.edu.bellini.sagab.service.EventoSeguridadService;
import ec.edu.bellini.sagab.service.JwtService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JwtAuthFilterTest {

    private JwtService jwt;
    private UsuarioRepository usuarios;
    private EventoSeguridadService eventos;
    private JwtAuthFilter filter;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
        jwt = mock(JwtService.class);
        usuarios = mock(UsuarioRepository.class);
        eventos = mock(EventoSeguridadService.class);
        filter = new JwtAuthFilter(jwt, usuarios, eventos);
    }

    @AfterEach
    void limpiarContexto() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void autenticaCuentaActivaConVersionVigenteYRolesDeBaseDeDatos() throws Exception {
        Claims claims = claims(7L, 3, "cuenta@bellini.edu.ec");
        Usuario usuario = usuario(7L, 3, Usuario.EstadoUsuario.ACTIVO, false);
        when(jwt.validar("token-vigente")).thenReturn(claims);
        when(usuarios.findById(7L)).thenReturn(Optional.of(usuario));
        var request = request("/api/dashboard/resumen", "token-vigente");
        var response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        assertEquals(usuario.getEmail(), SecurityContextHolder.getContext().getAuthentication().getName());
        assertTrue(SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
                .anyMatch(a -> "ROLE_SUPER_ADMIN".equals(a.getAuthority())));
        verify(eventos, never()).accesoDenegado(eq(usuario.getEmail()), eq("Token revocado o cuenta no activa"),
                eq("127.0.0.1"), eq(null));
    }

    @Test
    void rechazaTokenDeCuentaInactiva() throws Exception {
        Claims claims = claims(7L, 3, "cuenta@bellini.edu.ec");
        Usuario usuario = usuario(7L, 3, Usuario.EstadoUsuario.INACTIVO, false);
        when(jwt.validar("token-inactivo")).thenReturn(claims);
        when(usuarios.findById(7L)).thenReturn(Optional.of(usuario));
        var request = request("/api/dashboard/resumen", "token-inactivo");
        var response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(eventos).accesoDenegado(usuario.getEmail(), "Token revocado o cuenta no activa",
                "127.0.0.1", null);
    }

    @Test
    void rechazaTokenConVersionDistinta() throws Exception {
        Claims claims = claims(7L, 2, "cuenta@bellini.edu.ec");
        Usuario usuario = usuario(7L, 3, Usuario.EstadoUsuario.ACTIVO, false);
        when(jwt.validar("token-revocado")).thenReturn(claims);
        when(usuarios.findById(7L)).thenReturn(Optional.of(usuario));
        var request = request("/api/dashboard/resumen", "token-revocado");
        var response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(eventos).accesoDenegado(usuario.getEmail(), "Token revocado o cuenta no activa",
                "127.0.0.1", null);
    }

    @Test
    void rechazaTokenViejoSinVersionDeSeguridad() throws Exception {
        Claims claims = mock(Claims.class);
        when(claims.getSubject()).thenReturn("cuenta@bellini.edu.ec");
        when(claims.get("uid", Number.class)).thenReturn(7L);
        when(claims.get("av", Number.class)).thenReturn(null);
        when(jwt.validar("token-viejo")).thenReturn(claims);
        var request = request("/api/dashboard/resumen", "token-viejo");
        var response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(usuarios, never()).findById(7L);
        verify(eventos).accesoDenegado("cuenta@bellini.edu.ec", "Token sin versión de seguridad",
                "127.0.0.1", null);
    }

    @Test
    void cambioObligatorioBloqueaRutasDeNegocioSinContinuarLaCadena() throws Exception {
        Claims claims = claims(7L, 3, "cuenta@bellini.edu.ec");
        Usuario usuario = usuario(7L, 3, Usuario.EstadoUsuario.ACTIVO, true);
        when(jwt.validar("token-cambio")).thenReturn(claims);
        when(usuarios.findById(7L)).thenReturn(Optional.of(usuario));
        var request = request("/api/dashboard/resumen", "token-cambio");
        var response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain, never()).doFilter(request, response);
        assertEquals(403, response.getStatus());
        assertTrue(response.getContentAsString().contains("Debe cambiar su contraseña"));
        verify(eventos).accesoDenegado(usuario.getEmail(),
                "Acceso bloqueado por cambio de contraseña pendiente", "127.0.0.1", null);
    }

    @Test
    void cambioObligatorioPermiteLaRutaExistenteDeCambioDeClave() throws Exception {
        Claims claims = claims(7L, 3, "cuenta@bellini.edu.ec");
        Usuario usuario = usuario(7L, 3, Usuario.EstadoUsuario.ACTIVO, true);
        when(jwt.validar("token-cambio")).thenReturn(claims);
        when(usuarios.findById(7L)).thenReturn(Optional.of(usuario));
        var request = request("/api/auth/cambiar-clave", "token-cambio");
        request.setMethod("POST");
        var response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        assertEquals(200, response.getStatus());
    }

    private Claims claims(Long id, int version, String subject) {
        Claims claims = mock(Claims.class);
        when(claims.getSubject()).thenReturn(subject);
        when(claims.get("uid", Number.class)).thenReturn(id);
        when(claims.get("av", Number.class)).thenReturn(version);
        return claims;
    }

    private Usuario usuario(Long id, int version, Usuario.EstadoUsuario estado, boolean cambioPendiente) {
        Rol rol = mock(Rol.class);
        when(rol.getCodigo()).thenReturn("SUPER_ADMIN");
        Usuario usuario = new Usuario();
        usuario.setId(id);
        usuario.setEmail("cuenta@bellini.edu.ec");
        usuario.setEstado(estado);
        usuario.setAuthVersion(version);
        usuario.setDebeCambiarClave(cambioPendiente);
        usuario.setRoles(Set.of(rol));
        return usuario;
    }

    private MockHttpServletRequest request(String uri, String token) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", uri);
        request.setRequestURI(uri);
        request.setRemoteAddr("127.0.0.1");
        request.addHeader("Authorization", "Bearer " + token);
        return request;
    }
}
