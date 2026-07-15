package ec.edu.bellini.sagab.academico;

public class AsignacionDocenteDtos {
    public record AsignacionResponse(
            Long idAsignacion,
            Integer idParalelo,
            String paralelo,
            String materia,
            String periodo,
            boolean periodoActivo,
            String docente) {}
}
