package ec.edu.bellini.sagab.controller;

import ec.edu.bellini.sagab.dto.SuperAdminDtos;
import ec.edu.bellini.sagab.service.SuperAdminService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/super-admin")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SuperAdminController {

    private final SuperAdminService service;

    public SuperAdminController(SuperAdminService service) { this.service = service; }

    @GetMapping("/usuarios")
    public SuperAdminDtos.PaginaUsuarios usuarios(
            @RequestParam(defaultValue = "") @Size(max = 100) String q,
            @RequestParam(defaultValue = "")
            @Pattern(regexp = "|SUPER_ADMIN|ADMIN|DOCENTE|DECE|AUDITOR|REPRESENTANTE|ESTUDIANTE")
            String rol,
            @RequestParam(defaultValue = "") @Pattern(regexp = "|ACTIVO|INACTIVO|BLOQUEADO")
            String estado,
            @RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size,
            Authentication auth) {
        return service.listar(q, rol, estado, page, size, auth);
    }

    @PostMapping("/usuarios/{idUsuario}/restablecer-clave")
    public ResponseEntity<Void> restablecerClave(@PathVariable @Min(1) Long idUsuario,
                                                  Authentication auth,
                                                  HttpServletRequest http) {
        service.restablecerClave(idUsuario, auth, http.getRemoteAddr(), http.getHeader("User-Agent"));
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/usuarios/{idUsuario}/estado")
    public ResponseEntity<Void> cambiarEstado(@PathVariable @Min(1) Long idUsuario,
            @Valid @RequestBody SuperAdminDtos.CambiarEstadoRequest req,
            Authentication auth, HttpServletRequest http) {
        service.cambiarEstado(idUsuario, req.estado(), auth,
                http.getRemoteAddr(), http.getHeader("User-Agent"));
        return ResponseEntity.noContent().build();
    }
}
