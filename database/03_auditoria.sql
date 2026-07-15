-- ============================================================================
-- SAGAB — 03_auditoria.sql : Auditoría a nivel de base de datos
-- Estrategia de doble capa:
--   1) Triggers en PostgreSQL capturan TODO cambio (incluso fuera de la app).
--   2) La aplicación registra eventos de negocio (login, exportaciones, etc.)
-- El esquema "auditoria" es de solo INSERT: nadie (ni el ADMIN de la app)
-- puede modificar o borrar registros de auditoría.
-- ============================================================================
SET search_path TO auditoria, sagab, public;

-- ─────────────────────────────────────────────────────────────────────────
-- Tabla principal de auditoría de datos (particionada por mes)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE auditoria.registro_cambio (
    id_registro     BIGSERIAL,
    esquema         VARCHAR(30)  NOT NULL,
    tabla           VARCHAR(60)  NOT NULL,
    id_fila         TEXT         NOT NULL,        -- PK de la fila afectada
    operacion       auditoria.tipo_operacion NOT NULL,
    datos_antes     JSONB,                        -- NULL en INSERT
    datos_despues   JSONB,                        -- NULL en DELETE
    columnas_modificadas TEXT[],                  -- solo en UPDATE
    usuario_bd      VARCHAR(60)  NOT NULL DEFAULT current_user,
    usuario_app     VARCHAR(120),                 -- email del usuario de la aplicación
    ip_cliente      INET,
    ejecutado_en    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (id_registro, ejecutado_en)
) PARTITION BY RANGE (ejecutado_en);

COMMENT ON TABLE auditoria.registro_cambio IS
'Bitácora inmutable de cambios. usuario_app se propaga desde Spring vía SET LOCAL sagab.usuario_app.';

-- Particiones iniciales (crear nuevas mensualmente con pg_partman o cron)
CREATE TABLE auditoria.registro_cambio_2026_07 PARTITION OF auditoria.registro_cambio
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE auditoria.registro_cambio_2026_08 PARTITION OF auditoria.registro_cambio
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE auditoria.registro_cambio_2026_09 PARTITION OF auditoria.registro_cambio
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE auditoria.registro_cambio_default PARTITION OF auditoria.registro_cambio DEFAULT;

-- ─────────────────────────────────────────────────────────────────────────
-- Tabla de eventos de seguridad (nivel aplicación)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE auditoria.evento_seguridad (
    id_evento       BIGSERIAL PRIMARY KEY,
    operacion       auditoria.tipo_operacion NOT NULL,   -- LOGIN, LOGIN_FALLIDO, ACCESO_DENEGADO, EXPORTACION...
    usuario_app     VARCHAR(120),
    detalle         TEXT,
    ip_cliente      INET,
    user_agent      VARCHAR(300),
    ejecutado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- Función de trigger genérica
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auditoria.fn_auditar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_antes   JSONB;
    v_despues JSONB;
    v_cols    TEXT[];
    v_pk      TEXT;
    v_usuario_app TEXT := current_setting('sagab.usuario_app', true);
    v_ip          TEXT := current_setting('sagab.ip_cliente', true);
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_despues := to_jsonb(NEW);
        v_pk := COALESCE(v_despues->>TG_ARGV[0], '?');
    ELSIF TG_OP = 'UPDATE' THEN
        v_antes   := to_jsonb(OLD);
        v_despues := to_jsonb(NEW);
        v_pk := COALESCE(v_despues->>TG_ARGV[0], '?');
        SELECT array_agg(key) INTO v_cols
        FROM jsonb_each(v_antes) a
        WHERE a.value IS DISTINCT FROM (v_despues->a.key);
        IF v_cols IS NULL THEN RETURN NEW; END IF;  -- UPDATE sin cambios reales: no auditar
    ELSE
        v_antes := to_jsonb(OLD);
        v_pk := COALESCE(v_antes->>TG_ARGV[0], '?');
    END IF;

    -- Nunca persistir hashes de contraseña en la auditoría
    v_antes   := v_antes   - 'hash_password';
    v_despues := v_despues - 'hash_password';

    INSERT INTO auditoria.registro_cambio
        (esquema, tabla, id_fila, operacion, datos_antes, datos_despues,
         columnas_modificadas, usuario_app, ip_cliente)
    VALUES
        (TG_TABLE_SCHEMA, TG_TABLE_NAME, v_pk, TG_OP::auditoria.tipo_operacion,
         v_antes, v_despues, v_cols,
         NULLIF(v_usuario_app, ''), NULLIF(v_ip, '')::INET);

    RETURN COALESCE(NEW, OLD);
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- Adjuntar auditoría a las tablas sensibles (argumento = nombre de su PK)
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT * FROM (VALUES
        ('usuario',                  'id_usuario'),
        ('usuario_rol',              'id_usuario'),
        ('estudiante',               'id_estudiante'),
        ('calificacion',             'id_calificacion'),
        ('asistencia',               'id_asistencia'),
        ('incidencia_disciplinaria', 'id_incidencia'),
        ('obligacion_pago',          'id_obligacion'),
        ('pago',                     'id_pago')
    ) AS t(tabla, pk)
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_audit_%s
             AFTER INSERT OR UPDATE OR DELETE ON sagab.%I
             FOR EACH ROW EXECUTE FUNCTION auditoria.fn_auditar(%L)',
            r.tabla, r.tabla, r.pk);
    END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- Inmutabilidad: bloquear UPDATE/DELETE sobre la auditoría
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auditoria.fn_bloquear()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Los registros de auditoría son inmutables (tabla %)', TG_TABLE_NAME
        USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE TRIGGER trg_inmutable_cambios BEFORE UPDATE OR DELETE ON auditoria.registro_cambio
    FOR EACH ROW EXECUTE FUNCTION auditoria.fn_bloquear();
CREATE TRIGGER trg_inmutable_eventos BEFORE UPDATE OR DELETE ON auditoria.evento_seguridad
    FOR EACH ROW EXECUTE FUNCTION auditoria.fn_bloquear();

-- ─────────────────────────────────────────────────────────────────────────
-- Índices de consulta para el rol AUDITOR
-- ─────────────────────────────────────────────────────────────────────────
CREATE INDEX idx_audit_tabla_fecha   ON auditoria.registro_cambio (tabla, ejecutado_en DESC);
CREATE INDEX idx_audit_usuario_app   ON auditoria.registro_cambio (usuario_app, ejecutado_en DESC);
CREATE INDEX idx_audit_fila          ON auditoria.registro_cambio (tabla, id_fila);
CREATE INDEX idx_audit_datos_gin     ON auditoria.registro_cambio USING gin (datos_despues jsonb_path_ops);
CREATE INDEX idx_evento_seg_fecha    ON auditoria.evento_seguridad (ejecutado_en DESC);
CREATE INDEX idx_evento_seg_usuario  ON auditoria.evento_seguridad (usuario_app, ejecutado_en DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- Vista amigable para el panel del auditor
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW auditoria.v_historial AS
SELECT rc.id_registro,
       rc.ejecutado_en,
       rc.usuario_app,
       rc.operacion,
       rc.tabla,
       rc.id_fila,
       rc.columnas_modificadas,
       rc.datos_antes,
       rc.datos_despues,
       rc.ip_cliente
FROM auditoria.registro_cambio rc
ORDER BY rc.ejecutado_en DESC;
