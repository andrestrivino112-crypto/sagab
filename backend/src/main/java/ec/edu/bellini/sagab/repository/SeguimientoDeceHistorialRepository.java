package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.SeguimientoDeceHistorial;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SeguimientoDeceHistorialRepository extends JpaRepository<SeguimientoDeceHistorial, Long> {
    @EntityGraph(attributePaths = "cambiadoPor")
    List<SeguimientoDeceHistorial> findBySeguimientoIdOrderByCambiadoEnDesc(Long idSeguimiento);
}
