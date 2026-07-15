package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.entity.Pago;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PagoRepository extends JpaRepository<Pago, Long> {
    List<Pago> findByObligacionIdOrderByFechaPagoDesc(Long idObligacion);
}
