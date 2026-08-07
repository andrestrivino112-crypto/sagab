package ec.edu.bellini.sagab.repository;

import ec.edu.bellini.sagab.model.Mensaje;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MensajeRepository extends JpaRepository<Mensaje, Long> {
    /** Mensajes enviados por el usuario actual — pestaña "Enviados" del drill-down de Mensajes. */
    List<Mensaje> findByIdRemitenteOrderByEnviadoEnDesc(Long idRemitente, Pageable pageable);
}
