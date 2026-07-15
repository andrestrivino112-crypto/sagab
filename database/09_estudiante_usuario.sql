-- ============================================================================
-- SAGAB — 09_estudiante_usuario.sql : Cuenta de acceso automática del estudiante
-- Migración aditiva, no destructiva. Ejecutar tras 01-08.
--
-- Contexto: la Matrícula ahora crea también una cuenta ESTUDIANTE (Portal
-- Familiar), con el mismo patrón 1:1 que ya usan docente/representante.
-- Aprovecha para corregir el rango de las notas (0–10, no 1–10) y ampliar
-- la auditoría de base de datos a tablas que quedaron fuera en 03_auditoria.sql.
-- ============================================================================
SET search_path TO sagab, public;

-- ─────────────────────────────────────────────────────────────────────────
-- 0) Columna username: antes solo la creaba 07_usuario_username.sql, un
--    script manual con credenciales reales de personal. Sin ese username
--    NINGÚN usuario puede iniciar sesión (AuthService busca por username),
--    así que en una instalación nueva sin ejecutar 07 el login queda roto.
--    Se adelanta aquí (idempotente); 07 sigue funcionando igual para sus
--    cuentas de personal.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE sagab.usuario
  ADD COLUMN IF NOT EXISTS username VARCHAR(40) UNIQUE;

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Rol ESTUDIANTE + permisos de solo lectura sobre su propia información
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO sagab.rol (codigo, nombre, descripcion) VALUES
 ('ESTUDIANTE', 'Estudiante', 'Consulta sus propias calificaciones, asistencia y mensajería (Portal Familiar)')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO sagab.rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso FROM sagab.rol r JOIN sagab.permiso p ON (
    r.codigo = 'ESTUDIANTE' AND p.codigo IN ('CALIFICACION_LEER', 'ASISTENCIA_LEER', 'MENSAJERIA_LIMITADA')
)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Vínculo 1:1 estudiante ↔ usuario (mismo patrón que docente/representante)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE sagab.estudiante
  ADD COLUMN IF NOT EXISTS id_usuario BIGINT UNIQUE REFERENCES sagab.usuario(id_usuario);

CREATE INDEX IF NOT EXISTS idx_estudiante_usuario ON sagab.estudiante (id_usuario);

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Corrección de rango: la nota va de 0 a 10, no de 1 a 10
--    (el CHECK original contradecía el propio comentario del esquema y
--    rechazaba una nota de 0, un valor legítimo en la escala LOEI).
--    pg_get_constraintdef reescribe BETWEEN como >= AND <=, así que se
--    localizan por nombre (la convención de PostgreSQL para un CHECK
--    de columna sin nombre explícito es <tabla>_<columna>_check).
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE sagab.calificacion
  DROP CONSTRAINT IF EXISTS calificacion_nota_tarea_check,
  DROP CONSTRAINT IF EXISTS calificacion_nota_clase_check,
  DROP CONSTRAINT IF EXISTS calificacion_nota_examen_check;

ALTER TABLE sagab.calificacion
  ADD CONSTRAINT calificacion_nota_tarea_check  CHECK (nota_tarea  BETWEEN 0 AND 10),
  ADD CONSTRAINT calificacion_nota_clase_check  CHECK (nota_clase  BETWEEN 0 AND 10),
  ADD CONSTRAINT calificacion_nota_examen_check CHECK (nota_examen BETWEEN 0 AND 10);

-- ─────────────────────────────────────────────────────────────────────────
-- 4) Auditoría: ampliar a tablas transaccionales/personales que quedaron
--    fuera de 03_auditoria.sql (asignación docente, mensajería, rubros,
--    y los datos personales de docente/representante).
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT * FROM (VALUES
        ('asignacion_docente', 'id_asignacion'),
        ('mensaje',            'id_mensaje'),
        ('rubro',              'id_rubro'),
        ('docente',            'id_docente'),
        ('representante',      'id_representante')
    ) AS t(tabla, pk)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_' || r.tabla
        ) THEN
            EXECUTE format(
                'CREATE TRIGGER trg_audit_%s
                 AFTER INSERT OR UPDATE OR DELETE ON sagab.%I
                 FOR EACH ROW EXECUTE FUNCTION auditoria.fn_auditar(%L)',
                r.tabla, r.tabla, r.pk);
        END IF;
    END LOOP;
END $$;
