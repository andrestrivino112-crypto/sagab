package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.entity.Docente;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DocenteRepository extends JpaRepository<Docente, Long> {
    Optional<Docente> findByUsuarioEmail(String email);
}
