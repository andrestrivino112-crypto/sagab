package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.RecursoAcademicoDtos;
import ec.edu.bellini.sagab.model.AsignacionDocente;
import ec.edu.bellini.sagab.model.Docente;
import ec.edu.bellini.sagab.model.Materia;
import ec.edu.bellini.sagab.model.Paralelo;
import ec.edu.bellini.sagab.model.RecursoAcademico;
import ec.edu.bellini.sagab.model.Usuario;
import ec.edu.bellini.sagab.repository.AsignacionDocenteRepository;
import ec.edu.bellini.sagab.repository.EstudianteRepository;
import ec.edu.bellini.sagab.repository.RecursoAcademicoRepository;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.multipart.MultipartFile;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class RecursoAcademicoServiceTest {

    @Test
    void linkSinTipoMantieneCompatibilidadYUsaLinkClase() {
        Fixture f = new Fixture();

        var respuesta = f.service.crearLink(solicitud(null, null), f.auth);

        assertEquals("LINK_CLASE", respuesta.tipo());
        assertNotNull(respuesta.creadoEn());
    }

    @Test
    void enlaceSemanalPuedeGuardarseComoMaterial() {
        Fixture f = new Fixture();

        var respuesta = f.service.crearLink(
                solicitud(RecursoAcademico.TipoRecurso.MATERIAL, (short) 4), f.auth);

        assertEquals("MATERIAL", respuesta.tipo());
        assertEquals((short) 4, respuesta.semana());
        assertNotNull(respuesta.creadoEn());
    }

    @Test
    void archivoTambienDevuelveFechaDeCreacionInmediata() {
        Fixture f = new Fixture();
        MultipartFile archivo = mock(MultipartFile.class);
        byte[] contenido = "%PDF-1.4".getBytes();
        when(archivo.getOriginalFilename()).thenReturn("guia.pdf");
        when(f.validacion.validarMaterialClase(archivo, 100L * 1024 * 1024)).thenReturn(
                new FileValidationService.Resultado(
                        FileValidationService.TipoArchivo.PDF, "application/pdf", contenido, "hash"));
        when(f.storage.generarClave("recursos/1", "guia.pdf")).thenReturn("recursos/1/guia.pdf");
        when(f.recursos.saveAndFlush(any(RecursoAcademico.class))).thenAnswer(invocacion -> {
            RecursoAcademico recurso = invocacion.getArgument(0);
            recurso.setId(12L);
            return recurso;
        });

        var respuesta = f.service.subirArchivo(1L, RecursoAcademico.TipoRecurso.MATERIAL,
                "Guía", null, (short) 2, null, archivo, f.auth);

        assertEquals("MATERIAL", respuesta.tipo());
        assertNotNull(respuesta.creadoEn());
    }

    @Test
    void enlaceRechazaTiposDeArchivo() {
        Fixture f = new Fixture();

        assertThrows(IllegalArgumentException.class, () -> f.service.crearLink(
                solicitud(RecursoAcademico.TipoRecurso.SILABO, null), f.auth));

        verifyNoInteractions(f.asignaciones, f.recursos, f.usuarios);
    }

    @Test
    void archivoRechazaNombreVacioYSemanaFueraDeRangoAntesDeSubir() {
        Fixture f = new Fixture();
        MultipartFile archivo = mock(MultipartFile.class);

        assertThrows(IllegalArgumentException.class, () -> f.service.subirArchivo(
                1L, RecursoAcademico.TipoRecurso.MATERIAL, "  ", null, (short) 1,
                null, archivo, f.auth));
        assertThrows(IllegalArgumentException.class, () -> f.service.subirArchivo(
                1L, RecursoAcademico.TipoRecurso.MATERIAL, "Guía", null, (short) 53,
                null, archivo, f.auth));

        verifyNoInteractions(f.asignaciones, f.storage, f.validacion);
    }

    private static RecursoAcademicoDtos.CrearLinkRequest solicitud(
            RecursoAcademico.TipoRecurso tipo, Short semana) {
        return new RecursoAcademicoDtos.CrearLinkRequest(
                1L, tipo, "Clase virtual", "Descripción", semana, null,
                "https://meet.example.com/aula");
    }

    private static class Fixture {
        final RecursoAcademicoRepository recursos = mock(RecursoAcademicoRepository.class);
        final AsignacionDocenteRepository asignaciones = mock(AsignacionDocenteRepository.class);
        final EstudianteRepository estudiantes = mock(EstudianteRepository.class);
        final UsuarioRepository usuarios = mock(UsuarioRepository.class);
        final AsignacionDocenteService asignacionService = mock(AsignacionDocenteService.class);
        final EstudianteService estudianteService = mock(EstudianteService.class);
        final StorageService storage = mock(StorageService.class);
        final FileValidationService validacion = mock(FileValidationService.class);
        final Authentication auth = mock(Authentication.class);
        final RecursoAcademicoService service = new RecursoAcademicoService(
                recursos, asignaciones, estudiantes, usuarios, asignacionService,
                estudianteService, storage, validacion, 100);

        Fixture() {
            AsignacionDocente asignacion = asignacion();
            Usuario autor = new Usuario();
            autor.setId(7L);
            autor.setNombres("Ada");
            autor.setApellidos("Docente");
            when(auth.getName()).thenReturn("docente@example.com");
            when(asignaciones.findById(1L)).thenReturn(Optional.of(asignacion));
            when(usuarios.findByEmail("docente@example.com")).thenReturn(Optional.of(autor));
            when(usuarios.findById(7L)).thenReturn(Optional.of(autor));
            when(recursos.save(any(RecursoAcademico.class))).thenAnswer(invocacion -> {
                RecursoAcademico recurso = invocacion.getArgument(0);
                recurso.setId(11L);
                return recurso;
            });
        }

        private AsignacionDocente asignacion() {
            Materia materia = new Materia();
            ReflectionTestUtils.setField(materia, "nombre", "Matemáticas");
            Paralelo paralelo = new Paralelo();
            ReflectionTestUtils.setField(paralelo, "id", 3);
            ReflectionTestUtils.setField(paralelo, "nivel", "1° BGU");
            ReflectionTestUtils.setField(paralelo, "seccion", "A");
            Usuario usuarioDocente = new Usuario();
            usuarioDocente.setNombres("Ada");
            usuarioDocente.setApellidos("Docente");
            Docente docente = new Docente();
            docente.setUsuario(usuarioDocente);
            AsignacionDocente asignacion = new AsignacionDocente();
            asignacion.setId(1L);
            asignacion.setMateria(materia);
            asignacion.setParalelo(paralelo);
            asignacion.setDocente(docente);
            return asignacion;
        }
    }
}
