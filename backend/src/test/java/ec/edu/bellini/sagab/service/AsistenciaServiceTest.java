package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.AsistenciaDtos;
import ec.edu.bellini.sagab.model.Asistencia;
import ec.edu.bellini.sagab.model.Estudiante;
import ec.edu.bellini.sagab.model.Paralelo;
import ec.edu.bellini.sagab.model.Usuario;
import ec.edu.bellini.sagab.repository.AsistenciaRepository;
import ec.edu.bellini.sagab.repository.EstudianteRepository;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AsistenciaServiceTest {

    @Test
    void rechazaFechaFuturaAntesDeConsultarOGuardarEstudiantes() {
        Fixture f = new Fixture();
        var req = solicitud(7, LocalDate.now().plusDays(1), 10L);

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> f.service.registrar(req, f.auth));

        assertTrue(error.getMessage().contains("fecha futura"));
        verifyNoInteractions(f.estudiantes, f.asistencias, f.usuarios);
    }

    @Test
    void rechazaMarcasDuplicadasAntesDeConsultarLaBase() {
        Fixture f = new Fixture();
        var marca = new AsistenciaDtos.MarcaRequest(10L, Asistencia.EstadoAsistencia.PRESENTE, null);
        var req = new AsistenciaDtos.RegistroDiarioRequest(7, LocalDate.now(), List.of(marca, marca));

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> f.service.registrar(req, f.auth));

        assertTrue(error.getMessage().contains("dos veces"));
        verifyNoInteractions(f.estudiantes, f.asistencias, f.usuarios);
    }

    @Test
    void rechazaEstudianteQueNoPerteneceAlParaleloSolicitado() {
        Fixture f = new Fixture();
        Estudiante estudiante = estudiante(10L, 8);
        when(f.estudiantes.findAllById(List.of(10L))).thenReturn(List.of(estudiante));

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> f.service.registrar(solicitud(7, LocalDate.now(), 10L), f.auth));

        assertTrue(error.getMessage().contains("no pertenece"));
        verify(f.asistencias, never()).saveAll(anyList());
        verifyNoInteractions(f.usuarios);
    }

    @Test
    void registraSoloAlEstudianteDelParaleloIndicado() {
        Fixture f = new Fixture();
        Estudiante estudiante = estudiante(10L, 7);
        Usuario usuario = new Usuario();
        usuario.setId(99L);
        when(f.estudiantes.findAllById(List.of(10L))).thenReturn(List.of(estudiante));
        when(f.usuarios.findByEmail("docente@example.com")).thenReturn(Optional.of(usuario));
        when(f.asistencias.findByIdParaleloAndFecha(7, LocalDate.now())).thenReturn(List.of());

        var resultado = f.service.registrar(solicitud(7, LocalDate.now(), 10L), f.auth);

        assertEquals(1, resultado.get("registrados"));
        verify(f.asistencias).saveAll(anyList());
    }

    @Test
    void dtoLimitaJustificacionATrescientosCaracteres() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var marca = new AsistenciaDtos.MarcaRequest(
                    10L, Asistencia.EstadoAsistencia.AUSENCIA_JUSTIFICADA, "x".repeat(301));
            var violaciones = factory.getValidator().validate(marca);

            assertEquals(1, violaciones.size());
            assertEquals("justificacion", violaciones.iterator().next().getPropertyPath().toString());
        }
    }

    private static AsistenciaDtos.RegistroDiarioRequest solicitud(Integer paralelo, LocalDate fecha, Long estudiante) {
        return new AsistenciaDtos.RegistroDiarioRequest(paralelo, fecha, List.of(
                new AsistenciaDtos.MarcaRequest(estudiante, Asistencia.EstadoAsistencia.PRESENTE, null)));
    }

    private static Estudiante estudiante(Long id, Integer idParalelo) {
        Paralelo paralelo = new Paralelo();
        ReflectionTestUtils.setField(paralelo, "id", idParalelo);
        Estudiante estudiante = new Estudiante();
        estudiante.setId(id);
        estudiante.setParalelo(paralelo);
        return estudiante;
    }

    private static class Fixture {
        final AsistenciaRepository asistencias = mock(AsistenciaRepository.class);
        final EstudianteRepository estudiantes = mock(EstudianteRepository.class);
        final UsuarioRepository usuarios = mock(UsuarioRepository.class);
        final EstudianteService estudianteService = mock(EstudianteService.class);
        final AsignacionDocenteService asignacionService = mock(AsignacionDocenteService.class);
        final Authentication auth = mock(Authentication.class);
        final AsistenciaService service = new AsistenciaService(
                asistencias, estudiantes, usuarios, estudianteService, asignacionService);

        Fixture() {
            when(auth.getName()).thenReturn("docente@example.com");
        }
    }
}
