package ec.edu.bellini.sagab.service;

import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.Month;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Feriados nacionales y efemérides educativas ecuatorianas, calculados sin depender de APIs externas. */
@Service
public class FechasEcuadorService {

    public record FechaSistema(LocalDate fecha, String titulo, String tipo, String descripcion) {}

    public List<FechaSistema> entre(LocalDate desde, LocalDate hasta) {
        List<FechaSistema> resultado = new ArrayList<>();
        for (int anio = desde.getYear(); anio <= hasta.getYear(); anio++) {
            agregarExceptuadoEntreSemana(resultado, LocalDate.of(anio, Month.JANUARY, 1), "Año Nuevo");

            LocalDate pascua = domingoPascua(anio);
            agregar(resultado, pascua.minusDays(48), "Lunes de Carnaval", "FERIADO", "Feriado nacional del Ecuador.");
            agregar(resultado, pascua.minusDays(47), "Martes de Carnaval", "FERIADO", "Feriado nacional del Ecuador.");
            agregar(resultado, pascua.minusDays(2), "Viernes Santo", "FERIADO", "Feriado nacional del Ecuador.");

            agregarTrasladable(resultado, LocalDate.of(anio, 5, 1), "Día del Trabajo");
            agregarTrasladable(resultado, LocalDate.of(anio, 5, 24), "Batalla de Pichincha");
            agregarTrasladable(resultado, LocalDate.of(anio, 8, 10), "Primer Grito de Independencia");
            agregarTrasladable(resultado, LocalDate.of(anio, 10, 9), "Independencia de Guayaquil");
            agregarFeriadosNoviembre(resultado, anio);
            agregarExceptuadoEntreSemana(resultado, LocalDate.of(anio, Month.DECEMBER, 25), "Navidad");

            agregarDescansosExtraordinarios(resultado, anio);

            agregarFijo(resultado, anio, Month.FEBRUARY, 27, "Día del Civismo y de la Unidad Nacional", "FECHA_IMPORTANTE",
                    "Conmemoración de la Batalla de Tarqui.");
            agregarFijo(resultado, anio, Month.APRIL, 13, "Día del Maestro Ecuatoriano", "FECHA_IMPORTANTE",
                    "Reconocimiento nacional a docentes y educadores.");
            agregarFijo(resultado, anio, Month.APRIL, 22, "Día Internacional de la Madre Tierra", "FECHA_IMPORTANTE",
                    "Fecha educativa de conciencia ambiental.");
            agregarFijo(resultado, anio, Month.APRIL, 23, "Día Internacional del Libro", "FECHA_IMPORTANTE",
                    "Fecha educativa dedicada a la lectura y al libro.");
            agregarFijo(resultado, anio, Month.JUNE, 1, "Día de la Niñez", "FECHA_IMPORTANTE",
                    "Jornada de promoción y protección de los derechos de niñas y niños.");
            agregarFijo(resultado, anio, Month.JUNE, 5, "Día Mundial del Medio Ambiente", "FECHA_IMPORTANTE",
                    "Fecha educativa de cuidado ambiental.");
            agregarFijo(resultado, anio, Month.SEPTEMBER, 26, "Día de la Bandera Nacional", "FECHA_IMPORTANTE",
                    "Fecha cívica del Ecuador.");
            agregarFijo(resultado, anio, Month.OCTOBER, 12, "Día de la Interculturalidad y Plurinacionalidad", "FECHA_IMPORTANTE",
                    "Fecha de reflexión sobre la diversidad cultural del Ecuador.");
            agregarFijo(resultado, anio, Month.OCTOBER, 31, "Día del Escudo Nacional", "FECHA_IMPORTANTE",
                    "Fecha cívica del Ecuador.");
            agregarFijo(resultado, anio, Month.NOVEMBER, 26, "Día del Himno Nacional", "FECHA_IMPORTANTE",
                    "Fecha cívica del Ecuador.");
        }
        return resultado.stream()
                .filter(f -> !f.fecha().isBefore(desde) && !f.fecha().isAfter(hasta))
                .sorted(Comparator.comparing(FechaSistema::fecha).thenComparing(FechaSistema::titulo))
                .toList();
    }

    private void agregarTrasladable(List<FechaSistema> fechas, LocalDate conmemoracion, String titulo) {
        agregarDescanso(fechas, conmemoracion, trasladar(conmemoracion), titulo,
                "Fecha histórica; el descanso nacional se traslada conforme al calendario ecuatoriano.");
    }

    /** 1 de enero y 25 de diciembre no se trasladan entre semana, pero sí cuando caen en fin de semana. */
    private void agregarExceptuadoEntreSemana(List<FechaSistema> fechas, LocalDate conmemoracion, String titulo) {
        LocalDate descanso = switch (conmemoracion.getDayOfWeek()) {
            case SATURDAY -> conmemoracion.minusDays(1);
            case SUNDAY -> conmemoracion.plusDays(1);
            default -> conmemoracion;
        };
        agregarDescanso(fechas, conmemoracion, descanso, titulo,
                "Fecha histórica; el descanso se traslada por coincidir con fin de semana.");
    }

    /** Reglas especiales de la Ley de Feriados para los días consecutivos 2 y 3 de noviembre. */
    private void agregarFeriadosNoviembre(List<FechaSistema> fechas, int anio) {
        LocalDate difuntos = LocalDate.of(anio, Month.NOVEMBER, 2);
        LocalDate cuenca = difuntos.plusDays(1);
        LocalDate descansoDifuntos;
        LocalDate descansoCuenca;
        switch (difuntos.getDayOfWeek()) {
            case MONDAY, THURSDAY -> {
                descansoDifuntos = difuntos;
                descansoCuenca = cuenca;
            }
            case TUESDAY -> {
                descansoDifuntos = difuntos;
                descansoCuenca = difuntos.minusDays(1);
            }
            case WEDNESDAY -> {
                descansoDifuntos = cuenca.plusDays(1);
                descansoCuenca = cuenca;
            }
            case FRIDAY -> {
                descansoDifuntos = difuntos;
                descansoCuenca = difuntos.minusDays(1);
            }
            case SATURDAY -> {
                descansoDifuntos = difuntos.minusDays(1);
                descansoCuenca = cuenca.plusDays(1);
            }
            case SUNDAY -> {
                descansoDifuntos = cuenca.plusDays(1);
                descansoCuenca = cuenca;
            }
            default -> throw new IllegalStateException("Día de semana no soportado");
        }
        String detalle = "Fecha histórica; el descanso se ajusta por tratarse de feriados nacionales consecutivos.";
        agregarDescanso(fechas, difuntos, descansoDifuntos, "Día de los Difuntos", detalle);
        agregarDescanso(fechas, cuenca, descansoCuenca, "Independencia de Cuenca", detalle);
    }

    private void agregarDescanso(List<FechaSistema> fechas, LocalDate conmemoracion, LocalDate descanso,
                                 String titulo, String detalleTraslado) {
        if (!descanso.equals(conmemoracion)) {
            agregar(fechas, conmemoracion, "Conmemoración: " + titulo, "FECHA_IMPORTANTE",
                    detalleTraslado);
        }
        agregar(fechas, descanso, titulo, "FERIADO",
                descanso.equals(conmemoracion) ? "Feriado nacional del Ecuador."
                        : "Día de descanso nacional trasladado desde el " + conmemoracion + ".");
    }

    /** Descansos nacionales extraordinarios publicados en el Registro Oficial para el año indicado. */
    private void agregarDescansosExtraordinarios(List<FechaSistema> fechas, int anio) {
        if (anio == 2026) {
            agregar(fechas, LocalDate.of(2026, Month.JANUARY, 2), "Extensión del feriado de Año Nuevo", "FERIADO",
                    "Descanso nacional no recuperable dispuesto por Decreto Ejecutivo 249.");
            agregar(fechas, LocalDate.of(2026, Month.APRIL, 30), "Extensión del feriado del Día del Trabajo", "FERIADO",
                    "Descanso nacional no recuperable dispuesto por Decreto Ejecutivo 354.");
        }
    }

    /** Regla general ecuatoriana de traslado de feriados nacionales. */
    static LocalDate trasladar(LocalDate fecha) {
        return switch (fecha.getDayOfWeek()) {
            case TUESDAY -> fecha.minusDays(1);
            case WEDNESDAY -> fecha.plusDays(2);
            case THURSDAY -> fecha.plusDays(1);
            case SATURDAY -> fecha.minusDays(1);
            case SUNDAY -> fecha.plusDays(1);
            default -> fecha;
        };
    }

    /** Algoritmo gregoriano de Meeus/Jones/Butcher. */
    static LocalDate domingoPascua(int year) {
        int a = year % 19;
        int b = year / 100;
        int c = year % 100;
        int d = b / 4;
        int e = b % 4;
        int f = (b + 8) / 25;
        int g = (b - f + 1) / 3;
        int h = (19 * a + b - d - g + 15) % 30;
        int i = c / 4;
        int k = c % 4;
        int l = (32 + 2 * e + 2 * i - h - k) % 7;
        int m = (a + 11 * h + 22 * l) / 451;
        int month = (h + l - 7 * m + 114) / 31;
        int day = ((h + l - 7 * m + 114) % 31) + 1;
        return LocalDate.of(year, month, day);
    }

    private void agregarFijo(List<FechaSistema> fechas, int anio, Month mes, int dia,
                             String titulo, String tipo, String descripcion) {
        agregar(fechas, LocalDate.of(anio, mes, dia), titulo, tipo, descripcion);
    }

    private void agregar(List<FechaSistema> fechas, LocalDate fecha, String titulo, String tipo, String descripcion) {
        fechas.add(new FechaSistema(fecha, titulo, tipo, descripcion));
    }
}
