package ec.edu.bellini.sagab.academico;

import ec.edu.bellini.sagab.entity.AsignacionDocente;
import ec.edu.bellini.sagab.repository.AsignacionDocenteRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AsignacionDocenteService {

    private final AsignacionDocenteRepository asignaciones;

    public AsignacionDocenteService(AsignacionDocenteRepository asignaciones) {
        this.asignaciones = asignaciones;
    }

    /** ADMIN ve todas las asignaciones; DOCENTE solo las suyas. */
    @Transactional(readOnly = true)
    public List<AsignacionDocenteDtos.AsignacionResponse> mias(Authentication auth) {
        boolean esAdmin = auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ADMIN"));
        List<AsignacionDocente> lista = esAdmin
                ? asignaciones.findAllByOrderByPeriodoFechaInicioDesc()
                : asignaciones.findByDocenteUsuarioEmailOrderByPeriodoFechaInicioDesc(auth.getName());

        return lista.stream().map(a -> new AsignacionDocenteDtos.AsignacionResponse(
                a.getId(),
                a.getParalelo().getId(),
                a.getParalelo().etiqueta(),
                a.getMateria().getId(),
                a.getMateria().getNombre(),
                a.getPeriodo().getId(),
                a.getPeriodo().etiqueta(),
                a.getPeriodo().isActivo(),
                a.getDocente().getId(),
                a.getDocente().getUsuario().nombreCompleto()
        )).toList();
    }
}
