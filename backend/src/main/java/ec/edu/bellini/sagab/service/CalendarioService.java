package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.CalendarioDtos;
import ec.edu.bellini.sagab.model.*;
import ec.edu.bellini.sagab.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CalendarioService {
    private static final ZoneId ZONA = ZoneId.of("America/Guayaquil");
    private static final int MAX_DIAS_CONSULTA = 370;

    private final EventoCalendarioRepository eventos;
    private final EventoCalendarioAdjuntoRepository adjuntosEvento;
    private final TareaRepository tareas;
    private final TareaAdjuntoRepository adjuntosTarea;
    private final RecursoAcademicoRepository recursos;
    private final UsuarioRepository usuarios;
    private final EstudianteRepository estudiantes;
    private final RepresentanteRepository representantes;
    private final FechasEcuadorService fechasEcuador;
    private final StorageService storage;
    private final FileValidationService validacionArchivos;
    private final long maxBytesAdjunto;

    public CalendarioService(EventoCalendarioRepository eventos, EventoCalendarioAdjuntoRepository adjuntosEvento,
                             TareaRepository tareas,
                             TareaAdjuntoRepository adjuntosTarea, RecursoAcademicoRepository recursos,
                             UsuarioRepository usuarios, EstudianteRepository estudiantes,
                             RepresentanteRepository representantes, FechasEcuadorService fechasEcuador,
                             StorageService storage, FileValidationService validacionArchivos,
                             @Value("${sagab.uploads.max-mb-deberes}") long maxMbAdjunto) {
        this.eventos = eventos;
        this.adjuntosEvento = adjuntosEvento;
        this.tareas = tareas;
        this.adjuntosTarea = adjuntosTarea;
        this.recursos = recursos;
        this.usuarios = usuarios;
        this.estudiantes = estudiantes;
        this.representantes = representantes;
        this.fechasEcuador = fechasEcuador;
        this.storage = storage;
        this.validacionArchivos = validacionArchivos;
        this.maxBytesAdjunto = maxMbAdjunto * 1024 * 1024;
    }

    /** Agenda unificada: eventos institucionales, calendario oficial y vencimientos académicos. */
    @Transactional(readOnly = true)
    public List<CalendarioDtos.CalendarioItemResponse> listar(LocalDate desde, LocalDate hasta, Authentication auth) {
        validarRango(desde, hasta);
        OffsetDateTime inicio = desde.atStartOfDay(ZONA).toOffsetDateTime();
        OffsetDateTime fin = hasta.plusDays(1).atStartOfDay(ZONA).minusNanos(1).toOffsetDateTime();
        boolean admin = tieneRol(auth, "ADMIN");

        List<CalendarioDtos.CalendarioItemResponse> resultado = new ArrayList<>();
        List<EventoCalendario> eventosVisibles = admin ? eventos.enRangoAdmin(inicio, fin)
                : eventos.visiblesEnRango(inicio, fin, OffsetDateTime.now(ZONA),
                    List.of(EventoCalendario.Estado.PUBLICADO, EventoCalendario.Estado.CANCELADO),
                    EventoCalendario.Estado.PROGRAMADO);
        Map<Long, List<EventoCalendarioAdjunto>> archivosPorEvento = eventosVisibles.isEmpty() ? Map.of()
                : adjuntosEvento.findByEventoIdInOrderByCreadoEnDesc(
                        eventosVisibles.stream().map(EventoCalendario::getId).toList()).stream()
                    .collect(Collectors.groupingBy(a -> a.getEvento().getId()));
        eventosVisibles.stream()
                .map(e -> eventoResponse(e, archivosPorEvento.getOrDefault(e.getId(), List.of())))
                .forEach(resultado::add);

        fechasEcuador.entre(desde, hasta).stream().map(this::fechaSistemaResponse).forEach(resultado::add);

        List<Tarea> tareasVisibles = tareasVisibles(inicio, fin, auth);
        Map<Long, List<TareaAdjunto>> archivosPorTarea = tareasVisibles.isEmpty() ? Map.of()
                : adjuntosTarea.findByTareaIdIn(tareasVisibles.stream().map(Tarea::getId).toList()).stream()
                        .collect(Collectors.groupingBy(a -> a.getTarea().getId()));
        tareasVisibles.stream().map(t -> tareaResponse(t, archivosPorTarea.getOrDefault(t.getId(), List.of())))
                .forEach(resultado::add);

        recursosVisibles(inicio, fin, auth).stream().map(this::recursoResponse).forEach(resultado::add);
        resultado.sort(Comparator.comparing(CalendarioDtos.CalendarioItemResponse::inicio)
                .thenComparing(CalendarioDtos.CalendarioItemResponse::titulo));
        return resultado;
    }

    @Transactional
    public CalendarioDtos.CalendarioItemResponse crear(CalendarioDtos.GuardarEventoRequest req, Authentication auth) {
        EventoCalendario evento = new EventoCalendario();
        aplicar(evento, req);
        evento.setCreador(usuarioActual(auth));
        return eventoResponse(eventos.save(evento), List.of());
    }

    @Transactional
    public CalendarioDtos.CalendarioItemResponse editar(Long id, CalendarioDtos.GuardarEventoRequest req) {
        EventoCalendario evento = eventos.findById(id)
                .orElseThrow(() -> new NoSuchElementException("El evento no existe"));
        aplicar(evento, req);
        EventoCalendario guardado = eventos.save(evento);
        return eventoResponse(guardado, adjuntosEvento.findByEventoIdOrderByCreadoEnDesc(guardado.getId()));
    }

    @Transactional
    public CalendarioDtos.CalendarioItemResponse duplicar(Long id, Authentication auth) {
        EventoCalendario original = eventos.findById(id)
                .orElseThrow(() -> new NoSuchElementException("El evento no existe"));
        EventoCalendario copia = new EventoCalendario();
        copia.setTitulo("Copia de " + original.getTitulo());
        copia.setDescripcion(original.getDescripcion());
        copia.setInicio(original.getInicio());
        copia.setFin(original.getFin());
        copia.setLugar(original.getLugar());
        copia.setCategoria(original.getCategoria());
        copia.setColor(original.getColor());
        copia.setEstado(EventoCalendario.Estado.BORRADOR);
        copia.setAdjuntoNombre(original.getAdjuntoNombre());
        copia.setAdjuntoUrl(original.getAdjuntoUrl());
        copia.setCreador(usuarioActual(auth));
        return eventoResponse(eventos.save(copia), List.of());
    }

    @Transactional
    public void eliminar(Long id) {
        EventoCalendario evento = eventos.findById(id)
                .orElseThrow(() -> new NoSuchElementException("El evento no existe"));
        List<EventoCalendarioAdjunto> archivos = adjuntosEvento.findByEventoIdOrderByCreadoEnDesc(id);
        archivos.forEach(a -> storage.eliminar(a.getArchivoUrl()));
        adjuntosEvento.deleteAll(archivos);
        eventos.delete(evento);
    }

    @Transactional
    public CalendarioDtos.AdjuntoResponse subirAdjunto(Long idEvento, String nombre, MultipartFile archivo,
                                                        Authentication auth) {
        EventoCalendario evento = eventos.findById(idEvento)
                .orElseThrow(() -> new NoSuchElementException("El evento no existe"));
        if (adjuntosEvento.countByEventoId(idEvento) >= 10) {
            throw new IllegalArgumentException("Un evento admite como máximo 10 archivos adjuntos");
        }
        FileValidationService.Resultado resultado = validacionArchivos.validarMaterialClase(archivo, maxBytesAdjunto);
        String original = limpio(archivo.getOriginalFilename());
        if (original == null) original = "archivo";
        if (original.length() > 255) original = original.substring(0, 255);
        String etiqueta = limpio(nombre);
        if (etiqueta == null) etiqueta = original;
        if (etiqueta.length() > 150) {
            throw new IllegalArgumentException("El nombre del adjunto supera 150 caracteres");
        }

        String clave = storage.generarClave("calendario/" + idEvento, original);
        storage.subir(clave, resultado.contenido(), resultado.mimeType());

        EventoCalendarioAdjunto adjunto = new EventoCalendarioAdjunto();
        adjunto.setEvento(evento);
        adjunto.setNombre(etiqueta);
        adjunto.setArchivoUrl(clave);
        adjunto.setArchivoNombreOriginal(original);
        adjunto.setArchivoMimeType(resultado.mimeType());
        adjunto.setArchivoTamanoBytes((long) resultado.contenido().length);
        adjunto.setCreadoPor(usuarioActual(auth).getId());
        return adjuntoResponse(adjuntosEvento.save(adjunto));
    }

    @Transactional(readOnly = true)
    public String urlDescargaAdjunto(Long idAdjunto, Authentication auth) {
        EventoCalendarioAdjunto adjunto = adjuntosEvento.findById(idAdjunto)
                .orElseThrow(() -> new NoSuchElementException("El adjunto no existe"));
        exigirEventoVisible(adjunto.getEvento(), auth);
        return storage.urlDescargaTemporal(adjunto.getArchivoUrl());
    }

    @Transactional
    public void eliminarAdjunto(Long idAdjunto) {
        EventoCalendarioAdjunto adjunto = adjuntosEvento.findById(idAdjunto)
                .orElseThrow(() -> new NoSuchElementException("El adjunto no existe"));
        storage.eliminar(adjunto.getArchivoUrl());
        adjuntosEvento.delete(adjunto);
    }

    private void aplicar(EventoCalendario evento, CalendarioDtos.GuardarEventoRequest req) {
        if (req.fin().isBefore(req.inicio())) {
            throw new IllegalArgumentException("La fecha de fin no puede ser anterior al inicio");
        }
        if (req.estado() == EventoCalendario.Estado.PROGRAMADO && req.publicarEn() == null) {
            throw new IllegalArgumentException("Un evento programado requiere fecha de publicación");
        }
        String adjuntoNombre = limpio(req.adjuntoNombre());
        String adjuntoUrl = limpio(req.adjuntoUrl());
        if ((adjuntoNombre == null) != (adjuntoUrl == null)) {
            throw new IllegalArgumentException("El adjunto requiere nombre y URL");
        }
        evento.setTitulo(req.titulo().trim());
        evento.setDescripcion(limpio(req.descripcion()));
        evento.setInicio(req.inicio());
        evento.setFin(req.fin());
        evento.setLugar(limpio(req.lugar()));
        evento.setCategoria(req.categoria());
        evento.setColor(req.color().toUpperCase(Locale.ROOT));
        evento.setEstado(req.estado());
        evento.setPublicarEn(req.estado() == EventoCalendario.Estado.PROGRAMADO ? req.publicarEn() : null);
        evento.setAdjuntoNombre(adjuntoNombre);
        evento.setAdjuntoUrl(adjuntoUrl);
    }

    private List<Tarea> tareasVisibles(OffsetDateTime desde, OffsetDateTime hasta, Authentication auth) {
        if (tieneRol(auth, "ADMIN")) return tareas.calendarioAdmin(desde, hasta);
        if (tieneRol(auth, "DOCENTE")) return tareas.calendarioDocente(auth.getName(), desde, hasta);
        List<Integer> paralelos = paralelosFamilia(auth);
        return paralelos.isEmpty() ? List.of() : tareas.calendarioParalelos(paralelos, desde, hasta);
    }

    private List<RecursoAcademico> recursosVisibles(OffsetDateTime desde, OffsetDateTime hasta, Authentication auth) {
        if (tieneRol(auth, "ADMIN")) return recursos.calendarioAdmin(desde, hasta);
        if (tieneRol(auth, "DOCENTE")) return recursos.calendarioDocente(auth.getName(), desde, hasta);
        List<Integer> paralelos = paralelosFamilia(auth);
        return paralelos.isEmpty() ? List.of() : recursos.calendarioParalelos(paralelos, desde, hasta);
    }

    private List<Integer> paralelosFamilia(Authentication auth) {
        Usuario usuario = usuarioActual(auth);
        List<Estudiante> propios;
        if (tieneRol(auth, "ESTUDIANTE")) {
            propios = estudiantes.findByUsuarioId(usuario.getId()).map(List::of).orElse(List.of());
        } else if (tieneRol(auth, "REPRESENTANTE")) {
            propios = representantes.findByUsuarioId(usuario.getId())
                    .map(r -> estudiantes.findByRepresentanteIdAndActivoTrue(r.getId())).orElse(List.of());
        } else {
            return List.of();
        }
        return propios.stream().filter(Estudiante::isActivo).map(Estudiante::getParalelo)
                .filter(Objects::nonNull).map(Paralelo::getId).distinct().toList();
    }

    private CalendarioDtos.CalendarioItemResponse eventoResponse(EventoCalendario e,
                                                                  List<EventoCalendarioAdjunto> archivos) {
        List<CalendarioDtos.AdjuntoResponse> adjuntos = new ArrayList<>();
        if (e.getAdjuntoUrl() != null) {
            adjuntos.add(new CalendarioDtos.AdjuntoResponse(null, e.getAdjuntoNombre(), e.getAdjuntoUrl()));
        }
        archivos.stream().map(this::adjuntoResponse).forEach(adjuntos::add);
        return new CalendarioDtos.CalendarioItemResponse(
                "evento-" + e.getId(), e.getId(), "INSTITUCIONAL", e.getTitulo(), e.getDescripcion(),
                e.getInicio(), e.getFin(), e.getLugar(), e.getCategoria().name(), e.getColor(), e.getEstado().name(),
                e.getPublicarEn(), e.getCreador().nombreCompleto(), e.getCreadoEn(), null, null, null, null, adjuntos);
    }

    private CalendarioDtos.CalendarioItemResponse fechaSistemaResponse(FechasEcuadorService.FechaSistema f) {
        OffsetDateTime inicio = f.fecha().atStartOfDay(ZONA).toOffsetDateTime();
        return new CalendarioDtos.CalendarioItemResponse(
                "ecuador-" + f.fecha() + "-" + Math.abs(f.titulo().hashCode()), null, f.tipo(), f.titulo(), f.descripcion(),
                inicio, inicio.plusDays(1).minusNanos(1), "Ecuador", f.tipo(),
                "FERIADO".equals(f.tipo()) ? "#C62828" : "#8A5A00", "PUBLICADO", null, "Sistema", null,
                null, null, null, null, List.of());
    }

    private CalendarioDtos.CalendarioItemResponse tareaResponse(Tarea t, List<TareaAdjunto> archivos) {
        List<CalendarioDtos.AdjuntoResponse> adjuntos = archivos.stream()
                .map(a -> new CalendarioDtos.AdjuntoResponse(null, a.getNombre(),
                        "/api/tareas/adjuntos/" + a.getId() + "/descarga"))
                .toList();
        return new CalendarioDtos.CalendarioItemResponse(
                "tarea-" + t.getId(), null, "TAREA", t.getTitulo(), t.getDescripcion(),
                t.getFechaLimite(), t.getFechaLimite(), null, "ACADEMICO", "#7B1FA2", "PUBLICADO", null, "Docente", t.getCreadoEn(),
                t.getAsignacion().getMateria().getNombre(), t.getAsignacion().getDocente().getUsuario().nombreCompleto(),
                t.getId(), "/tareas?item=" + t.getId(), adjuntos);
    }

    private CalendarioDtos.CalendarioItemResponse recursoResponse(RecursoAcademico r) {
        List<CalendarioDtos.AdjuntoResponse> adjuntos = r.getArchivoNombreOriginal() == null ? List.of()
                : List.of(new CalendarioDtos.AdjuntoResponse(null, r.getArchivoNombreOriginal(),
                        "/api/recursos-academicos/" + r.getId() + "/descarga"));
        return new CalendarioDtos.CalendarioItemResponse(
                "recurso-" + r.getId(), null, "RECURSO", r.getNombre(), r.getDescripcion(),
                r.getFechaLimite(), r.getFechaLimite(), null, "ACADEMICO", "#00838F", "PUBLICADO", null, "Docente", r.getCreadoEn(),
                r.getAsignacion().getMateria().getNombre(), r.getAsignacion().getDocente().getUsuario().nombreCompleto(),
                r.getId(), "/grades?asignacion=" + r.getAsignacion().getId(), adjuntos);
    }

    private Usuario usuarioActual(Authentication auth) {
        return usuarios.findByEmail(auth.getName())
                .orElseThrow(() -> new NoSuchElementException("El usuario autenticado no existe"));
    }

    private CalendarioDtos.AdjuntoResponse adjuntoResponse(EventoCalendarioAdjunto adjunto) {
        return new CalendarioDtos.AdjuntoResponse(adjunto.getId(), adjunto.getNombre(),
                "/api/calendario/adjuntos/" + adjunto.getId() + "/descarga");
    }

    private void exigirEventoVisible(EventoCalendario evento, Authentication auth) {
        if (tieneRol(auth, "ADMIN")) return;
        boolean visible = evento.getEstado() == EventoCalendario.Estado.PUBLICADO
                || evento.getEstado() == EventoCalendario.Estado.CANCELADO
                || (evento.getEstado() == EventoCalendario.Estado.PROGRAMADO
                    && evento.getPublicarEn() != null
                    && !evento.getPublicarEn().isAfter(OffsetDateTime.now(ZONA)));
        if (!visible) throw new AccessDeniedException("No tiene permisos para consultar este archivo");
    }

    private boolean tieneRol(Authentication auth, String rol) {
        return auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_" + rol));
    }

    private void validarRango(LocalDate desde, LocalDate hasta) {
        if (hasta.isBefore(desde)) throw new IllegalArgumentException("La fecha final no puede ser anterior a la inicial");
        if (ChronoUnit.DAYS.between(desde, hasta) > MAX_DIAS_CONSULTA) {
            throw new IllegalArgumentException("El rango máximo del calendario es de 370 días");
        }
    }

    private String limpio(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }
}
