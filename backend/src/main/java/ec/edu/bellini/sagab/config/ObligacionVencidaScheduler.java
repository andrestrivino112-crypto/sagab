package ec.edu.bellini.sagab.config;

import ec.edu.bellini.sagab.service.FinanzasService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Transiciona diariamente las obligaciones de pago PENDIENTE cuya fecha de vencimiento ya
 * pasó al estado VENCIDO. Sin este job, ningún código asignaba nunca ese estado
 * (INFORME_AUDITORIA_FUNCIONAL.md, hallazgo BE-06) y el KPI "estudiantes en mora" del
 * Dashboard quedaba permanentemente en 0 pese a haber estudiantes realmente en mora.
 */
@Component
public class ObligacionVencidaScheduler {

    private static final Logger log = LoggerFactory.getLogger(ObligacionVencidaScheduler.class);

    private final FinanzasService finanzas;

    public ObligacionVencidaScheduler(FinanzasService finanzas) {
        this.finanzas = finanzas;
    }

    /** Al arrancar, por si el proceso estuvo caído cuando alguna obligación venció. */
    @Scheduled(initialDelay = 0, fixedDelay = Long.MAX_VALUE)
    public void alArrancar() {
        ejecutar();
    }

    /** Todos los días a las 02:00. */
    @Scheduled(cron = "0 0 2 * * *")
    public void diario() {
        ejecutar();
    }

    private void ejecutar() {
        try {
            int actualizadas = finanzas.marcarObligacionesVencidas();
            if (actualizadas > 0) {
                log.info("{} obligación(es) de pago transicionadas a VENCIDO", actualizadas);
            }
        } catch (Exception e) {
            log.error("No se pudo transicionar las obligaciones de pago vencidas", e);
        }
    }
}
