package ec.edu.bellini.sagab.dto;

public class MateriaDtos {

    /** Una materia del estudiante en el período académico vigente — "Mis materias" (Portal Familiar). */
    public record MateriaEstudianteResponse(
            Integer idMateria, String codigo, String nombre, String area,
            Long idAsignacion, String docente, int porcentajeAvance) {}
}
