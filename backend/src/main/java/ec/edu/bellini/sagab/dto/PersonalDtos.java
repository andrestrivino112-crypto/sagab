package ec.edu.bellini.sagab.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Alta de cuentas de personal (no familia) desde el panel de Administrador: DOCENTE, DECE, AUDITOR. */
public class PersonalDtos {

    public record CrearPersonalRequest(
            @NotBlank @Size(min = 3, max = 80) String nombres,
            @NotBlank @Size(min = 3, max = 80) String apellidos,
            @NotBlank @Pattern(regexp = "\\d{10}") String cedula,
            @NotBlank @Email @Size(max = 120) String email,
            @Pattern(regexp = "09\\d{8}|0[2-7]\\d{7}|") String telefono,
            @NotBlank @Pattern(regexp = "DOCENTE|DECE|AUDITOR", message = "rol debe ser DOCENTE, DECE o AUDITOR") String rol,
            @Size(max = 80) String tituloDocente) {}

    /** Respuesta segura: confirma la cuenta creada sin devolver su contraseña temporal. */
    public record PersonalResponse(
            Long idUsuario, String nombreCompleto, String username, String email, String rol) {}

    public record PersonalResumen(
            Long idUsuario, String nombreCompleto, String username, String email, String rol, String estado) {}
}
