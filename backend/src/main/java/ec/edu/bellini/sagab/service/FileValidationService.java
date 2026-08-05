package ec.edu.bellini.sagab.service;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Set;

/**
 * Valida archivos subidos por el usuario (deberes, comprobantes de pago): tamaño, y que el
 * contenido real coincida con un tipo permitido — nunca se confía únicamente en el
 * Content-Type ni en la extensión que manda el cliente, porque ambos se pueden falsificar
 * fácilmente. No hay un antivirus real disponible en este entorno; esto es la mitigación
 * razonable sin esa pieza: solo se acepta contenido cuyos primeros bytes (firma binaria)
 * correspondan de verdad a uno de los formatos permitidos.
 */
@Service
public class FileValidationService {

    public enum TipoArchivo { PDF, IMAGEN, ZIP_O_DOCX, DOC_ANTIGUO }

    public record Resultado(TipoArchivo tipo, String mimeType, byte[] contenido, String hashSha256) {}

    private static final Set<String> EXTENSIONES_DEBER =
            Set.of(".pdf", ".doc", ".docx", ".zip", ".jpg", ".jpeg", ".png", ".webp");
    private static final Set<String> EXTENSIONES_COMPROBANTE =
            Set.of(".pdf", ".jpg", ".jpeg", ".png", ".webp");

    public Resultado validarDeber(MultipartFile file, long maxBytes) {
        Resultado r = validarComun(file, maxBytes, EXTENSIONES_DEBER);
        if (r.tipo() == null) {
            throw new IllegalArgumentException(
                    "El archivo no es un PDF, Word, ZIP ni imagen válidos (o su contenido no coincide con la extensión).");
        }
        return r;
    }

    public Resultado validarComprobante(MultipartFile file, long maxBytes) {
        Resultado r = validarComun(file, maxBytes, EXTENSIONES_COMPROBANTE);
        if (r.tipo() == null || r.tipo() == TipoArchivo.ZIP_O_DOCX || r.tipo() == TipoArchivo.DOC_ANTIGUO) {
            throw new IllegalArgumentException(
                    "El comprobante debe ser una imagen (JPG/PNG/WEBP) o un PDF válidos.");
        }
        return r;
    }

    private Resultado validarComun(MultipartFile file, long maxBytes, Set<String> extensionesPermitidas) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Debe adjuntar un archivo.");
        }
        if (file.getSize() > maxBytes) {
            throw new IllegalArgumentException(
                    "El archivo supera el tamaño máximo permitido (" + (maxBytes / (1024 * 1024)) + " MB).");
        }
        String nombre = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
        String extension = nombre.contains(".") ? nombre.substring(nombre.lastIndexOf('.')) : "";
        if (!extensionesPermitidas.contains(extension)) {
            throw new IllegalArgumentException("Tipo de archivo no permitido: " + extension);
        }

        byte[] contenido;
        try {
            contenido = file.getBytes();
        } catch (IOException e) {
            throw new IllegalArgumentException("No se pudo leer el archivo enviado.");
        }

        TipoArchivo tipoReal = detectarTipoReal(contenido);
        String mimeReal = mimeDe(tipoReal, extension);
        return new Resultado(tipoReal, mimeReal, contenido, sha256(contenido));
    }

    /** Firma binaria (magic bytes) de los primeros bytes del archivo — ignora lo que declare el cliente. */
    private TipoArchivo detectarTipoReal(byte[] c) {
        if (empieza(c, 0x25, 0x50, 0x44, 0x46)) return TipoArchivo.PDF;                             // %PDF
        if (empieza(c, 0xFF, 0xD8, 0xFF)) return TipoArchivo.IMAGEN;                                // JPEG
        if (empieza(c, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)) return TipoArchivo.IMAGEN;  // PNG
        if (empieza(c, 0x52, 0x49, 0x46, 0x46) && contieneWebp(c)) return TipoArchivo.IMAGEN;       // RIFF....WEBP
        if (empieza(c, 0x50, 0x4B, 0x03, 0x04) || empieza(c, 0x50, 0x4B, 0x05, 0x06)) return TipoArchivo.ZIP_O_DOCX; // ZIP/DOCX
        if (empieza(c, 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1)) return TipoArchivo.DOC_ANTIGUO; // OLE (.doc viejo)
        return null;
    }

    private boolean contieneWebp(byte[] c) {
        return c.length >= 12 && c[8] == 'W' && c[9] == 'E' && c[10] == 'B' && c[11] == 'P';
    }

    private boolean empieza(byte[] c, int... firma) {
        if (c.length < firma.length) return false;
        for (int i = 0; i < firma.length; i++) {
            if ((c[i] & 0xFF) != firma[i]) return false;
        }
        return true;
    }

    private String mimeDe(TipoArchivo tipo, String extension) {
        if (tipo == null) return "application/octet-stream";
        return switch (tipo) {
            case PDF -> "application/pdf";
            case IMAGEN -> switch (extension) {
                case ".png" -> "image/png";
                case ".webp" -> "image/webp";
                default -> "image/jpeg";
            };
            case ZIP_O_DOCX -> extension.equals(".docx")
                    ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    : "application/zip";
            case DOC_ANTIGUO -> "application/msword";
        };
    }

    private String sha256(byte[] contenido) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(contenido);
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible en esta JVM", e);
        }
    }
}
