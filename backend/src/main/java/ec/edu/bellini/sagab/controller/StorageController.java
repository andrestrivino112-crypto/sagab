package ec.edu.bellini.sagab.controller;

import ec.edu.bellini.sagab.service.StorageService;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.file.Files;

/** Descarga de objetos del proveedor local mediante enlaces HMAC temporales. */
@RestController
@RequestMapping("/api/storage")
public class StorageController {

    private final StorageService storage;

    public StorageController(StorageService storage) {
        this.storage = storage;
    }

    @GetMapping("/local/{token}")
    public ResponseEntity<InputStreamResource> descargarLocal(@PathVariable String token) throws IOException {
        StorageService.ArchivoLocal archivo = storage.resolverDescargaLocal(token);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(archivo.mimeType()))
                .contentLength(Files.size(archivo.ruta()))
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + archivo.ruta().getFileName().toString().replace("\"", "") + "\"")
                .body(new InputStreamResource(Files.newInputStream(archivo.ruta())));
    }
}
