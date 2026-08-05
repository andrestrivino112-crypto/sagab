package ec.edu.bellini.sagab.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.NoSuchElementException;

/**
 * Respuestas de error uniformes y sin fuga de información interna
 * (nunca stacktraces ni SQL al cliente). Todo error queda además en el log del
 * servidor (nunca en la respuesta) para poder investigar incidentes.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Map<String, Object>> credenciales(BadCredentialsException e) {
        return error(HttpStatus.UNAUTHORIZED, "Credenciales inválidas");
    }

    @ExceptionHandler(LockedException.class)
    public ResponseEntity<Map<String, Object>> bloqueada(LockedException e) {
        return error(HttpStatus.LOCKED, e.getMessage());
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> denegado(AccessDeniedException e) {
        log.warn("Acceso denegado: {}", e.getMessage());
        return error(HttpStatus.FORBIDDEN, "No tiene permisos para esta operación");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> validacion(MethodArgumentNotValidException e) {
        String detalle = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .findFirst().orElse("Datos inválidos");
        return error(HttpStatus.BAD_REQUEST, detalle);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> argumento(IllegalArgumentException e) {
        return error(HttpStatus.BAD_REQUEST, e.getMessage());
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, Object>> noEncontrado(NoSuchElementException e) {
        return error(HttpStatus.NOT_FOUND, e.getMessage() != null ? e.getMessage() : "El registro solicitado no existe");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> integridad(DataIntegrityViolationException e) {
        log.warn("Violación de integridad de datos: {}", e.getMostSpecificCause().getMessage());
        return error(HttpStatus.CONFLICT, "La operación viola una restricción de datos (registro duplicado o referenciado)");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> general(Exception e) {
        log.error("Error no controlado procesando la solicitud", e);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "Error interno. Contacte al administrador.");
    }

    private ResponseEntity<Map<String, Object>> error(HttpStatus status, String mensaje) {
        return ResponseEntity.status(status).body(Map.of(
                "timestamp", OffsetDateTime.now().toString(),
                "status", status.value(),
                "mensaje", mensaje));
    }
}
