package ec.edu.bellini.sagab.dto;

public class EstudianteDtos {
    public record EstudianteResumen(Long id, String codigo, String nombreCompleto) {}

    /** Igual que EstudianteResumen, pero con el paralelo — usado en Financiero y Portal Familiar. */
    public record EstudianteConParalelo(Long id, String codigo, String nombreCompleto, String paralelo) {}

    /** Nómina administrativa del año lectivo activo. */
    public record EstudianteMatriculado(
            Long idEstudiante, String codigo, String nombreCompleto,
            String curso, String paralelo, String anioLectivo) {}
}
