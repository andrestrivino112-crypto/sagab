package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.ObligacionPago;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ObligacionPagoRepository extends JpaRepository<ObligacionPago, Long> {

    List<ObligacionPago> findByEstudianteIdOrderByFechaVencimientoDesc(Long idEstudiante);

    /** Evita duplicar la obligación del mes si el estudiante (o un admin) ya generó una para este rubro. */
    Optional<ObligacionPago> findByEstudianteIdAndRubroIdAndMes(Long idEstudiante, Integer idRubro, LocalDate mes);

    /** Estudiantes distintos con al menos una obligación vencida — KPI "estudiantes en mora". */
    @Query("SELECT COUNT(DISTINCT o.estudiante.id) FROM ObligacionPago o WHERE o.estado = :estado")
    long contarEstudiantesPorEstado(@Param("estado") ObligacionPago.EstadoPago estado);

    /** Job diario: transiciona a VENCIDO lo que ya pasó de fecha y seguía PENDIENTE. */
    @Modifying
    @Query("UPDATE ObligacionPago o SET o.estado = :nuevo WHERE o.estado = :actual AND o.fechaVencimiento < :hoy")
    int actualizarEstadoPorVencimiento(@Param("actual") ObligacionPago.EstadoPago actual,
                                       @Param("nuevo") ObligacionPago.EstadoPago nuevo, @Param("hoy") LocalDate hoy);

    /**
     * Un registro por estudiante con al menos una obligación VENCIDO, con el total pendiente y los
     * datos de contacto del representante — respalda el drill-down "Estudiantes en mora" del
     * Dashboard. Agregado en una sola consulta (evita N+1 al recorrer estudiante por estudiante).
     */
    @Query(value = """
            SELECT e.id_estudiante                       AS idEstudiante,
                   e.codigo                               AS codigo,
                   e.apellidos || ' ' || e.nombres         AS nombreCompleto,
                   CASE WHEN p.id_paralelo IS NULL THEN NULL ELSE p.nivel || ' ' || p.seccion END AS paralelo,
                   CASE WHEN ur.id_usuario IS NULL THEN NULL ELSE ur.apellidos || ' ' || ur.nombres END AS representante,
                   ur.telefono                             AS representanteTelefono,
                   ur.email                                AS representanteEmail,
                   SUM(o.valor)                            AS valorPendiente,
                   MIN(o.fecha_vencimiento)                AS fechaVencimientoMasAntigua,
                   COUNT(*)                                AS obligacionesVencidas
            FROM sagab.obligacion_pago o
            JOIN sagab.estudiante e ON e.id_estudiante = o.id_estudiante
            LEFT JOIN sagab.paralelo p ON p.id_paralelo = e.id_paralelo
            LEFT JOIN sagab.representante r ON r.id_representante = e.id_representante
            LEFT JOIN sagab.usuario ur ON ur.id_usuario = r.id_usuario
            WHERE o.estado = 'VENCIDO' AND e.activo
            GROUP BY e.id_estudiante, e.codigo, e.apellidos, e.nombres, p.id_paralelo, p.nivel, p.seccion,
                     ur.id_usuario, ur.apellidos, ur.nombres, ur.telefono, ur.email
            ORDER BY fechaVencimientoMasAntigua ASC
            LIMIT 500
            """, nativeQuery = true)
    List<EstudianteMoraProjection> buscarEstudiantesEnMora();

    interface EstudianteMoraProjection {
        Long getIdEstudiante();
        String getCodigo();
        String getNombreCompleto();
        String getParalelo();
        String getRepresentante();
        String getRepresentanteTelefono();
        String getRepresentanteEmail();
        BigDecimal getValorPendiente();
        LocalDate getFechaVencimientoMasAntigua();
        Long getObligacionesVencidas();
    }
}
