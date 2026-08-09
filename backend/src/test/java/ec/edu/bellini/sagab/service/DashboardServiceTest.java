package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.model.Pago;
import ec.edu.bellini.sagab.model.PeriodoAcademico;
import ec.edu.bellini.sagab.model.Usuario;
import ec.edu.bellini.sagab.repository.AsistenciaRepository;
import ec.edu.bellini.sagab.repository.CalificacionRepository;
import ec.edu.bellini.sagab.repository.EstudianteRepository;
import ec.edu.bellini.sagab.repository.EventoCalendarioRepository;
import ec.edu.bellini.sagab.repository.MensajeDestinatarioRepository;
import ec.edu.bellini.sagab.repository.ObligacionPagoRepository;
import ec.edu.bellini.sagab.repository.PagoRepository;
import ec.edu.bellini.sagab.repository.PeriodoAcademicoRepository;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DashboardServiceTest {

    @Test
    void convierteTimestampsNativosDeInstantAOffsetDateTime() {
        var calificaciones = mock(CalificacionRepository.class);
        var asistencias = mock(AsistenciaRepository.class);
        var obligaciones = mock(ObligacionPagoRepository.class);
        var destinatarios = mock(MensajeDestinatarioRepository.class);
        var usuarios = mock(UsuarioRepository.class);
        var estudiantes = mock(EstudianteRepository.class);
        var periodos = mock(PeriodoAcademicoRepository.class);
        var pagos = mock(PagoRepository.class);
        var eventos = mock(EventoCalendarioRepository.class);
        Usuario usuario = mock(Usuario.class);
        when(usuario.getId()).thenReturn(7L);
        when(usuarios.findByEmail("admin@bellini.edu.ec")).thenReturn(Optional.of(usuario));

        PeriodoAcademico periodo = mock(PeriodoAcademico.class);
        when(periodo.getAnioLectivo()).thenReturn("2026-2027");
        when(periodos.findFirstByActivoTrueOrderByFechaInicioDesc()).thenReturn(Optional.of(periodo));

        Instant creadaEn = Instant.parse("2026-08-08T20:00:00Z");
        var matricula = mock(EstudianteRepository.MatriculaRecienteProjection.class);
        when(matricula.getIdEstudiante()).thenReturn(1L);
        when(matricula.getCodigo()).thenReturn("EST-0001");
        when(matricula.getNombreCompleto()).thenReturn("APELLIDO NOMBRE");
        when(matricula.getCurso()).thenReturn("8vo EGB");
        when(matricula.getParalelo()).thenReturn("A");
        when(matricula.getAnioLectivo()).thenReturn("2026-2027");
        when(matricula.getCreadoEn()).thenReturn(creadaEn);
        when(estudiantes.matriculasRecientesDelAnio(eq("2026-2027"), any(Pageable.class)))
                .thenReturn(List.of(matricula));
        Instant enviadoEn = Instant.parse("2026-08-08T21:00:00Z");
        var mensaje = mock(MensajeDestinatarioRepository.MensajeRecienteProjection.class);
        when(mensaje.getIdMensaje()).thenReturn(2L);
        when(mensaje.getAsunto()).thenReturn("Aviso");
        when(mensaje.getRemitente()).thenReturn("SECRETARÍA");
        when(mensaje.getEnviadoEn()).thenReturn(enviadoEn);
        when(mensaje.getLeido()).thenReturn(false);
        when(destinatarios.mensajesRecientes(eq(7L), any(Pageable.class))).thenReturn(List.of(mensaje));
        when(eventos.proximosPublicados(any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(List.of());
        when(pagos.countByEstadoRevision(Pago.EstadoRevision.EN_REVISION)).thenReturn(0L);

        var service = new DashboardService(calificaciones, asistencias, obligaciones, destinatarios,
                usuarios, estudiantes, periodos, pagos, eventos);
        var auth = new UsernamePasswordAuthenticationToken("admin@bellini.edu.ec", null, List.of());

        var resultado = service.administrativo(auth);

        assertEquals(creadaEn.atOffset(ZoneOffset.UTC), resultado.matriculasRecientes().get(0).creadoEn());
        assertEquals(enviadoEn.atOffset(ZoneOffset.UTC), resultado.mensajesRecientes().get(0).enviadoEn());
    }
}
