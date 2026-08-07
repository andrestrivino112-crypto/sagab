package ec.edu.bellini.sagab.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class StorageServiceTest {

    @TempDir
    Path temporal;

    @Test
    void persisteYDescargaLocalConTokenFirmado() throws Exception {
        StorageService storage = local();
        String key = storage.generarClave("recursos/42", "guia.txt");
        byte[] contenido = "contenido persistente".getBytes(StandardCharsets.UTF_8);

        storage.subir(key, contenido, "text/plain");
        String url = storage.urlDescargaTemporal(key);
        String token = url.substring(url.lastIndexOf('/') + 1);
        StorageService.ArchivoLocal archivo = storage.resolverDescargaLocal(token);

        assertArrayEquals(contenido, Files.readAllBytes(archivo.ruta()));
        assertTrue(archivo.ruta().startsWith(temporal.toAbsolutePath()));

        storage.eliminar(key);
        assertFalse(Files.exists(archivo.ruta()));
    }

    @Test
    void rechazaTokenManipulado() {
        StorageService storage = local();
        assertThrows(IllegalArgumentException.class,
                () -> storage.resolverDescargaLocal("cGF5bG9hZA.firma-falsa"));
    }

    @Test
    void noAceptaConfiguracionS3Parcial() {
        StorageService storage = new StorageService(null, "bucket", "", "auto", "", "",
                temporal.toString(), "http://localhost:8080", "secreto-de-prueba-con-mas-de-32-bytes");
        assertThrows(IllegalArgumentException.class,
                () -> storage.subir("recursos/x.txt", new byte[] { 1 }, "text/plain"));
    }

    private StorageService local() {
        return new StorageService(null, "", "", "auto", "", "", temporal.toString(),
                "http://localhost:8080", "secreto-de-prueba-con-mas-de-32-bytes");
    }
}
