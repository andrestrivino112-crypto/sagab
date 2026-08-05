package ec.edu.bellini.sagab.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
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

    public record PagoRequest(
            @NotNull Long idObligacion,
            @NotNull @DecimalMin("0.01") BigDecimal valorPagado,
            String metodo) {}

    /** Fila de la cola de revisión del admin: un pago por transferencia EN_REVISION. */
    public record PagoRevisionResponse(
            Long idPago, Long idObligacion, String estudiante, String rubro,
            BigDecimal valorPagado, String bancoOrigen, String asunto, String numeroReferencia,
            OffsetDateTime fechaPago, String comprobanteNombreOriginal, String estadoRevision,
            String observacionesAdmin) {}

    public record RevisionPagoRequest(@Size(max = 500) String observaciones) {}
}
