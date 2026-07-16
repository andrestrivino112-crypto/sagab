package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.MensajeDestinatario;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MensajeDestinatarioRepository extends JpaRepository<MensajeDestinatario, MensajeDestinatario.Pk> {

    @Query("SELECT md FROM MensajeDestinatario md JOIN FETCH md.mensaje m " +
           "WHERE md.idDestinatario = :idUsuario ORDER BY m.enviadoEn DESC")
    List<MensajeDestinatario> bandejaDeEntrada(@Param("idUsuario") Long idUsuario);

    long countByIdDestinatarioAndLeidoEnIsNull(Long idDestinatario);

    @Modifying
    @Query("UPDATE MensajeDestinatario md SET md.leidoEn = CURRENT_TIMESTAMP " +
           "WHERE md.mensaje.id = :idMensaje AND md.idDestinatario = :idUsuario")
    int marcarLeido(@Param("idMensaje") Long idMensaje, @Param("idUsuario") Long idUsuario);
}
