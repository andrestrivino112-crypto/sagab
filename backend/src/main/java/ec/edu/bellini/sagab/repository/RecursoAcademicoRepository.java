package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.RecursoAcademico;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RecursoAcademicoRepository extends JpaRepository<RecursoAcademico, Long> {
    List<RecursoAcademico> findByAsignacionIdOrderByCreadoEnDesc(Long idAsignacion);
}
