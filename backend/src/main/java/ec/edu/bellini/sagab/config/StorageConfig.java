package ec.edu.bellini.sagab.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;

import java.net.URI;

/**
 * Cliente S3 para el almacenamiento de archivos (deberes, comprobantes de pago).
 * Se construye siempre, incluso sin credenciales configuradas, para no impedir que el resto
 * de la aplicación arranque; StorageService.isConfigured() es quien decide si puede usarse.
 */
@Configuration
public class StorageConfig {

    @Bean
    public S3Client s3Client(@Value("${sagab.storage.endpoint}") String endpoint,
                              @Value("${sagab.storage.region}") String region,
                              @Value("${sagab.storage.access-key}") String accessKey,
                              @Value("${sagab.storage.secret-key}") String secretKey) {
        // AwsBasicCredentials exige valores no vacíos incluso solo para construirse (aunque
        // nunca lleguen a usarse): si SAGAB_S3_* todavía no está configurado, se pasa un
        // placeholder — StorageService.isConfigured() es quien de verdad bloquea su uso real.
        var credenciales = AwsBasicCredentials.create(
                notBlank(accessKey) ? accessKey : "sin-configurar",
                notBlank(secretKey) ? secretKey : "sin-configurar");

        var builder = S3Client.builder()
                .region(Region.of(region == null || region.isBlank() ? "auto" : region))
                .credentialsProvider(StaticCredentialsProvider.create(credenciales))
                // Cliente HTTP síncrono liviano (sin depender de Apache HttpClient5 aparte).
                .httpClientBuilder(UrlConnectionHttpClient.builder())
                // Requerido por proveedores S3-compatibles como Cloudflare R2.
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build());

        if (endpoint != null && !endpoint.isBlank()) {
            builder.endpointOverride(URI.create(endpoint));
        }
        return builder.build();
    }

    private static boolean notBlank(String s) { return s != null && !s.isBlank(); }
}
