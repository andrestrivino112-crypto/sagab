package ec.edu.bellini.sagab.dto;

import ec.edu.bellini.sagab.model.EventoCalendario;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;

public class CalendarioDtos {
    public record AdjuntoResponse(Long idAdjunto, String nombre, String url) {}

    public record CalendarioItemResponse(
            String id, Long idEvento, String tipo, String titulo, String descripcion,
            OffsetDateTime inicio, OffsetDateTime fin, String lugar, String categoria,
            String color, String estado, OffsetDateTime publicarEn, String creador, OffsetDateTime creadoEn,
            String materia, String docente, Long idRelacionado, String rutaRelacionada,
            List<AdjuntoResponse> adjuntos) {}

    public record GuardarEventoRequest(
            @NotBlank @Size(max = 150) String titulo,
            @Size(max = 2000) String descripcion,
            @NotNull OffsetDateTime inicio,
            @NotNull OffsetDateTime fin,
            @Size(max = 180) String lugar,
            @NotNull EventoCalendario.Categoria categoria,
            @NotBlank @Pattern(regexp = "^#[0-9A-Fa-f]{6}$") String color,
            @NotNull EventoCalendario.Estado estado,
            OffsetDateTime publicarEn,
            @Size(max = 255) String adjuntoNombre,
            @Size(max = 500) @Pattern(regexp = "^https?://.*$", message = "El adjunto debe usar una URL http(s)") String adjuntoUrl) {}
}
