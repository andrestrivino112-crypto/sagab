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

    /**
     * Drill-down "Ausencias" del Dashboard: todos los registros que no son PRESENTE (faltas
     * justificadas, injustificadas y atrasos), con filtros opcionales por rango de fecha, curso
     * y paralelo. La asistencia se registra una vez al día por paralelo (no por materia/docente
     * de una clase puntual), así que no existe un filtro por materia — "profesor" se resuelve
     * en el cliente a partir de quién registró cada fila (columna registradoPor).
     */
    @Query(value = """
            SELECT a.id_asistencia AS idAsistencia, e.id_estudiante AS idEstudiante,
                   e.apellidos || ' ' || e.nombres AS estudiante,
                   p.nivel AS curso, p.nivel || ' ' || p.seccion AS paralelo,
                   a.fecha AS fecha, CAST(a.estado AS TEXT) AS estado, a.justificacion AS justificacion,
                   ru.apellidos || ' ' || ru.nombres AS registradoPor
            FROM sagab.asistencia a
            JOIN sagab.estudiante e ON e.id_estudiante = a.id_estudiante
            JOIN sagab.paralelo p ON p.id_paralelo = a.id_paralelo
            LEFT JOIN sagab.usuario ru ON ru.id_usuario = a.registrado_por
            WHERE a.estado <> 'PRESENTE'
              AND (CAST(:desde AS DATE) IS NULL OR a.fecha >= :desde)
              AND (CAST(:hasta AS DATE) IS NULL OR a.fecha <= :hasta)
              AND (CAST(:idParalelo AS INT) IS NULL OR a.id_paralelo = :idParalelo)
              AND (CAST(:curso AS TEXT) IS NULL OR p.nivel = :curso)
              AND (CAST(:docenteEmail AS TEXT) IS NULL OR EXISTS (
                    SELECT 1
                    FROM sagab.asignacion_docente ad
                    JOIN sagab.docente d ON d.id_docente = ad.id_docente
                    JOIN sagab.usuario u ON u.id_usuario = d.id_usuario
                    JOIN sagab.periodo_academico pe ON pe.id_periodo = ad.id_periodo
                    WHERE ad.id_paralelo = a.id_paralelo
                      AND pe.activo = true
                      AND lower(u.email) = lower(:docenteEmail)
              ))
            ORDER BY a.fecha DESC, e.apellidos, e.nombres
            LIMIT 500
            """, nativeQuery = true)
    List<AusenciaListadoProjection> reporteAusencias(@Param("desde") LocalDate desde, @Param("hasta") LocalDate hasta,
            @Param("idParalelo") Integer idParalelo, @Param("curso") String curso,
            @Param("docenteEmail") String docenteEmail);

    interface AusenciaListadoProjection {
        Long getIdAsistencia();
        Long getIdEstudiante();
        String getEstudiante();
        String getCurso();
        String getParalelo();
        LocalDate getFecha();
        String getEstado();
        String getJustificacion();
        String getRegistradoPor();
    }
}
