package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.MensajeDtos;

import ec.edu.bellini.sagab.model.Mensaje;
import ec.edu.bellini.sagab.model.MensajeDestinatario;
import ec.edu.bellini.sagab.model.Usuario;
import ec.edu.bellini.sagab.repository.EstudianteRepository;
import ec.edu.bellini.sagab.repository.MensajeDestinatarioRepository;
import ec.edu.bellini.sagab.repository.MensajeRepository;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

@Service
public class MensajeService {

    /** Tope de la bandeja de entrada: no hay paginación en el frontend, así que se acota en vez
     * de exponer un parámetro que hoy nadie usaría (ver INFORME_AUDITORIA_FUNCIONAL.md, BE-16). */
    private static final int MAX_MENSAJES = 100;

    private final MensajeRepository mensajes;
    private final MensajeDestinatarioRepository destinatarios;
    private final UsuarioRepository usuarios;
    private final EstudianteRepository estudiantes;
    private final AsignacionDocenteService asignacionDocenteService;

    public MensajeService(MensajeRepository mensajes, MensajeDestinatarioRepository destinatarios,
                           UsuarioRepository usuarios, EstudianteRepository estudiantes,
                           AsignacionDocenteService asignacionDocenteService) {
        this.mensajes = mensajes;
        this.destinatarios = destinatarios;
        this.usuarios = usuarios;
        this.estudiantes = estudiantes;
        this.asignacionDocenteService = asignacionDocenteService;
    }

    /**
     * Crea un mensaje interno y lo entrega a cada destinatario indicado (por id de usuario). El
     * remitente nunca se entrega a sí mismo aunque figure en la lista (p. ej. un envío masivo a
     * "todo el colegio" donde el propio remitente es parte del grupo) — de lo contrario vería su
     * propio mensaje como "no leído" en su bandeja.
     */
    @Transactional
    public MensajeDtos.MensajeResponse enviar(MensajeDtos.EnviarMensajeRequest req, Authentication auth) {
        Long idRemitente = usuarios.findByEmail(auth.getName()).orElseThrow().getId();

        Mensaje mensaje = new Mensaje();
        mensaje.setIdRemitente(idRemitente);
        mensaje.setAsunto(req.asunto());
        mensaje.setCuerpo(req.cuerpo());
        mensaje.setEsCircular(req.idsDestinatarios().size() > 1);
        mensaje = mensajes.save(mensaje);

        for (Long idDestinatario : req.idsDestinatarios()) {
            if (idDestinatario.equals(idRemitente)) continue;
            MensajeDestinatario md = new MensajeDestinatario();
            md.setMensaje(mensaje);
            md.setIdDestinatario(idDestinatario);
            destinatarios.save(md);
        }

        String remitente = usuarios.findById(idRemitente).map(Usuario::nombreCompleto).orElse("—");
        return new MensajeDtos.MensajeResponse(mensaje.getId(), mensaje.getAsunto(), mensaje.getCuerpo(),
                mensaje.isEsCircular(), remitente, mensaje.getEnviadoEn(), false);
    }

    /**
     * Envío masivo por grupo (curso, paralelo, representantes, docentes o todo el colegio) —
     * resuelve el grupo a ids de usuario concretos y reutiliza enviar(). Un DOCENTE únicamente
     * puede dirigirse a estudiantes (individualmente, por paralelo o por curso): el resto de
     * grupos son de uso exclusivo de ADMIN, aunque la petición llegue directo a la API sin pasar
     * por el formulario del frontend (que ya solo ofrece esas tres opciones a un DOCENTE).
     */
    @Transactional
    public MensajeDtos.MensajeResponse enviarBroadcast(MensajeDtos.EnviarBroadcastRequest req, Authentication auth) {
        boolean esDocente = auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_DOCENTE"))
                && !auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ADMIN"));
        boolean gruposPermitidosDocente = switch (req.grupo()) {
            case ESTUDIANTES, TODO_PARALELO -> true;
            case TODO_CURSO, TODOS_REPRESENTANTES, TODOS_DOCENTES, TODO_COLEGIO -> false;
        };
        if (esDocente && !gruposPermitidosDocente) {
            throw new IllegalArgumentException("Un docente solo puede enviar mensajes a estudiantes de sus paralelos asignados.");
        }

        List<Long> idsDestinatarios = switch (req.grupo()) {
            case ESTUDIANTES -> {
                if (req.idsEstudiantes() == null || req.idsEstudiantes().isEmpty()) {
                    throw new IllegalArgumentException("Debe indicar al menos un estudiante.");
                }
                if (esDocente) {
                    var seleccionados = estudiantes.findAllById(req.idsEstudiantes());
                    if (seleccionados.size() != req.idsEstudiantes().stream().distinct().count()) {
                        throw new IllegalArgumentException("Uno de los estudiantes no existe.");
                    }
                    seleccionados.stream().map(e -> e.getParalelo() != null ? e.getParalelo().getId() : null)
                            .distinct().forEach(idParalelo -> {
                                if (idParalelo == null) throw new IllegalArgumentException("Un estudiante no tiene paralelo asignado.");
                                asignacionDocenteService.exigirDocenteDelParalelo(idParalelo, auth);
                            });
                }
                yield estudiantes.idsUsuariosDestinatarios(req.idsEstudiantes());
            }
            case TODO_PARALELO -> {
                if (req.idParalelo() == null) throw new IllegalArgumentException("Debe indicar el paralelo.");
                if (esDocente) asignacionDocenteService.exigirDocenteDelParalelo(req.idParalelo(), auth);
                yield estudiantes.idsUsuariosDestinatariosPorParalelo(req.idParalelo());
            }
            case TODO_CURSO -> {
                if (req.curso() == null || req.curso().isBlank()) throw new IllegalArgumentException("Debe indicar el curso.");
                yield estudiantes.idsUsuariosDestinatariosPorCurso(req.curso());
            }
            case TODOS_REPRESENTANTES -> usuarios.findByRoles_CodigoInOrderByApellidosAscNombresAsc(List.of("REPRESENTANTE"))
                    .stream().map(Usuario::getId).toList();
            case TODOS_DOCENTES -> usuarios.findByRoles_CodigoInOrderByApellidosAscNombresAsc(List.of("DOCENTE"))
                    .stream().map(Usuario::getId).toList();
            case TODO_COLEGIO -> usuarios.findByEstado(Usuario.EstadoUsuario.ACTIVO).stream().map(Usuario::getId).toList();
        };
        if (idsDestinatarios.isEmpty()) {
            throw new IllegalArgumentException("No se encontró ningún destinatario para ese grupo.");
        }
        return enviar(new MensajeDtos.EnviarMensajeRequest(idsDestinatarios, req.asunto(), req.cuerpo()), auth);
    }

    /** Reutiliza el mismo modelo de mensajes/copias/lecturas, limitando los destinatarios a docentes activos. */
    @Transactional
    public MensajeDtos.MensajeResponse enviarInstitucional(MensajeDtos.EnviarInstitucionalRequest req, Authentication auth) {
        List<Usuario> docentesActivos = usuarios.findByRoles_CodigoInOrderByApellidosAscNombresAsc(List.of("DOCENTE"))
                .stream().filter(u -> u.getEstado() == Usuario.EstadoUsuario.ACTIVO).toList();
        List<Long> ids;
        if (req.idDocenteUsuario() == null) {
            ids = docentesActivos.stream().map(Usuario::getId).toList();
        } else {
            boolean esDocente = docentesActivos.stream().anyMatch(u -> u.getId().equals(req.idDocenteUsuario()));
            if (!esDocente) throw new IllegalArgumentException("El destinatario no es un docente activo");
            ids = List.of(req.idDocenteUsuario());
        }
        if (ids.isEmpty()) throw new IllegalArgumentException("No hay docentes activos registrados");
        return enviar(new MensajeDtos.EnviarMensajeRequest(ids, req.asunto(), req.cuerpo()), auth);
    }

    /** Mensajes enviados por el usuario actual, con el conteo de lectura de cada uno. */
    @Transactional(readOnly = true)
    public List<MensajeDtos.MensajeEnviadoResponse> enviados(Authentication auth) {
        Long idUsuario = usuarios.findByEmail(auth.getName()).orElseThrow().getId();
        List<Mensaje> propios = mensajes.findByIdRemitenteOrderByEnviadoEnDesc(idUsuario, PageRequest.of(0, MAX_MENSAJES));
        List<Long> ids = propios.stream().map(Mensaje::getId).toList();
        Map<Long, MensajeDestinatarioRepository.ConteoLecturaProjection> conteos = ids.isEmpty()
                ? Map.of()
                : destinatarios.conteoLecturaPorMensaje(ids).stream()
                        .collect(Collectors.toMap(MensajeDestinatarioRepository.ConteoLecturaProjection::getIdMensaje, c -> c));

        return propios.stream()
                .map(m -> {
                    var conteo = conteos.get(m.getId());
                    return new MensajeDtos.MensajeEnviadoResponse(m.getId(), m.getAsunto(), m.getCuerpo(),
                            m.isEsCircular(), m.getEnviadoEn(),
                            conteo != null ? conteo.getTotalDestinatarios() : 0,
                            conteo != null ? conteo.getLeidos() : 0);
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MensajeDtos.MensajeResponse> mias(Authentication auth) {
        Long idUsuario = usuarios.findByEmail(auth.getName()).orElseThrow().getId();
        boolean esDocente = auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_DOCENTE"));
        List<MensajeDestinatario> bandeja = esDocente
                ? destinatarios.bandejaDocenteDesdeAdmin(idUsuario, PageRequest.of(0, MAX_MENSAJES))
                : destinatarios.bandejaDeEntrada(idUsuario, PageRequest.of(0, MAX_MENSAJES));
        Map<Long, String> remitentes = usuarios.findAllById(bandeja.stream()
                        .map(md -> md.getMensaje().getIdRemitente()).distinct().toList()).stream()
                .collect(Collectors.toMap(Usuario::getId, Usuario::nombreCompleto));
        return bandeja.stream()
                .map(md -> toResponse(md, remitentes))
                .toList();
    }

    @Transactional
    public void marcarLeido(Long idMensaje, Authentication auth) {
        Long idUsuario = usuarios.findByEmail(auth.getName()).orElseThrow().getId();
        int actualizadas = destinatarios.marcarLeido(idMensaje, idUsuario);
        if (actualizadas == 0) {
            throw new NoSuchElementException("El mensaje no existe, no le pertenece, o ya estaba leído");
        }
    }

    private MensajeDtos.MensajeResponse toResponse(MensajeDestinatario md, Map<Long, String> remitentes) {
        String remitente = remitentes.getOrDefault(md.getMensaje().getIdRemitente(), "—");
        return new MensajeDtos.MensajeResponse(
                md.getMensaje().getId(), md.getMensaje().getAsunto(), md.getMensaje().getCuerpo(),
                md.getMensaje().isEsCircular(), remitente, md.getMensaje().getEnviadoEn(),
                md.getLeidoEn() != null);
    }
}
