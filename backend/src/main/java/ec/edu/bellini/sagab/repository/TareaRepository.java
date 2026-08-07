package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.EntregaTarea;
import ec.edu.bellini.sagab.model.Tarea;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;

public interface TareaRepository extends JpaRepository<Tarea, Long> {
    List<Tarea> findByAsignacionIdOrderByFechaLimiteDesc(Long idAsignacion);

    /** Agenda personal del estudiante: solo deberes que todavía debe entregar y que pertenecen
     * exactamente al paralelo de su matrícula activa. */
    @Query("SELECT t FROM EntregaTarea e JOIN e.tarea t " +
           "JOIN FETCH t.asignacion a JOIN FETCH a.materia " +
           "JOIN FETCH a.paralelo JOIN FETCH a.docente d JOIN FETCH d.usuario " +
           "WHERE e.estudiante.id = :idEstudiante AND a.paralelo.id = :idParalelo " +
           "AND e.estado = :estado AND t.fechaLimite BETWEEN :desde AND :hasta " +
           "ORDER BY t.fechaLimite")
    List<Tarea> calendarioPendienteEstudiante(@Param("idEstudiante") Long idEstudiante,
                                              @Param("idParalelo") Integer idParalelo,
                                              @Param("estado") EntregaTarea.EstadoEntrega estado,
                                              @Param("desde") OffsetDateTime desde,
                                              @Param("hasta") OffsetDateTime hasta);
}
