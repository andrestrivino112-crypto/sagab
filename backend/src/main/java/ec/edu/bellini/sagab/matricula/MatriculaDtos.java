package ec.edu.bellini.sagab.matricula;

import jakarta.validation.constraints.*;

import java.time.LocalDate;
import java.util.List;

public class MatriculaDtos {

    public record MatriculaRequest(
            @NotBlank @Size(min = 3, max = 80) String estudianteNombres,
            @NotBlank @Size(min = 3, max = 80) String estudianteApellidos,
            @NotBlank @Pattern(regexp = "\\d{10}") String estudianteCedula,
            @NotNull LocalDate fechaNacimiento,
            @NotBlank @Pattern(regexp = "[MFO]") String genero,
            @NotBlank String nivel,
            @NotBlank String seccion,
            @NotBlank String anioLectivo,
            @Size(max = 150) String institucionProcedencia,
            @NotBlank @Size(min = 8, max = 150) String direccion,
            @Pattern(regexp = "09\\d{8}|0[2-7]\\d{7}|") String telefonoEstudiante,
            @Size(max = 5) String tipoSangre,
            @Size(max = 500) String condicionMedica,

            @NotBlank @Size(min = 3, max = 80) String representanteNombres,
            @NotBlank @Size(min = 3, max = 80) String representanteApellidos,
            @NotBlank @Pattern(regexp = "\\d{10}") String representanteCedula,
            @NotBlank String parentesco,
            @NotBlank @Email String representanteEmail,
            @NotBlank @Pattern(regexp = "09\\d{8}|0[2-7]\\d{7}") String representanteTelefono,
            @NotBlank @Size(min = 5, max = 150) String contactoEmergencia,

            @NotEmpty List<String> documentos) {}

    public record MatriculaResponse(
            Long idEstudiante,
            String codigo,
            boolean representanteNuevo,
            String claveTemporal) {}
}
