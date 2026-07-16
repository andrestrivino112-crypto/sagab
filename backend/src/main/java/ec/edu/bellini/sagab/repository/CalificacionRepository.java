package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.Calificacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    /**
     * Búsqueda avanzada por estudiante, curso, materia, período y/o docente (RF-02).
     * Los parámetros nulos se ignoran (se castea explícitamente para que el
     * planificador de PostgreSQL pueda inferir el tipo cuando el valor es NULL).
     */
    @Query(value = """
            SELECT c.id_calificacion   AS idCalificacion,
                   c.id_estudiante     AS idEstudiante,
                   e.apellidos || ' ' || e.nombres AS estudiante,
                   p.nivel || ' ' || p.seccion      AS curso,
                   m.nombre            AS materia,
                   per.nombre || ' · ' || per.anio_lectivo AS periodo,
                   du.nombres || ' ' || du.apellidos AS docente,
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
            JOIN sagab.periodo_academico per ON per.id_periodo = a.id_periodo
            JOIN sagab.docente d           ON d.id_docente = a.id_docente
            JOIN sagab.usuario du          ON du.id_usuario = d.id_usuario
            WHERE (CAST(:idEstudiante AS BIGINT) IS NULL OR c.id_estudiante = :idEstudiante)
              AND (CAST(:idParalelo AS INT) IS NULL OR a.id_paralelo = :idParalelo)
              AND (CAST(:idMateria AS INT) IS NULL OR a.id_materia = :idMateria)
              AND (CAST(:idPeriodo AS INT) IS NULL OR a.id_periodo = :idPeriodo)
              AND (CAST(:idDocente AS BIGINT) IS NULL OR a.id_docente = :idDocente)
              AND (CAST(:parcial AS SMALLINT) IS NULL OR c.parcial = :parcial)
            ORDER BY per.fecha_inicio DESC, e.apellidos, e.nombres, c.parcial
            """, nativeQuery = true)
    List<NotaBusquedaProjection> buscar(
            @Param("idEstudiante") Long idEstudiante,
            @Param("idParalelo") Integer idParalelo,
            @Param("idMateria") Integer idMateria,
            @Param("idPeriodo") Integer idPeriodo,
            @Param("idDocente") Long idDocente,
            @Param("parcial") Short parcial);

    interface NotaBusquedaProjection {
        Long getIdCalificacion();
        Long getIdEstudiante();
        String getEstudiante();
        String getCurso();
        String getMateria();
        String getPeriodo();
        String getDocente();
        short getParcial();
        BigDecimal getNotaTarea();
        BigDecimal getNotaClase();
        BigDecimal getNotaExamen();
        BigDecimal getPromedio();
    }
}
