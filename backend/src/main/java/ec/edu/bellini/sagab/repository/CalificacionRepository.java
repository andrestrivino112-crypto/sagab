package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.Calificacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface CalificacionRepository extends JpaRepository<Calificacion, Long> {
    List<Calificacion> findByIdAsignacionAndParcial(Long idAsignacion, short parcial);
    List<Calificacion> findByEstudianteIdOrderByParcialAsc(Long idEstudiante);

    /** Trae de una sola consulta las calificaciones ya existentes de un lote de estudiantes (evita N+1 en registrarMasivo). */
    List<Calificacion> findByIdAsignacionAndParcialAndEstudianteIdIn(Long idAsignacion, short parcial, List<Long> estudianteIds);

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

    /** Igual que rendimientoPorParalelo(), pero con el total de calificaciones por paralelo —
     * forma unificada con el resto de agrupaciones del drill-down "Promedio institucional". */
    @Query(value = """
            SELECT p.nivel || ' ' || p.seccion AS etiqueta, AVG(c.promedio) AS promedio, COUNT(*) AS total
            FROM sagab.calificacion c
            JOIN sagab.estudiante e ON e.id_estudiante = c.id_estudiante
            JOIN sagab.paralelo p ON p.id_paralelo = e.id_paralelo
            WHERE c.promedio IS NOT NULL
            GROUP BY p.nivel, p.seccion
            ORDER BY p.nivel, p.seccion
            """, nativeQuery = true)
    List<PromedioAgrupadoProjection> promedioPorParalelo();

    /** Drill-down "Promedio institucional" del Dashboard: promedio por curso (nivel, agrupando
     * todos sus paralelos), para comparar entre niveles independientemente de la sección. */
    @Query(value = """
            SELECT p.nivel AS etiqueta, AVG(c.promedio) AS promedio, COUNT(*) AS total
            FROM sagab.calificacion c
            JOIN sagab.estudiante e ON e.id_estudiante = c.id_estudiante
            JOIN sagab.paralelo p ON p.id_paralelo = e.id_paralelo
            WHERE c.promedio IS NOT NULL
            GROUP BY p.nivel
            ORDER BY p.nivel
            """, nativeQuery = true)
    List<PromedioAgrupadoProjection> promedioPorCurso();

    /** Promedio por materia. */
    @Query(value = """
            SELECT m.nombre AS etiqueta, AVG(c.promedio) AS promedio, COUNT(*) AS total
            FROM sagab.calificacion c
            JOIN sagab.asignacion_docente a ON a.id_asignacion = c.id_asignacion
            JOIN sagab.materia m ON m.id_materia = a.id_materia
            WHERE c.promedio IS NOT NULL
            GROUP BY m.nombre
            ORDER BY m.nombre
            """, nativeQuery = true)
    List<PromedioAgrupadoProjection> promedioPorMateria();

    /** Drill-down "Promedio institucional" del Dashboard, pestaña "Tendencia por año": promedio por
     * año lectivo, desglosado por curso y paralelo (no solo el año) para que cada dato tenga contexto
     * completo — ver DashboardDtos.TendenciaAnual. */
    @Query(value = """
            SELECT per.anio_lectivo AS anioLectivo, p.nivel AS curso, p.seccion AS paralelo,
                   AVG(c.promedio) AS promedio, COUNT(*) AS total
            FROM sagab.calificacion c
            JOIN sagab.estudiante e ON e.id_estudiante = c.id_estudiante
            JOIN sagab.paralelo p ON p.id_paralelo = e.id_paralelo
            JOIN sagab.asignacion_docente a ON a.id_asignacion = c.id_asignacion
            JOIN sagab.periodo_academico per ON per.id_periodo = a.id_periodo
            WHERE c.promedio IS NOT NULL
            GROUP BY per.anio_lectivo, p.nivel, p.seccion
            ORDER BY per.anio_lectivo DESC, p.nivel, p.seccion
            """, nativeQuery = true)
    List<TendenciaAnualProjection> tendenciaPorAnioLectivo();

    interface TendenciaAnualProjection {
        String getAnioLectivo();
        String getCurso();
        String getParalelo();
        BigDecimal getPromedio();
        long getTotal();
    }

    interface PromedioAgrupadoProjection {
        String getEtiqueta();
        BigDecimal getPromedio();
        long getTotal();
    }

    /**
     * Búsqueda avanzada por estudiante, curso, materia y/o parcial (RF-02).
     * Los parámetros nulos se ignoran (se castea explícitamente para que el
     * planificador de PostgreSQL pueda inferir el tipo cuando el valor es NULL).
     */
    @Query(value = """
            SELECT c.id_calificacion   AS idCalificacion,
                   c.id_estudiante     AS idEstudiante,
                   e.apellidos || ' ' || e.nombres AS estudiante,
                   p.nivel || ' ' || p.seccion      AS curso,
                   m.nombre            AS materia,
                   c.parcial           AS parcial,
                   c.nota_tarea        AS notaTarea,
                   c.nota_clase        AS notaClase,
                   c.nota_examen       AS notaExamen,
                   c.promedio          AS promedio
            FROM sagab.calificacion c
            JOIN sagab.estudiante e        ON e.id_estudiante = c.id_estudiante
            JOIN sagab.asignacion_docente a ON a.id_asignacion = c.id_asignacion
            JOIN sagab.materia m           ON m.id_materia = a.id_materia
            JOIN sagab.paralelo p          ON p.id_paralelo = a.id_paralelo
            WHERE (CAST(:idEstudiante AS BIGINT) IS NULL OR c.id_estudiante = :idEstudiante)
              AND (CAST(:idParalelo AS INT) IS NULL OR a.id_paralelo = :idParalelo)
              AND (CAST(:idMateria AS INT) IS NULL OR a.id_materia = :idMateria)
              AND (CAST(:idDocente AS BIGINT) IS NULL OR a.id_docente = :idDocente)
              AND (CAST(:parcial AS SMALLINT) IS NULL OR c.parcial = :parcial)
            ORDER BY e.apellidos, e.nombres, c.parcial
            LIMIT 500
            """, nativeQuery = true)
    List<NotaBusquedaProjection> buscar(
            @Param("idEstudiante") Long idEstudiante,
            @Param("idParalelo") Integer idParalelo,
            @Param("idMateria") Integer idMateria,
            @Param("idDocente") Long idDocente,
            @Param("parcial") Short parcial);

    interface NotaBusquedaProjection {
        Long getIdCalificacion();
        Long getIdEstudiante();
        String getEstudiante();
        String getCurso();
        String getMateria();
        short getParcial();
        BigDecimal getNotaTarea();
        BigDecimal getNotaClase();
        BigDecimal getNotaExamen();
        BigDecimal getPromedio();
    }
}
