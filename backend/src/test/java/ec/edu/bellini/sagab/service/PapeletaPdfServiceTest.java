package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.model.*;
import ec.edu.bellini.sagab.repository.AsignacionDocenteRepository;
import ec.edu.bellini.sagab.repository.AsistenciaRepository;
import ec.edu.bellini.sagab.repository.CalificacionRepository;
import ec.edu.bellini.sagab.repository.EstudianteRepository;
import ec.edu.bellini.sagab.repository.PeriodoAcademicoRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Prueba de humo del render real de OpenPDF: como no hay entorno para abrir el PDF visualmente,
 * esto al menos confirma que generar() no lanza en tiempo de ejecución (tablas con el número de
 * columnas correcto, fuentes válidas, documento con contenido) y que el resultado es un PDF real.
 * Paralelo/PeriodoAcademico/Materia/AsignacionDocente son entidades de solo lectura en la app
 * (solo @Getter, sin setters) — se pueblan por reflexión (ReflectionTestUtils) en vez de mockearlas,
 * porque el mock maker inline de Mockito para clases concretas no soporta todavía el JDK de este
 * entorno (Java 26); los repositorios sí se mockean normalmente porque son interfaces.
 */
class PapeletaPdfServiceTest {

    private static <T> T instanciar(Class<T> tipo, Object... camposYValores) {
        try {
            T instancia = tipo.getDeclaredConstructor().newInstance();
            for (int i = 0; i < camposYValores.length; i += 2) {
                ReflectionTestUtils.setField(instancia, (String) camposYValores[i], camposYValores[i + 1]);
            }
            return instancia;
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    void generaUnPdfValidoConDatosDeEjemplo() {
        EstudianteRepository estudiantes = mock(EstudianteRepository.class);
        CalificacionRepository calificaciones = mock(CalificacionRepository.class);
        AsignacionDocenteRepository asignaciones = mock(AsignacionDocenteRepository.class);
        AsistenciaRepository asistencias = mock(AsistenciaRepository.class);
        PeriodoAcademicoRepository periodos = mock(PeriodoAcademicoRepository.class);

        Paralelo paralelo = instanciar(Paralelo.class, "nivel", "8vo EGB", "seccion", "A");

        Usuario usuarioRepresentante = new Usuario();
        usuarioRepresentante.setNombres("María");
        usuarioRepresentante.setApellidos("Pérez");
        Representante representante = new Representante();
        representante.setUsuario(usuarioRepresentante);

        Estudiante estudiante = new Estudiante();
        estudiante.setId(10L);
        estudiante.setCodigo("EST-0010");
        estudiante.setNombres("Juan");
        estudiante.setApellidos("Gómez");
        estudiante.setParalelo(paralelo);
        estudiante.setRepresentante(representante);
        when(estudiantes.findById(10L)).thenReturn(Optional.of(estudiante));

        PeriodoAcademico periodo = instanciar(PeriodoAcademico.class,
                "id", 1, "nombre", "Primer Quimestre", "anioLectivo", "2025-2026",
                "fechaInicio", LocalDate.of(2025, 9, 1), "fechaFin", LocalDate.of(2026, 1, 31), "activo", true);
        when(periodos.findById(1)).thenReturn(Optional.of(periodo));

        Materia materia = instanciar(Materia.class, "nombre", "Matemáticas");
        AsignacionDocente asignacion = instanciar(AsignacionDocente.class,
                "id", 100L, "materia", materia, "paralelo", paralelo, "periodo", periodo);
        when(asignaciones.findAllById(List.of(100L))).thenReturn(List.of(asignacion));

        Calificacion nota = new Calificacion();
        nota.setId(1000L);
        nota.setEstudiante(estudiante);
        nota.setIdAsignacion(100L);
        nota.setParcial((short) 1);
        nota.setNotaTarea(new BigDecimal("9.00"));
        nota.setNotaClase(new BigDecimal("8.50"));
        nota.setNotaExamen(new BigDecimal("8.00"));
        nota.setPromedio(new BigDecimal("8.30"));
        nota.setObservacion("Buen desempeño");
        when(calificaciones.findByEstudianteIdOrderByParcialAsc(10L)).thenReturn(List.of(nota));

        Asistencia presente = new Asistencia();
        presente.setEstudiante(estudiante);
        presente.setEstado(Asistencia.EstadoAsistencia.PRESENTE);
        presente.setFecha(LocalDate.of(2025, 9, 10));
        Asistencia falta = new Asistencia();
        falta.setEstudiante(estudiante);
        falta.setEstado(Asistencia.EstadoAsistencia.AUSENCIA_JUSTIFICADA);
        falta.setFecha(LocalDate.of(2025, 9, 11));
        when(asistencias.findByEstudianteIdAndFechaBetweenOrderByFechaDesc(10L, periodo.getFechaInicio(), periodo.getFechaFin()))
                .thenReturn(List.of(presente, falta));

        PapeletaPdfService service = new PapeletaPdfService(estudiantes, calificaciones, asignaciones, asistencias, periodos);

        byte[] pdf = service.generar(10L, 1);

        assertThat(pdf).isNotEmpty();
        assertThat(new String(pdf, 0, 5, java.nio.charset.StandardCharsets.US_ASCII)).isEqualTo("%PDF-");
    }

    @Test
    void generaUnPdfValidoSinCalificacionesNiAsistencia() {
        EstudianteRepository estudiantes = mock(EstudianteRepository.class);
        CalificacionRepository calificaciones = mock(CalificacionRepository.class);
        AsignacionDocenteRepository asignaciones = mock(AsignacionDocenteRepository.class);
        AsistenciaRepository asistencias = mock(AsistenciaRepository.class);
        PeriodoAcademicoRepository periodos = mock(PeriodoAcademicoRepository.class);

        Estudiante estudiante = new Estudiante();
        estudiante.setId(20L);
        estudiante.setCodigo("EST-0020");
        estudiante.setNombres("Ana");
        estudiante.setApellidos("Ruiz");
        when(estudiantes.findById(20L)).thenReturn(Optional.of(estudiante));

        PeriodoAcademico periodo = instanciar(PeriodoAcademico.class,
                "id", 2, "nombre", "Segundo Quimestre", "anioLectivo", "2025-2026",
                "fechaInicio", LocalDate.of(2026, 2, 1), "fechaFin", LocalDate.of(2026, 6, 30), "activo", true);
        when(periodos.findFirstByActivoTrueOrderByFechaInicioDesc()).thenReturn(Optional.of(periodo));

        when(calificaciones.findByEstudianteIdOrderByParcialAsc(20L)).thenReturn(List.of());
        when(asignaciones.findAllById(List.of())).thenReturn(List.of());
        when(asistencias.findByEstudianteIdAndFechaBetweenOrderByFechaDesc(20L, periodo.getFechaInicio(), periodo.getFechaFin()))
                .thenReturn(List.of());

        PapeletaPdfService service = new PapeletaPdfService(estudiantes, calificaciones, asignaciones, asistencias, periodos);

        byte[] pdf = service.generar(20L, null);

        assertThat(pdf).isNotEmpty();
        assertThat(new String(pdf, 0, 5, java.nio.charset.StandardCharsets.US_ASCII)).isEqualTo("%PDF-");
    }
}
