package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.Pago;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PagoRepository extends JpaRepository<Pago, Long> {
    List<Pago> findByObligacionIdOrderByFechaPagoDesc(Long idObligacion);

    /** Trae de una sola consulta los pagos de un lote de obligaciones (evita N+1 al listar el estado de cuenta). */
    List<Pago> findByObligacionIdInOrderByFechaPagoDesc(List<Long> idsObligacion);

    /** Cola de revisión del admin: transferencias pendientes de aprobar/rechazar. Acotada con Pageable
     * (temporada de matrícula/cobro puede acumular muchos comprobantes de golpe). */
    List<Pago> findByEstadoRevisionOrderByFechaPagoAsc(Pago.EstadoRevision estadoRevision, Pageable pageable);

    /** Detección de comprobante duplicado: la misma imagen/PDF ya se subió para esta obligación. */
    boolean existsByObligacionIdAndComprobanteHash(Long idObligacion, String comprobanteHash);
}
