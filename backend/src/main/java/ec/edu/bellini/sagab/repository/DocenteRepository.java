package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.Docente;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;

import java.util.List;
import java.util.Optional;

public interface DocenteRepository extends JpaRepository<Docente, Long> {
    Optional<Docente> findByUsuarioEmail(String email);
    @EntityGraph(attributePaths = "usuario")
    List<Docente> findAllByOrderByUsuarioApellidosAscUsuarioNombresAsc();
}
