package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.Materia;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MateriaRepository extends JpaRepository<Materia, Integer> {
    List<Materia> findAllByOrderByNombreAsc();
}
