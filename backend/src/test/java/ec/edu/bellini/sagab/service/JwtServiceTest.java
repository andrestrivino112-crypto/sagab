package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.model.Rol;
import ec.edu.bellini.sagab.model.Usuario;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class JwtServiceTest {

    @Test
    void tokenFirmadoIncluyeIdVersionYRol() {
        JwtService service = new JwtService(
                "secreto-de-pruebas-con-mas-de-treinta-y-dos-bytes", 15);
        Rol rol = mock(Rol.class);
        when(rol.getCodigo()).thenReturn("SUPER_ADMIN");
        Usuario usuario = new Usuario();
        usuario.setId(17L);
        usuario.setEmail("seguridad@bellini.edu.ec");
        usuario.setNombres("Cuenta");
        usuario.setApellidos("Seguridad");
        usuario.setAuthVersion(6);
        usuario.setRoles(Set.of(rol));

        var claims = service.validar(service.generarAccessToken(usuario));

        assertEquals(17, ((Number) claims.get("uid")).intValue());
        assertEquals(6, ((Number) claims.get("av")).intValue());
        assertEquals("seguridad@bellini.edu.ec", claims.getSubject());
        assertEquals("SUPER_ADMIN", ((java.util.List<?>) claims.get("roles")).get(0));
    }
}
