package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.model.Rol;
import ec.edu.bellini.sagab.model.Usuario;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;

/** Emisión y validación de tokens JWT (HS256). */
@Service
public class JwtService {

    private final SecretKey clave;
    private final long minutosAcceso;

    public JwtService(@Value("${sagab.jwt.secret}") String secreto,
                      @Value("${sagab.jwt.access-minutes}") long minutosAcceso) {
        if (secreto == null || secreto.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("sagab.jwt.secret debe tener al menos 32 bytes");
        }
        this.clave = Keys.hmacShaKeyFor(secreto.getBytes(StandardCharsets.UTF_8));
        this.minutosAcceso = minutosAcceso;
    }

    public String generarAccessToken(Usuario u) {
        Instant ahora = Instant.now();
        List<String> roles = u.getRoles().stream().map(Rol::getCodigo).toList();
        return Jwts.builder()
                .subject(u.getEmail())
                .claim("uid", u.getId())
                .claim("nombre", u.nombreCompleto())
                .claim("roles", roles)
                .issuedAt(Date.from(ahora))
                .expiration(Date.from(ahora.plus(minutosAcceso, ChronoUnit.MINUTES)))
                .signWith(clave)
                .compact();
    }

    /** Devuelve los claims si el token es válido; lanza JwtException si no. */
    public Claims validar(String token) {
        return Jwts.parser().verifyWith(clave).build()
                .parseSignedClaims(token).getPayload();
    }
}
