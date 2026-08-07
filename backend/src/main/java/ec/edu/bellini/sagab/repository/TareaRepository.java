package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.Tarea;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;

public interface TareaRepository extends JpaRepository<Tarea, Long> {
    List<Tarea> findByAsignacionIdOrderByFechaLimiteDesc(Long idAsignacion);

    @Query("SELECT t FROM Tarea t JOIN FETCH t.asignacion a JOIN FETCH a.materia " +
           "JOIN FETCH a.paralelo JOIN FETCH a.docente d JOIN FETCH d.usuario " +
           "WHERE t.fechaLimite BETWEEN :desde AND :hasta ORDER BY t.fechaLimite")
    List<Tarea> calendarioAdmin(@Param("desde") OffsetDateTime desde, @Param("hasta") OffsetDateTime hasta);

    @Query("SELECT t FROM Tarea t JOIN FETCH t.asignacion a JOIN FETCH a.materia " +
           "JOIN FETCH a.paralelo JOIN FETCH a.docente d JOIN FETCH d.usuario " +
           "WHERE d.usuario.email = :email AND t.fechaLimite BETWEEN :desde AND :hasta ORDER BY t.fechaLimite")
    List<Tarea> calendarioDocente(@Param("email") String email, @Param("desde") OffsetDateTime desde,
                                  @Param("hasta") OffsetDateTime hasta);

    @Query("SELECT t FROM Tarea t JOIN FETCH t.asignacion a JOIN FETCH a.materia " +
           "JOIN FETCH a.paralelo JOIN FETCH a.docente d JOIN FETCH d.usuario " +
           "WHERE a.paralelo.id IN :idsParalelos AND t.fechaLimite BETWEEN :desde AND :hasta ORDER BY t.fechaLimite")
    List<Tarea> calendarioParalelos(@Param("idsParalelos") List<Integer> idsParalelos,
                                    @Param("desde") OffsetDateTime desde, @Param("hasta") OffsetDateTime hasta);
}
