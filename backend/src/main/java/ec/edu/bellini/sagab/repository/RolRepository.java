package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.Rol;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface RolRepository extends JpaRepository<Rol, Short> {
    Optional<Rol> findByCodigo(String codigo);

    /** Mutex transaccional común para operaciones que podrían dejar al sistema sin ningún
     * SUPER_ADMIN activo. Todas esas operaciones bloquean primero esta misma fila. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM Rol r WHERE r.codigo = :codigo")
    Optional<Rol> findByCodigoForUpdate(@Param("codigo") String codigo);
}
