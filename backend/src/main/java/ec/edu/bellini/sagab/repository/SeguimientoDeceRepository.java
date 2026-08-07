package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.SeguimientoDece;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface SeguimientoDeceRepository extends JpaRepository<SeguimientoDece, Long> {

    Optional<SeguimientoDece> findByEstudianteId(Long idEstudiante);

    @Query(value = """
            SELECT sd.id_seguimiento AS idSeguimiento, e.id_estudiante AS idEstudiante,
                   e.codigo AS codigo, e.apellidos || ' ' || e.nombres AS estudiante,
                   e.cedula AS cedula, eu.email AS email, e.fecha_nacimiento AS fechaNacimiento,
                   e.genero AS genero, e.telefono AS telefono, e.tipo_sangre AS tipoSangre,
                   e.condicion_medica AS condicionMedica, e.contacto_emergencia AS contactoEmergencia,
                   p.nivel AS curso, p.nivel || ' ' || p.seccion AS paralelo,
                   ac.promedioGeneral AS promedioGeneral, ac.totalCalificaciones AS totalCalificaciones,
                   aa.ausenciasInjustificadas AS ausenciasInjustificadas,
                   sd.fecha_inicio AS fechaInicio, sd.estado AS estado, sd.observacion AS observacion,
                   du.nombres || ' ' || du.apellidos AS registradoPor,
                   sd.creado_en AS creadoEn, sd.actualizado_en AS actualizadoEn
            FROM sagab.seguimiento_dece sd
            JOIN sagab.estudiante e ON e.id_estudiante = sd.id_estudiante
            LEFT JOIN sagab.usuario eu ON eu.id_usuario = e.id_usuario
            LEFT JOIN sagab.paralelo p ON p.id_paralelo = e.id_paralelo
            JOIN sagab.usuario du ON du.id_usuario = sd.registrado_por
            LEFT JOIN LATERAL (
                SELECT round(avg(c.promedio), 2) AS promedioGeneral, count(c.id_calificacion) AS totalCalificaciones
                FROM sagab.calificacion c WHERE c.id_estudiante = e.id_estudiante
            ) ac ON true
            LEFT JOIN LATERAL (
                SELECT count(*) AS ausenciasInjustificadas FROM sagab.asistencia a
                WHERE a.id_estudiante = e.id_estudiante AND a.estado = 'AUSENCIA_INJUSTIFICADA'
            ) aa ON true
            WHERE sd.eliminado = false
              AND (CAST(:estado AS TEXT) IS NULL OR sd.estado = :estado)
              AND (CAST(:q AS TEXT) IS NULL OR
                   (e.apellidos || ' ' || e.nombres) ILIKE '%' || :q || '%' OR
                   e.codigo ILIKE '%' || :q || '%' OR e.cedula = :q)
            ORDER BY sd.actualizado_en DESC, e.apellidos, e.nombres
            LIMIT 500
            """, nativeQuery = true)
    List<DetalleProjection> listarDetalle(@Param("q") String q, @Param("estado") String estado);

    @Query(value = """
            SELECT sd.id_seguimiento AS idSeguimiento, e.id_estudiante AS idEstudiante,
                   e.codigo AS codigo, e.apellidos || ' ' || e.nombres AS estudiante,
                   e.cedula AS cedula, eu.email AS email, e.fecha_nacimiento AS fechaNacimiento,
                   e.genero AS genero, e.telefono AS telefono, e.tipo_sangre AS tipoSangre,
                   e.condicion_medica AS condicionMedica, e.contacto_emergencia AS contactoEmergencia,
                   p.nivel AS curso, p.nivel || ' ' || p.seccion AS paralelo,
                   ac.promedioGeneral AS promedioGeneral, ac.totalCalificaciones AS totalCalificaciones,
                   aa.ausenciasInjustificadas AS ausenciasInjustificadas,
                   sd.fecha_inicio AS fechaInicio, sd.estado AS estado, sd.observacion AS observacion,
                   du.nombres || ' ' || du.apellidos AS registradoPor,
                   sd.creado_en AS creadoEn, sd.actualizado_en AS actualizadoEn
            FROM sagab.seguimiento_dece sd
            JOIN sagab.estudiante e ON e.id_estudiante = sd.id_estudiante
            LEFT JOIN sagab.usuario eu ON eu.id_usuario = e.id_usuario
            LEFT JOIN sagab.paralelo p ON p.id_paralelo = e.id_paralelo
            JOIN sagab.usuario du ON du.id_usuario = sd.registrado_por
            LEFT JOIN LATERAL (
                SELECT round(avg(c.promedio), 2) AS promedioGeneral, count(c.id_calificacion) AS totalCalificaciones
                FROM sagab.calificacion c WHERE c.id_estudiante = e.id_estudiante
            ) ac ON true
            LEFT JOIN LATERAL (
                SELECT count(*) AS ausenciasInjustificadas FROM sagab.asistencia a
                WHERE a.id_estudiante = e.id_estudiante AND a.estado = 'AUSENCIA_INJUSTIFICADA'
            ) aa ON true
            WHERE sd.id_seguimiento = :idSeguimiento AND sd.eliminado = false
            """, nativeQuery = true)
    Optional<DetalleProjection> detalle(@Param("idSeguimiento") Long idSeguimiento);

    interface DetalleProjection {
        Long getIdSeguimiento();
        Long getIdEstudiante();
        String getCodigo();
        String getEstudiante();
        String getCedula();
        String getEmail();
        LocalDate getFechaNacimiento();
        String getGenero();
        String getTelefono();
        String getTipoSangre();
        String getCondicionMedica();
        String getContactoEmergencia();
        String getCurso();
        String getParalelo();
        BigDecimal getPromedioGeneral();
        long getTotalCalificaciones();
        long getAusenciasInjustificadas();
        LocalDate getFechaInicio();
        String getEstado();
        String getObservacion();
        String getRegistradoPor();
        Instant getCreadoEn();
        Instant getActualizadoEn();
    }
}
