package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.SuperAdminDtos;
import ec.edu.bellini.sagab.exception.AuditedAccessDeniedException;
import ec.edu.bellini.sagab.model.Rol;
import ec.edu.bellini.sagab.model.Usuario;
import ec.edu.bellini.sagab.repository.RolRepository;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import org.springframework.data.domain.PageRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;
import java.util.NoSuchElementException;

@Service
public class SuperAdminService {

    private static final Logger log = LoggerFactory.getLogger(SuperAdminService.class);
    private static final String ROL_SUPER_ADMIN = "SUPER_ADMIN";

    private final UsuarioRepository usuarios;
    private final RolRepository roles;
    private final PasswordEncoder encoder;
    private final EventoSeguridadService eventos;

    public SuperAdminService(UsuarioRepository usuarios, RolRepository roles,
                             PasswordEncoder encoder, EventoSeguridadService eventos) {
        this.usuarios = usuarios;
        this.roles = roles;
        this.encoder = encoder;
        this.eventos = eventos;
    }

    @Transactional(readOnly = true)
    public SuperAdminDtos.PaginaUsuarios listar(String q, String rol, String estado,
                                                 int pagina, int tamano, Authentication auth) {
        Usuario actor = usuarios.findByEmail(auth.getName())
                .orElseThrow(() -> new AccessDeniedException("La sesión no corresponde a una cuenta vigente"));
        var resultado = usuarios.buscarCuentas(
                limpiar(q), limpiar(rol).toUpperCase(), limpiar(estado).toUpperCase(),
                PageRequest.of(pagina, tamano));
        List<SuperAdminDtos.UsuarioCuenta> contenido = resultado.getContent().stream()
                .map(p -> respuesta(p, actor.getId()))
                .toList();
        return new SuperAdminDtos.PaginaUsuarios(
                contenido, resultado.getNumber(), resultado.getSize(),
                resultado.getTotalElements(), resultado.getTotalPages());
    }

    @Transactional
    public void restablecerClave(Long idUsuario, Authentication auth, String ip, String userAgent) {
        bloquearGestionCuentas();
        Usuario actor = actorBloqueado(auth, ip, userAgent);
        if (actor.getId().equals(idUsuario)) {
            denegar(actor, "Intento de restablecer su propia contraseña", idUsuario, ip, userAgent);
        }

        Usuario objetivo = usuarios.findByIdForUpdate(idUsuario)
                .orElseThrow(() -> new NoSuchElementException("La cuenta seleccionada no existe"));
        String cedula = objetivo.getCedula();
        if (cedula == null || cedula.isBlank()) {
            throw new IllegalArgumentException(
                    "Esta cuenta no tiene una cédula registrada. No se puede generar la contraseña temporal.");
        }
        if (!cedula.matches("\\d{10}")) {
            throw new IllegalArgumentException(
                    "La cédula registrada no es válida. No se puede generar la contraseña temporal.");
        }

        objetivo.setHashPassword(encoder.encode(cedula));
        objetivo.setDebeCambiarClave(true);
        objetivo.setIntentosFallidos((short) 0);
        objetivo.setBloqueadoHasta(null);
        if (objetivo.getEstado() == Usuario.EstadoUsuario.BLOQUEADO) {
            objetivo.setEstado(Usuario.EstadoUsuario.ACTIVO);
        }
        incrementarVersion(objetivo);
        usuarios.revocarRefreshTokens(objetivo.getId());
        usuarios.saveAndFlush(objetivo);
        eventos.cuentaGestionada(actor.getEmail(), "RESTABLECIMIENTO_CLAVE", objetivo.getId(),
                usernameSeguro(objetivo), ip, userAgent);
    }

    @Transactional
    public void cambiarEstado(Long idUsuario, String nuevoEstado, Authentication auth,
                              String ip, String userAgent) {
        Usuario.EstadoUsuario estado = estadoGestionable(nuevoEstado);
        // Mutex global: dos SUPER_ADMIN no pueden deshabilitarse simultáneamente después de que
        // ambos hayan contado dos cuentas activas. Todas las operaciones toman primero este lock.
        bloquearGestionCuentas();
        Usuario actor = actorBloqueado(auth, ip, userAgent);
        if (estado == Usuario.EstadoUsuario.INACTIVO && actor.getId().equals(idUsuario)) {
            denegar(actor, "Intento de autodeshabilitación", idUsuario, ip, userAgent);
        }

        Usuario objetivo = usuarios.findByIdForUpdate(idUsuario)
                .orElseThrow(() -> new NoSuchElementException("La cuenta seleccionada no existe"));

        if (objetivo.getEstado() == estado
                && !(estado == Usuario.EstadoUsuario.ACTIVO
                     && objetivo.getBloqueadoHasta() != null)) {
            throw new IllegalArgumentException(estado == Usuario.EstadoUsuario.ACTIVO
                    ? "La cuenta ya está activa" : "La cuenta ya está inactiva");
        }

        if (estado == Usuario.EstadoUsuario.INACTIVO && tieneRol(objetivo, ROL_SUPER_ADMIN)) {
            long activos = usuarios.countByRolAndEstado(
                    ROL_SUPER_ADMIN, Usuario.EstadoUsuario.ACTIVO);
            if (activos <= 1) {
                denegar(actor, "Intento de deshabilitar al último SUPER_ADMIN activo",
                        objetivo.getId(), ip, userAgent);
            }
        }

        objetivo.setEstado(estado);
        objetivo.setIntentosFallidos((short) 0);
        objetivo.setBloqueadoHasta(null);
        incrementarVersion(objetivo);
        usuarios.revocarRefreshTokens(objetivo.getId());
        usuarios.saveAndFlush(objetivo);

        String accion = estado == Usuario.EstadoUsuario.ACTIVO
                ? "CUENTA_HABILITADA" : "CUENTA_DESHABILITADA";
        eventos.cuentaGestionada(actor.getEmail(), accion, objetivo.getId(),
                usernameSeguro(objetivo), ip, userAgent);
    }

    private Usuario actor(Authentication auth) {
        return usuarios.findByEmail(auth.getName())
                .orElseThrow(() -> new AccessDeniedException("La sesión no corresponde a una cuenta vigente"));
    }

    private Usuario actorBloqueado(Authentication auth, String ip, String userAgent) {
        Usuario actor = usuarios.findByEmailForUpdate(auth.getName())
                .orElseThrow(() -> new AccessDeniedException("La sesión no corresponde a una cuenta vigente"));
        if (actor.getEstado() != Usuario.EstadoUsuario.ACTIVO
                || !tieneRol(actor, ROL_SUPER_ADMIN)) {
            denegar(actor, "Cuenta ejecutora sin autorización vigente", actor.getId(), ip, userAgent);
        }
        return actor;
    }

    private void bloquearGestionCuentas() {
        roles.findByCodigoForUpdate(ROL_SUPER_ADMIN)
                .orElseThrow(() -> new IllegalStateException("Falta el rol SUPER_ADMIN en la base de datos"));
    }

    private SuperAdminDtos.UsuarioCuenta respuesta(
            UsuarioRepository.UsuarioCuentaProjection p, Long idActor) {
        List<String> rolesCuenta = p.getRoles() == null || p.getRoles().isBlank()
                ? List.of()
                : Arrays.stream(p.getRoles().split(",")).filter(s -> !s.isBlank()).toList();
        return new SuperAdminDtos.UsuarioCuenta(
                p.getIdUsuario(), p.getNombreCompleto(), p.getUsername(), p.getEmail(),
                rolesCuenta, p.getEstado(), p.getCedulaEnmascarada(),
                fecha(p.getUltimoAcceso()), fecha(p.getCreadoEn()),
                Boolean.TRUE.equals(p.getDebeCambiarClave()), p.getIdUsuario().equals(idActor));
    }

    private OffsetDateTime fecha(Instant valor) {
        return valor == null ? null : valor.atOffset(ZoneOffset.UTC);
    }

    private Usuario.EstadoUsuario estadoGestionable(String valor) {
        if ("ACTIVO".equals(valor)) return Usuario.EstadoUsuario.ACTIVO;
        if ("INACTIVO".equals(valor)) return Usuario.EstadoUsuario.INACTIVO;
        throw new IllegalArgumentException("El estado solo puede ser ACTIVO o INACTIVO");
    }

    private boolean tieneRol(Usuario usuario, String codigo) {
        return usuario.getRoles() != null
                && usuario.getRoles().stream().map(Rol::getCodigo).anyMatch(codigo::equals);
    }

    private void incrementarVersion(Usuario usuario) {
        usuario.setAuthVersion(Math.addExact(usuario.getAuthVersion(), 1));
    }

    private String limpiar(String valor) {
        return valor == null ? "" : valor.trim();
    }

    private String usernameSeguro(Usuario usuario) {
        return usuario.getUsername() == null ? "sin-username" : usuario.getUsername();
    }

    private void denegar(Usuario actor, String motivo, Long idObjetivo,
                         String ip, String userAgent) {
        boolean auditado = true;
        try {
            eventos.accesoDenegado(actor.getEmail(), motivo + "; cuentaObjetivo=" + idObjetivo,
                    ip, userAgent);
        } catch (RuntimeException auditError) {
            auditado = false;
            log.warn("No se pudo registrar un rechazo de gestión de cuentas");
        }
        if (auditado) {
            throw new AuditedAccessDeniedException("No se permite esta operación de seguridad");
        }
        throw new AccessDeniedException("No se permite esta operación de seguridad");
    }
}
