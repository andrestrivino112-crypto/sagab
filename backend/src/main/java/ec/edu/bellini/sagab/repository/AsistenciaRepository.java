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
}
