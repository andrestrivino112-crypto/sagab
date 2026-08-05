package ec.edu.bellini.sagab.controller;

import ec.edu.bellini.sagab.dto.NotificacionDtos;
import ec.edu.bellini.sagab.service.NotificacionService;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notificaciones")
public class NotificacionController {

    private final NotificacionService service;

    public NotificacionController(NotificacionService service) { this.service = service; }

    /** Notificaciones del usuario autenticado (cualquier rol: estudiante, representante, etc.). */
    @GetMapping("/mias")
    public List<NotificacionDtos.NotificacionResponse> mias(Authentication auth) {
        return service.mias(auth);
    }

    @PostMapping("/{id}/leida")
    public void marcarLeida(@PathVariable Long id, Authentication auth) {
        service.marcarLeida(id, auth);
    }
}
