package ec.edu.bellini.sagab.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Registra eventos de seguridad a nivel de aplicación
 * (login, login fallido, accesos denegados, exportaciones)
 * en la tabla inmutable auditoria.evento_seguridad.
 */
@Service
public class EventoSeguridadService {

    private final JdbcTemplate jdbc;

    public EventoSeguridadService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void loginExitoso(String email, String ip, String userAgent) {
        registrar("LOGIN", email, "Inicio de sesión exitoso", ip, userAgent);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void loginFallido(String email, String motivo, String ip, String userAgent) {
        registrar("LOGIN_FALLIDO", email, motivo, ip, userAgent);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void cuentaGestionada(String actor, String accion, Long idObjetivo, String usernameObjetivo,
                                 String ip, String userAgent) {
        registrar(accion, actor,
                accion + "; cuentaObjetivo=" + idObjetivo + "; username=" + usernameObjetivo,
                ip, userAgent);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void accesoDenegado(String actor, String motivo, String ip, String userAgent) {
        registrar("ACCESO_DENEGADO", actor, motivo, ip, userAgent);
    }

    private void registrar(String operacion, String usuario, String detalle, String ip, String userAgent) {
        jdbc.update("""
                INSERT INTO auditoria.evento_seguridad
                    (operacion, usuario_app, detalle, ip_cliente, user_agent)
                VALUES (?::auditoria.tipo_operacion, ?, ?, ?::inet, ?)
                """, operacion, usuario, detalle, normalizarIp(ip), limitar(userAgent, 300));
    }

    private String normalizarIp(String ip) {
        return ip == null || ip.isBlank() ? null : ip;
    }

    private String limitar(String valor, int maximo) {
        if (valor == null) return null;
        return valor.length() <= maximo ? valor : valor.substring(0, maximo);
    }
}
