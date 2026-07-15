package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.entity.Paralelo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ParaleloRepository extends JpaRepository<Paralelo, Integer> {
    List<Paralelo> findByAnioLectivoOrderByNivelAscSeccionAsc(String anioLectivo);

    Optional<Paralelo> findByNivelAndSeccionAndAnioLectivo(String nivel, String seccion, String anioLectivo);
}
