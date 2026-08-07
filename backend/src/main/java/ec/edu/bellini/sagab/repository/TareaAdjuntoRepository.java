package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.TareaAdjunto;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TareaAdjuntoRepository extends JpaRepository<TareaAdjunto, Long> {
    List<TareaAdjunto> findByTareaIdOrderByCreadoEnDesc(Long idTarea);
    List<TareaAdjunto> findByTareaIdIn(List<Long> idsTareas);
}
