package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.entity.ObligacionPago;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ObligacionPagoRepository extends JpaRepository<ObligacionPago, Long> {

    List<ObligacionPago> findByEstudianteIdOrderByFechaVencimientoDesc(Long idEstudiante);

    /** Estudiantes distintos con al menos una obligación vencida — KPI "estudiantes en mora". */
    @Query("SELECT COUNT(DISTINCT o.estudiante.id) FROM ObligacionPago o WHERE o.estado = :estado")
    long contarEstudiantesPorEstado(@Param("estado") ObligacionPago.EstadoPago estado);
}
