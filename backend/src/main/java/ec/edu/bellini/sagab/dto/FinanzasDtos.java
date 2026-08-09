package ec.edu.bellini.sagab.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public class FinanzasDtos {

    public record PagoResponse(
            Long idPago, BigDecimal valorPagado, String metodo,
            String numeroRecibo, OffsetDateTime fechaPago, String estadoRevision) {}

    public record ObligacionResponse(
            Long idObligacion, String rubro, String tipo, LocalDate mes,
            BigDecimal valor, LocalDate fechaVencimiento, String estado,
            PagoResponse pago) {}

    /** Motivo de pago disponible (rubro del año lectivo vigente) — selector en el Portal Familiar. */
    public record RubroResponse(Integer idRubro, String nombre, String tipo, BigDecimal valor) {}

    public record PagoRequest(
            @NotNull Long idObligacion,
            @NotNull @DecimalMin("0.01") BigDecimal valorPagado,
            @Pattern(regexp = "EFECTIVO|TRANSFERENCIA|CHEQUE|TARJETA",
                     message = "metodo debe ser EFECTIVO, TRANSFERENCIA, CHEQUE o TARJETA")
            String metodo) {}

    /** Fila de la cola de revisión del admin: un pago por transferencia EN_REVISION. */
    public record PagoRevisionResponse(
            Long idPago, Long idObligacion, String estudiante, String rubro,
            BigDecimal valorPagado, String bancoOrigen, String asunto, String numeroReferencia,
            OffsetDateTime fechaPago, String comprobanteNombreOriginal, String estadoRevision,
            String observacionesAdmin) {}

    public record RevisionPagoRequest(@Size(max = 500) String observaciones) {}

    /** ADMIN origina a mano la obligación del mes en curso de un estudiante para un rubro — mismo
     * mecanismo que ya usa subirComprobante() cuando la familia paga un rubro sin obligación previa. */
    public record CrearObligacionRequest(@NotNull Long idEstudiante, @NotNull Integer idRubro) {}

    /** Fila del drill-down "Estudiantes en mora" del Dashboard — un registro por estudiante,
     * agregando todas sus obligaciones VENCIDO. */
    public record EstudianteMoraResponse(
            Long idEstudiante, String codigo, String nombreCompleto, String paralelo,
            String representante, String representanteTelefono, String representanteEmail,
            BigDecimal valorPendiente, LocalDate fechaVencimientoMasAntigua, long obligacionesVencidas) {}

    /** Canal por el que se envía la comunicación desde el drill-down de mora. */
    public enum CanalComunicacion { RECORDATORIO, NOTIFICACION, MENSAJE_INTERNO, EMAIL }

    /** {@code asunto} solo se usa para EMAIL y MENSAJE_INTERNO; se ignora en los otros canales. */
    public record ComunicacionMoraRequest(
            @NotNull CanalComunicacion canal,
            @Size(max = 150) String asunto,
            @NotBlank @Size(max = 500) String mensaje) {}

    /** Una fila por estudiante con obligaciones PENDIENTE o VENCIDO. El valor descuenta pagos
     * aprobados parciales y por eso representa el saldo real, no la suma nominal original. */
    public record ValorPendienteResponse(
            Long idEstudiante, String codigo, String nombreCompleto,
            String curso, String paralelo, String representante,
            String representanteEmail, String representanteTelefono,
            BigDecimal valorTotalPendiente, long cantidadObligaciones,
            long obligacionesVencidas, LocalDate fechaVencimientoMasAntigua) {}

    public record NotificacionValorPendienteRequest(
            @NotBlank @Size(max = 500) String mensaje) {}
}
