package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.Asistencia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface AsistenciaRepository extends JpaRepository<Asistencia, Long> {

    List<Asistencia> findByIdParaleloAndFecha(Integer idParalelo, LocalDate fecha);

    List<Asistencia> findByEstudianteIdAndFechaBetweenOrderByFechaDesc(Long idEstudiante, LocalDate desde, LocalDate hasta);

    /** Ausencias (justificadas + injustificadas) de la fecha dada — KPI "ausencias hoy". */
    long countByFechaAndEstadoIn(LocalDate fecha, List<Asistencia.EstadoAsistencia> estados);

    /** Ausencias injustificadas consecutivas más recientes (alerta DECE: >= 3). */
    @Query(value = """
            SELECT count(*) FROM (
                SELECT estado, fecha,
                       row_number() OVER (ORDER BY fecha DESC) rn
                FROM sagab.asistencia
                WHERE id_estudiante = :idEstudiante
                ORDER BY fecha DESC
            ) ult
            WHERE ult.estado = 'AUSENCIA_INJUSTIFICADA'
              AND ult.rn = (SELECT count(*) FROM sagab.asistencia a2
                            WHERE a2.id_estudiante = :idEstudiante
                              AND a2.fecha >= ult.fecha
                              AND a2.estado = 'AUSENCIA_INJUSTIFICADA')
            """, nativeQuery = true)
    long contarAusenciasConsecutivas(@Param("idEstudiante") Long idEstudiante);

    /**
     * Misma lógica que {@link #contarAusenciasConsecutivas}, pero para todos los estudiantes
     * activos de un paralelo en una sola consulta (evita una query por estudiante al pintar
     * la tabla de registro de asistencia con alertas DECE).
     */
    @Query(value = """
            SELECT e.id_estudiante AS idEstudiante, COALESCE(cnt.consecutivas, 0) AS consecutivas
            FROM sagab.estudiante e
            LEFT JOIN LATERAL (
                SELECT count(*) AS consecutivas
                FROM (
                    SELECT estado, fecha,
                           row_number() OVER (ORDER BY fecha DESC) rn
                    FROM sagab.asistencia a
                    WHERE a.id_estudiante = e.id_estudiante
                ) ult
                WHERE ult.estado = 'AUSENCIA_INJUSTIFICADA'
                  AND ult.rn = (SELECT count(*) FROM sagab.asistencia a2
                                WHERE a2.id_estudiante = e.id_estudiante
                                  AND a2.fecha >= ult.fecha
                                  AND a2.estado = 'AUSENCIA_INJUSTIFICADA')
            ) cnt ON true
            WHERE e.id_paralelo = :idParalelo AND e.activo = true
            """, nativeQuery = true)
    List<AusenciasConsecutivasProjection> contarAusenciasConsecutivasPorParalelo(@Param("idParalelo") Integer idParalelo);

    interface AusenciasConsecutivasProjection {
        Long getIdEstudiante();
        Long getConsecutivas();
    }
}
