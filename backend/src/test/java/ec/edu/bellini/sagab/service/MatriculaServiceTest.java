package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.MatriculaDtos;
import ec.edu.bellini.sagab.model.Estudiante;
import ec.edu.bellini.sagab.model.Paralelo;
import ec.edu.bellini.sagab.model.Representante;
import ec.edu.bellini.sagab.model.Rol;
import ec.edu.bellini.sagab.model.Usuario;
import ec.edu.bellini.sagab.repository.EstudianteRepository;
import ec.edu.bellini.sagab.repository.EntregaTareaRepository;
import ec.edu.bellini.sagab.repository.ParaleloRepository;
import ec.edu.bellini.sagab.repository.RepresentanteRepository;
import ec.edu.bellini.sagab.repository.RolRepository;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class MatriculaServiceTest {

    @Test
    void creaEstudianteYCuentaVinculadosAlParaleloSeleccionadoDe2025_2026() {
        var estudiantes = mock(EstudianteRepository.class);
        var representantes = mock(RepresentanteRepository.class);
        var usuarios = mock(UsuarioRepository.class);
        var roles = mock(RolRepository.class);
        var paralelos = mock(ParaleloRepository.class);
        var entregas = mock(EntregaTareaRepository.class);
        var encoder = mock(PasswordEncoder.class);
        var service = new MatriculaService(
                estudiantes, representantes, usuarios, roles, paralelos, entregas, encoder);

        Paralelo paralelo = new Paralelo();
        ReflectionTestUtils.setField(paralelo, "id", 13);
        ReflectionTestUtils.setField(paralelo, "nivel", "2° BGU");
        ReflectionTestUtils.setField(paralelo, "seccion", "A");
        ReflectionTestUtils.setField(paralelo, "anioLectivo", "2025-2026");
        Rol rolRepresentante = rol((short) 3, "REPRESENTANTE");
        Rol rolEstudiante = rol((short) 6, "ESTUDIANTE");

        when(paralelos.findByNivelAndSeccionAndAnioLectivo("2° BGU", "A", "2025-2026"))
                .thenReturn(Optional.of(paralelo));
        when(roles.findByCodigo("REPRESENTANTE")).thenReturn(Optional.of(rolRepresentante));
        when(roles.findByCodigo("ESTUDIANTE")).thenReturn(Optional.of(rolEstudiante));
        when(usuarios.findByEmail("representante.e2e@example.com")).thenReturn(Optional.empty());
        when(usuarios.findByUsername(any())).thenReturn(Optional.empty());
        when(encoder.encode(any())).thenReturn("hash-seguro");
        when(usuarios.save(any(Usuario.class))).thenAnswer(invocacion -> {
            Usuario usuario = invocacion.getArgument(0);
            if (usuario.getId() == null) {
                usuario.setId(usuario.getRoles().contains(rolRepresentante) ? 101L : 102L);
            }
            return usuario;
        });
        when(usuarios.getReferenceById(101L)).thenAnswer(invocacion -> {
            Usuario referencia = new Usuario();
            referencia.setId(101L);
            return referencia;
        });
        when(representantes.findByUsuarioId(101L)).thenReturn(Optional.empty());
        when(representantes.save(any(Representante.class))).thenAnswer(invocacion -> {
            Representante representante = invocacion.getArgument(0);
            representante.setId(201L);
            return representante;
        });
        when(estudiantes.siguienteCodigoSecuencial()).thenReturn(7L);
        when(estudiantes.saveAndFlush(any(Estudiante.class))).thenAnswer(invocacion -> {
            Estudiante estudiante = invocacion.getArgument(0);
            estudiante.setId(301L);
            return estudiante;
        });

        MatriculaDtos.MatriculaResponse resultado = service.crear(solicitudCompleta());

        ArgumentCaptor<Estudiante> estudianteCaptor = ArgumentCaptor.forClass(Estudiante.class);
        verify(estudiantes).saveAndFlush(estudianteCaptor.capture());
        Estudiante guardado = estudianteCaptor.getValue();
        ArgumentCaptor<Usuario> usuarioCaptor = ArgumentCaptor.forClass(Usuario.class);
        verify(usuarios, times(2)).save(usuarioCaptor.capture());
        Usuario cuentaEstudiante = usuarioCaptor.getAllValues().stream()
                .filter(u -> u.getRoles().contains(rolEstudiante))
                .findFirst().orElseThrow();

        assertAll(
                () -> assertEquals(301L, resultado.idEstudiante()),
                () -> assertEquals("EST-0007", resultado.codigo()),
                () -> assertTrue(resultado.representanteNuevo()),
                () -> assertSame(paralelo, guardado.getParalelo()),
                () -> assertEquals("2° BGU A", guardado.getParalelo().etiqueta()),
                () -> assertEquals("2025-2026", guardado.getParalelo().getAnioLectivo()),
                () -> assertSame(cuentaEstudiante, guardado.getUsuario()),
                () -> assertEquals(201L, guardado.getRepresentante().getId()),
                () -> assertEquals("cedula_est,partida,foto,conducta", guardado.getDocumentosEntregados()),
                () -> assertTrue(guardado.isActivo()));
        verify(paralelos).findByNivelAndSeccionAndAnioLectivo("2° BGU", "A", "2025-2026");
        verify(entregas).crearPendientesParaTareasAbiertas(
                org.mockito.ArgumentMatchers.eq(301L), org.mockito.ArgumentMatchers.eq(13),
                any(java.time.OffsetDateTime.class));
    }

    @Test
    void rechazaDocumentosFaltantesDuplicadosODesconocidosAntesDeCrearDatos() {
        var estudiantes = mock(EstudianteRepository.class);
        var representantes = mock(RepresentanteRepository.class);
        var usuarios = mock(UsuarioRepository.class);
        var roles = mock(RolRepository.class);
        var paralelos = mock(ParaleloRepository.class);
        var entregas = mock(EntregaTareaRepository.class);
        var encoder = mock(PasswordEncoder.class);
        var service = new MatriculaService(
                estudiantes, representantes, usuarios, roles, paralelos, entregas, encoder);

        assertAll(
                () -> assertThrows(IllegalArgumentException.class,
                        () -> service.crear(solicitud(List.of("cedula_est", "partida", "foto")))),
                () -> assertThrows(IllegalArgumentException.class,
                        () -> service.crear(solicitud(List.of("cedula_est", "partida", "foto", "foto")))),
                () -> assertThrows(IllegalArgumentException.class,
                        () -> service.crear(solicitud(List.of("cedula_est", "partida", "foto", "otro")))));

        verifyNoInteractions(estudiantes, representantes, usuarios, roles, paralelos, entregas, encoder);
    }

    private MatriculaDtos.MatriculaRequest solicitud(List<String> documentos) {
        return new MatriculaDtos.MatriculaRequest(
                "Ana María", "Pérez López", "1710034065", LocalDate.of(2010, 5, 12), "F",
                "1° BGU", "A", "2026-2027", null, "Calle Principal 123", "0991234567",
                "O+", null, "Carlos", "Pérez", "1718013723", "Padre",
                "carlos@example.com", "0987654321", "María 0991112233", documentos);
    }

    private MatriculaDtos.MatriculaRequest solicitudCompleta() {
        return new MatriculaDtos.MatriculaRequest(
                "Ana María", "Pérez López", "1710034065", LocalDate.of(2010, 5, 12), "F",
                "2° BGU", "A", "2025-2026", null, "Calle Principal 123", "0991234567",
                "O+", null, "Carlos", "Pérez", "1718013723", "Padre",
                "representante.e2e@example.com", "0987654321", "María 0991112233",
                List.of("cedula_est", "partida", "foto", "conducta"));
    }

    private Rol rol(short id, String codigo) {
        Rol rol = new Rol();
        ReflectionTestUtils.setField(rol, "id", id);
        ReflectionTestUtils.setField(rol, "codigo", codigo);
        ReflectionTestUtils.setField(rol, "nombre", codigo);
        return rol;
    }
}
