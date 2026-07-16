package ec.edu.bellini.sagab.controller;

import ec.edu.bellini.sagab.dto.AuthDtos;
import ec.edu.bellini.sagab.service.AuthService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
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
}
