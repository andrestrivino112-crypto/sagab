package ec.edu.bellini.sagab.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

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
    private final Path localDir;
    private final String publicBaseUrl;
    private final byte[] downloadSecret;

    public StorageService(S3Client s3,
                          @Value("${sagab.storage.bucket}") String bucket,
                          @Value("${sagab.storage.endpoint}") String endpoint,
                          @Value("${sagab.storage.region}") String region,
                          @Value("${sagab.storage.access-key}") String accessKey,
                          @Value("${sagab.storage.secret-key}") String secretKey,
                          @Value("${sagab.storage.local-dir}") String localDir,
                          @Value("${sagab.storage.public-base-url}") String publicBaseUrl,
                          @Value("${sagab.jwt.secret}") String downloadSecret) {
        this.s3 = s3;
        this.bucket = bucket;
        this.endpoint = endpoint;
        this.region = region;
        this.accessKey = accessKey;
        this.secretKey = secretKey;
        this.localDir = Path.of(localDir).toAbsolutePath().normalize();
        this.publicBaseUrl = publicBaseUrl.replaceAll("/+$", "");
        this.downloadSecret = downloadSecret.getBytes(StandardCharsets.UTF_8);
    }

    public boolean isS3Configured() {
        return notBlank(bucket) && notBlank(endpoint) && notBlank(accessKey) && notBlank(secretKey);
    }

    private boolean hayConfiguracionS3Parcial() {
        return !isS3Configured() && (notBlank(bucket) || notBlank(endpoint) || notBlank(accessKey) || notBlank(secretKey));
    }

    private void exigirConfiguracionCoherente() {
        if (hayConfiguracionS3Parcial()) {
            throw new IllegalArgumentException("La configuración S3 está incompleta; defina todas las variables SAGAB_S3_* o elimínelas para usar el almacenamiento local");
        }
    }

    private static boolean notBlank(String s) { return s != null && !s.isBlank(); }

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
        exigirConfiguracionCoherente();
        if (isS3Configured()) {
            s3.putObject(
                    PutObjectRequest.builder().bucket(bucket).key(key).contentType(contentType).build(),
                    RequestBody.fromBytes(contenido));
            return;
        }
        Path destino = rutaLocalSegura(key);
        try {
            Files.createDirectories(destino.getParent());
            Files.write(destino, contenido, StandardOpenOption.CREATE_NEW);
        } catch (java.io.IOException e) {
            throw new IllegalStateException("No se pudo persistir el archivo en el almacenamiento local", e);
        }
    }

    /** Borra el objeto del bucket (p. ej. al eliminar un recurso de clase) — nunca falla si la
     * clave ya no existe, S3 trata delete de un objeto inexistente como éxito. */
    public void eliminar(String key) {
        exigirConfiguracionCoherente();
        if (isS3Configured()) {
            s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
            return;
        }
        try {
            Files.deleteIfExists(rutaLocalSegura(key));
        } catch (java.io.IOException e) {
            throw new IllegalStateException("No se pudo eliminar el archivo del almacenamiento local", e);
        }
    }

    /** URL de descarga válida por poco tiempo; nunca se expone el bucket como público. */
    public String urlDescargaTemporal(String key) {
        exigirConfiguracionCoherente();
        if (isS3Configured()) {
            try (S3Presigner presigner = presigner()) {
                var presignado = presigner.presignGetObject(GetObjectPresignRequest.builder()
                        .signatureDuration(Duration.ofMinutes(10))
                        .getObjectRequest(GetObjectRequest.builder().bucket(bucket).key(key).build())
                        .build());
                return presignado.url().toString();
            }
        }
        Path archivo = rutaLocalSegura(key);
        if (!Files.isRegularFile(archivo)) throw new java.util.NoSuchElementException("El archivo ya no existe en el almacenamiento");
        long expira = Instant.now().plus(Duration.ofMinutes(10)).getEpochSecond();
        String datos = Base64.getUrlEncoder().withoutPadding()
                .encodeToString((expira + "\n" + key).getBytes(StandardCharsets.UTF_8));
        String firma = Base64.getUrlEncoder().withoutPadding().encodeToString(hmac(datos));
        return publicBaseUrl + "/api/storage/local/" + datos + "." + firma;
    }

    /** Valida la firma y expiración del enlace local. Nunca acepta una ruta enviada en claro. */
    public ArchivoLocal resolverDescargaLocal(String token) {
        int punto = token.lastIndexOf('.');
        if (punto <= 0 || punto == token.length() - 1) throw new IllegalArgumentException("Enlace de descarga inválido");
        String datos = token.substring(0, punto);
        byte[] esperada = hmac(datos);
        byte[] recibida;
        try {
            recibida = Base64.getUrlDecoder().decode(token.substring(punto + 1));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Enlace de descarga inválido");
        }
        if (!MessageDigest.isEqual(esperada, recibida)) throw new IllegalArgumentException("Enlace de descarga inválido");
        String payload;
        try {
            payload = new String(Base64.getUrlDecoder().decode(datos), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Enlace de descarga inválido");
        }
        int salto = payload.indexOf('\n');
        if (salto <= 0) throw new IllegalArgumentException("Enlace de descarga inválido");
        long expira;
        try {
            expira = Long.parseLong(payload.substring(0, salto));
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Enlace de descarga inválido");
        }
        if (Instant.now().getEpochSecond() > expira) throw new IllegalArgumentException("El enlace de descarga expiró");
        Path archivo = rutaLocalSegura(payload.substring(salto + 1));
        if (!Files.isRegularFile(archivo)) throw new java.util.NoSuchElementException("El archivo ya no existe en el almacenamiento");
        String mime;
        try {
            mime = Files.probeContentType(archivo);
        } catch (java.io.IOException e) {
            mime = null;
        }
        return new ArchivoLocal(archivo, mime == null ? "application/octet-stream" : mime);
    }

    public record ArchivoLocal(Path ruta, String mimeType) {}

    private Path rutaLocalSegura(String key) {
        Path ruta = localDir.resolve(key).normalize();
        if (!ruta.startsWith(localDir)) throw new IllegalArgumentException("Clave de almacenamiento inválida");
        return ruta;
    }

    private byte[] hmac(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(downloadSecret, "HmacSHA256"));
            return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException("No se pudo firmar el enlace de descarga", e);
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
