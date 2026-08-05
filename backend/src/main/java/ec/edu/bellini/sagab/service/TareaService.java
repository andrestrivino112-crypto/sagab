package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.TareaDtos;
import ec.edu.bellini.sagab.model.AsignacionDocente;
import ec.edu.bellini.sagab.model.EntregaTarea;
import ec.edu.bellini.sagab.model.Estudiante;
import ec.edu.bellini.sagab.model.Tarea;
import ec.edu.bellini.sagab.repository.AsignacionDocenteRepository;
import ec.edu.bellini.sagab.repository.EntregaTareaRepository;
import ec.edu.bellini.sagab.repository.EstudianteRepository;
import ec.edu.bellini.sagab.repository.TareaRepository;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Deberes: el docente publica una Tarea sobre una asignación (materia+paralelo+período); se
 * genera automáticamente una entrega PENDIENTE por cada estudiante activo del paralelo. El
 * representante (o un admin) sube el archivo en nombre del estudiante — pasa a ENTREGADO — y
 * el docente la revisa — pasa a REVISADO.
 */
@Service
public class TareaService {

    private final TareaRepository tareas;
    private final EntregaTareaRepository entregas;
    private final AsignacionDocenteRepository asignaciones;
    private final EstudianteRepository estudiantes;
    private final UsuarioRepository usuarios;
    private final EstudianteService estudianteService;
    private final StorageService storage;
    private final FileValidationService validacion;
    private final long maxBytesDeber;

    public TareaService(TareaRepository tareas, EntregaTareaRepository entregas,
                        AsignacionDocenteRepository asignaciones, EstudianteRepository estudiantes,
                        UsuarioRepository usuarios, EstudianteService estudianteService,
                        StorageService storage, FileValidationService validacion,
                        @Value("${sagab.uploads.max-mb-deberes}") long maxMbDeber) {
        this.tareas = tareas;
        this.entregas = entregas;
        this.asignaciones = asignaciones;
        this.estudiantes = estudiantes;
        this.usuarios = usuarios;
        this.estudianteService = estudianteService;
        this.storage = storage;
        this.validacion = validacion;
        this.maxBytesDeber = maxMbDeber * 1024 * 1024;
    }

    @Transactional
    public TareaDtos.TareaResponse crear(TareaDtos.CrearTareaRequest req, Authentication auth) {
        AsignacionDocente asignacion = asignaciones.findById(req.idAsignacion())
                .orElseThrow(() -> new NoSuchElementException("La asignación no existe"));
        exigirDueñoDeAsignacion(asignacion, auth);

        Long idUsuario = usuarios.findByEmail(auth.getName()).orElseThrow().getId();

        Tarea t = new Tarea();
        t.setAsignacion(asignacion);
        t.setTitulo(req.titulo());
        t.setDescripcion(req.descripcion());
        t.setFechaLimite(req.fechaLimite());
        t.setCreadoPor(idUsuario);
        t = tareas.save(t);
        // creado_en es DEFAULT now() en la BD (columna insertable=false/updatable=false en la
        // entidad): se refleja al releer, pero no en esta misma instancia tras el save(); se
        // completa aquí solo para que la respuesta de creación no muestre null.
        t.setCreadoEn(OffsetDateTime.now());

        // Una entrega PENDIENTE por cada estudiante activo del paralelo de la asignación.
        List<Estudiante> roster = estudiantes.findByParaleloIdAndActivoTrueOrderByApellidosAscNombresAsc(
                asignacion.getParalelo().getId());
        Tarea tareaFinal = t;
        List<EntregaTarea> nuevas = roster.stream().map(est -> {
            EntregaTarea e = new EntregaTarea();
            e.setTarea(tareaFinal);
            e.setEstudiante(est);
            return e;
        }).toList();
        entregas.saveAll(nuevas);

        return toTareaResponse(t);
    }

    @Transactional(readOnly = true)
    public List<TareaDtos.TareaResponse> porAsignacion(Long idAsignacion, Authentication auth) {
        AsignacionDocente asignacion = asignaciones.findById(idAsignacion)
                .orElseThrow(() -> new NoSuchElementException("La asignación no existe"));
        exigirDueñoDeAsignacion(asignacion, auth);
        return tareas.findByAsignacionIdOrderByFechaLimiteDesc(idAsignacion).stream()
                .map(this::toTareaResponse).toList();
    }

    /** Entregas de una tarea (todas, para que el docente las revise). */
    @Transactional(readOnly = true)
    public List<TareaDtos.EntregaResponse> entregasDeTarea(Long idTarea, Authentication auth) {
        Tarea t = tareas.findById(idTarea).orElseThrow(() -> new NoSuchElementException("La tarea no existe"));
        exigirDueñoDeAsignacion(t.getAsignacion(), auth);
        return entregas.findByTareaId(idTarea).stream()
                .sorted((a, b) -> a.getEstudiante().nombreCompleto().compareToIgnoreCase(b.getEstudiante().nombreCompleto()))
                .map(e -> toEntregaResponse(e, t))
                .toList();
    }

    /** Entregas (todas las tareas) de un estudiante — Portal Familiar. */
    @Transactional(readOnly = true)
    public List<TareaDtos.EntregaResponse> misEntregas(Long idEstudiante, Authentication auth) {
        if (!estudianteService.esPropio(idEstudiante, auth)) {
            throw new AccessDeniedException("No autorizado para consultar este estudiante");
        }
        List<EntregaTarea> lista = entregas.findByEstudianteIdOrderByFechaEntregaDesc(idEstudiante);
        Map<Long, Tarea> tareasPorId = tareas.findAllById(lista.stream().map(e -> e.getTarea().getId()).distinct().toList())
                .stream().collect(Collectors.toMap(Tarea::getId, Function.identity()));
        return lista.stream()
                .map(e -> toEntregaResponse(e, tareasPorId.get(e.getTarea().getId())))
                .toList();
    }

    @Transactional
    public TareaDtos.EntregaResponse subirEntrega(Long idTarea, Long idEstudiante, MultipartFile file, Authentication auth) {
        if (!estudianteService.esPropio(idEstudiante, auth)) {
            throw new AccessDeniedException("No autorizado para entregar en nombre de este estudiante");
        }
        EntregaTarea e = entregas.findByTareaIdAndEstudianteId(idTarea, idEstudiante)
                .orElseThrow(() -> new NoSuchElementException("No existe una entrega pendiente para ese estudiante en esa tarea"));

        FileValidationService.Resultado r = validacion.validarDeber(file, maxBytesDeber);
        String clave = storage.generarClave("deberes/" + idTarea + "/" + idEstudiante, file.getOriginalFilename());
        storage.subir(clave, r.contenido(), r.mimeType());

        e.setArchivoUrl(clave);
        e.setArchivoNombreOriginal(file.getOriginalFilename());
        e.setArchivoMimeType(r.mimeType());
        e.setArchivoTamanoBytes((long) r.contenido().length);
        e.setFechaEntrega(OffsetDateTime.now());
        e.setEstado(EntregaTarea.EstadoEntrega.ENTREGADO);
        entregas.save(e);

        return toEntregaResponse(e, e.getTarea());
    }

    @Transactional
    public TareaDtos.EntregaResponse revisar(Long idEntrega, TareaDtos.RevisarEntregaRequest req, Authentication auth) {
        EntregaTarea e = entregas.findById(idEntrega)
                .orElseThrow(() -> new NoSuchElementException("La entrega no existe"));
        exigirDueñoDeAsignacion(e.getTarea().getAsignacion(), auth);
        if (e.getEstado() == EntregaTarea.EstadoEntrega.PENDIENTE) {
            throw new IllegalArgumentException("No se puede revisar una entrega que el estudiante todavía no ha subido");
        }
        Long idUsuario = usuarios.findByEmail(auth.getName()).orElseThrow().getId();
        e.setObservacionDocente(req.observacionDocente());
        e.setEstado(EntregaTarea.EstadoEntrega.REVISADO);
        e.setRevisadoPor(idUsuario);
        e.setFechaRevision(OffsetDateTime.now());
        entregas.save(e);
        return toEntregaResponse(e, e.getTarea());
    }

    /** URL de descarga temporal del archivo entregado, verificando permisos primero. */
    @Transactional(readOnly = true)
    public String urlDescarga(Long idEntrega, Authentication auth) {
        EntregaTarea e = entregas.findById(idEntrega)
                .orElseThrow(() -> new NoSuchElementException("La entrega no existe"));
        boolean esDocenteODuenio = auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ADMIN"))
                || esDocenteDeLaAsignacion(e.getTarea().getAsignacion(), auth);
        if (!esDocenteODuenio && !estudianteService.esPropio(e.getEstudiante().getId(), auth)) {
            throw new AccessDeniedException("No autorizado para descargar este archivo");
        }
        if (e.getArchivoUrl() == null) {
            throw new NoSuchElementException("Esta entrega todavía no tiene un archivo subido");
        }
        return storage.urlDescargaTemporal(e.getArchivoUrl());
    }

    private void exigirDueñoDeAsignacion(AsignacionDocente asignacion, Authentication auth) {
        if (auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ADMIN"))) return;
        if (!esDocenteDeLaAsignacion(asignacion, auth)) {
            throw new AccessDeniedException("No tiene permisos sobre esta asignación");
        }
    }

    private boolean esDocenteDeLaAsignacion(AsignacionDocente asignacion, Authentication auth) {
        return asignacion.getDocente().getUsuario().getEmail().equalsIgnoreCase(auth.getName());
    }

    private TareaDtos.TareaResponse toTareaResponse(Tarea t) {
        return new TareaDtos.TareaResponse(
                t.getId(), t.getTitulo(), t.getDescripcion(), t.getFechaLimite(),
                t.getAsignacion().getMateria().getNombre(), t.getAsignacion().getParalelo().etiqueta(),
                t.getCreadoEn());
    }

    private TareaDtos.EntregaResponse toEntregaResponse(EntregaTarea e, Tarea t) {
        return new TareaDtos.EntregaResponse(
                e.getId(), t.getId(), t.getTitulo(),
                t.getAsignacion().getMateria().getNombre(), t.getAsignacion().getParalelo().etiqueta(),
                t.getFechaLimite(), e.getEstudiante().getId(), e.getEstudiante().nombreCompleto(),
                e.getEstado().name(), e.getArchivoNombreOriginal(), e.getFechaEntrega(), e.getObservacionDocente());
    }
}
