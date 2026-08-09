package ec.edu.bellini.sagab.utils;

import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UsernameGeneratorTest {

    @Test
    void normalizaTildesYGeneraNombreEsperado() {
        assertEquals("andres.perez", UsernameGenerator.generar("Andrés Felipe", "Pérez Ruiz", u -> false));
    }

    @Test
    void conservaMaximoCuarentaCaracteresIncluyendoSufijo() {
        AtomicInteger consultas = new AtomicInteger();
        String generado = UsernameGenerator.generar(
                "NombreExtraordinariamenteLargo",
                "ApellidoExtraordinariamenteLargo",
                ignorado -> consultas.getAndIncrement() == 0);

        assertTrue(generado.length() <= 40);
        assertTrue(generado.endsWith("2"));
    }
}
