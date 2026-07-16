package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.PeriodoAcademico;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PeriodoAcademicoRepository extends JpaRepository<PeriodoAcademico, Integer> {
    List<PeriodoAcademico> findByActivoTrue();
    Optional<PeriodoAcademico> findFirstByActivoTrueOrderByFechaInicioDesc();
}
