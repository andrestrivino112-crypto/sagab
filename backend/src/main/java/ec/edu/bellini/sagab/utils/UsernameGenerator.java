package ec.edu.bellini.sagab.utils;

import java.text.Normalizer;
import java.util.function.Predicate;

/**
 * Genera nombres de usuario únicos con el patrón primerNombre.primerApellido,
 * añadiendo un sufijo numérico incremental (2, 3, 4…) si ya existe.
 * Ej.: "Carlos Andrés" + "Pérez Ruiz" → "carlos.perez", "carlos.perez2"…
 */
public final class UsernameGenerator {

    private static final int MAX_LONGITUD = 40;

    private UsernameGenerator() {}

    public static String generar(String nombres, String apellidos, Predicate<String> yaExiste) {
        String base = recortar(normalizar(primerToken(nombres)) + "." + normalizar(primerToken(apellidos)), MAX_LONGITUD);
        String candidato = base;
        int sufijo = 2;
        while (yaExiste.test(candidato)) {
            String textoSufijo = String.valueOf(sufijo++);
            candidato = recortar(base, MAX_LONGITUD - textoSufijo.length()) + textoSufijo;
        }
        return candidato;
    }

    private static String primerToken(String texto) {
        String t = texto.trim();
        int espacio = t.indexOf(' ');
        return espacio > 0 ? t.substring(0, espacio) : t;
    }

    private static String normalizar(String texto) {
        String sinTildes = Normalizer.normalize(texto, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        String limpio = sinTildes.toLowerCase().replaceAll("[^a-z0-9]", "");
        return limpio.isEmpty() ? "usuario" : limpio;
    }

    private static String recortar(String valor, int maximo) {
        return valor.length() <= maximo ? valor : valor.substring(0, maximo);
    }
}
