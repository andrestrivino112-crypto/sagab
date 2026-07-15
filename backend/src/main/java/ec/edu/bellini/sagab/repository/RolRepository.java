package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.entity.Rol;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RolRepository extends JpaRepository<Rol, Short> {
    Optional<Rol> findByCodigo(String codigo);
}
