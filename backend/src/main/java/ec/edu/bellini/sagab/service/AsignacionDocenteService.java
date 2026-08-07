package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.AsignacionDocenteDtos;

import ec.edu.bellini.sagab.model.AsignacionDocente;
import ec.edu.bellini.sagab.model.Docente;
import ec.edu.bellini.sagab.model.Materia;
import ec.edu.bellini.sagab.model.Paralelo;
import ec.edu.bellini.sagab.model.PeriodoAcademico;
import ec.edu.bellini.sagab.model.Usuario;
import ec.edu.bellini.sagab.repository.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.LinkedHashSet;
import java.util.NoSuchElementException;

@Service
public class AsignacionDocenteService {

    private final AsignacionDocenteRepository asignaciones;
    private final DocenteRepository docentes;
    private final MateriaRepository materias;
    private final ParaleloRepository paralelos;
    private final PeriodoAcademicoRepository periodos;

    public AsignacionDocenteService(AsignacionDocenteRepository asignaciones, DocenteRepository docentes,
                                    MateriaRepository materias, ParaleloRepository paralelos,
                                    PeriodoAcademicoRepository periodos) {
        this.asignaciones = asignaciones;
        this.docentes = docentes;
        this.materias = materias;
        this.paralelos = paralelos;
        this.periodos = periodos;
    }

    /** ADMIN ve todas las asignaciones; DOCENTE solo las suyas. */
    @Transactional(readOnly = true)
    public List<AsignacionDocenteDtos.AsignacionResponse> mias(Authentication auth) {
        boolean esAdmin = auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ADMIN"));
        List<AsignacionDocente> lista = esAdmin
                ? asignaciones.findAllByOrderByPeriodoFechaInicioDesc()
                : asignaciones.findByDocenteUsuarioEmailOrderByPeriodoFechaInicioDesc(auth.getName());

        return lista.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public AsignacionDocenteDtos.CatalogosResponse catalogos() {
        var docentesResponse = docentes.findAllByOrderByUsuarioApellidosAscUsuarioNombresAsc().stream()
                .filter(d -> d.getUsuario().getEstado() == Usuario.EstadoUsuario.ACTIVO)
                .map(d -> new AsignacionDocenteDtos.DocenteOpcion(d.getId(), d.getUsuario().getId(),
                        d.getUsuario().nombreCompleto(), d.getUsuario().getEmail())).toList();
        var materiasResponse = materias.findAllByOrderByNombreAsc().stream()
                .map(m -> new AsignacionDocenteDtos.MateriaOpcion(m.getId(), m.getCodigo(), m.getNombre(), m.getArea())).toList();
        var paralelosResponse = paralelos.findAll().stream()
                .sorted(java.util.Comparator.comparing(Paralelo::getAnioLectivo).reversed()
                        .thenComparing(Paralelo::getNivel).thenComparing(Paralelo::getSeccion))
                .map(p -> new AsignacionDocenteDtos.ParaleloOpcion(p.getId(), p.getNivel(), p.getSeccion(),
                        p.getAnioLectivo(), p.etiqueta())).toList();
        var periodosResponse = periodos.findAllByOrderByFechaInicioDesc().stream()
                .map(p -> new AsignacionDocenteDtos.PeriodoOpcion(p.getId(), p.getNombre(), p.getAnioLectivo(),
                        p.etiqueta(), p.isActivo())).toList();
        return new AsignacionDocenteDtos.CatalogosResponse(docentesResponse, materiasResponse, paralelosResponse, periodosResponse);
    }

    @Transactional
    public List<AsignacionDocenteDtos.AsignacionResponse> crear(AsignacionDocenteDtos.CrearAsignacionesRequest req) {
        Docente docente = docente(req.idDocente());
        Paralelo paralelo = paralelo(req.idParalelo());
        PeriodoAcademico periodo = periodo(req.idPeriodo());
        validarAnio(paralelo, periodo);

        List<Integer> idsMaterias = new LinkedHashSet<>(req.idsMaterias()).stream().toList();
        List<Materia> materiasSeleccionadas = materias.findAllById(idsMaterias);
        if (materiasSeleccionadas.size() != idsMaterias.size()) {
            throw new NoSuchElementException("Una de las materias seleccionadas no existe");
        }
        for (Materia materia : materiasSeleccionadas) {
            if (asignaciones.existsByMateriaIdAndParaleloIdAndPeriodoId(materia.getId(), paralelo.getId(), periodo.getId())) {
                throw new IllegalArgumentException(materia.getNombre() + " ya tiene docente en ese paralelo y período");
            }
        }
        return materiasSeleccionadas.stream().map(materia -> {
            AsignacionDocente a = new AsignacionDocente();
            a.setDocente(docente);
            a.setMateria(materia);
            a.setParalelo(paralelo);
            a.setPeriodo(periodo);
            return toResponse(asignaciones.save(a));
        }).toList();
    }

    @Transactional
    public AsignacionDocenteDtos.AsignacionResponse editar(Long id, AsignacionDocenteDtos.EditarAsignacionRequest req) {
        AsignacionDocente asignacion = asignaciones.findById(id)
                .orElseThrow(() -> new NoSuchElementException("La asignación no existe"));
        Docente docente = docente(req.idDocente());
        Materia materia = materias.findById(req.idMateria())
                .orElseThrow(() -> new NoSuchElementException("La materia no existe"));
        Paralelo paralelo = paralelo(req.idParalelo());
        PeriodoAcademico periodo = periodo(req.idPeriodo());
        validarAnio(paralelo, periodo);
        asignaciones.findByMateriaIdAndParaleloIdAndPeriodoId(materia.getId(), paralelo.getId(), periodo.getId())
                .filter(otra -> !otra.getId().equals(id))
                .ifPresent(otra -> { throw new IllegalArgumentException("La materia ya tiene docente en ese paralelo y período"); });
        asignacion.setDocente(docente);
        asignacion.setMateria(materia);
        asignacion.setParalelo(paralelo);
        asignacion.setPeriodo(periodo);
        return toResponse(asignaciones.save(asignacion));
    }

    @Transactional
    public void eliminar(Long id) {
        AsignacionDocente asignacion = asignaciones.findById(id)
                .orElseThrow(() -> new NoSuchElementException("La asignación no existe"));
        asignaciones.delete(asignacion);
        asignaciones.flush();
    }

    private Docente docente(Long id) {
        Docente docente = docentes.findById(id).orElseThrow(() -> new NoSuchElementException("El docente no existe"));
        if (docente.getUsuario().getEstado() != Usuario.EstadoUsuario.ACTIVO) {
            throw new IllegalArgumentException("No se puede asignar una materia a un docente inactivo");
        }
        return docente;
    }

    private Paralelo paralelo(Integer id) {
        return paralelos.findById(id).orElseThrow(() -> new NoSuchElementException("El paralelo no existe"));
    }

    private PeriodoAcademico periodo(Integer id) {
        return periodos.findById(id).orElseThrow(() -> new NoSuchElementException("El período no existe"));
    }

    private void validarAnio(Paralelo paralelo, PeriodoAcademico periodo) {
        if (!paralelo.getAnioLectivo().equals(periodo.getAnioLectivo())) {
            throw new IllegalArgumentException("El paralelo y el período deben pertenecer al mismo año lectivo");
        }
    }

    private AsignacionDocenteDtos.AsignacionResponse toResponse(AsignacionDocente a) {
        return new AsignacionDocenteDtos.AsignacionResponse(
                a.getId(), a.getParalelo().getId(), a.getParalelo().etiqueta(),
                a.getParalelo().getNivel(), a.getParalelo().getSeccion(), a.getParalelo().getAnioLectivo(),
                a.getMateria().getId(), a.getMateria().getNombre(), a.getPeriodo().getId(),
                a.getPeriodo().etiqueta(), a.getPeriodo().isActivo(), a.getDocente().getId(),
                a.getDocente().getUsuario().nombreCompleto());
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
