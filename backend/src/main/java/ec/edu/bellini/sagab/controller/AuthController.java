package ec.edu.bellini.sagab.controller;

import ec.edu.bellini.sagab.dto.AuthDtos;
import ec.edu.bellini.sagab.service.AuthService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) { this.authService = authService; }

    @PostMapping("/login")
    public ResponseEntity<AuthDtos.TokenResponse> login(@Valid @RequestBody AuthDtos.LoginRequest req,
                                                        HttpServletRequest http) {
        return ResponseEntity.ok(authService.login(
                req.usuario(), req.password(),
                http.getRemoteAddr(), http.getHeader("User-Agent")));
    }

    /** Reconstruye la sesión a partir del access token vigente (Authorization: Bearer) — el
     * frontend lo llama al arrancar para no perder la sesión al recargar la página. */
    @GetMapping("/me")
    public AuthDtos.SesionResponse me(Authentication auth) {
        return authService.me(auth.getName());
    }

    @PostMapping("/cambiar-clave")
    public ResponseEntity<Void> cambiarClave(@Valid @RequestBody AuthDtos.CambiarClaveRequest req,
                                             Authentication auth) {
        authService.cambiarClave(auth.getName(), req.claveActual(), req.claveNueva());
        return ResponseEntity.noContent().build();
    }
}
