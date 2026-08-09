package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.MensajeDestinatario;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MensajeDestinatarioRepository extends JpaRepository<MensajeDestinatario, MensajeDestinatario.Pk> {

    /** Acotada con Pageable: una bandeja de entrada no debe devolver miles de filas de golpe. */
    @Query("SELECT md FROM MensajeDestinatario md JOIN FETCH md.mensaje m " +
           "WHERE md.idDestinatario = :idUsuario ORDER BY m.enviadoEn DESC")
    List<MensajeDestinatario> bandejaDeEntrada(@Param("idUsuario") Long idUsuario, Pageable pageable);

    /** La bandeja del docente es un canal institucional unidireccional: únicamente mensajes
     * cuyo remitente tenga rol ADMIN. Se aplica en SQL para que no pueda eludirse desde la API. */
    @Query(value = """
            SELECT md.*
            FROM sagab.mensaje_destinatario md
            JOIN sagab.mensaje m ON m.id_mensaje = md.id_mensaje
            WHERE md.id_destinatario = :idUsuario
              AND EXISTS (
                  SELECT 1 FROM sagab.usuario_rol ur
                  JOIN sagab.rol r ON r.id_rol = ur.id_rol
                  WHERE ur.id_usuario = m.id_remitente AND r.codigo IN ('ADMIN', 'SUPER_ADMIN')
              )
            ORDER BY m.enviado_en DESC
            """, nativeQuery = true)
    List<MensajeDestinatario> bandejaDocenteDesdeAdmin(@Param("idUsuario") Long idUsuario, Pageable pageable);

    long countByIdDestinatarioAndLeidoEnIsNull(Long idDestinatario);

    @Query(value = """
            SELECT m.id_mensaje AS idMensaje, m.asunto AS asunto,
                   u.nombres || ' ' || u.apellidos AS remitente,
                   m.enviado_en AS enviadoEn, (md.leido_en IS NOT NULL) AS leido
            FROM sagab.mensaje_destinatario md
            JOIN sagab.mensaje m ON m.id_mensaje = md.id_mensaje
            JOIN sagab.usuario u ON u.id_usuario = m.id_remitente
            WHERE md.id_destinatario = :idUsuario
            ORDER BY m.enviado_en DESC
            """, nativeQuery = true)
    List<MensajeRecienteProjection> mensajesRecientes(@Param("idUsuario") Long idUsuario, Pageable pageable);

    @Query(value = """
            SELECT count(*)
            FROM sagab.mensaje_destinatario md
            JOIN sagab.mensaje m ON m.id_mensaje = md.id_mensaje
            WHERE md.id_destinatario = :idUsuario AND md.leido_en IS NULL
              AND EXISTS (
                  SELECT 1 FROM sagab.usuario_rol ur
                  JOIN sagab.rol r ON r.id_rol = ur.id_rol
                  WHERE ur.id_usuario = m.id_remitente AND r.codigo IN ('ADMIN', 'SUPER_ADMIN')
              )
            """, nativeQuery = true)
    long countNoLeidosDocenteDesdeAdmin(@Param("idUsuario") Long idUsuario);

    @Modifying
    @Query("UPDATE MensajeDestinatario md SET md.leidoEn = CURRENT_TIMESTAMP " +
           "WHERE md.mensaje.id = :idMensaje AND md.idDestinatario = :idUsuario")
    int marcarLeido(@Param("idMensaje") Long idMensaje, @Param("idUsuario") Long idUsuario);

    /** Cuántos destinatarios tiene cada mensaje y cuántos ya lo leyeron — para la pestaña
     * "Enviados" del drill-down de Mensajes (saber si un circular ya fue visto por todos). */
    @Query("SELECT md.mensaje.id AS idMensaje, COUNT(md) AS totalDestinatarios, " +
           "SUM(CASE WHEN md.leidoEn IS NOT NULL THEN 1L ELSE 0L END) AS leidos " +
           "FROM MensajeDestinatario md WHERE md.mensaje.id IN :idsMensajes GROUP BY md.mensaje.id")
    List<ConteoLecturaProjection> conteoLecturaPorMensaje(@Param("idsMensajes") List<Long> idsMensajes);

    interface ConteoLecturaProjection {
        Long getIdMensaje();
        long getTotalDestinatarios();
        long getLeidos();
    }

    interface MensajeRecienteProjection {
        Long getIdMensaje();
        String getAsunto();
        String getRemitente();
        java.time.Instant getEnviadoEn();
        boolean getLeido();
    }
}
