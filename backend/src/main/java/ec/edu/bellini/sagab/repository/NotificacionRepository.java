package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.Notificacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;

public interface NotificacionRepository extends JpaRepository<Notificacion, Long> {
    List<Notificacion> findByIdDestinatarioOrderByCreadoEnDesc(Long idDestinatario);

    /** Igual que MensajeDestinatarioRepository.marcarLeido: la restricción de propiedad va en el WHERE. */
    @Modifying
    @Query("UPDATE Notificacion n SET n.leidoEn = :ahora WHERE n.id = :id AND n.idDestinatario = :idUsuario AND n.leidoEn IS NULL")
    int marcarLeida(@Param("id") Long id, @Param("idUsuario") Long idUsuario, @Param("ahora") OffsetDateTime ahora);
}
