package ec.edu.bellini.sagab;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.transaction.annotation.EnableTransactionManagement;

/**
 * SAGAB — Sistema Avanzado de Gestión Académica Bellini.
 * Punto de entrada de la aplicación Spring Boot.
 */
@SpringBootApplication
@EnableScheduling
// order=0 fija el advisor transaccional por debajo de Ordered.LOWEST_PRECEDENCE (el valor por
// defecto sin esta anotación, el mismo que usa AuditoriaContextAspect) para que la transacción
// arranque siempre ANTES de que el aspecto de auditoría corra su @Before — sin esto, ambos
// quedaban empatados en precedencia y el orden real entre ellos no estaba garantizado.
@EnableTransactionManagement(order = 0)
public class SagabApplication {
    public static void main(String[] args) {
        SpringApplication.run(SagabApplication.class, args);
    }
}
