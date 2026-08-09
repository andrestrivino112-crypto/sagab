package ec.edu.bellini.sagab.database;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Verificación estática de la migración sensible. No abre conexiones, no ejecuta
 * PostgreSQL y nunca imprime los hashes encontrados.
 */
class SuperAdminMigrationContractTest {

    private static final String ARCHIVO = "31_super_admin_gestion_cuentas.sql";
    private static final Pattern BCRYPT_COSTO_12 =
            Pattern.compile("\\$2[aby]\\$12\\$[./A-Za-z0-9]{53}");
    private static String sql;

    @BeforeAll
    static void cargarMigracion() throws IOException {
        List<Path> candidatos = List.of(
                Path.of("database", ARCHIVO),
                Path.of("..", "database", ARCHIVO));
        Path archivo = candidatos.stream().filter(Files::isRegularFile).findFirst()
                .orElseThrow(() -> new IOException("No se encontró la migración " + ARCHIVO));
        sql = Files.readString(archivo);
    }

    @Test
    void esTransaccionalIdempotenteYSerializada() {
        assertTrue(sql.contains("\\set ON_ERROR_STOP on"));
        assertTrue(sql.contains("BEGIN;"));
        assertTrue(sql.contains("COMMIT;"));
        assertTrue(sql.contains("pg_advisory_xact_lock"));
        assertTrue(sql.contains("ADD COLUMN IF NOT EXISTS auth_version"));
        assertEquals(3, ocurrencias("ADD VALUE IF NOT EXISTS"));
        assertTrue(sql.contains("ON CONFLICT (id_usuario, id_rol) DO NOTHING"));
    }

    @Test
    void copiaExactamentePermisosAdminYAsignaSoloSuperAdmin() {
        assertTrue(sql.contains("admin.codigo = 'ADMIN'"));
        assertTrue(sql.contains("rp.id_rol = admin.id_rol"));
        assertTrue(sql.contains("super.codigo = 'SUPER_ADMIN'"));
        assertTrue(sql.contains("IS DISTINCT FROM (permiso_super.id_permiso IS NULL)"));
        assertTrue(sql.contains("r.codigo <> 'SUPER_ADMIN'"));
        assertFalse(sql.contains("CROSS JOIN sagab.permiso p\nWHERE r.codigo = 'SUPER_ADMIN'"));
    }

    @Test
    void protegeVersionDeJwtYRedactaDatosSensiblesDeAuditoria() {
        assertTrue(sql.contains("CHECK (auth_version >= 0)"));
        assertTrue(sql.contains("v_antes - 'hash_password' - 'cedula'"));
        assertTrue(sql.contains("v_despues - 'hash_password' - 'cedula'"));
        assertTrue(sql.contains("RESTABLECIMIENTO_CLAVE"));
        assertTrue(sql.contains("CUENTA_DESHABILITADA"));
        assertTrue(sql.contains("CUENTA_HABILITADA"));
    }

    @Test
    void semillasContienenSoloDosHashesBcrypt12DistintosYSinClaveLegible() {
        Matcher matcher = BCRYPT_COSTO_12.matcher(sql);
        List<String> hashes = new ArrayList<>();
        while (matcher.find()) hashes.add(matcher.group());

        assertEquals(2, hashes.size());
        assertEquals(2, new HashSet<>(hashes).size());

        String bloque = entre("FROM (VALUES", ") AS semillas");
        assertEquals(2, ocurrenciasEn(bloque, "::VARCHAR(100)"));

        // Tras retirar los BCrypt, ninguna literal del bloque seed puede parecer
        // una clave temporal alfanumérica (larga, con mayúsculas y números).
        String bloqueSinHashes = BCRYPT_COSTO_12.matcher(bloque).replaceAll("[HASH]");
        Matcher literales = Pattern.compile("'([^']*)'").matcher(bloqueSinHashes);
        while (literales.find()) {
            String literal = literales.group(1);
            boolean pareceClave = literal.length() >= 8
                    && literal.chars().anyMatch(Character::isUpperCase)
                    && literal.chars().anyMatch(Character::isDigit);
            assertFalse(pareceClave, "El bloque de semillas contiene una posible clave legible");
        }
    }

    @Test
    void normalizacionEsDeterministaYSinExtensionExterna() {
        assertTrue(sql.contains("CREATE OR REPLACE FUNCTION sagab.fn_normalizar_busqueda"));
        assertTrue(sql.contains("IMMUTABLE"));
        assertTrue(sql.contains("translate("));
        assertFalse(sql.toLowerCase().contains("create extension"));
    }

    private static int ocurrencias(String texto) {
        return ocurrenciasEn(sql, texto);
    }

    private static int ocurrenciasEn(String contenido, String texto) {
        int total = 0;
        int desde = 0;
        while ((desde = contenido.indexOf(texto, desde)) >= 0) {
            total++;
            desde += texto.length();
        }
        return total;
    }

    private static String entre(String inicio, String fin) {
        int desde = sql.indexOf(inicio);
        int hasta = sql.indexOf(fin, desde);
        assertTrue(desde >= 0 && hasta > desde, "No se encontró el bloque de semillas");
        return sql.substring(desde, hasta);
    }
}
