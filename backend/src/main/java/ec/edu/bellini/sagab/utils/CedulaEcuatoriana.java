package ec.edu.bellini.sagab.utils;

/** Algoritmo módulo 10 de validación de cédula ecuatoriana — usado por Matrícula y Personal. */
public final class CedulaEcuatoriana {

    private CedulaEcuatoriana() {}

    public static boolean esValida(String cedula) {
        if (cedula == null || !cedula.matches("\\d{10}")) return false;
        int provincia = Integer.parseInt(cedula.substring(0, 2));
        if (provincia < 1 || provincia > 24) return false;
        int[] d = cedula.chars().map(c -> c - '0').toArray();
        if (d[2] > 6) return false;
        int[] coef = {2, 1, 2, 1, 2, 1, 2, 1, 2};
        int suma = 0;
        for (int i = 0; i < 9; i++) {
            int v = d[i] * coef[i];
            if (v >= 10) v -= 9;
            suma += v;
        }
        int verificador = (10 - (suma % 10)) % 10;
        return verificador == d[9];
    }
}
