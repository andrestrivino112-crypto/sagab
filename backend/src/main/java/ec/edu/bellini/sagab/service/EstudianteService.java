package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.EstudianteDtos;
import ec.edu.bellini.sagab.model.Estudiante;
import ec.edu.bellini.sagab.model.Representante;
import ec.edu.bellini.sagab.repository.EstudianteRepository;
import ec.edu.bellini.sagab.repository.RepresentanteRepository;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class EstudianteService {

    private final EstudianteRepository estudiantes;
    private final RepresentanteRepository representantes;
    private final UsuarioRepository usuarios;

    public EstudianteService(EstudianteRepository estudiantes, RepresentanteRepository representantes,
                             UsuarioRepository usuarios) {
        this.estudiantes = estudiantes;
        this.representantes = representantes;
        this.usuarios = usuarios;
    }

    /** Nómina de un paralelo — usada por Notas y Asistencia. */
    @Transactional(readOnly = true)
    public List<EstudianteDtos.EstudianteResumen> porParalelo(Integer idParalelo) {
        return estudiantes.findByParaleloIdAndActivoTrueOrderByApellidosAscNombresAsc(idParalelo).stream()
                .map(e -> new EstudianteDtos.EstudianteResumen(e.getId(), e.getCodigo(), e.nombreCompleto()))
                .toList();
    }

    /**
     * Estudiantes a los que el usuario autenticado tiene acceso propio — Portal Familiar.
     * Un REPRESENTANTE ve a todos sus representados; un ESTUDIANTE se ve solo a sí mismo
     * (cuenta 1:1 creada automáticamente en la matrícula, ver 09_estudiante_usuario.sql).
     */
    @Transactional(readOnly = true)
    public List<EstudianteDtos.EstudianteConParalelo> mios(Authentication auth) {
        List<Estudiante> propios;
        if (auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ESTUDIANTE"))) {
            propios = estudianteDe(auth).map(List::of).orElse(List.of());
        } else {
            Representante rep = representanteDe(auth);
            propios = estudiantes.findByRepresentanteIdAndActivoTrue(rep.getId());
        }
        return propios.stream()
                .map(e -> new EstudianteDtos.EstudianteConParalelo(e.getId(), e.getCodigo(), e.nombreCompleto(),
                        e.getParalelo() != null ? e.getParalelo().etiqueta() : null))
                .toList();
    }

    /** Búsqueda instantánea por nombre — selector de estudiante en Financiero (solo ADMIN). */
    @Transactional(readOnly = true)
    public List<EstudianteDtos.EstudianteConParalelo> buscar(String q) {
        return estudiantes.buscarPorNombre(q, PageRequest.of(0, 20)).stream()
                .map(e -> new EstudianteDtos.EstudianteConParalelo(e.getId(), e.getCodigo(), e.nombreCompleto(),
                        e.getParalelo() != null ? e.getParalelo().etiqueta() : null))
                .toList();
    }

    /**
     * Verifica si el estudiante dado pertenece al usuario autenticado: es su representante,
     * o es el propio estudiante viendo sus propios datos. ADMIN y DOCENTE no tienen restricción
     * (mismo criterio que el resto de la API). Punto único de este chequeo — lo usan
     * Calificaciones, Asistencia, Finanzas y Tareas al exponer datos de "mi hijo"/"mis datos".
     */
    @Transactional(readOnly = true)
    public boolean esPropio(Long idEstudiante, Authentication auth) {
        if (auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ADMIN"))
                || auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_DOCENTE"))) {
            return true;
        }
        if (auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ESTUDIANTE"))) {
            return estudianteDe(auth).map(Estudiante::getId).map(idEstudiante::equals).orElse(false);
        }
        Representante rep = representanteDe(auth);
        return estudiantes.findByRepresentanteIdAndActivoTrue(rep.getId()).stream()
                .anyMatch(e -> e.getId().equals(idEstudiante));
    }

    private Representante representanteDe(Authentication auth) {
        Long idUsuario = usuarios.findByEmail(auth.getName()).orElseThrow().getId();
        return representantes.findByUsuarioId(idUsuario)
                .orElseThrow(() -> new IllegalStateException("La cuenta no tiene un representante asociado"));
    }

    private Optional<Estudiante> estudianteDe(Authentication auth) {
        Long idUsuario = usuarios.findByEmail(auth.getName()).orElseThrow().getId();
        return estudiantes.findByUsuarioId(idUsuario);
    }
}
