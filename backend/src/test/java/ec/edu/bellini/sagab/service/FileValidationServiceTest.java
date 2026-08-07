package ec.edu.bellini.sagab.service;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

class FileValidationServiceTest {

    private final FileValidationService service = new FileValidationService();

    @Test
    void aceptaTxtUtf8RealYCalculaHash() {
        var archivo = new MockMultipartFile("archivo", "guia.txt", "text/plain",
                "Guía académica DECE\nLínea 2".getBytes(StandardCharsets.UTF_8));

        var resultado = service.validarMaterialClase(archivo, 1024);

        assertEquals(FileValidationService.TipoArchivo.TEXTO, resultado.tipo());
        assertEquals("text/plain; charset=utf-8", resultado.mimeType());
        assertEquals(64, resultado.hashSha256().length());
    }

    @Test
    void rechazaBinarioDisfrazadoDeTxt() {
        var archivo = new MockMultipartFile("archivo", "malicioso.txt", "text/plain",
                new byte[] { 't', 'e', 'x', 't', 0, 1, 2 });

        assertThrows(IllegalArgumentException.class,
                () -> service.validarMaterialClase(archivo, 1024));
    }

    @Test
    void rechazaExtensionPermitidaCuandoFirmaNoCoincide() {
        var archivo = new MockMultipartFile("archivo", "falso.pdf", "application/pdf",
                "esto no es un PDF".getBytes(StandardCharsets.UTF_8));

        assertThrows(IllegalArgumentException.class,
                () -> service.validarMaterialClase(archivo, 1024));
    }
}
