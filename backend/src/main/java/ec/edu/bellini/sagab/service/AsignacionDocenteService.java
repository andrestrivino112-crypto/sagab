package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.AsignacionDocenteDtos;

import ec.edu.bellini.sagab.model.AsignacionDocente;
import ec.edu.bellini.sagab.repository.AsignacionDocenteRepository;
import org.springframework.security.access.AccessDeniedException;
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

    /**
     * Punto único del chequeo "¿puede este usuario administrar esta asignación?" — lo usan
     * TareaService (deberes) y RecursoAcademicoService (sílabo/formatos/link), igual que
     * EstudianteService.esPropio() es el punto único de "¿es suyo este estudiante?".
     */
    public void exigirDueñoDeAsignacion(AsignacionDocente asignacion, Authentication auth) {
        if (auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ADMIN"))) return;
        if (!esDocenteDeLaAsignacion(asignacion, auth)) {
            throw new AccessDeniedException("No tiene permisos sobre esta asignación");
        }
    }

    public boolean esDocenteDeLaAsignacion(AsignacionDocente asignacion, Authentication auth) {
        return asignacion.getDocente().getUsuario().getEmail().equalsIgnoreCase(auth.getName());
    }

    /**
     * Punto único del chequeo "¿puede este usuario operar sobre este paralelo?" — para
     * operaciones que son por paralelo completo (asistencia, nómina), no por una materia
     * específica: basta con que el docente dicte alguna asignación en ese paralelo.
     * DECE queda exento (monitorea ausencias de todo el colegio, no dicta materias) — es
     * seguro exentarlo aquí porque los únicos endpoints que exponen este chequeo a DECE son
     * de solo lectura; los de escritura (registrar asistencia) restringen el rol a nivel de
     * @PreAuthorize antes de llegar a este método.
     */
    public void exigirDocenteDelParalelo(Integer idParalelo, Authentication auth) {
        if (auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ADMIN"))
                || auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_DECE"))) return;
        if (!asignaciones.existsByDocenteUsuarioEmailAndParaleloId(auth.getName(), idParalelo)) {
            throw new AccessDeniedException("No tiene una asignación en este paralelo");
        }
    }
}
