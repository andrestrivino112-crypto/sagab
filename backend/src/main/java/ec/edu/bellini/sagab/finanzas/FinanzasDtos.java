package ec.edu.bellini.sagab.finanzas;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public class FinanzasDtos {

    public record PagoResponse(
            Long idPago, BigDecimal valorPagado, String metodo,
            String numeroRecibo, OffsetDateTime fechaPago) {}

    public record ObligacionResponse(
            Long idObligacion, String rubro, String tipo, LocalDate mes,
            BigDecimal valor, LocalDate fechaVencimiento, String estado,
            PagoResponse pago) {}

    public record PagoRequest(
            @NotNull Long idObligacion,
            @NotNull @DecimalMin("0.01") BigDecimal valorPagado,
            String metodo) {}
}
