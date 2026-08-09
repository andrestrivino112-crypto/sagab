package ec.edu.bellini.sagab.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SuperAdminDtosTest {

    @Test
    void respuestaSerializadaSoloContieneDocumentoEnmascaradoYSinSecretos() throws Exception {
        var cuenta = new SuperAdminDtos.UsuarioCuenta(
                7L, "Persona Prueba", "persona", "persona@bellini.edu.ec",
                List.of("ESTUDIANTE"), "ACTIVO", "******1234",
                null, null, false, false);

        String json = new ObjectMapper().writeValueAsString(cuenta);

        assertTrue(json.contains("******1234"));
        assertFalse(json.contains("1712341234"));
        assertFalse(json.contains("hashPassword"));
        assertFalse(json.contains("accessToken"));
        assertFalse(json.contains("claveTemporal"));
    }
}
