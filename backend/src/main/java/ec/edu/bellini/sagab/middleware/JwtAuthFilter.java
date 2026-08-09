package ec.edu.bellini.sagab.middleware;

import ec.edu.bellini.sagab.model.Rol;
import ec.edu.bellini.sagab.model.Usuario;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import ec.edu.bellini.sagab.service.EventoSeguridadService;
import ec.edu.bellini.sagab.service.JwtService;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
/** Extrae y valida el JWT. Además comprueba en base de datos que la cuenta siga activa y que
 * la versión de autenticación coincida; por eso deshabilitar o restablecer una cuenta revoca
 * inmediatamente sus tokens previos aunque la API sea stateless. */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthFilter.class);

    private final JwtService jwtService;
    private final UsuarioRepository usuarios;
    private final EventoSeguridadService eventos;

    public JwtAuthFilter(JwtService jwtService, UsuarioRepository usuarios,
                         EventoSeguridadService eventos) {
        this.jwtService = jwtService;
        this.usuarios = usuarios;
        this.eventos = eventos;
    }

    @Override
    @SuppressWarnings("unchecked")
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                Claims claims = jwtService.validar(header.substring(7));
                Number uidClaim = claims.get("uid", Number.class);
                Number versionClaim = claims.get("av", Number.class);
                if (uidClaim == null || versionClaim == null) {
                    registrarRechazo(claims.getSubject(), "Token sin versión de seguridad", req);
                    chain.doFilter(req, res);
                    return;
                }

                Usuario usuario = usuarios.findById(uidClaim.longValue()).orElse(null);
                if (usuario == null
                        || usuario.getEstado() != Usuario.EstadoUsuario.ACTIVO
                        || usuario.getAuthVersion() != versionClaim.intValue()
                        || !usuario.getEmail().equals(claims.getSubject())) {
                    registrarRechazo(claims.getSubject(), "Token revocado o cuenta no activa", req);
                    chain.doFilter(req, res);
                    return;
                }

                var authorities = usuario.getRoles().stream().map(Rol::getCodigo)
                        .map(r -> new SimpleGrantedAuthority("ROLE_" + r)).toList();
                var auth = new UsernamePasswordAuthenticationToken(usuario.getEmail(), null, authorities);
                auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(req));
                SecurityContextHolder.getContext().setAuthentication(auth);

                if (usuario.isDebeCambiarClave() && !esRutaPermitidaDuranteCambio(req)) {
                    eventos.accesoDenegado(usuario.getEmail(),
                            "Acceso bloqueado por cambio de contraseña pendiente",
                            req.getRemoteAddr(), req.getHeader("User-Agent"));
                    responderCambioPendiente(res);
                    return;
                }
            } catch (JwtException | IllegalArgumentException e) {
                // Token inválido o expirado: se continúa sin autenticación
                // y Spring Security responderá 401 en rutas protegidas.
                log.debug("Token JWT rechazado ({}): {}", req.getRequestURI(), e.getMessage());
            }
        }
        chain.doFilter(req, res);
    }

    private boolean esRutaPermitidaDuranteCambio(HttpServletRequest req) {
        return "/api/auth/me".equals(req.getRequestURI())
                || "/api/auth/cambiar-clave".equals(req.getRequestURI());
    }

    private void responderCambioPendiente(HttpServletResponse res) throws IOException {
        res.setStatus(HttpServletResponse.SC_FORBIDDEN);
        res.setCharacterEncoding("UTF-8");
        res.setContentType("application/json");
        res.getWriter().write("{\"status\":403,\"mensaje\":\"Debe cambiar su contraseña antes de continuar.\"}");
    }

    private void registrarRechazo(String actor, String motivo, HttpServletRequest req) {
        try {
            eventos.accesoDenegado(actor == null ? "token-sin-sujeto" : actor, motivo,
                    req.getRemoteAddr(), req.getHeader("User-Agent"));
        } catch (RuntimeException e) {
            // La auditoría nunca debe convertir una denegación segura en acceso permitido ni
            // impedir que Spring responda 401. Se conserva un log sin token ni datos sensibles.
            log.warn("No se pudo registrar el rechazo de un token para {}", req.getRequestURI());
        }
    }
}
