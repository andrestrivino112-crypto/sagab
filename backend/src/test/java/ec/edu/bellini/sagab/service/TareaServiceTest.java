package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.TareaDtos;
import ec.edu.bellini.sagab.model.AsignacionDocente;
import ec.edu.bellini.sagab.model.Materia;
import ec.edu.bellini.sagab.model.Paralelo;
import ec.edu.bellini.sagab.model.Tarea;
import ec.edu.bellini.sagab.model.Usuario;
import ec.edu.bellini.sagab.repository.AsignacionDocenteRepository;
import ec.edu.bellini.sagab.repository.EntregaTareaRepository;
import ec.edu.bellini.sagab.repository.EstudianteRepository;
import ec.edu.bellini.sagab.repository.TareaAdjuntoRepository;
import ec.edu.bellini.sagab.repository.TareaRepository;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class TareaServiceTest {

    @Test
    void crearRechazaFechaNoFuturaYPuntajesIncompatiblesConLaColumna() {
        Fixture f = new Fixture();

        assertAll(
                () -> assertThrows(IllegalArgumentException.class,
                        () -> f.service.crear(crear(OffsetDateTime.now().minusMinutes(1), new BigDecimal("10.00")), f.auth)),
                () -> assertThrows(IllegalArgumentException.class,
                        () -> f.service.crear(crear(OffsetDateTime.now().plusDays(1), null), f.auth)),
                () -> assertThrows(IllegalArgumentException.class,
                        () -> f.service.crear(crear(OffsetDateTime.now().plusDays(1), new BigDecimal("1000.00")), f.auth)),
                () -> assertThrows(IllegalArgumentException.class,
                        () -> f.service.crear(crear(OffsetDateTime.now().plusDays(1), new BigDecimal("1.001")), f.auth)));

        verifyNoInteractions(f.asignaciones, f.tareas, f.usuarios, f.estudiantes, f.entregas);
    }

    @Test
    void editarTambienRechazaFechaVencidaAntesDeBuscarLaTarea() {
        Fixture f = new Fixture();
        var req = new TareaDtos.EditarTareaRequest(
                "Título", null, OffsetDateTime.now().minusSeconds(1), (short) 1, new BigDecimal("10.00"));

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> f.service.editar(3L, req, f.auth));

        assertTrue(error.getMessage().contains("futuro"));
        verifyNoInteractions(f.tareas);
    }

    @Test
    void crearConDatosValidosConservaPuntajeYGeneraLaRespuesta() {
        Fixture f = new Fixture();
        AsignacionDocente asignacion = asignacion(5L, 7, "Matemáticas");
        Usuario usuario = new Usuario();
        usuario.setId(9L);
        when(f.asignaciones.findById(5L)).thenReturn(Optional.of(asignacion));
        when(f.usuarios.findByEmail("docente@example.com")).thenReturn(Optional.of(usuario));
        when(f.tareas.save(any(Tarea.class))).thenAnswer(invocacion -> {
            Tarea tarea = invocacion.getArgument(0);
            tarea.setId(20L);
            return tarea;
        });
        when(f.estudiantes.findByParaleloIdAndActivoTrueOrderByApellidosAscNombresAsc(7)).thenReturn(List.of());

        var resultado = f.service.crear(
                crear(OffsetDateTime.now().plusDays(2), new BigDecimal("12.50")), f.auth);

        assertEquals(20L, resultado.idTarea());
        assertEquals(new BigDecimal("12.50"), resultado.puntaje());
        assertEquals("Matemáticas", resultado.materia());
    }

    private static TareaDtos.CrearTareaRequest crear(OffsetDateTime limite, BigDecimal puntaje) {
        return new TareaDtos.CrearTareaRequest(5L, "Título", "Descripción", limite, (short) 1, puntaje);
    }

    private static AsignacionDocente asignacion(Long id, Integer idParalelo, String materiaNombre) {
        Paralelo paralelo = new Paralelo();
        ReflectionTestUtils.setField(paralelo, "id", idParalelo);
        ReflectionTestUtils.setField(paralelo, "nivel", "1° BGU");
        ReflectionTestUtils.setField(paralelo, "seccion", "A");
        Materia materia = new Materia();
        ReflectionTestUtils.setField(materia, "nombre", materiaNombre);
        AsignacionDocente asignacion = new AsignacionDocente();
        asignacion.setId(id);
        asignacion.setParalelo(paralelo);
        asignacion.setMateria(materia);
        return asignacion;
    }

    private static class Fixture {
        final TareaRepository tareas = mock(TareaRepository.class);
        final EntregaTareaRepository entregas = mock(EntregaTareaRepository.class);
        final TareaAdjuntoRepository adjuntos = mock(TareaAdjuntoRepository.class);
        final AsignacionDocenteRepository asignaciones = mock(AsignacionDocenteRepository.class);
        final EstudianteRepository estudiantes = mock(EstudianteRepository.class);
        final UsuarioRepository usuarios = mock(UsuarioRepository.class);
        final EstudianteService estudianteService = mock(EstudianteService.class);
        final AsignacionDocenteService asignacionService = mock(AsignacionDocenteService.class);
        final StorageService storage = mock(StorageService.class);
        final FileValidationService validacion = mock(FileValidationService.class);
        final Authentication auth = mock(Authentication.class);
        final TareaService service = new TareaService(tareas, entregas, adjuntos, asignaciones,
                estudiantes, usuarios, estudianteService, asignacionService, storage, validacion, 20);

        Fixture() {
            when(auth.getName()).thenReturn("docente@example.com");
        }
    }
}
