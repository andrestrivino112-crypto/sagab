package ec.edu.bellini.sagab.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FechasEcuadorServiceTest {
    private final FechasEcuadorService service = new FechasEcuadorService();

    @Test
    void calculaCarnavalYViernesSanto2026() {
        var fechas = service.entre(LocalDate.of(2026, 2, 1), LocalDate.of(2026, 4, 10));
        assertTrue(fechas.stream().anyMatch(f -> f.fecha().equals(LocalDate.of(2026, 2, 16)) && f.titulo().contains("Carnaval")));
        assertTrue(fechas.stream().anyMatch(f -> f.fecha().equals(LocalDate.of(2026, 4, 3)) && f.titulo().equals("Viernes Santo")));
    }

    @Test
    void aplicaReglaGeneralDeTraslado() {
        assertEquals(LocalDate.of(2026, 8, 10), FechasEcuadorService.trasladar(LocalDate.of(2026, 8, 10)));
        assertEquals(LocalDate.of(2026, 10, 9), FechasEcuadorService.trasladar(LocalDate.of(2026, 10, 9)));
        assertEquals(LocalDate.of(2027, 4, 30), FechasEcuadorService.trasladar(LocalDate.of(2027, 5, 1)));
    }

    @Test
    void respetaReglaEspecialDeFeriadosConsecutivosEnNoviembre() {
        var fechas = service.entre(LocalDate.of(2025, 11, 1), LocalDate.of(2025, 11, 5));
        assertTrue(fechas.stream().anyMatch(f -> f.tipo().equals("FERIADO")
                && f.titulo().equals("Independencia de Cuenca") && f.fecha().equals(LocalDate.of(2025, 11, 3))));
        assertTrue(fechas.stream().anyMatch(f -> f.tipo().equals("FERIADO")
                && f.titulo().equals("Día de los Difuntos") && f.fecha().equals(LocalDate.of(2025, 11, 4))));
    }

    @Test
    void trasladaFinDeSemanaYAgregaDescansosExtraordinarios2026() {
        var anioNuevo2023 = service.entre(LocalDate.of(2023, 1, 1), LocalDate.of(2023, 1, 3));
        assertTrue(anioNuevo2023.stream().anyMatch(f -> f.tipo().equals("FERIADO")
                && f.titulo().equals("Año Nuevo") && f.fecha().equals(LocalDate.of(2023, 1, 2))));

        var extraordinarios = service.entre(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 4, 30));
        assertTrue(extraordinarios.stream().anyMatch(f -> f.fecha().equals(LocalDate.of(2026, 1, 2))
                && f.titulo().contains("Extensión")));
        assertTrue(extraordinarios.stream().anyMatch(f -> f.fecha().equals(LocalDate.of(2026, 4, 30))
                && f.titulo().contains("Extensión")));
    }
}
