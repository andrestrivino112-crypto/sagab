package ec.edu.bellini.sagab.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;

public class CalificacionDtos {

    public record NotaRequest(
            @NotNull Long idEstudiante,
            @NotNull @DecimalMin("0.0") @DecimalMax("10.0") BigDecimal notaTarea,
            @NotNull @DecimalMin("0.0") @DecimalMax("10.0") BigDecimal notaClase,
            @NotNull @DecimalMin("0.0") @DecimalMax("10.0") BigDecimal notaExamen,
            @Size(max = 250) String observacion) {}

    /** {@code @Valid} en notas es necesario para que Bean Validation aplique las restricciones de
     * cada NotaRequest (rango 0-10, etc.) — sin él, @NotEmpty solo valida que la lista no esté
     * vacía y los valores de cada nota quedarían sin validar. */
    public record RegistroMasivoRequest(
            @NotNull Long idAsignacion,
            @Min(1) @Max(3) short parcial,
            @NotEmpty @Valid List<NotaRequest> notas) {}

    public record NotaResponse(
            Long idCalificacion, Long idEstudiante, String estudiante,
            BigDecimal notaTarea, BigDecimal notaClase, BigDecimal notaExamen,
            BigDecimal promedio, boolean enRiesgo) {}

    /** Notas de un estudiante a través de todas sus materias/parciales — Portal Familiar. */
    public record NotaEstudianteResponse(
            Long idCalificacion, String materia, short parcial,
            BigDecimal notaTarea, BigDecimal notaClase, BigDecimal notaExamen,
            BigDecimal promedio, boolean enRiesgo) {}

    /** Fila de la búsqueda avanzada (ADMIN/DOCENTE): cruza estudiante, curso, materia, período y docente. */
    public record NotaBusquedaResponse(
            Long idCalificacion, Long idEstudiante, String estudiante, String curso,
            String materia, String periodo, String docente, short parcial,
            BigDecimal notaTarea, BigDecimal notaClase, BigDecimal notaExamen,
            BigDecimal promedio, boolean enRiesgo) {}
}
