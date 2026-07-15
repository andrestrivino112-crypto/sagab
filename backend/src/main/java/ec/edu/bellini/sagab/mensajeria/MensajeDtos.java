package ec.edu.bellini.sagab.mensajeria;

import java.time.OffsetDateTime;

public class MensajeDtos {
    public record MensajeResponse(
            Long idMensaje, String asunto, String cuerpo, boolean esCircular,
            String remitente, OffsetDateTime enviadoEn, boolean leido) {}
}
