package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.Tarea;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TareaRepository extends JpaRepository<Tarea, Long> {
    List<Tarea> findByAsignacionIdOrderByFechaLimiteDesc(Long idAsignacion);
}
