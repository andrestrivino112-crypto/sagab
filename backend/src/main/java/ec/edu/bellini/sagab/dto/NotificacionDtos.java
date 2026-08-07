package ec.edu.bellini.sagab.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public class NotificacionDtos {

    public record NotificacionResponse(
            Long idNotificacion,
            String tipo,
            String materia,
            BigDecimal calificacion,
            String mensaje,
            OffsetDateTime creadoEn,
            boolean leida) {}
}
