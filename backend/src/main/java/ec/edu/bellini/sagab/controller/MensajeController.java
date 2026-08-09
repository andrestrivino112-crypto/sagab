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

    /** Envío directo a ids ya resueltos. El canal docente usa /broadcast y el institucional
     * usa /institucionales, de modo que cada flujo aplique sus propias reglas de alcance. */
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
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
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN','DOCENTE')")
    public MensajeDtos.MensajeResponse enviarBroadcast(@Valid @RequestBody MensajeDtos.EnviarBroadcastRequest req,
                                                         Authentication auth) {
        return service.enviarBroadcast(req, auth);
    }

    /** Canal exclusivo del Administrador: privado a un docente o masivo a todo el cuerpo docente. */
    @PostMapping("/institucionales")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public MensajeDtos.MensajeResponse enviarInstitucional(
            @Valid @RequestBody MensajeDtos.EnviarInstitucionalRequest req, Authentication auth) {
        return service.enviarInstitucional(req, auth);
    }

    @PostMapping("/{id}/leido")
    public void marcarLeido(@PathVariable Long id, Authentication auth) {
        service.marcarLeido(id, auth);
    }
}
