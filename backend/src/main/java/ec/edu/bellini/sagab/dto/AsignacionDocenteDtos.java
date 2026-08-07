package ec.edu.bellini.sagab.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public class AsignacionDocenteDtos {
    public record AsignacionResponse(
            Long idAsignacion,
            Integer idParalelo,
            String paralelo,
            String nivel,
            String seccion,
            String anioLectivo,
            Integer idMateria,
            String materia,
            Integer idPeriodo,
            String periodo,
            boolean periodoActivo,
            Long idDocente,
            String docente) {}

    public record CrearAsignacionesRequest(
            @NotNull Long idDocente,
            @NotEmpty @Size(max = 20) List<@NotNull Integer> idsMaterias,
            @NotNull Integer idParalelo,
            @NotNull Integer idPeriodo) {}

    public record EditarAsignacionRequest(
            @NotNull Long idDocente,
            @NotNull Integer idMateria,
            @NotNull Integer idParalelo,
            @NotNull Integer idPeriodo) {}

    public record DocenteOpcion(Long idDocente, Long idUsuario, String nombre, String email) {}
    public record MateriaOpcion(Integer idMateria, String codigo, String nombre, String area) {}
    public record ParaleloOpcion(Integer idParalelo, String nivel, String seccion, String anioLectivo, String etiqueta) {}
    public record PeriodoOpcion(Integer idPeriodo, String nombre, String anioLectivo, String etiqueta, boolean activo) {}
    public record CatalogosResponse(List<DocenteOpcion> docentes, List<MateriaOpcion> materias,
                                    List<ParaleloOpcion> paralelos, List<PeriodoOpcion> periodos) {}
}
