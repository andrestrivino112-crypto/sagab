package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.MatriculaDtos;
import ec.edu.bellini.sagab.repository.EstudianteRepository;
import ec.edu.bellini.sagab.repository.ParaleloRepository;
import ec.edu.bellini.sagab.repository.RepresentanteRepository;
import ec.edu.bellini.sagab.repository.RolRepository;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class MatriculaServiceTest {

    @Test
    void rechazaDocumentosFaltantesDuplicadosODesconocidosAntesDeCrearDatos() {
        var estudiantes = mock(EstudianteRepository.class);
        var representantes = mock(RepresentanteRepository.class);
        var usuarios = mock(UsuarioRepository.class);
        var roles = mock(RolRepository.class);
        var paralelos = mock(ParaleloRepository.class);
        var encoder = mock(PasswordEncoder.class);
        var service = new MatriculaService(
                estudiantes, representantes, usuarios, roles, paralelos, encoder);

        assertAll(
                () -> assertThrows(IllegalArgumentException.class,
                        () -> service.crear(solicitud(List.of("cedula_est", "partida", "foto")))),
                () -> assertThrows(IllegalArgumentException.class,
                        () -> service.crear(solicitud(List.of("cedula_est", "partida", "foto", "foto")))),
                () -> assertThrows(IllegalArgumentException.class,
                        () -> service.crear(solicitud(List.of("cedula_est", "partida", "foto", "otro")))));

        verifyNoInteractions(estudiantes, representantes, usuarios, roles, paralelos, encoder);
    }

    private MatriculaDtos.MatriculaRequest solicitud(List<String> documentos) {
        return new MatriculaDtos.MatriculaRequest(
                "Ana María", "Pérez López", "1710034065", LocalDate.of(2010, 5, 12), "F",
                "1° BGU", "A", "2026-2027", null, "Calle Principal 123", "0991234567",
                "O+", null, "Carlos", "Pérez", "1718013723", "Padre",
                "carlos@example.com", "0987654321", "María 0991112233", documentos);
    }
}
