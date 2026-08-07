package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.SeguimientoDeceMensaje;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface SeguimientoDeceMensajeRepository extends JpaRepository<SeguimientoDeceMensaje, Long> {
    @Query(value = """
            SELECT m.id_mensaje AS idMensaje, m.asunto AS asunto, m.cuerpo AS cuerpo,
                   m.enviado_en AS enviadoEn, md.leido_en AS leidoEn,
                   u.nombres || ' ' || u.apellidos AS remitente
            FROM sagab.seguimiento_dece_mensaje sm
            JOIN sagab.mensaje m ON m.id_mensaje = sm.id_mensaje
            JOIN sagab.usuario u ON u.id_usuario = sm.enviado_por
            LEFT JOIN sagab.mensaje_destinatario md
              ON md.id_mensaje = sm.id_mensaje AND md.id_destinatario = sm.id_destinatario
            WHERE sm.id_seguimiento = :idSeguimiento
            ORDER BY m.enviado_en DESC
            """, nativeQuery = true)
    List<MensajeProjection> historial(@Param("idSeguimiento") Long idSeguimiento);

    interface MensajeProjection {
        Long getIdMensaje();
        String getAsunto();
        String getCuerpo();
        Instant getEnviadoEn();
        Instant getLeidoEn();
        String getRemitente();
    }
}
