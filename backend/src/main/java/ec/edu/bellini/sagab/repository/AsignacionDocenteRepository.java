package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.entity.AsignacionDocente;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AsignacionDocenteRepository extends JpaRepository<AsignacionDocente, Long> {
    List<AsignacionDocente> findByDocenteUsuarioEmailOrderByPeriodoFechaInicioDesc(String email);

    List<AsignacionDocente> findAllByOrderByPeriodoFechaInicioDesc();
}
