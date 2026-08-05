package ec.edu.bellini.sagab.config;

import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Impide que la aplicación arranque sin SAGAB_DB_PASSWORD/SAGAB_JWT_SECRET definidas si alguien
 * olvida configurarlas al desplegar; sin este guard, application.yml cae en silencio a los
 * valores de ejemplo del repositorio (CAMBIAR_EN_PRODUCCION_app / CAMBIAR-ESTA-CLAVE-...).
 *
 * Se comprueba la PRESENCIA de la variable de entorno (Environment.containsProperty), no el
 * valor resuelto de spring.datasource.password/sagab.jwt.secret: alguien podría legítimamente
 * definir esas variables con un valor igual al placeholder (p. ej. en un entorno de desarrollo
 * donde nunca se rotó la contraseña semilla) y eso es una decisión explícita, no el fallback
 * silencioso que este guard existe para evitar.
 */
@Component
public class SecretsGuard {

    public SecretsGuard(Environment environment) {
        if (!environment.containsProperty("SAGAB_DB_PASSWORD")) {
            throw new IllegalStateException(
                    "SAGAB_DB_PASSWORD no está definida: la aplicación usaría la contraseña de " +
                    "ejemplo del repositorio. Define la variable de entorno SAGAB_DB_PASSWORD antes de arrancar.");
        }
        if (!environment.containsProperty("SAGAB_JWT_SECRET")) {
            throw new IllegalStateException(
                    "SAGAB_JWT_SECRET no está definida: la aplicación usaría el secreto de ejemplo " +
                    "del repositorio, con el que cualquiera podría forjar tokens válidos. Define la " +
                    "variable de entorno SAGAB_JWT_SECRET (ej. openssl rand -base64 48) antes de arrancar.");
        }
    }
}
