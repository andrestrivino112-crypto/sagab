package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.AsignacionDocente;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AsignacionDocenteRepository extends JpaRepository<AsignacionDocente, Long> {
    List<AsignacionDocente> findByDocenteUsuarioEmailOrderByPeriodoFechaInicioDesc(String email);

    List<AsignacionDocente> findAllByOrderByPeriodoFechaInicioDesc();

    /** Materias que cursa un paralelo en un período dado — "Mis materias" del Portal Familiar. */
    List<AsignacionDocente> findByParaleloIdAndPeriodoId(Integer idParalelo, Integer idPeriodo);

    /** ¿El docente de este email dicta alguna materia en este paralelo? — chequeo de propiedad por paralelo completo. */
    boolean existsByDocenteUsuarioEmailAndParaleloId(String email, Integer idParalelo);
}
