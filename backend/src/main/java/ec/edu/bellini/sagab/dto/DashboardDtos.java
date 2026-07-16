package ec.edu.bellini.sagab.dto;

import java.math.BigDecimal;
import java.util.List;

public class DashboardDtos {

    public record RendimientoParalelo(String paralelo, BigDecimal promedio) {}

    public record ResumenDashboard(
            BigDecimal promedioInstitucional,
            long estudiantesEnMora,
            long ausenciasHoy,
            long mensajesPendientes,
            List<RendimientoParalelo> rendimientoPorParalelo) {}
}
