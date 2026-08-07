package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.AuthDtos;

import ec.edu.bellini.sagab.model.Rol;
import ec.edu.bellini.sagab.model.Usuario;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

/**
 * Autenticación con protección contra fuerza bruta:
 * tras N intentos fallidos la cuenta se bloquea temporalmente y el
 * evento queda registrado en auditoria.evento_seguridad.
 */
@Service
public class AuthService {

    private final UsuarioRepository usuarios;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final EventoSeguridadService eventos;
    private final int maxIntentos;
    private final int minutosBloqueo;
    private final long minutosAcceso;

    public AuthService(UsuarioRepository usuarios, PasswordEncoder encoder, JwtService jwt,
                       EventoSeguridadService eventos,
                       @Value("${sagab.seguridad.max-intentos-fallidos}") int maxIntentos,
                       @Value("${sagab.seguridad.minutos-bloqueo}") int minutosBloqueo,
                       @Value("${sagab.jwt.access-minutes}") long minutosAcceso) {
        this.usuarios = usuarios;
        this.encoder = encoder;
        this.jwt = jwt;
        this.eventos = eventos;
        this.maxIntentos = maxIntentos;
        this.minutosBloqueo = minutosBloqueo;
        this.minutosAcceso = minutosAcceso;
    }

    @Transactional
    public AuthDtos.TokenResponse login(String usuario, String password, String ip, String userAgent) {
        Usuario u = usuarios.findByUsername(usuario.trim())
                .orElseThrow(() -> {
                    eventos.loginFallido(usuario, "Usuario inexistente", ip, userAgent);
                    // Mensaje genérico: no revelar si el usuario existe
                    return new BadCredentialsException("Credenciales inválidas");
                });

        if (u.getEstado() != Usuario.EstadoUsuario.ACTIVO) {
            eventos.loginFallido(usuario, "Cuenta " + u.getEstado(), ip, userAgent);
            throw new LockedException("La cuenta no está activa. Contacte a la administración.");
        }
        if (u.getBloqueadoHasta() != null && u.getBloqueadoHasta().isAfter(OffsetDateTime.now())) {
            eventos.loginFallido(usuario, "Cuenta bloqueada temporalmente", ip, userAgent);
            throw new LockedException("Cuenta bloqueada temporalmente por intentos fallidos.");
        }

        if (!encoder.matches(password, u.getHashPassword())) {
            u.setIntentosFallidos((short) (u.getIntentosFallidos() + 1));
            if (u.getIntentosFallidos() >= maxIntentos) {
                u.setBloqueadoHasta(OffsetDateTime.now().plusMinutes(minutosBloqueo));
                u.setIntentosFallidos((short) 0);
            }
            usuarios.save(u);
            eventos.loginFallido(usuario, "Contraseña incorrecta", ip, userAgent);
            throw new BadCredentialsException("Credenciales inválidas");
        }

        u.setIntentosFallidos((short) 0);
        u.setBloqueadoHasta(null);
        u.setUltimoAcceso(OffsetDateTime.now());
        usuarios.save(u);
        eventos.loginExitoso(u.getEmail(), ip, userAgent);

        return new AuthDtos.TokenResponse(
                jwt.generarAccessToken(u), "Bearer", minutosAcceso,
                u.nombreCompleto(),
                u.getRoles().stream().map(Rol::getCodigo).toList(),
                u.isDebeCambiarClave());
    }

    /** Reconstruye los datos de sesión a partir de un access token ya válido (JwtAuthFilter ya
     * autenticó la petición) — usado al recargar la página para no perder la sesión. */
    @Transactional(readOnly = true)
    public AuthDtos.SesionResponse me(String email) {
        Usuario u = usuarios.findByEmail(email).orElseThrow();
        return new AuthDtos.SesionResponse(
                u.nombreCompleto(), u.getRoles().stream().map(Rol::getCodigo).toList(), u.isDebeCambiarClave());
    }

    /** Cambio de contraseña por el propio usuario (incluye el cambio obligatorio en el primer login). */
    @Transactional
    public void cambiarClave(String email, String claveActual, String claveNueva) {
        Usuario u = usuarios.findByEmail(email).orElseThrow();
        if (!encoder.matches(claveActual, u.getHashPassword())) {
            throw new BadCredentialsException("La contraseña actual no es correcta");
        }
        u.setHashPassword(encoder.encode(claveNueva));
        u.setDebeCambiarClave(false);
        usuarios.save(u);
    }
}
