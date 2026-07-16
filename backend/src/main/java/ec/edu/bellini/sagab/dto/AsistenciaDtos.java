package ec.edu.bellini.sagab.dto;

import ec.edu.bellini.sagab.model.Asistencia;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

public class AsistenciaDtos {

    public record MarcaRequest(@NotNull Long idEstudiante,
                               @NotNull Asistencia.EstadoAsistencia estado,
                               String justificacion) {}

    public record RegistroDiarioRequest(@NotNull Integer idParalelo,
                                        LocalDate fecha,
                                        @NotEmpty List<MarcaRequest> marcas) {}

    public record RegistroResponse(LocalDate fecha, Asistencia.EstadoAsistencia estado, String justificacion) {}
}
