package ec.edu.bellini.sagab.controller;

import ec.edu.bellini.sagab.exception.GlobalExceptionHandler;
import ec.edu.bellini.sagab.service.EventoSeguridadService;
import ec.edu.bellini.sagab.service.RecursoAcademicoService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.mock.web.MockMultipartFile;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class RecursoAcademicoBadRequestTest {

    private RecursoAcademicoService service;
    private MockMvc mvc;

    @BeforeEach
    void configurar() {
        service = mock(RecursoAcademicoService.class);
        var controller = new RecursoAcademicoController(service);
        var handler = new GlobalExceptionHandler(mock(EventoSeguridadService.class));
        mvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(handler)
                .build();
    }

    @Test
    void enumMultipartInvalidoEs400YNo500() throws Exception {
        mvc.perform(multipart("/api/recursos-academicos/archivo")
                        .file(archivo())
                        .param("idAsignacion", "1")
                        .param("tipo", "NO_EXISTE")
                        .param("nombre", "Guía"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));

        verifyNoInteractions(service);
    }

    @Test
    void parteMultipartFaltanteEs400YNo500() throws Exception {
        mvc.perform(multipart("/api/recursos-academicos/archivo")
                        .param("idAsignacion", "1")
                        .param("tipo", "MATERIAL")
                        .param("nombre", "Guía"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));

        verifyNoInteractions(service);
    }

    @Test
    void parametroMultipartFaltanteEs400YNo500() throws Exception {
        mvc.perform(multipart("/api/recursos-academicos/archivo")
                        .file(archivo())
                        .param("tipo", "MATERIAL")
                        .param("nombre", "Guía"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));

        verifyNoInteractions(service);
    }

    private MockMultipartFile archivo() {
        return new MockMultipartFile(
                "archivo", "guia.pdf", MediaType.APPLICATION_PDF_VALUE, "%PDF-1.4".getBytes());
    }
}
