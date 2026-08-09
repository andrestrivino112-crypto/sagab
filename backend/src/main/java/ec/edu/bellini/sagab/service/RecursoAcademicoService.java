package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.RecursoAcademicoDtos;
import ec.edu.bellini.sagab.model.AsignacionDocente;
import ec.edu.bellini.sagab.model.Estudiante;
import ec.edu.bellini.sagab.model.RecursoAcademico;
import ec.edu.bellini.sagab.model.Usuario;
import ec.edu.bellini.sagab.repository.AsignacionDocenteRepository;
import ec.edu.bellini.sagab.repository.EstudianteRepository;
import ec.edu.bellini.sagab.repository.RecursoAcademicoRepository;
import ec.edu.bellini.sagab.repository.UsuarioRepository;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.Comparator;
import java.util.List;
import java.util.NoSuchElementException;
import java.net.URI;

/**
 * Sílabo, formatos de presentación y link de clase virtual de una asignación — sección
 * "Información Académica" de "Mis materias" (Portal Familiar) y gestión del docente.
 */
@Service
public class RecursoAcademicoService {

    private final RecursoAcademicoRepository recursos;
    private final AsignacionDocenteRepository asignaciones;
    private final EstudianteRepository estudiantes;
    private final UsuarioRepository usuarios;
    private final AsignacionDocenteService asignacionDocenteService;
    private final EstudianteService estudianteService;
    private final StorageService storage;
    private final FileValidationService validacion;
    private final long maxBytesRecurso;

    public RecursoAcademicoService(RecursoAcademicoRepository recursos, AsignacionDocenteRepository asignaciones,
                                   EstudianteRepository estudiantes, UsuarioRepository usuarios,
                                   AsignacionDocenteService asignacionDocenteService, EstudianteService estudianteService,
                                   StorageService storage, FileValidationService validacion,
                                   @Value("${sagab.uploads.max-mb-recursos}") long maxMbRecurso) {
        this.recursos = recursos;
        this.asignaciones = asignaciones;
        this.estudiantes = estudiantes;
        this.usuarios = usuarios;
        this.asignacionDocenteService = asignacionDocenteService;
        this.estudianteService = estudianteService;
        this.storage = storage;
        this.validacion = validacion;
        this.maxBytesRecurso = maxMbRecurso * 1024 * 1024;
    }

    /**
     * ADMIN y el docente dueño de la asignación acceden sin restricción. REPRESENTANTE/ESTUDIANTE
     * deben indicar {@code idEstudiante}: se exige que el estudiante sea propio y que la
     * asignación pertenezca a su paralelo actual (no basta con ser dueño del estudiante — la
     * asignación debe ser una de sus materias reales).
     */
    @Transactional(readOnly = true)
    public List<RecursoAcademicoDtos.RecursoResponse> porAsignacion(Long idAsignacion, Long idEstudiante, Authentication auth) {
        AsignacionDocente asignacion = asignaciones.findById(idAsignacion)
                .orElseThrow(() -> new NoSuchElementException("La asignación no existe"));

        boolean esAdmin = auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ADMIN"))
                || auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"));
        boolean esDocenteDueño = asignacionDocenteService.esDocenteDeLaAsignacion(asignacion, auth);
        if (!esAdmin && !esDocenteDueño) {
            if (idEstudiante == null) {
                throw new AccessDeniedException("Debe indicar el estudiante para consultar los recursos de esta materia");
            }
            if (!estudianteService.esPropio(idEstudiante, auth)) {
                throw new AccessDeniedException("No autorizado para consultar este estudiante");
            }
            Estudiante estudiante = estudiantes.findById(idEstudiante)
                    .orElseThrow(() -> new NoSuchElementException("El estudiante no existe"));
            boolean esSuMateria = estudiante.getParalelo() != null
                    && estudiante.getParalelo().getId().equals(asignacion.getParalelo().getId());
            if (!esSuMateria) {
                throw new AccessDeniedException("Esta materia no corresponde al paralelo del estudiante");
            }
        }

        return recursos.findByAsignacionIdOrderByCreadoEnDesc(idAsignacion).stream()
                .sorted(Comparator.comparing(RecursoAcademico::getSemana, Comparator.nullsFirst(Comparator.naturalOrder()))
                        .thenComparing(RecursoAcademico::getCreadoEn, Comparator.reverseOrder()))
                .map(this::toResponse).toList();
    }

    /** URL de descarga temporal de un sílabo/formato, con la misma regla de acceso que porAsignacion(). */
    @Transactional(readOnly = true)
    public String urlDescarga(Long idRecurso, Long idEstudiante, Authentication auth) {
        RecursoAcademico recurso = recursos.findById(idRecurso)
                .orElseThrow(() -> new NoSuchElementException("El recurso no existe"));
        if (recurso.getArchivoUrl() == null) {
            throw new NoSuchElementException("Este recurso no tiene un archivo (es un link de clase)");
        }
        // Reutiliza el mismo chequeo de acceso que el listado, sobre la asignación del recurso.
        porAsignacion(recurso.getAsignacion().getId(), idEstudiante, auth);
        return storage.urlDescargaTemporal(recurso.getArchivoUrl());
    }

    @Transactional
    public RecursoAcademicoDtos.RecursoResponse subirArchivo(Long idAsignacion, RecursoAcademico.TipoRecurso tipo,
            String nombre, String descripcion, Short semana, java.time.OffsetDateTime fechaLimite,
            MultipartFile archivo, Authentication auth) {
        if (tipo == RecursoAcademico.TipoRecurso.LINK_CLASE) {
            throw new IllegalArgumentException("LINK_CLASE no lleva archivo, use el endpoint de enlace");
        }
        AsignacionDocente asignacion = asignaciones.findById(idAsignacion)
                .orElseThrow(() -> new NoSuchElementException("La asignación no existe"));
        asignacionDocenteService.exigirDueñoDeAsignacion(asignacion, auth);

        // Todo recurso académico admite el catálogo seguro completo; el backend valida firma
        // binaria/contenido real, no solo la extensión declarada por el navegador.
        FileValidationService.Resultado r = validacion.validarMaterialClase(archivo, maxBytesRecurso);
        String clave = storage.generarClave("recursos/" + idAsignacion, archivo.getOriginalFilename());
        storage.subir(clave, r.contenido(), r.mimeType());

        Long idUsuario = usuarios.findByEmail(auth.getName()).orElseThrow().getId();
        RecursoAcademico rec = new RecursoAcademico();
        rec.setAsignacion(asignacion);
        rec.setTipo(tipo);
        rec.setNombre(nombre.trim());
        rec.setDescripcion(descripcion == null || descripcion.isBlank() ? null : descripcion.trim());
        rec.setSemana(semana);
        rec.setFechaLimite(fechaLimite);
        rec.setArchivoUrl(clave);
        rec.setArchivoNombreOriginal(archivo.getOriginalFilename());
        rec.setArchivoMimeType(r.mimeType());
        rec.setArchivoTamanoBytes((long) r.contenido().length);
        rec.setCreadoPor(idUsuario);
        try {
            rec = recursos.saveAndFlush(rec);
        } catch (RuntimeException e) {
            storage.eliminar(clave);
            throw e;
        }
        return toResponse(rec);
    }

    @Transactional
    public RecursoAcademicoDtos.RecursoResponse crearLink(RecursoAcademicoDtos.CrearLinkRequest req, Authentication auth) {
        AsignacionDocente asignacion = asignaciones.findById(req.idAsignacion())
                .orElseThrow(() -> new NoSuchElementException("La asignación no existe"));
        asignacionDocenteService.exigirDueñoDeAsignacion(asignacion, auth);

        String url = urlHttpValida(req.urlExterna());
        Long idUsuario = usuarios.findByEmail(auth.getName()).orElseThrow().getId();
        RecursoAcademico rec = new RecursoAcademico();
        rec.setAsignacion(asignacion);
        rec.setTipo(RecursoAcademico.TipoRecurso.LINK_CLASE);
        rec.setNombre(req.nombre().trim());
        rec.setDescripcion(req.descripcion() == null || req.descripcion().isBlank() ? null : req.descripcion().trim());
        rec.setSemana(req.semana());
        rec.setFechaLimite(req.fechaLimite());
        rec.setUrlExterna(url);
        rec.setCreadoPor(idUsuario);
        rec = recursos.save(rec);
        return toResponse(rec);
    }

    /** Solo metadatos (nombre/descripción/semana) — el docente dueño de la asignación o ADMIN. */
    @Transactional
    public RecursoAcademicoDtos.RecursoResponse editar(Long idRecurso, RecursoAcademicoDtos.EditarRecursoRequest req,
                                                         Authentication auth) {
        RecursoAcademico rec = recursos.findById(idRecurso)
                .orElseThrow(() -> new NoSuchElementException("El recurso no existe"));
        asignacionDocenteService.exigirDueñoDeAsignacion(rec.getAsignacion(), auth);
        rec.setNombre(req.nombre());
        rec.setDescripcion(req.descripcion());
        rec.setSemana(req.semana());
        rec.setFechaLimite(req.fechaLimite());
        rec = recursos.save(rec);
        return toResponse(rec);
    }

    /** Borra el recurso y, si tenía archivo, el objeto en el bucket — el docente dueño o ADMIN. */
    @Transactional
    public void eliminar(Long idRecurso, Authentication auth) {
        RecursoAcademico rec = recursos.findById(idRecurso)
                .orElseThrow(() -> new NoSuchElementException("El recurso no existe"));
        asignacionDocenteService.exigirDueñoDeAsignacion(rec.getAsignacion(), auth);
        if (rec.getArchivoUrl() != null) {
            storage.eliminar(rec.getArchivoUrl());
        }
        recursos.delete(rec);
    }

    private RecursoAcademicoDtos.RecursoResponse toResponse(RecursoAcademico r) {
        String autor = usuarios.findById(r.getCreadoPor()).map(Usuario::nombreCompleto).orElse("—");
        return new RecursoAcademicoDtos.RecursoResponse(
                r.getId(), r.getTipo().name(), r.getNombre(), r.getDescripcion(), r.getSemana(),
                r.getUrlExterna(), r.getArchivoNombreOriginal(), r.getArchivoMimeType(), r.getArchivoTamanoBytes(),
                r.getAsignacion().getMateria().getNombre(), r.getAsignacion().getParalelo().getNivel(),
                r.getAsignacion().getParalelo().etiqueta(), r.getAsignacion().getDocente().getUsuario().nombreCompleto(),
                autor, r.getCreadoEn(), r.getFechaLimite());
    }

    private String urlHttpValida(String valor) {
        try {
            URI uri = URI.create(valor.trim());
            boolean esquema = "http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme());
            if (!esquema || uri.getHost() == null || uri.getUserInfo() != null) {
                throw new IllegalArgumentException("Debe indicar una URL http(s) válida, sin credenciales incrustadas");
            }
            return uri.toASCIIString();
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Debe indicar una URL http(s) válida, sin credenciales incrustadas");
        }
    }
}
