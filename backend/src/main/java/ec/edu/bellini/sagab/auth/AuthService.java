package ec.edu.bellini.sagab.auth;

import ec.edu.bellini.sagab.audit.EventoSeguridadService;
import ec.edu.bellini.sagab.entity.Rol;
import ec.edu.bellini.sagab.entity.Usuario;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import ec.edu.bellini.sagab.security.JwtService;
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

    public AuthService(UsuarioRepository usuarios, PasswordEncoder encoder, JwtService jwt,
                       EventoSeguridadService eventos,
                       @Value("${sagab.seguridad.max-intentos-fallidos}") int maxIntentos,
                       @Value("${sagab.seguridad.minutos-bloqueo}") int minutosBloqueo) {
        this.usuarios = usuarios;
        this.encoder = encoder;
        this.jwt = jwt;
        this.eventos = eventos;
        this.maxIntentos = maxIntentos;
        this.minutosBloqueo = minutosBloqueo;
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
                jwt.generarAccessToken(u), "Bearer", 30,
                u.nombreCompleto(),
                u.getRoles().stream().map(Rol::getCodigo).toList(),
                u.isDebeCambiarClave());
    }
}
