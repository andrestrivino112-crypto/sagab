package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.Estudiante;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface EstudianteRepository extends JpaRepository<Estudiante, Long> {

    List<Estudiante> findByParaleloIdAndActivoTrueOrderByApellidosAscNombresAsc(Integer idParalelo);

    List<Estudiante> findByRepresentanteIdAndActivoTrue(Long idRepresentante);

    /** El estudiante viendo sus propios datos (Portal Familiar) — cuenta 1:1 creada en la matrícula. */
    Optional<Estudiante> findByUsuarioId(Long idUsuario);

    boolean existsByCedula(String cedula);

    /** Siguiente valor de la secuencia sagab.estudiante_codigo_seq (ver migración 06). */
    @Query(value = "SELECT nextval('sagab.estudiante_codigo_seq')", nativeQuery = true)
    Long siguienteCodigoSecuencial();

    /** Búsqueda instantánea por nombre — usa el índice GIN pg_trgm. */
    @Query(value = """
            SELECT * FROM sagab.estudiante
            WHERE activo AND (apellidos || ' ' || nombres) ILIKE '%' || :q || '%'
            ORDER BY apellidos, nombres
            """, nativeQuery = true)
    Page<Estudiante> buscarPorNombre(@Param("q") String q, Pageable pageable);
}
