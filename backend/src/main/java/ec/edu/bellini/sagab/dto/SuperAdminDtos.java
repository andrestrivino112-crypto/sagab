package ec.edu.bellini.sagab.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import java.time.OffsetDateTime;
import java.util.List;

/** Contratos exclusivos de gestión de cuentas. Ninguno incluye hash, cédula completa ni token. */
public class SuperAdminDtos {

    public record UsuarioCuenta(
            Long idUsuario,
            String nombreCompleto,
            String username,
            String email,
            List<String> roles,
            String estado,
            String cedulaEnmascarada,
            OffsetDateTime ultimoAcceso,
            OffsetDateTime creadoEn,
            boolean debeCambiarClave,
            boolean esCuentaActual) {}

    public record PaginaUsuarios(
            List<UsuarioCuenta> contenido,
            int pagina,
            int tamano,
            long totalElementos,
            int totalPaginas) {}

    public record CambiarEstadoRequest(
            @NotBlank
            @Pattern(regexp = "ACTIVO|INACTIVO",
                    message = "estado debe ser ACTIVO o INACTIVO")
            String estado) {}
}
