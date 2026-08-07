package ec.edu.bellini.sagab.dto;

import ec.edu.bellini.sagab.model.Asistencia;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

public class AsistenciaDtos {

    public record MarcaRequest(@NotNull Long idEstudiante,
                               @NotNull Asistencia.EstadoAsistencia estado,
                               String justificacion) {}

    /** {@code @Valid} en marcas es necesario para que Bean Validation aplique las restricciones de
     * cada MarcaRequest (idEstudiante/estado no nulos) — sin él, @NotEmpty solo valida que la lista
     * no esté vacía y una marca incompleta llegaría sin rechazo hasta el guardado en BD. */
    public record RegistroDiarioRequest(@NotNull Integer idParalelo,
                                        LocalDate fecha,
                                        @NotEmpty @Valid List<MarcaRequest> marcas) {}

    public record RegistroResponse(LocalDate fecha, Asistencia.EstadoAsistencia estado, String justificacion) {}

    /** Fila del registro de un paralelo — a diferencia de RegistroResponse, incluye al estudiante. */
    public record RegistroParaleloResponse(Long idEstudiante, String estudiante,
                                           Asistencia.EstadoAsistencia estado, String justificacion) {}

    /** Fila del drill-down "Ausencias" del Dashboard — un registro de falta/atraso con su contexto completo. */
    public record ReporteAusenciaResponse(
            Long idAsistencia, Long idEstudiante, String estudiante, String curso, String paralelo,
            LocalDate fecha, String estado, String justificacion, String registradoPor) {}
}
