package ec.edu.bellini.sagab.database;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Contrato estático del catálogo mínimo. No abre PostgreSQL ni modifica datos:
 * protege el contenido de la semilla y el orden del inicializador Docker/local.
 */
class CatalogoAcademicoMigrationContractTest {

    private static final String MIGRACION = "32_catalogo_academico_2025_2026.sql";
    private static final Pattern PARALELO_2025 = Pattern.compile(
            "\\('[123]° BGU', '[AB]', '2025-2026'\\)");
    private static final Pattern MATERIA_BASE = Pattern.compile(
            "\\('(MAT|LEN|CCNN|HIS|ING)',\\s+'[^']+',\\s+'[^']+'\\)");

    private static String sql;
    private static String setupLocal;
    private static String setupDocker;

    @BeforeAll
    static void cargarArchivos() throws IOException {
        sql = leerDesdeRaiz(Path.of("database", MIGRACION));
        setupLocal = leerDesdeRaiz(Path.of("database", "setup_db.sh"));
        setupDocker = leerDesdeRaiz(Path.of("deploy", "docker", "init-db.sh"));
    }

    @Test
    void esTransaccionalSerializadaYValidaDependencias() {
        assertTrue(sql.contains("\\set ON_ERROR_STOP on"));
        assertTrue(sql.contains("BEGIN;"));
        assertTrue(sql.contains("COMMIT;"));
        assertTrue(sql.contains("pg_advisory_xact_lock"));
        assertTrue(sql.contains("to_regclass('sagab.periodo_academico')"));
        assertTrue(sql.contains("to_regclass('sagab.paralelo')"));
        assertTrue(sql.contains("to_regclass('sagab.materia')"));
    }

    @Test
    void contieneUnicamenteLosSeisParalelosYLasCincoMateriasBase() {
        assertEquals(6, contar(PARALELO_2025.matcher(sql)));
        assertEquals(5, contar(MATERIA_BASE.matcher(sql)));
        assertTrue(sql.contains("ON CONFLICT (nivel, seccion, anio_lectivo) DO NOTHING"));
        assertTrue(sql.contains("ON CONFLICT (codigo) DO NOTHING"));

        String normalizado = sql.toLowerCase();
        assertFalse(normalizado.matches("(?s).*insert\\s+into\\s+sagab\\.usuario\\b.*"));
        assertFalse(normalizado.matches("(?s).*insert\\s+into\\s+sagab\\.estudiante\\b.*"));
        assertFalse(normalizado.matches("(?s).*insert\\s+into\\s+sagab\\.docente\\b.*"));
        assertFalse(normalizado.matches("(?s).*insert\\s+into\\s+sagab\\.representante\\b.*"));
    }

    @Test
    void dejaUnSoloPeriodoActivoYConectaElMismoAnioLectivo() {
        assertTrue(sql.contains("WHERE anio_lectivo = '2025-2026'"));
        assertTrue(sql.contains("SET activo = (id_periodo = v_periodo_id)"));
        assertTrue(sql.contains("('Período académico', '2025-2026'"));
    }

    @Test
    void inicializadoresCreanCatalogoAntesDeSembrarRubros() {
        assertOrden(setupLocal);
        assertOrden(setupDocker);
    }

    private static void assertOrden(String inicializador) {
        int catalogo = inicializador.indexOf(MIGRACION);
        int rubros = inicializador.indexOf("18_rubros_motivos_pago.sql");
        assertTrue(catalogo >= 0, "El inicializador no incluye la migración 32");
        assertTrue(rubros >= 0, "El inicializador no incluye la migración 18");
        assertTrue(catalogo < rubros, "El catálogo debe existir antes de sembrar rubros");
    }

    private static int contar(Matcher matcher) {
        int total = 0;
        while (matcher.find()) total++;
        return total;
    }

    private static String leerDesdeRaiz(Path relativa) throws IOException {
        return List.of(relativa, Path.of("..").resolve(relativa)).stream()
                .filter(Files::isRegularFile)
                .findFirst()
                .map(path -> {
                    try {
                        return Files.readString(path);
                    } catch (IOException e) {
                        throw new ArchivoNoLegibleException(e);
                    }
                })
                .orElseThrow(() -> new IOException("No se encontró " + relativa));
    }

    private static final class ArchivoNoLegibleException extends RuntimeException {
        private ArchivoNoLegibleException(IOException cause) { super(cause); }
    }
}
