package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.EventoCalendarioAdjunto;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EventoCalendarioAdjuntoRepository extends JpaRepository<EventoCalendarioAdjunto, Long> {
    List<EventoCalendarioAdjunto> findByEventoIdInOrderByCreadoEnDesc(List<Long> idsEventos);
    List<EventoCalendarioAdjunto> findByEventoIdOrderByCreadoEnDesc(Long idEvento);
    long countByEventoId(Long idEvento);

    @Override
    @EntityGraph(attributePaths = {"evento", "evento.creador"})
    Optional<EventoCalendarioAdjunto> findById(Long id);
}
