package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.MensajeDtos;

import ec.edu.bellini.sagab.model.MensajeDestinatario;
import ec.edu.bellini.sagab.model.Usuario;
import ec.edu.bellini.sagab.repository.MensajeDestinatarioRepository;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class MensajeService {

    private final MensajeDestinatarioRepository destinatarios;
    private final UsuarioRepository usuarios;

    public MensajeService(MensajeDestinatarioRepository destinatarios, UsuarioRepository usuarios) {
        this.destinatarios = destinatarios;
        this.usuarios = usuarios;
    }

    @Transactional(readOnly = true)
    public List<MensajeDtos.MensajeResponse> mias(Authentication auth) {
        Long idUsuario = usuarios.findByEmail(auth.getName()).orElseThrow().getId();
        return destinatarios.bandejaDeEntrada(idUsuario).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public void marcarLeido(Long idMensaje, Authentication auth) {
        Long idUsuario = usuarios.findByEmail(auth.getName()).orElseThrow().getId();
        destinatarios.marcarLeido(idMensaje, idUsuario);
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
