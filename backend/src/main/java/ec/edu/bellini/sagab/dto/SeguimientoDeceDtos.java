package ec.edu.bellini.sagab.dto;

import ec.edu.bellini.sagab.model.SeguimientoDece;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public class SeguimientoDeceDtos {

    public record BusquedaEstudianteResponse(
            Long idEstudiante, String codigo, String estudiante, String curso, String paralelo,
            String email, boolean enSeguimiento, Long idSeguimiento) {}

    public record CrearRequest(
            @NotNull Long idEstudiante,
            @PastOrPresent LocalDate fechaInicio,
            @NotNull SeguimientoDece.EstadoSeguimiento estado,
            @Size(max = 2000) String observacion) {}

    public record EditarRequest(
            @NotNull @PastOrPresent LocalDate fechaInicio,
            @NotNull SeguimientoDece.EstadoSeguimiento estado,
            @Size(max = 2000) String observacion) {}

    public record SeguimientoResponse(
            Long idSeguimiento, Long idEstudiante, String codigo, String estudiante,
            String cedula, String email, LocalDate fechaNacimiento, String genero, String telefono,
            String tipoSangre, String condicionMedica, String contactoEmergencia,
            String curso, String paralelo, BigDecimal promedioGeneral, long totalCalificaciones,
            long ausenciasInjustificadas, LocalDate fechaInicio, String estado, String observacion,
            String registradoPor, OffsetDateTime creadoEn, OffsetDateTime actualizadoEn) {}

    public record HistorialResponse(
            Long idHistorial, String estadoAnterior, String estadoNuevo, String observacion,
            String cambiadoPor, OffsetDateTime cambiadoEn) {}

    public record EnviarMensajeRequest(
            @NotBlank @Size(max = 150) String asunto,
            @NotBlank @Size(max = 10000) String cuerpo) {}

    public record MensajeHistorialResponse(
            Long idMensaje, String asunto, String cuerpo, String remitente,
            OffsetDateTime enviadoEn, OffsetDateTime leidoEn, boolean leido) {}
}
