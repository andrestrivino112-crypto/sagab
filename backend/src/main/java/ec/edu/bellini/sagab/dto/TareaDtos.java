package ec.edu.bellini.sagab.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public class TareaDtos {

    public record CrearTareaRequest(
            @NotNull Long idAsignacion,
            @NotBlank @Size(max = 150) String titulo,
            @Size(max = 1000) String descripcion,
            @NotNull @Future OffsetDateTime fechaLimite,
            @Min(1) @Max(3) short parcial,
            @NotNull @DecimalMin("0.01") @DecimalMax("999.99") @Digits(integer = 3, fraction = 2)
            BigDecimal puntaje) {}

    /** Igual que CrearTareaRequest pero sin idAsignacion: la asignación de un deber ya publicado
     * no se puede mover (las entregas ya se generaron para el paralelo original). */
    public record EditarTareaRequest(
            @NotBlank @Size(max = 150) String titulo,
            @Size(max = 1000) String descripcion,
            @NotNull @Future OffsetDateTime fechaLimite,
            @Min(1) @Max(3) short parcial,
            @NotNull @DecimalMin("0.01") @DecimalMax("999.99") @Digits(integer = 3, fraction = 2)
            BigDecimal puntaje) {}

    public record TareaResponse(
            Long idTarea, String titulo, String descripcion, OffsetDateTime fechaLimite,
            short parcial, BigDecimal puntaje, String materia, String curso, OffsetDateTime creadoEn) {}

    public record EntregaResponse(
            Long idEntrega, Long idTarea, String tituloTarea, String materia, String curso,
            OffsetDateTime fechaLimite, short parcial, BigDecimal puntaje, Long idEstudiante, String estudiante,
            String estado, String archivoNombreOriginal, OffsetDateTime fechaEntrega,
            String observacionDocente, BigDecimal nota) {}

    public record RevisarEntregaRequest(
            @Size(max = 500) String observacionDocente,
            @DecimalMin("1.0") @DecimalMax("10.0") BigDecimal nota) {}

    /** Material de apoyo adjunto a la tarea (no a la entrega) — guías, imágenes de referencia, etc. */
    public record AdjuntoTareaResponse(
            Long idAdjunto, String nombre, String archivoNombreOriginal, String archivoMimeType,
            Long archivoTamanoBytes, OffsetDateTime creadoEn) {}
}
