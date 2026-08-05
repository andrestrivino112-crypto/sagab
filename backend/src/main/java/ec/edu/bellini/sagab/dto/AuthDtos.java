package ec.edu.bellini.sagab.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public class AuthDtos {

    public record LoginRequest(
            @NotBlank String usuario,
            @NotBlank String password) {}

    public record TokenResponse(
            String accessToken,
            String tokenType,
            long expiraEnMinutos,
            String nombre,
            List<String> roles,
            boolean debeCambiarClave) {}

    public record CambiarClaveRequest(
            @NotBlank String claveActual,
            @NotBlank @Size(min = 8, max = 72, message = "La nueva contraseña debe tener al menos 8 caracteres") String claveNueva) {}
}
