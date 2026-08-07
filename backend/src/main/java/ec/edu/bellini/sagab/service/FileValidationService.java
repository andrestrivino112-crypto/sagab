package ec.edu.bellini.sagab.service;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Valida archivos subidos por el usuario (deberes, comprobantes de pago, recursos de clase):
 * tamaño, y que el contenido real coincida con un tipo permitido — nunca se confía únicamente
 * en el Content-Type ni en la extensión que manda el cliente, porque ambos se pueden falsificar
 * fácilmente. No hay un antivirus real disponible en este entorno; esto es la mitigación
 * razonable sin esa pieza: solo se acepta contenido cuyos primeros bytes (firma binaria)
 * correspondan de verdad a uno de los formatos permitidos.
 */
@Service
public class FileValidationService {

    public enum TipoArchivo {
        PDF, IMAGEN, ZIP_O_DOCX, DOC_ANTIGUO,
        // Usados solo por validarMaterialClase() — más tipos que un "deber" o "comprobante" admiten.
        DOCX, PPTX, XLSX, ZIP_GENERICO, RAR, VIDEO, AUDIO, TEXTO
    }

    public record Resultado(TipoArchivo tipo, String mimeType, byte[] contenido, String hashSha256) {}

    private static final Set<String> EXTENSIONES_DEBER =
            Set.of(".pdf", ".doc", ".docx", ".zip", ".jpg", ".jpeg", ".png", ".webp");
    private static final Set<String> EXTENSIONES_COMPROBANTE =
            Set.of(".pdf", ".jpg", ".jpeg", ".png", ".webp");
    /** Recursos de clase: bastante más permisivo — documentos de oficina, comprimidos, video y audio. */
    private static final Set<String> EXTENSIONES_MATERIAL = Set.of(
            ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".zip", ".rar",
            ".jpg", ".jpeg", ".png", ".webp", ".gif",
            ".mp4", ".mov", ".webm", ".avi", ".mp3", ".m4a", ".wav", ".ogg",
            ".txt", ".csv");

    public Resultado validarDeber(MultipartFile file, long maxBytes) {
        Resultado r = validarComun(file, maxBytes, EXTENSIONES_DEBER, this::detectarTipoReal);
        if (r.tipo() == null) {
            throw new IllegalArgumentException(
                    "El archivo no es un PDF, Word, ZIP ni imagen válidos (o su contenido no coincide con la extensión).");
        }
        return r;
    }

    public Resultado validarComprobante(MultipartFile file, long maxBytes) {
        Resultado r = validarComun(file, maxBytes, EXTENSIONES_COMPROBANTE, this::detectarTipoReal);
        if (r.tipo() == null || r.tipo() == TipoArchivo.ZIP_O_DOCX || r.tipo() == TipoArchivo.DOC_ANTIGUO) {
            throw new IllegalArgumentException(
                    "El comprobante debe ser una imagen (JPG/PNG/WEBP) o un PDF válidos.");
        }
        return r;
    }

    /** Recurso de clase (material de la semana): documentos, comprimidos, imágenes, video o audio. */
    public Resultado validarMaterialClase(MultipartFile file, long maxBytes) {
        Resultado r = validarComun(file, maxBytes, EXTENSIONES_MATERIAL, this::detectarTipoMaterial);
        if (r.tipo() == null) {
            throw new IllegalArgumentException(
                    "El archivo no corresponde a ninguno de los formatos permitidos, o su contenido no coincide con la extensión declarada.");
        }
        return r;
    }

    private Resultado validarComun(MultipartFile file, long maxBytes, Set<String> extensionesPermitidas,
                                    java.util.function.BiFunction<byte[], String, TipoArchivo> detector) {
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

        TipoArchivo tipoReal = detector.apply(contenido, extension);
        String mimeReal = mimeDe(tipoReal, extension);
        return new Resultado(tipoReal, mimeReal, contenido, sha256(contenido));
    }

    /** Firma binaria (magic bytes) de los primeros bytes del archivo — ignora lo que declare el cliente. */
    private TipoArchivo detectarTipoReal(byte[] c, String extension) {
        if (empieza(c, 0x25, 0x50, 0x44, 0x46)) return TipoArchivo.PDF;                             // %PDF
        if (esImagen(c)) return TipoArchivo.IMAGEN;
        if (empieza(c, 0x50, 0x4B, 0x03, 0x04) || empieza(c, 0x50, 0x4B, 0x05, 0x06)) return TipoArchivo.ZIP_O_DOCX; // ZIP/DOCX
        if (esOle2(c)) return TipoArchivo.DOC_ANTIGUO; // OLE (.doc viejo)
        return null;
    }

    /**
     * Igual que detectarTipoReal(), pero además distingue DOCX/PPTX/XLSX (mismo contenedor ZIP,
     * se diferencian mirando los nombres de entrada internos: word/, ppt/, xl/) y reconoce
     * RAR/MP4/MP3. Nota: para el formato de Office antiguo (OLE2: .doc/.xls/.ppt) los tres
     * comparten exactamente la misma firma binaria — distinguir el subtipo exigiría parsear el
     * árbol de streams OLE2, que no se justifica aquí; se acepta como "documento de oficina
     * antiguo" genérico, igual que ya hacía validarDeber() para .doc.
     */
    private TipoArchivo detectarTipoMaterial(byte[] c, String extension) {
        if (empieza(c, 0x25, 0x50, 0x44, 0x46)) return TipoArchivo.PDF;
        if (esImagen(c)) return TipoArchivo.IMAGEN;
        if (empieza(c, 0x52, 0x61, 0x72, 0x21, 0x1A, 0x07)) return TipoArchivo.RAR; // "Rar!" + variantes 4.x/5.x
        if (esMp4(c)) return extension.equals(".m4a") ? TipoArchivo.AUDIO : TipoArchivo.VIDEO;
        if (esWebm(c) || esAvi(c)) return TipoArchivo.VIDEO;
        if (esMp3(c)) return TipoArchivo.AUDIO;
        if (esWav(c) || esOgg(c)) return TipoArchivo.AUDIO;
        if ((extension.equals(".txt") || extension.equals(".csv")) && esTextoUtf8(c)) return TipoArchivo.TEXTO;
        if (empieza(c, 0x50, 0x4B, 0x03, 0x04) || empieza(c, 0x50, 0x4B, 0x05, 0x06)) {
            return subtipoZip(c);
        }
        if (esOle2(c)) return TipoArchivo.DOC_ANTIGUO;
        return null;
    }

    /** Docx/pptx/xlsx son ZIP con carpetas internas fijas — se abren en memoria para mirar solo los nombres. */
    private TipoArchivo subtipoZip(byte[] c) {
        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(c))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                String nombre = entry.getName();
                if (nombre.startsWith("word/")) return TipoArchivo.DOCX;
                if (nombre.startsWith("ppt/")) return TipoArchivo.PPTX;
                if (nombre.startsWith("xl/")) return TipoArchivo.XLSX;
            }
        } catch (IOException e) {
            return TipoArchivo.ZIP_GENERICO;
        }
        return TipoArchivo.ZIP_GENERICO;
    }

    private boolean esImagen(byte[] c) {
        if (empieza(c, 0xFF, 0xD8, 0xFF)) return true;                                 // JPEG
        if (empieza(c, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)) return true;    // PNG
        if (empieza(c, 0x47, 0x49, 0x46, 0x38)) return true;                           // GIF87a/GIF89a
        return empieza(c, 0x52, 0x49, 0x46, 0x46) && contieneWebp(c);                  // RIFF....WEBP
    }

    private boolean esOle2(byte[] c) {
        return empieza(c, 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1);
    }

    /** MP4/MOV: caja "ftyp" a partir del byte 4 (los primeros 4 bytes son el tamaño de la caja, variable). */
    private boolean esMp4(byte[] c) {
        return c.length >= 8 && c[4] == 'f' && c[5] == 't' && c[6] == 'y' && c[7] == 'p';
    }

    /** MP3: tag ID3v2 al inicio, o directamente el sync de una trama MPEG (11 bits en 1). */
    private boolean esMp3(byte[] c) {
        if (empieza(c, 0x49, 0x44, 0x33)) return true; // "ID3"
        return c.length >= 2 && (c[0] & 0xFF) == 0xFF && (c[1] & 0xE0) == 0xE0;
    }

    private boolean esWav(byte[] c) {
        return c.length >= 12 && empieza(c, 0x52, 0x49, 0x46, 0x46)
                && c[8] == 'W' && c[9] == 'A' && c[10] == 'V' && c[11] == 'E';
    }

    private boolean esAvi(byte[] c) {
        return c.length >= 12 && empieza(c, 0x52, 0x49, 0x46, 0x46)
                && c[8] == 'A' && c[9] == 'V' && c[10] == 'I' && c[11] == ' ';
    }

    private boolean esOgg(byte[] c) {
        return empieza(c, 0x4F, 0x67, 0x67, 0x53); // OggS
    }

    private boolean esWebm(byte[] c) {
        return empieza(c, 0x1A, 0x45, 0xDF, 0xA3); // EBML (WebM/Matroska)
    }

    /** Texto plano válido en UTF-8, sin bytes NUL ni controles binarios. */
    private boolean esTextoUtf8(byte[] c) {
        for (byte b : c) if (b == 0) return false;
        try {
            StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(c));
            return true;
        } catch (java.nio.charset.CharacterCodingException e) {
            return false;
        }
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
                case ".gif" -> "image/gif";
                default -> "image/jpeg";
            };
            case ZIP_O_DOCX -> extension.equals(".docx")
                    ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    : "application/zip";
            case DOC_ANTIGUO -> switch (extension) {
                case ".xls" -> "application/vnd.ms-excel";
                case ".ppt" -> "application/vnd.ms-powerpoint";
                default -> "application/msword";
            };
            case DOCX -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            case PPTX -> "application/vnd.openxmlformats-officedocument.presentationml.presentation";
            case XLSX -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            case ZIP_GENERICO -> "application/zip";
            case RAR -> "application/vnd.rar";
            case VIDEO -> switch (extension) {
                case ".webm" -> "video/webm";
                case ".avi" -> "video/x-msvideo";
                case ".mov" -> "video/quicktime";
                default -> "video/mp4";
            };
            case AUDIO -> switch (extension) {
                case ".wav" -> "audio/wav";
                case ".ogg" -> "audio/ogg";
                case ".m4a" -> "audio/mp4";
                default -> "audio/mpeg";
            };
            case TEXTO -> extension.equals(".csv") ? "text/csv; charset=utf-8" : "text/plain; charset=utf-8";
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
