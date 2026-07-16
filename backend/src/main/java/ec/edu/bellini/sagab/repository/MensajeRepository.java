package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.Mensaje;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MensajeRepository extends JpaRepository<Mensaje, Long> {
}
