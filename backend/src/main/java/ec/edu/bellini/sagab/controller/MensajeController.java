package ec.edu.bellini.sagab.controller;

import ec.edu.bellini.sagab.dto.MensajeDtos;
import ec.edu.bellini.sagab.service.MensajeService;

import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
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

    /** Envío de un mensaje interno a uno o varios usuarios. Acotado a ADMIN por ahora; se ampliará
     * (DOCENTE, broadcast por curso/paralelo/rol) junto con el módulo de Notificaciones. */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public MensajeDtos.MensajeResponse enviar(@Valid @RequestBody MensajeDtos.EnviarMensajeRequest req, Authentication auth) {
        return service.enviar(req, auth);
    }

    /** Mensajes enviados por el usuario autenticado — pestaña "Enviados" del drill-down de Mensajes. */
    @GetMapping("/enviados")
    public List<MensajeDtos.MensajeEnviadoResponse> enviados(Authentication auth) {
        return service.enviados(auth);
    }

    /** Envío masivo por grupo (un estudiante, varios, todo un curso/paralelo, representantes,
     * docentes o todo el colegio) — el profesor resuelve a quién llegar sin conocer ids de usuario. */
    @PostMapping("/broadcast")
    @PreAuthorize("hasAnyRole('ADMIN','DOCENTE')")
    public MensajeDtos.MensajeResponse enviarBroadcast(@Valid @RequestBody MensajeDtos.EnviarBroadcastRequest req,
                                                         Authentication auth) {
        return service.enviarBroadcast(req, auth);
    }

    @PostMapping("/{id}/leido")
    public void marcarLeido(@PathVariable Long id, Authentication auth) {
        service.marcarLeido(id, auth);
    }
}
