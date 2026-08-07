package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.AsignacionDocente;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;

import java.util.List;
import java.util.Optional;

public interface AsignacionDocenteRepository extends JpaRepository<AsignacionDocente, Long> {
    @EntityGraph(attributePaths = {"docente.usuario", "materia", "paralelo", "periodo"})
    List<AsignacionDocente> findByDocenteUsuarioEmailOrderByPeriodoFechaInicioDesc(String email);

    @EntityGraph(attributePaths = {"docente.usuario", "materia", "paralelo", "periodo"})
    List<AsignacionDocente> findAllByOrderByPeriodoFechaInicioDesc();

    /** Materias que cursa un paralelo en un período dado — "Mis materias" del Portal Familiar. */
    List<AsignacionDocente> findByParaleloIdAndPeriodoId(Integer idParalelo, Integer idPeriodo);

    /** ¿El docente de este email dicta alguna materia en este paralelo? — chequeo de propiedad por paralelo completo. */
    boolean existsByDocenteUsuarioEmailAndParaleloId(String email, Integer idParalelo);

    boolean existsByMateriaIdAndParaleloIdAndPeriodoId(Integer idMateria, Integer idParalelo, Integer idPeriodo);
    Optional<AsignacionDocente> findByMateriaIdAndParaleloIdAndPeriodoId(Integer idMateria, Integer idParalelo, Integer idPeriodo);
}
