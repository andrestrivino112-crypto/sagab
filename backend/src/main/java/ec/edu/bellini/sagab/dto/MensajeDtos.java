package ec.edu.bellini.sagab.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;

public class MensajeDtos {
    public record MensajeResponse(
            Long idMensaje, String asunto, String cuerpo, boolean esCircular,
            String remitente, OffsetDateTime enviadoEn, boolean leido) {}

    /** Envío de un mensaje interno a uno o varios usuarios (destinatarios ya resueltos por id). */
    public record EnviarMensajeRequest(
            @NotEmpty List<Long> idsDestinatarios,
            @NotBlank @Size(max = 150) String asunto,
            @NotBlank String cuerpo) {}

    /** A quién apunta un envío masivo — el backend resuelve el grupo a ids de usuario concretos. */
    public enum GrupoDestinatario {
        ESTUDIANTES, TODO_CURSO, TODO_PARALELO, TODOS_REPRESENTANTES, TODOS_DOCENTES, TODO_COLEGIO
    }

    /**
     * Envío masivo por grupo — el profesor (o admin) no conoce los ids de usuario de cada
     * destinatario, solo a quién quiere llegar. Según {@code grupo}:
     * <ul>
     *   <li>ESTUDIANTES: requiere {@code idsEstudiantes} (uno o varios).</li>
     *   <li>TODO_PARALELO: requiere {@code idParalelo}.</li>
     *   <li>TODO_CURSO: requiere {@code curso} (nivel, p. ej. "8vo EGB").</li>
     *   <li>TODOS_REPRESENTANTES / TODOS_DOCENTES / TODO_COLEGIO: no requieren nada más.</li>
     * </ul>
     */
    public record EnviarBroadcastRequest(
            @NotNull GrupoDestinatario grupo,
            List<Long> idsEstudiantes,
            Integer idParalelo,
            String curso,
            @NotBlank @Size(max = 150) String asunto,
            @NotBlank String cuerpo) {}

    /** Fila de la pestaña "Enviados" — incluye cuántos de los destinatarios ya lo leyeron. */
    public record MensajeEnviadoResponse(
            Long idMensaje, String asunto, String cuerpo, boolean esCircular, OffsetDateTime enviadoEn,
            long totalDestinatarios, long leidos) {}
}
