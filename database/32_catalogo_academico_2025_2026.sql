\set ON_ERROR_STOP on

BEGIN;

-- Serializa dos despliegues que intenten inicializar por primera vez el mismo catálogo.
SELECT pg_advisory_xact_lock(
    hashtextextended('sagab:migracion:32_catalogo_academico_2025_2026', 0)
);

SET LOCAL search_path TO pg_catalog, sagab;

-- Error temprano y comprensible si se intenta ejecutar fuera del orden de migraciones.
DO $preflight$
BEGIN
    IF to_regclass('sagab.periodo_academico') IS NULL
       OR to_regclass('sagab.paralelo') IS NULL
       OR to_regclass('sagab.materia') IS NULL THEN
        RAISE EXCEPTION
            'No se puede aplicar la migracion 32: falta la estructura academica base.';
    END IF;
END
$preflight$;

-- Catálogo académico mínimo y real para que Matrícula y Asignación de materias funcionen
-- también en instalaciones nuevas. Se reutiliza un período 2025-2026 existente para no romper
-- asignaciones previas; solo se crea uno cuando ese año lectivo aún no existe.
DO $$
DECLARE
    v_periodo_id INTEGER;
BEGIN
    SELECT id_periodo
      INTO v_periodo_id
      FROM sagab.periodo_academico
     WHERE anio_lectivo = '2025-2026'
     ORDER BY activo DESC, fecha_inicio DESC, id_periodo DESC
     LIMIT 1;

    IF v_periodo_id IS NULL THEN
        INSERT INTO sagab.periodo_academico
            (nombre, anio_lectivo, fecha_inicio, fecha_fin, activo)
        VALUES
            ('Período académico', '2025-2026', DATE '2025-09-01', DATE '2026-07-31', true)
        RETURNING id_periodo INTO v_periodo_id;
    END IF;

    -- El sistema utiliza un único período activo para Dashboard, matrícula, materias y reportes.
    UPDATE sagab.periodo_academico
       SET activo = (id_periodo = v_periodo_id)
     WHERE activo IS DISTINCT FROM (id_periodo = v_periodo_id);
END
$$;

INSERT INTO sagab.paralelo (nivel, seccion, anio_lectivo)
VALUES
    ('1° BGU', 'A', '2025-2026'),
    ('1° BGU', 'B', '2025-2026'),
    ('2° BGU', 'A', '2025-2026'),
    ('2° BGU', 'B', '2025-2026'),
    ('3° BGU', 'A', '2025-2026'),
    ('3° BGU', 'B', '2025-2026')
ON CONFLICT (nivel, seccion, anio_lectivo) DO NOTHING;

INSERT INTO sagab.materia (codigo, nombre, area)
VALUES
    ('MAT',  'Matemáticas',          'Ciencias Exactas'),
    ('LEN',  'Lengua y Literatura',  'Lengua'),
    ('CCNN', 'Ciencias Naturales',   'Ciencias'),
    ('HIS',  'Historia',             'Sociales'),
    ('ING',  'Inglés',               'Idiomas')
ON CONFLICT (codigo) DO NOTHING;

COMMIT;
