package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.Rubro;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RubroRepository extends JpaRepository<Rubro, Integer> {
    List<Rubro> findByAnioLectivoOrderByNombreAsc(String anioLectivo);
}
