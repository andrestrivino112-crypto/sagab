package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.entity.Representante;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RepresentanteRepository extends JpaRepository<Representante, Long> {
    Optional<Representante> findByUsuarioId(Long idUsuario);
}
