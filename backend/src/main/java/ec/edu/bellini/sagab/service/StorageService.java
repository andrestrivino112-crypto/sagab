package ec.edu.bellini.sagab.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;

import java.net.URI;
import java.time.Duration;
import java.util.UUID;

/**
 * Sube y descarga archivos (deberes, comprobantes de pago) contra un bucket S3-compatible.
 * Los archivos NUNCA se guardan públicos: el bucket es privado y la descarga se hace con una
 * URL prefirmada de corta duración, generada solo después de que el backend verificó que el
 * usuario tiene permiso para ver ese archivo en concreto (misma regla que el resto de la API).
 */
@Service
public class StorageService {

    private final S3Client s3;
    private final String bucket;
    private final String endpoint;
    private final String region;
    private final String accessKey;
    private final String secretKey;

    public StorageService(S3Client s3,
                          @Value("${sagab.storage.bucket}") String bucket,
                          @Value("${sagab.storage.endpoint}") String endpoint,
                          @Value("${sagab.storage.region}") String region,
                          @Value("${sagab.storage.access-key}") String accessKey,
                          @Value("${sagab.storage.secret-key}") String secretKey) {
        this.s3 = s3;
        this.bucket = bucket;
        this.endpoint = endpoint;
        this.region = region;
        this.accessKey = accessKey;
        this.secretKey = secretKey;
    }

    public boolean isConfigured() {
        return notBlank(bucket) && notBlank(endpoint) && notBlank(accessKey) && notBlank(secretKey);
    }

    private static boolean notBlank(String s) { return s != null && !s.isBlank(); }

    private void exigirConfigurado() {
        if (!isConfigured()) {
            throw new IllegalArgumentException(
                    "El almacenamiento de archivos todavía no está configurado en el servidor " +
                    "(faltan las variables de entorno SAGAB_S3_*). Contacte al administrador.");
        }
    }

    /** Clave de objeto segura: prefijo + UUID, conservando solo la extensión del nombre original. */
    public String generarClave(String prefijo, String nombreOriginal) {
        String extension = "";
        if (nombreOriginal != null && nombreOriginal.contains(".")) {
            extension = nombreOriginal.substring(nombreOriginal.lastIndexOf('.')).toLowerCase();
            if (extension.length() > 10) extension = ""; // por si acaso, no arrastrar basura
        }
        return prefijo + "/" + UUID.randomUUID() + extension;
    }

    public void subir(String key, byte[] contenido, String contentType) {
        exigirConfigurado();
        s3.putObject(
                PutObjectRequest.builder().bucket(bucket).key(key).contentType(contentType).build(),
                RequestBody.fromBytes(contenido));
    }

    /** URL de descarga válida por poco tiempo; nunca se expone el bucket como público. */
    public String urlDescargaTemporal(String key) {
        exigirConfigurado();
        try (S3Presigner presigner = presigner()) {
            var presignado = presigner.presignGetObject(GetObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofMinutes(10))
                    .getObjectRequest(GetObjectRequest.builder().bucket(bucket).key(key).build())
                    .build());
            return presignado.url().toString();
        }
    }

    private S3Presigner presigner() {
        var credenciales = AwsBasicCredentials.create(accessKey, secretKey);
        var builder = S3Presigner.builder()
                .region(Region.of(region == null || region.isBlank() ? "auto" : region))
                .credentialsProvider(StaticCredentialsProvider.create(credenciales));
        if (notBlank(endpoint)) {
            builder.endpointOverride(URI.create(endpoint));
        }
        return builder.build();
    }
}
