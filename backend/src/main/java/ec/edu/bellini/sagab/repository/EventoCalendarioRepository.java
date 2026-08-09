package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.EventoCalendario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Pageable;

import java.time.OffsetDateTime;
import java.util.List;

public interface EventoCalendarioRepository extends JpaRepository<EventoCalendario, Long> {
    @Query("SELECT e FROM EventoCalendario e JOIN FETCH e.creador " +
           "WHERE e.inicio <= :hasta AND e.fin >= :desde ORDER BY e.inicio")
    List<EventoCalendario> enRangoAdmin(@Param("desde") OffsetDateTime desde,
                                        @Param("hasta") OffsetDateTime hasta);

    @Query("SELECT e FROM EventoCalendario e JOIN FETCH e.creador " +
           "WHERE e.inicio <= :hasta AND e.fin >= :desde AND (" +
           "e.estado IN :estados OR " +
           "(e.estado = :programado AND (e.publicarEn IS NULL OR e.publicarEn <= :ahora))) " +
           "ORDER BY e.inicio")
    List<EventoCalendario> visiblesEnRango(@Param("desde") OffsetDateTime desde,
                                           @Param("hasta") OffsetDateTime hasta,
                                           @Param("ahora") OffsetDateTime ahora,
                                           @Param("estados") List<EventoCalendario.Estado> estados,
                                           @Param("programado") EventoCalendario.Estado programado);

    /** Consulta acotada para el resumen de Secretaría: omite borradores, ocultos y cancelados. */
    @Query("SELECT e FROM EventoCalendario e JOIN FETCH e.creador " +
           "WHERE e.fin >= :ahora AND e.inicio <= :hasta AND (" +
           "e.estado = :publicado OR (e.estado = :programado AND e.publicarEn <= :ahora)) " +
           "ORDER BY e.inicio")
    List<EventoCalendario> proximosPublicados(@Param("ahora") OffsetDateTime ahora,
                                              @Param("hasta") OffsetDateTime hasta,
                                              @Param("publicado") EventoCalendario.Estado publicado,
                                              @Param("programado") EventoCalendario.Estado programado,
                                              Pageable pageable);
}
