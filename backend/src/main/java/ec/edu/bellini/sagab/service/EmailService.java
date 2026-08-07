package ec.edu.bellini.sagab.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Envío de correo por SMTP (spring.mail.*, ver application.yml — SAGAB_SMTP_HOST/USER/PASS).
 * Patrón defensivo de configuración opcional: si no hay credenciales SMTP
 * configuradas, la app arranca igual pero enviar() falla con un mensaje claro (400) en vez
 * de un 500 genérico.
 */
@Service
public class EmailService {

    private final JavaMailSender mailSender;
    private final String usuarioSmtp;
    private final String remitente;

    public EmailService(JavaMailSender mailSender,
                         @Value("${spring.mail.username:}") String usuarioSmtp,
                         @Value("${sagab.mail.remitente:${spring.mail.username:}}") String remitente) {
        this.mailSender = mailSender;
        this.usuarioSmtp = usuarioSmtp;
        this.remitente = remitente;
    }

    public boolean isConfigured() {
        return usuarioSmtp != null && !usuarioSmtp.isBlank();
    }

    public void enviar(String destinatario, String asunto, String cuerpo) {
        if (!isConfigured()) {
            throw new IllegalArgumentException("El envío de correo no está configurado (SAGAB_SMTP_USER/SAGAB_SMTP_PASS).");
        }
        SimpleMailMessage mensaje = new SimpleMailMessage();
        mensaje.setFrom(remitente);
        mensaje.setTo(destinatario);
        mensaje.setSubject(asunto);
        mensaje.setText(cuerpo);
        mailSender.send(mensaje);
    }
}
