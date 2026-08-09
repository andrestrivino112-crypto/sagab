package ec.edu.bellini.sagab.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcType;
import org.hibernate.dialect.PostgreSQLEnumJdbcType;

import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "usuario")
@Getter @Setter
public class Usuario {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_usuario")
    private Long id;

    @Column(nullable = false, updatable = false)
    private UUID uuid = UUID.randomUUID();

    @Column(nullable = false, unique = true, length = 120)
    private String email;

    @Column(length = 40, unique = true)
    private String username;

    /** Hash BCrypt — jamás exponer en DTOs ni logs. */
    @Column(name = "hash_password", nullable = false, length = 100)
    private String hashPassword;

    @Column(nullable = false, length = 80)
    private String nombres;

    @Column(nullable = false, length = 80)
    private String apellidos;

    @Column(length = 10, unique = true)
    private String cedula;

    @Column(length = 15)
    private String telefono;

    @Enumerated(EnumType.STRING)
    @JdbcType(PostgreSQLEnumJdbcType.class)
    @Column(nullable = false, columnDefinition = "estado_usuario")
    private EstadoUsuario estado = EstadoUsuario.ACTIVO;

    @Column(name = "intentos_fallidos", nullable = false)
    private short intentosFallidos = 0;

    @Column(name = "bloqueado_hasta")
    private OffsetDateTime bloqueadoHasta;

    @Column(name = "ultimo_acceso")
    private OffsetDateTime ultimoAcceso;

    @Column(name = "debe_cambiar_clave", nullable = false)
    private boolean debeCambiarClave = true;

    /** Versión de seguridad incluida en el JWT. Al incrementarla, todos los tokens anteriores
     * quedan revocados aunque todavía no hayan alcanzado su fecha de expiración. */
    @Column(name = "auth_version", nullable = false)
    private int authVersion = 0;

    @Column(name = "creado_en", insertable = false, updatable = false)
    private OffsetDateTime creadoEn;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "usuario_rol",
            joinColumns = @JoinColumn(name = "id_usuario"),
            inverseJoinColumns = @JoinColumn(name = "id_rol"))
    private Set<Rol> roles;

    public enum EstadoUsuario { ACTIVO, INACTIVO, BLOQUEADO }

    public String nombreCompleto() { return nombres + " " + apellidos; }
}
