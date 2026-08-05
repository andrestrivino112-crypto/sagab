package ec.edu.bellini.sagab.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

public class TareaDtos {

    public record CrearTareaRequest(
            @NotNull Long idAsignacion,
            @NotBlank @Size(max = 150) String titulo,
            @Size(max = 1000) String descripcion,
            @NotNull OffsetDateTime fechaLimite) {}

    public record TareaResponse(
            Long idTarea, String titulo, String descripcion, OffsetDateTime fechaLimite,
            String materia, String curso, OffsetDateTime creadoEn) {}

    public record EntregaResponse(
            Long idEntrega, Long idTarea, String tituloTarea, String materia, String curso,
            OffsetDateTime fechaLimite, Long idEstudiante, String estudiante,
            String estado, String archivoNombreOriginal, OffsetDateTime fechaEntrega,
            String observacionDocente) {}

    public record RevisarEntregaRequest(@Size(max = 500) String observacionDocente) {}
}
