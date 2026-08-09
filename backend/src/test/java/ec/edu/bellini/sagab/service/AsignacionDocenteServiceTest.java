package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.AsignacionDocenteDtos;
import ec.edu.bellini.sagab.model.AsignacionDocente;
import ec.edu.bellini.sagab.model.Docente;
import ec.edu.bellini.sagab.model.Materia;
import ec.edu.bellini.sagab.model.Paralelo;
import ec.edu.bellini.sagab.model.PeriodoAcademico;
import ec.edu.bellini.sagab.model.Usuario;
import ec.edu.bellini.sagab.repository.AsignacionDocenteRepository;
import ec.edu.bellini.sagab.repository.DocenteRepository;
import ec.edu.bellini.sagab.repository.MateriaRepository;
import ec.edu.bellini.sagab.repository.ParaleloRepository;
import ec.edu.bellini.sagab.repository.PeriodoAcademicoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AsignacionDocenteServiceTest {

    private AsignacionDocenteRepository asignaciones;
    private DocenteRepository docentes;
    private MateriaRepository materias;
    private ParaleloRepository paralelos;
    private PeriodoAcademicoRepository periodos;
    private AsignacionDocenteService service;

    @BeforeEach
    void setUp() {
        asignaciones = mock(AsignacionDocenteRepository.class);
        docentes = mock(DocenteRepository.class);
        materias = mock(MateriaRepository.class);
        paralelos = mock(ParaleloRepository.class);
        periodos = mock(PeriodoAcademicoRepository.class);
        service = new AsignacionDocenteService(asignaciones, docentes, materias, paralelos, periodos);
    }

    @Test
    void catalogosExponePeriodo2025_2026SeisParalelosMateriasYSoloDocentesActivos() {
        Docente activo = docente(41L, 141L, "Saida", "Casares", "saida@bellini.edu.ec",
                Usuario.EstadoUsuario.ACTIVO);
        Docente inactivo = docente(42L, 142L, "Docente", "Inactivo", "inactivo@bellini.edu.ec",
                Usuario.EstadoUsuario.INACTIVO);
        List<Materia> materiasCatalogo = List.of(
                materia(1, "CCNN", "Ciencias Naturales", "Ciencias"),
                materia(2, "HIS", "Historia", "Sociales"),
                materia(3, "MAT", "Matemáticas", "Ciencias Exactas"));
        List<Paralelo> paralelosDesordenados = List.of(
                paralelo(16, "3° BGU", "B", "2025-2026"),
                paralelo(11, "1° BGU", "A", "2025-2026"),
                paralelo(14, "2° BGU", "B", "2025-2026"),
                paralelo(13, "2° BGU", "A", "2025-2026"),
                paralelo(12, "1° BGU", "B", "2025-2026"),
                paralelo(15, "3° BGU", "A", "2025-2026"));
        PeriodoAcademico periodo = periodo(7, "Período académico", "2025-2026", true);

        when(docentes.findAllByOrderByUsuarioApellidosAscUsuarioNombresAsc())
                .thenReturn(List.of(activo, inactivo));
        when(materias.findAllByOrderByNombreAsc()).thenReturn(materiasCatalogo);
        when(paralelos.findAll()).thenReturn(paralelosDesordenados);
        when(periodos.findAllByOrderByFechaInicioDesc()).thenReturn(List.of(periodo));

        AsignacionDocenteDtos.CatalogosResponse resultado = service.catalogos();

        assertAll(
                () -> assertEquals(1, resultado.docentes().size()),
                () -> assertEquals("Saida Casares", resultado.docentes().get(0).nombre()),
                () -> assertEquals("saida@bellini.edu.ec", resultado.docentes().get(0).email()),
                () -> assertEquals(List.of("CCNN", "HIS", "MAT"),
                        resultado.materias().stream().map(AsignacionDocenteDtos.MateriaOpcion::codigo).toList()),
                () -> assertEquals(List.of(
                                "1° BGU|2025-2026|A", "1° BGU|2025-2026|B",
                                "2° BGU|2025-2026|A", "2° BGU|2025-2026|B",
                                "3° BGU|2025-2026|A", "3° BGU|2025-2026|B"),
                        resultado.paralelos().stream()
                                .map(p -> p.nivel() + "|" + p.anioLectivo() + "|" + p.seccion())
                                .toList()),
                () -> assertEquals("Período académico · 2025-2026", resultado.periodos().get(0).etiqueta()),
                () -> assertEquals("2025-2026", resultado.periodos().get(0).anioLectivo()),
                () -> assertTrue(resultado.periodos().get(0).activo()));
    }

    @Test
    void crearVinculaCadaMateriaConElDocenteParaleloYPeriodoSeleccionados() {
        Docente docente = docente(41L, 141L, "Saida", "Casares", "saida@bellini.edu.ec",
                Usuario.EstadoUsuario.ACTIVO);
        Materia historia = materia(2, "HIS", "Historia", "Sociales");
        Materia ingles = materia(5, "ING", "Inglés", "Idiomas");
        Paralelo paralelo = paralelo(13, "2° BGU", "A", "2025-2026");
        PeriodoAcademico periodo = periodo(7, "Período académico", "2025-2026", true);

        when(docentes.findById(41L)).thenReturn(Optional.of(docente));
        when(paralelos.findById(13)).thenReturn(Optional.of(paralelo));
        when(periodos.findById(7)).thenReturn(Optional.of(periodo));
        when(materias.findAllById(List.of(2, 5))).thenReturn(List.of(historia, ingles));
        AtomicLong secuencia = new AtomicLong(900L);
        when(asignaciones.save(any(AsignacionDocente.class))).thenAnswer(invocacion -> {
            AsignacionDocente guardada = invocacion.getArgument(0);
            ReflectionTestUtils.setField(guardada, "id", secuencia.incrementAndGet());
            return guardada;
        });

        List<AsignacionDocenteDtos.AsignacionResponse> resultado = service.crear(
                new AsignacionDocenteDtos.CrearAsignacionesRequest(41L, List.of(2, 5), 13, 7));

        ArgumentCaptor<AsignacionDocente> captor = ArgumentCaptor.forClass(AsignacionDocente.class);
        verify(asignaciones, times(2)).save(captor.capture());
        assertAll(
                () -> assertEquals(2, resultado.size()),
                () -> assertEquals(List.of("Historia", "Inglés"),
                        resultado.stream().map(AsignacionDocenteDtos.AsignacionResponse::materia).toList()),
                () -> assertEquals(List.of(901L, 902L),
                        resultado.stream().map(AsignacionDocenteDtos.AsignacionResponse::idAsignacion).toList()),
                () -> assertEquals("2° BGU A", resultado.get(0).paralelo()),
                () -> assertEquals("2025-2026", resultado.get(0).anioLectivo()),
                () -> assertEquals("Período académico · 2025-2026", resultado.get(0).periodo()),
                () -> assertEquals("Saida Casares", resultado.get(0).docente()),
                () -> captor.getAllValues().forEach(asignacion -> {
                    assertSame(docente, asignacion.getDocente());
                    assertSame(paralelo, asignacion.getParalelo());
                    assertSame(periodo, asignacion.getPeriodo());
                }));
    }

    @Test
    void crearRechazaAnioIncompatibleSinGuardarAsignaciones() {
        Docente docente = docente(41L, 141L, "Saida", "Casares", "saida@bellini.edu.ec",
                Usuario.EstadoUsuario.ACTIVO);
        Paralelo paralelo = paralelo(13, "2° BGU", "A", "2025-2026");
        PeriodoAcademico periodo = periodo(8, "Período académico", "2026-2027", true);
        when(docentes.findById(41L)).thenReturn(Optional.of(docente));
        when(paralelos.findById(13)).thenReturn(Optional.of(paralelo));
        when(periodos.findById(8)).thenReturn(Optional.of(periodo));

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.crear(new AsignacionDocenteDtos.CrearAsignacionesRequest(
                        41L, List.of(2), 13, 8)));

        assertEquals("El paralelo y el período deben pertenecer al mismo año lectivo", error.getMessage());
        verify(asignaciones, never()).save(any());
        verify(materias, never()).findAllById(any());
    }

    @Test
    void crearConVariasMateriasNoGuardaNingunaSiUnaYaEstaAsignada() {
        Docente docente = docente(41L, 141L, "Saida", "Casares", "saida@bellini.edu.ec",
                Usuario.EstadoUsuario.ACTIVO);
        Materia historia = materia(2, "HIS", "Historia", "Sociales");
        Materia ingles = materia(5, "ING", "Inglés", "Idiomas");
        Paralelo paralelo = paralelo(13, "2° BGU", "A", "2025-2026");
        PeriodoAcademico periodo = periodo(7, "Período académico", "2025-2026", true);
        when(docentes.findById(41L)).thenReturn(Optional.of(docente));
        when(paralelos.findById(13)).thenReturn(Optional.of(paralelo));
        when(periodos.findById(7)).thenReturn(Optional.of(periodo));
        when(materias.findAllById(List.of(2, 5))).thenReturn(List.of(historia, ingles));
        when(asignaciones.existsByMateriaIdAndParaleloIdAndPeriodoId(2, 13, 7)).thenReturn(false);
        when(asignaciones.existsByMateriaIdAndParaleloIdAndPeriodoId(5, 13, 7)).thenReturn(true);

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.crear(new AsignacionDocenteDtos.CrearAsignacionesRequest(
                        41L, List.of(2, 5), 13, 7)));

        assertEquals("Inglés ya tiene docente en ese paralelo y período", error.getMessage());
        verify(asignaciones, never()).save(any());
    }

    private Docente docente(Long idDocente, Long idUsuario, String nombres, String apellidos,
                            String email, Usuario.EstadoUsuario estado) {
        Usuario usuario = new Usuario();
        usuario.setId(idUsuario);
        usuario.setNombres(nombres);
        usuario.setApellidos(apellidos);
        usuario.setEmail(email);
        usuario.setEstado(estado);
        Docente docente = new Docente();
        docente.setId(idDocente);
        docente.setUsuario(usuario);
        return docente;
    }

    private Materia materia(Integer id, String codigo, String nombre, String area) {
        return instanciar(Materia.class, "id", id, "codigo", codigo, "nombre", nombre, "area", area);
    }

    private Paralelo paralelo(Integer id, String nivel, String seccion, String anioLectivo) {
        return instanciar(Paralelo.class, "id", id, "nivel", nivel, "seccion", seccion,
                "anioLectivo", anioLectivo);
    }

    private PeriodoAcademico periodo(Integer id, String nombre, String anioLectivo, boolean activo) {
        return instanciar(PeriodoAcademico.class,
                "id", id, "nombre", nombre, "anioLectivo", anioLectivo,
                "fechaInicio", LocalDate.of(2025, 9, 1),
                "fechaFin", LocalDate.of(2026, 7, 31), "activo", activo);
    }

    private <T> T instanciar(Class<T> tipo, Object... camposYValores) {
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
}
