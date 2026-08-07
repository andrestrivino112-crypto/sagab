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

    long countByIdDestinatarioAndLeidoEnIsNull(Long idDestinatario);

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
}
