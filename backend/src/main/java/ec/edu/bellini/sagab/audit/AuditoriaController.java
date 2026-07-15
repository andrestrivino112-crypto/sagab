package ec.edu.bellini.sagab.audit;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Panel de consulta para el rol AUDITOR (y ADMIN).
 * Solo lectura — la bitácora es inmutable a nivel de base de datos.
 */
@RestController
@RequestMapping("/api/auditoria")
@PreAuthorize("hasAnyRole('AUDITOR','ADMIN')")
public class AuditoriaController {

    private final JdbcTemplate jdbc;

    public AuditoriaController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    /** Historial de cambios de datos, con filtros opcionales y paginación. */
    @GetMapping("/cambios")
    public List<Map<String, Object>> cambios(
            @RequestParam(required = false) String tabla,
            @RequestParam(required = false) String usuario,
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "50") int tamano) {
        int limite = Math.min(Math.max(tamano, 1), 200);
        return jdbc.queryForList("""
                SELECT id_registro, ejecutado_en, usuario_app, operacion::text,
                       tabla, id_fila, columnas_modificadas,
                       datos_antes::text, datos_despues::text, ip_cliente::text
                FROM auditoria.registro_cambio
                WHERE (?::text IS NULL OR tabla = ?)
                  AND (?::text IS NULL OR usuario_app = ?)
                ORDER BY ejecutado_en DESC
                LIMIT ? OFFSET ?
                """, tabla, tabla, usuario, usuario, limite, pagina * limite);
    }

    /** Eventos de seguridad: logins, fallos, exportaciones. */
    @GetMapping("/eventos")
    public List<Map<String, Object>> eventos(
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "50") int tamano) {
        int limite = Math.min(Math.max(tamano, 1), 200);
        return jdbc.queryForList("""
                SELECT id_evento, ejecutado_en, operacion::text, usuario_app,
                       detalle, ip_cliente::text, user_agent
                FROM auditoria.evento_seguridad
                ORDER BY ejecutado_en DESC
                LIMIT ? OFFSET ?
                """, limite, pagina * limite);
    }

    /** Trazabilidad completa de una fila específica (p.ej. una calificación). */
    @GetMapping("/historial/{tabla}/{idFila}")
    public List<Map<String, Object>> historialFila(@PathVariable String tabla, @PathVariable String idFila) {
        return jdbc.queryForList("""
                SELECT ejecutado_en, usuario_app, operacion::text,
                       columnas_modificadas, datos_antes::text, datos_despues::text
                FROM auditoria.registro_cambio
                WHERE tabla = ? AND id_fila = ?
                ORDER BY ejecutado_en
                """, tabla, idFila);
    }
}
