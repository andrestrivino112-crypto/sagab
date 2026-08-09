package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.EntregaTarea;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface EntregaTareaRepository extends JpaRepository<EntregaTarea, Long> {
    List<EntregaTarea> findByTareaId(Long idTarea);
    List<EntregaTarea> findByEstudianteIdOrderByFechaEntregaDesc(Long idEstudiante);
    Optional<EntregaTarea> findByTareaIdAndEstudianteId(Long idTarea, Long idEstudiante);

    /**
     * Genera las entregas pendientes de tareas todavía abiertas para un estudiante recién
     * matriculado. ON CONFLICT vuelve la operación idempotente ante reintentos o concurrencia.
     */
    @Modifying
    @Query(value = """
            INSERT INTO sagab.entrega_tarea (id_tarea, id_estudiante)
            SELECT t.id_tarea, :idEstudiante
              FROM sagab.tarea t
              JOIN sagab.asignacion_docente a ON a.id_asignacion = t.id_asignacion
             WHERE a.id_paralelo = :idParalelo
               AND t.fecha_limite > :ahora
            ON CONFLICT (id_tarea, id_estudiante) DO NOTHING
            """, nativeQuery = true)
    int crearPendientesParaTareasAbiertas(@Param("idEstudiante") Long idEstudiante,
                                          @Param("idParalelo") Integer idParalelo,
                                          @Param("ahora") OffsetDateTime ahora);
}
