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

    /** Una fila de cualquiera de las agrupaciones del drill-down "Promedio institucional"
     * (por curso, paralelo o materia) — misma forma para las tres. */
    public record PromedioAgrupado(String etiqueta, BigDecimal promedio, long totalCalificaciones) {}

    /** Fila de la pestaña "Tendencia por año": el promedio de un curso/paralelo puntual en un año
     * lectivo puntual, para que cada dato se lea con su contexto completo (no un número aislado). */
    public record TendenciaAnual(String anioLectivo, String curso, String paralelo,
                                  BigDecimal promedio, long totalCalificaciones) {}

    public record PromedioDetalle(
            BigDecimal promedioInstitucional,
            List<PromedioAgrupado> porCurso,
            List<PromedioAgrupado> porParalelo,
            List<PromedioAgrupado> porMateria,
            List<TendenciaAnual> porAnioLectivo) {}
}
