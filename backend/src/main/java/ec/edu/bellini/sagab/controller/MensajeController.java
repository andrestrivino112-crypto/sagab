package ec.edu.bellini.sagab.controller;

import ec.edu.bellini.sagab.dto.MensajeDtos;
import ec.edu.bellini.sagab.service.MensajeService;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/mensajes")
public class MensajeController {

    private final MensajeService service;

    public MensajeController(MensajeService service) { this.service = service; }

    /** Bandeja de entrada del usuario autenticado. */
    @GetMapping("/mias")
    public List<MensajeDtos.MensajeResponse> mias(Authentication auth) {
        return service.mias(auth);
    }

    @PostMapping("/{id}/leido")
    public void marcarLeido(@PathVariable Long id, Authentication auth) {
        service.marcarLeido(id, auth);
    }
}
