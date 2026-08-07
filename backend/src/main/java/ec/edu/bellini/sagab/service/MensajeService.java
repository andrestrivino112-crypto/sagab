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

    public MensajeService(MensajeRepository mensajes, MensajeDestinatarioRepository destinatarios,
                           UsuarioRepository usuarios, EstudianteRepository estudiantes) {
        this.mensajes = mensajes;
        this.destinatarios = destinatarios;
        this.usuarios = usuarios;
        this.estudiantes = estudiantes;
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
        boolean esDocente = auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_DOCENTE"));
        boolean gruposDeEstudiantes = switch (req.grupo()) {
            case ESTUDIANTES, TODO_PARALELO, TODO_CURSO -> true;
            case TODOS_REPRESENTANTES, TODOS_DOCENTES, TODO_COLEGIO -> false;
        };
        if (esDocente && !gruposDeEstudiantes) {
            throw new IllegalArgumentException("Un docente solo puede enviar mensajes a estudiantes.");
        }

        List<Long> idsDestinatarios = switch (req.grupo()) {
            case ESTUDIANTES -> {
                if (req.idsEstudiantes() == null || req.idsEstudiantes().isEmpty()) {
                    throw new IllegalArgumentException("Debe indicar al menos un estudiante.");
                }
                yield estudiantes.idsUsuariosDestinatarios(req.idsEstudiantes());
            }
            case TODO_PARALELO -> {
                if (req.idParalelo() == null) throw new IllegalArgumentException("Debe indicar el paralelo.");
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
        return destinatarios.bandejaDeEntrada(idUsuario, PageRequest.of(0, MAX_MENSAJES)).stream()
                .map(this::toResponse)
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

    private MensajeDtos.MensajeResponse toResponse(MensajeDestinatario md) {
        String remitente = usuarios.findById(md.getMensaje().getIdRemitente())
                .map(Usuario::nombreCompleto)
                .orElse("—");
        return new MensajeDtos.MensajeResponse(
                md.getMensaje().getId(), md.getMensaje().getAsunto(), md.getMensaje().getCuerpo(),
                md.getMensaje().isEsCircular(), remitente, md.getMensaje().getEnviadoEn(),
                md.getLeidoEn() != null);
    }
}
