package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.Usuario;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
    Optional<Usuario> findByEmail(String email);
    Optional<Usuario> findByUsername(String username);
    boolean existsByEmail(String email);
    boolean existsByCedula(String cedula);

    /** Personal administrativo (no familia): usado por el panel de Administrador para crear/listar cuentas. */
    List<Usuario> findByRoles_CodigoInOrderByApellidosAscNombresAsc(List<String> codigos);

    /** Todos los usuarios con cuenta activa — "todo el colegio" en el broadcast de mensajes. */
    List<Usuario> findByEstado(Usuario.EstadoUsuario estado);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM Usuario u WHERE u.username = :username")
    Optional<Usuario> findByUsernameForUpdate(@Param("username") String username);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM Usuario u WHERE u.email = :email")
    Optional<Usuario> findByEmailForUpdate(@Param("email") String email);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM Usuario u WHERE u.id = :id")
    Optional<Usuario> findByIdForUpdate(@Param("id") Long id);

    @Query("""
            SELECT COUNT(DISTINCT u.id) FROM Usuario u JOIN u.roles r
            WHERE r.codigo = :rol AND u.estado = :estado
            """)
    long countByRolAndEstado(@Param("rol") String rol,
                             @Param("estado") Usuario.EstadoUsuario estado);

    @Modifying
    @Query(value = """
            UPDATE sagab.refresh_token SET revocado = true
            WHERE id_usuario = :idUsuario AND revocado = false
            """, nativeQuery = true)
    int revocarRefreshTokens(@Param("idUsuario") Long idUsuario);

    @Query(value = """
            SELECT u.id_usuario AS "idUsuario",
                   concat_ws(' ', u.nombres, u.apellidos) AS "nombreCompleto",
                   u.username AS username,
                   u.email AS email,
                   COALESCE(string_agg(DISTINCT r.codigo, ',' ORDER BY r.codigo), '') AS roles,
                   CASE
                     WHEN u.estado = 'BLOQUEADO'
                       OR (u.estado = 'ACTIVO' AND u.bloqueado_hasta > now()) THEN 'BLOQUEADO'
                     ELSE CAST(u.estado AS text)
                   END AS estado,
                   CASE
                     WHEN u.cedula IS NULL THEN NULL
                     WHEN u.cedula ~ '^\\d{10}$' THEN '******' || right(u.cedula, 4)
                     ELSE '**********'
                   END AS "cedulaEnmascarada",
                   u.ultimo_acceso AS "ultimoAcceso",
                   u.creado_en AS "creadoEn",
                   u.debe_cambiar_clave AS "debeCambiarClave"
            FROM sagab.usuario u
            LEFT JOIN sagab.usuario_rol ur ON ur.id_usuario = u.id_usuario
            LEFT JOIN sagab.rol r ON r.id_rol = ur.id_rol
            WHERE (
                    CAST(:q AS text) = '' OR NOT EXISTS (
                      SELECT 1
                      FROM regexp_split_to_table(
                        sagab.fn_normalizar_busqueda(trim(CAST(:q AS text))), '\\s+'
                      ) AS terminos(termino)
                      WHERE termino <> ''
                        AND strpos(
                          sagab.fn_normalizar_busqueda(concat_ws(' ', u.nombres, u.apellidos,
                            COALESCE(u.username, ''), u.email, COALESCE(u.cedula, ''))),
                          termino
                        ) = 0
                    )
                  )
              AND (CAST(:rol AS text) = '' OR EXISTS (
                    SELECT 1 FROM sagab.usuario_rol urf
                    JOIN sagab.rol rf ON rf.id_rol = urf.id_rol
                    WHERE urf.id_usuario = u.id_usuario AND rf.codigo = CAST(:rol AS text)
                  ))
              AND (CAST(:estado AS text) = '' OR
                    CASE
                      WHEN u.estado = 'BLOQUEADO'
                        OR (u.estado = 'ACTIVO' AND u.bloqueado_hasta > now()) THEN 'BLOQUEADO'
                      ELSE CAST(u.estado AS text)
                    END = CAST(:estado AS text))
            GROUP BY u.id_usuario, u.nombres, u.apellidos, u.username, u.email, u.estado,
                     u.cedula, u.bloqueado_hasta, u.ultimo_acceso, u.creado_en,
                     u.debe_cambiar_clave
            ORDER BY lower(u.apellidos), lower(u.nombres), u.id_usuario
            """,
            countQuery = """
            SELECT count(*)
            FROM sagab.usuario u
            WHERE (
                    CAST(:q AS text) = '' OR NOT EXISTS (
                      SELECT 1
                      FROM regexp_split_to_table(
                        sagab.fn_normalizar_busqueda(trim(CAST(:q AS text))), '\\s+'
                      ) AS terminos(termino)
                      WHERE termino <> ''
                        AND strpos(
                          sagab.fn_normalizar_busqueda(concat_ws(' ', u.nombres, u.apellidos,
                            COALESCE(u.username, ''), u.email, COALESCE(u.cedula, ''))),
                          termino
                        ) = 0
                    )
                  )
              AND (CAST(:rol AS text) = '' OR EXISTS (
                    SELECT 1 FROM sagab.usuario_rol urf
                    JOIN sagab.rol rf ON rf.id_rol = urf.id_rol
                    WHERE urf.id_usuario = u.id_usuario AND rf.codigo = CAST(:rol AS text)
                  ))
              AND (CAST(:estado AS text) = '' OR
                    CASE
                      WHEN u.estado = 'BLOQUEADO'
                        OR (u.estado = 'ACTIVO' AND u.bloqueado_hasta > now()) THEN 'BLOQUEADO'
                      ELSE CAST(u.estado AS text)
                    END = CAST(:estado AS text))
            """, nativeQuery = true)
    Page<UsuarioCuentaProjection> buscarCuentas(
            @Param("q") String q, @Param("rol") String rol, @Param("estado") String estado,
            Pageable pageable);

    interface UsuarioCuentaProjection {
        Long getIdUsuario();
        String getNombreCompleto();
        String getUsername();
        String getEmail();
        String getRoles();
        String getEstado();
        String getCedulaEnmascarada();
        Instant getUltimoAcceso();
        Instant getCreadoEn();
        Boolean getDebeCambiarClave();
    }
}
