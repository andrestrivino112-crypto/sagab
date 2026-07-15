package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.entity.Calificacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface CalificacionRepository extends JpaRepository<Calificacion, Long> {
    List<Calificacion> findByIdAsignacionAndParcial(Long idAsignacion, short parcial);
    List<Calificacion> findByEstudianteIdOrderByParcialAsc(Long idEstudiante);
    Optional<Calificacion> findByEstudianteIdAndIdAsignacionAndParcial(Long idEstudiante, Long idAsignacion, short parcial);

    /** Promedio institucional (null si todavía no hay ninguna calificación). */
    @Query("SELECT AVG(c.promedio) FROM Calificacion c WHERE c.promedio IS NOT NULL")
    BigDecimal promedioInstitucional();

    /** Rendimiento promedio por paralelo, para el gráfico del Dashboard. */
    @Query(value = """
            SELECT p.nivel || ' ' || p.seccion AS paralelo, AVG(c.promedio) AS promedio
            FROM sagab.calificacion c
            JOIN sagab.estudiante e ON e.id_estudiante = c.id_estudiante
            JOIN sagab.paralelo p ON p.id_paralelo = e.id_paralelo
            WHERE c.promedio IS NOT NULL
            GROUP BY p.nivel, p.seccion
            ORDER BY p.nivel, p.seccion
            """, nativeQuery = true)
    List<RendimientoParaleloProjection> rendimientoPorParalelo();

    interface RendimientoParaleloProjection {
        String getParalelo();
        BigDecimal getPromedio();
    }
}
