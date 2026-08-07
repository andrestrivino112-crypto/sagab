package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
    Optional<Usuario> findByEmail(String email);
    Optional<Usuario> findByUsername(String username);
    boolean existsByCedula(String cedula);

    /** Personal administrativo (no familia): usado por el panel de Administrador para crear/listar cuentas. */
    List<Usuario> findByRoles_CodigoInOrderByApellidosAscNombresAsc(List<String> codigos);

    /** Todos los usuarios con cuenta activa — "todo el colegio" en el broadcast de mensajes. */
    List<Usuario> findByEstado(Usuario.EstadoUsuario estado);
}
