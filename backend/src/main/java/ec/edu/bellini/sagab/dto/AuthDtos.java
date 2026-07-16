package ec.edu.bellini.sagab.dto;

import jakarta.validation.constraints.NotBlank;

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
}
