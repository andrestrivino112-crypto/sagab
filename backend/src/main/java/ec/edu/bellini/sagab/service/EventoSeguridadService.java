package ec.edu.bellini.sagab.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Registra eventos de seguridad a nivel de aplicación
 * (login, login fallido, accesos denegados, exportaciones)
 * en la tabla inmutable auditoria.evento_seguridad.
 */
@Service
public class EventoSeguridadService {

    private final JdbcTemplate jdbc;

    public EventoSeguridadService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public void loginExitoso(String email, String ip, String userAgent) {
        registrar("LOGIN", email, "Inicio de sesión exitoso", ip, userAgent);
    }

    public void loginFallido(String email, String motivo, String ip, String userAgent) {
        registrar("LOGIN_FALLIDO", email, motivo, ip, userAgent);
    }

    public void exportacion(String email, String detalle, String ip) {
        registrar("EXPORTACION", email, detalle, ip, null);
    }

    private void registrar(String operacion, String usuario, String detalle, String ip, String userAgent) {
        jdbc.update("""
                INSERT INTO auditoria.evento_seguridad
                    (operacion, usuario_app, detalle, ip_cliente, user_agent)
                VALUES (?::auditoria.tipo_operacion, ?, ?, ?::inet, ?)
                """, operacion, usuario, detalle, ip, userAgent);
    }
}
