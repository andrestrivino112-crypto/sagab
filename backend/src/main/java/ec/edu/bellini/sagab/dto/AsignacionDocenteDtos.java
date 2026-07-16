package ec.edu.bellini.sagab.dto;

public class AsignacionDocenteDtos {
    public record AsignacionResponse(
            Long idAsignacion,
            Integer idParalelo,
            String paralelo,
            Integer idMateria,
            String materia,
            Integer idPeriodo,
            String periodo,
            boolean periodoActivo,
            Long idDocente,
            String docente) {}
}
