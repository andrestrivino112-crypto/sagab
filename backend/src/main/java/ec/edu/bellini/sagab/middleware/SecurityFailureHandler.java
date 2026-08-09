package ec.edu.bellini.sagab.middleware;

import com.fasterxml.jackson.databind.ObjectMapper;
import ec.edu.bellini.sagab.service.EventoSeguridadService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/** Respuestas JSON uniformes para rechazos producidos dentro de la cadena de seguridad. */
@Component
public class SecurityFailureHandler implements AuthenticationEntryPoint, AccessDeniedHandler {

    private static final Logger log = LoggerFactory.getLogger(SecurityFailureHandler.class);

    private final EventoSeguridadService eventos;
    private final ObjectMapper objectMapper;

    public SecurityFailureHandler(EventoSeguridadService eventos, ObjectMapper objectMapper) {
        this.eventos = eventos;
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         org.springframework.security.core.AuthenticationException exception)
            throws IOException {
        escribir(response, HttpServletResponse.SC_UNAUTHORIZED,
                "Debe iniciar sesión para acceder a este recurso");
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException exception) throws IOException, ServletException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String actor = auth == null || auth.getName() == null ? "anonimo" : auth.getName();
        try {
            eventos.accesoDenegado(actor, "Acceso denegado a un recurso protegido",
                    request.getRemoteAddr(), request.getHeader("User-Agent"));
        } catch (RuntimeException auditError) {
            log.warn("No se pudo auditar un acceso denegado a {}", request.getRequestURI());
        }
        escribir(response, HttpServletResponse.SC_FORBIDDEN,
                "No tiene permisos para esta operación");
    }

    private void escribir(HttpServletResponse response, int estado, String mensaje) throws IOException {
        if (response.isCommitted()) return;
        response.setStatus(estado);
        response.setCharacterEncoding("UTF-8");
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", OffsetDateTime.now().toString());
        body.put("status", estado);
        body.put("mensaje", mensaje);
        objectMapper.writeValue(response.getWriter(), body);
    }
}
