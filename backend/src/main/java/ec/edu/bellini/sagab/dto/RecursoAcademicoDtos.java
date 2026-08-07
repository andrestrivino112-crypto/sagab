package ec.edu.bellini.sagab.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

public class RecursoAcademicoDtos {

    public record RecursoResponse(
            Long idRecurso, String tipo, String nombre, String descripcion, Short semana,
            String urlExterna, String archivoNombreOriginal, String archivoMimeType, Long archivoTamanoBytes,
            String autor, OffsetDateTime creadoEn) {}

    public record CrearLinkRequest(
            @NotNull Long idAsignacion,
            @NotBlank @Size(max = 150) String nombre,
            @Size(max = 500) String descripcion,
            @Min(1) @Max(52) Short semana,
            @NotBlank @Size(max = 500) @Pattern(regexp = "^https?://.+", message = "Debe ser una URL http(s) válida")
            String urlExterna) {}

    /** Solo metadatos editables — reemplazar el archivo/enlace en sí es eliminar y volver a publicar. */
    public record EditarRecursoRequest(
            @NotBlank @Size(max = 150) String nombre,
            @Size(max = 500) String descripcion,
            @Min(1) @Max(52) Short semana) {}
}
