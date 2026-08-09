package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.Estudiante;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.time.Instant;

public interface EstudianteRepository extends JpaRepository<Estudiante, Long> {

    List<Estudiante> findByParaleloIdAndActivoTrueOrderByApellidosAscNombresAsc(Integer idParalelo);

    List<Estudiante> findByRepresentanteIdAndActivoTrue(Long idRepresentante);

    @Query(value = """
            SELECT e.id_estudiante AS idEstudiante, e.codigo AS codigo,
                   e.apellidos || ' ' || e.nombres AS nombreCompleto,
                   p.nivel AS curso, p.seccion AS paralelo, p.anio_lectivo AS anioLectivo
            FROM sagab.estudiante e
            JOIN sagab.paralelo p ON p.id_paralelo = e.id_paralelo
            WHERE e.activo = true AND p.anio_lectivo = :anioLectivo
            ORDER BY p.nivel, p.seccion, e.apellidos, e.nombres
            """, nativeQuery = true)
    List<MatriculadoProjection> matriculadosDelAnio(@Param("anioLectivo") String anioLectivo);

    @Query(value = """
            SELECT count(*)
            FROM sagab.estudiante e
            JOIN sagab.paralelo p ON p.id_paralelo = e.id_paralelo
            WHERE e.activo = true AND p.anio_lectivo = :anioLectivo
            """, nativeQuery = true)
    long contarMatriculadosDelAnio(@Param("anioLectivo") String anioLectivo);

    @Query(value = """
            SELECT e.id_estudiante AS idEstudiante, e.codigo AS codigo,
                   e.apellidos || ' ' || e.nombres AS nombreCompleto,
                   p.nivel AS curso, p.seccion AS paralelo, p.anio_lectivo AS anioLectivo,
                   e.creado_en AS creadoEn
            FROM sagab.estudiante e
            JOIN sagab.paralelo p ON p.id_paralelo = e.id_paralelo
            WHERE e.activo = true AND p.anio_lectivo = :anioLectivo
            ORDER BY e.creado_en DESC, e.id_estudiante DESC
            """, nativeQuery = true)
    List<MatriculaRecienteProjection> matriculasRecientesDelAnio(
            @Param("anioLectivo") String anioLectivo, Pageable pageable);

    /** El estudiante viendo sus propios datos (Portal Familiar) — cuenta 1:1 creada en la matrícula. */
    Optional<Estudiante> findByUsuarioId(Long idUsuario);

    boolean existsByCedula(String cedula);

    /** Siguiente valor de la secuencia sagab.estudiante_codigo_seq (ver migración 06). */
    @Query(value = "SELECT nextval('sagab.estudiante_codigo_seq')", nativeQuery = true)
    Long siguienteCodigoSecuencial();

    /**
     * Búsqueda instantánea por nombre (índice GIN pg_trgm), por cédula del propio estudiante,
     * o por cédula de su representante — en este último caso trae a todos sus representados,
     * para que el admin pueda ubicar la obligación de pago correcta sin conocer de antemano
     * a cuál de sus hijos corresponde.
     */
    @Query(value = """
            SELECT e.* FROM sagab.estudiante e
            LEFT JOIN sagab.representante r ON r.id_representante = e.id_representante
            LEFT JOIN sagab.usuario ur ON ur.id_usuario = r.id_usuario
            WHERE e.activo AND (
                (e.apellidos || ' ' || e.nombres) ILIKE '%' || :q || '%'
                OR e.cedula = :q
                OR ur.cedula = :q
            )
            ORDER BY e.apellidos, e.nombres
            """, nativeQuery = true)
    Page<Estudiante> buscarPorNombre(@Param("q") String q, Pageable pageable);

    /** Selector DECE: solo datos mínimos para localizar un estudiante existente y saber si ya
     * tiene expediente activo; evita duplicados y no carga entidades completas/N+1. */
    @Query(value = """
            SELECT e.id_estudiante AS idEstudiante, e.codigo AS codigo,
                   e.apellidos || ' ' || e.nombres AS estudiante,
                   p.nivel AS curso, p.nivel || ' ' || p.seccion AS paralelo,
                   eu.email AS email, sd.id_seguimiento AS idSeguimiento
            FROM sagab.estudiante e
            LEFT JOIN sagab.paralelo p ON p.id_paralelo = e.id_paralelo
            LEFT JOIN sagab.usuario eu ON eu.id_usuario = e.id_usuario
            LEFT JOIN sagab.seguimiento_dece sd
              ON sd.id_estudiante = e.id_estudiante AND sd.eliminado = false
            WHERE e.activo = true AND (
                (e.apellidos || ' ' || e.nombres) ILIKE '%' || :q || '%'
                OR (e.nombres || ' ' || e.apellidos) ILIKE '%' || :q || '%'
                OR e.codigo ILIKE '%' || :q || '%' OR e.cedula = :q
            )
            ORDER BY e.apellidos, e.nombres
            LIMIT 15
            """, nativeQuery = true)
    List<BusquedaDeceProjection> buscarParaSeguimiento(@Param("q") String q);

    interface BusquedaDeceProjection {
        Long getIdEstudiante();
        String getCodigo();
        String getEstudiante();
        String getCurso();
        String getParalelo();
        String getEmail();
        Long getIdSeguimiento();
    }

    /**
     * Ids de usuario destinatarios (representante + cuenta propia del estudiante, si tiene
     * Portal Familiar) de un conjunto de estudiantes — resuelve en una sola consulta el
     * "a quién le llega" de un mensaje/notificación masiva, sin N+1 por estudiante.
     */
    @Query(value = """
            SELECT DISTINCT uid FROM (
                SELECT r.id_usuario AS uid FROM sagab.estudiante e
                JOIN sagab.representante r ON r.id_representante = e.id_representante
                WHERE e.id_estudiante IN :idsEstudiantes AND e.activo
                UNION
                SELECT e.id_usuario AS uid FROM sagab.estudiante e
                WHERE e.id_estudiante IN :idsEstudiantes AND e.activo AND e.id_usuario IS NOT NULL
            ) t
            """, nativeQuery = true)
    List<Long> idsUsuariosDestinatarios(@Param("idsEstudiantes") List<Long> idsEstudiantes);

    /** Igual que idsUsuariosDestinatarios(), para todos los estudiantes activos de un paralelo. */
    @Query(value = """
            SELECT DISTINCT uid FROM (
                SELECT r.id_usuario AS uid FROM sagab.estudiante e
                JOIN sagab.representante r ON r.id_representante = e.id_representante
                WHERE e.id_paralelo = :idParalelo AND e.activo
                UNION
                SELECT e.id_usuario AS uid FROM sagab.estudiante e
                WHERE e.id_paralelo = :idParalelo AND e.activo AND e.id_usuario IS NOT NULL
            ) t
            """, nativeQuery = true)
    List<Long> idsUsuariosDestinatariosPorParalelo(@Param("idParalelo") Integer idParalelo);

    /** Igual que idsUsuariosDestinatarios(), para todos los estudiantes activos de un curso (nivel,
     * agrupando todos sus paralelos) — p. ej. "8vo EGB" completo, sin importar la sección. */
    @Query(value = """
            SELECT DISTINCT uid FROM (
                SELECT r.id_usuario AS uid FROM sagab.estudiante e
                JOIN sagab.paralelo p ON p.id_paralelo = e.id_paralelo
                JOIN sagab.representante r ON r.id_representante = e.id_representante
                WHERE p.nivel = :curso AND e.activo
                UNION
                SELECT e.id_usuario AS uid FROM sagab.estudiante e
                JOIN sagab.paralelo p ON p.id_paralelo = e.id_paralelo
                WHERE p.nivel = :curso AND e.activo AND e.id_usuario IS NOT NULL
            ) t
            """, nativeQuery = true)
    List<Long> idsUsuariosDestinatariosPorCurso(@Param("curso") String curso);

    interface MatriculadoProjection {
        Long getIdEstudiante();
        String getCodigo();
        String getNombreCompleto();
        String getCurso();
        String getParalelo();
        String getAnioLectivo();
    }

    interface MatriculaRecienteProjection extends MatriculadoProjection {
        Instant getCreadoEn();
    }

}
