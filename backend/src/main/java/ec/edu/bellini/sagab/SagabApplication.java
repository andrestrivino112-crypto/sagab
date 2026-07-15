package ec.edu.bellini.sagab;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * SAGAB — Sistema Avanzado de Gestión Académica Bellini.
 * Punto de entrada de la aplicación Spring Boot.
 */
@SpringBootApplication
@EnableScheduling
public class SagabApplication {
    public static void main(String[] args) {
        SpringApplication.run(SagabApplication.class, args);
    }
}
