package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.EntregaTarea;
import ec.edu.bellini.sagab.model.Estudiante;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EntregaTareaRepository extends JpaRepository<EntregaTarea, Long> {
    List<EntregaTarea> findByTareaId(Long idTarea);
    List<EntregaTarea> findByEstudianteIdOrderByFechaEntregaDesc(Long idEstudiante);
    Optional<EntregaTarea> findByTareaIdAndEstudianteId(Long idTarea, Long idEstudiante);
    List<EntregaTarea> findByEstudianteIn(List<Estudiante> estudiantes);
}
