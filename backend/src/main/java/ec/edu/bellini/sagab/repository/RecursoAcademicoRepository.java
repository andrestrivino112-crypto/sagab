package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.RecursoAcademico;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;

public interface RecursoAcademicoRepository extends JpaRepository<RecursoAcademico, Long> {
    List<RecursoAcademico> findByAsignacionIdOrderByCreadoEnDesc(Long idAsignacion);

    @Query("SELECT r FROM RecursoAcademico r JOIN FETCH r.asignacion a JOIN FETCH a.materia " +
           "JOIN FETCH a.paralelo JOIN FETCH a.docente d JOIN FETCH d.usuario " +
           "WHERE r.fechaLimite BETWEEN :desde AND :hasta ORDER BY r.fechaLimite")
    List<RecursoAcademico> calendarioAdmin(@Param("desde") OffsetDateTime desde, @Param("hasta") OffsetDateTime hasta);

    @Query("SELECT r FROM RecursoAcademico r JOIN FETCH r.asignacion a JOIN FETCH a.materia " +
           "JOIN FETCH a.paralelo JOIN FETCH a.docente d JOIN FETCH d.usuario " +
           "WHERE d.usuario.email = :email AND r.fechaLimite BETWEEN :desde AND :hasta ORDER BY r.fechaLimite")
    List<RecursoAcademico> calendarioDocente(@Param("email") String email, @Param("desde") OffsetDateTime desde,
                                             @Param("hasta") OffsetDateTime hasta);

    @Query("SELECT r FROM RecursoAcademico r JOIN FETCH r.asignacion a JOIN FETCH a.materia " +
           "JOIN FETCH a.paralelo JOIN FETCH a.docente d JOIN FETCH d.usuario " +
           "WHERE a.paralelo.id IN :idsParalelos AND r.fechaLimite BETWEEN :desde AND :hasta ORDER BY r.fechaLimite")
    List<RecursoAcademico> calendarioParalelos(@Param("idsParalelos") List<Integer> idsParalelos,
                                               @Param("desde") OffsetDateTime desde, @Param("hasta") OffsetDateTime hasta);
}
