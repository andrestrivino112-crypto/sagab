package ec.edu.bellini.sagab.exception;

import org.springframework.security.access.AccessDeniedException;

/** Indica que el servicio ya registró el motivo específico del rechazo en la bitácora. */
public class AuditedAccessDeniedException extends AccessDeniedException {
    public AuditedAccessDeniedException(String mensaje) {
        super(mensaje);
    }
}
