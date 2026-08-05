package ec.edu.bellini.sagab.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Mantiene al día las particiones mensuales de auditoria.registro_cambio llamando a
 * auditoria.fn_crear_particion_siguiente_mes() (ver database/13_particion_auditoria_automatica.sql).
 * Sin esto, los registros de auditoría de meses sin partición creada caen en
 * silencio en la partición DEFAULT (ver INFORME_AUDITORIA.md, hallazgo crítico #1).
 */
@Component
public class AuditoriaParticionScheduler {

    private static final Logger log = LoggerFactory.getLogger(AuditoriaParticionScheduler.class);

    private final JdbcTemplate jdbc;

    public AuditoriaParticionScheduler(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Al arrancar, por si el proceso estuvo mucho tiempo caído y ya toca crear la siguiente partición. */
    @Scheduled(initialDelay = 0, fixedDelay = Long.MAX_VALUE)
    public void alArrancar() {
        ejecutar();
    }

    /** El día 1 de cada mes a las 03:00, con 2 meses de antelación (ver función SQL). */
    @Scheduled(cron = "0 0 3 1 * *")
    public void mensual() {
        ejecutar();
    }

    private void ejecutar() {
        try {
            jdbc.execute("SELECT auditoria.fn_crear_particion_siguiente_mes()");
            log.info("Verificación de partición de auditoría completada");
        } catch (Exception e) {
            log.error("No se pudo verificar/crear la partición mensual de auditoria.registro_cambio", e);
        }
    }
}
