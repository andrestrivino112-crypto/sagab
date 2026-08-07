-- ============================================================================
-- SAGAB — 28_calendario_institucional.sql
-- Fuente única del calendario institucional y fechas límite opcionales de recursos.
-- Los feriados/fechas cívicas se calculan en el backend y no se duplican en esta tabla.
-- ============================================================================
SET search_path TO sagab;

CREATE TABLE IF NOT EXISTS sagab.evento_calendario (
    id_evento       BIGSERIAL PRIMARY KEY,
    titulo          VARCHAR(150) NOT NULL,
    descripcion     VARCHAR(2000),
    inicio          TIMESTAMPTZ NOT NULL,
    fin             TIMESTAMPTZ NOT NULL,
    lugar           VARCHAR(180),
    categoria       VARCHAR(40) NOT NULL,
    color           VARCHAR(7) NOT NULL DEFAULT '#2E75B6',
    estado          VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
    publicar_en     TIMESTAMPTZ,
    adjunto_nombre  VARCHAR(255),
    adjunto_url     VARCHAR(500),
    creado_por      BIGINT NOT NULL REFERENCES sagab.usuario(id_usuario),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_evento_rango CHECK (fin >= inicio),
    CONSTRAINT ck_evento_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT ck_evento_categoria CHECK (categoria IN
        ('INSTITUCIONAL','ACADEMICO','REUNION','CAPACITACION','EVALUACION','DEPORTIVO','CULTURAL','OTRO')),
    CONSTRAINT ck_evento_estado CHECK (estado IN
        ('BORRADOR','PUBLICADO','OCULTO','PROGRAMADO','CANCELADO')),
    CONSTRAINT ck_evento_adjunto CHECK (
        (adjunto_nombre IS NULL AND adjunto_url IS NULL)
        OR (adjunto_nombre IS NOT NULL AND adjunto_url IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_evento_calendario_rango
    ON sagab.evento_calendario (inicio, fin);
CREATE INDEX IF NOT EXISTS idx_evento_calendario_visible
    ON sagab.evento_calendario (estado, publicar_en, inicio);

-- Archivos reales del evento. Se conserva adjunto_nombre/adjunto_url en la tabla principal
-- para enlaces externos opcionales; los objetos privados subidos al bucket viven aquí.
CREATE TABLE IF NOT EXISTS sagab.evento_calendario_adjunto (
    id_adjunto              BIGSERIAL PRIMARY KEY,
    id_evento               BIGINT NOT NULL REFERENCES sagab.evento_calendario(id_evento) ON DELETE CASCADE,
    nombre                  VARCHAR(150) NOT NULL,
    archivo_url             VARCHAR(500) NOT NULL,
    archivo_nombre_original VARCHAR(255) NOT NULL,
    archivo_mime_type       VARCHAR(100) NOT NULL,
    archivo_tamano_bytes    BIGINT NOT NULL CHECK (archivo_tamano_bytes > 0),
    creado_por              BIGINT NOT NULL REFERENCES sagab.usuario(id_usuario),
    creado_en               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evento_calendario_adjunto_evento
    ON sagab.evento_calendario_adjunto (id_evento);

ALTER TABLE sagab.recurso_academico
    ADD COLUMN IF NOT EXISTS fecha_limite TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_recurso_fecha_limite
    ON sagab.recurso_academico (fecha_limite) WHERE fecha_limite IS NOT NULL;

DROP TRIGGER IF EXISTS trg_touch_evento_calendario ON sagab.evento_calendario;
CREATE TRIGGER trg_touch_evento_calendario
BEFORE UPDATE ON sagab.evento_calendario
FOR EACH ROW EXECUTE FUNCTION sagab.fn_touch_actualizado();

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_evento_calendario') THEN
        EXECUTE format(
            'CREATE TRIGGER trg_audit_evento_calendario
             AFTER INSERT OR UPDATE OR DELETE ON sagab.evento_calendario
             FOR EACH ROW EXECUTE FUNCTION auditoria.fn_auditar(%L)', 'id_evento');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_evento_calendario_adjunto') THEN
        EXECUTE format(
            'CREATE TRIGGER trg_audit_evento_calendario_adjunto
             AFTER INSERT OR UPDATE OR DELETE ON sagab.evento_calendario_adjunto
             FOR EACH ROW EXECUTE FUNCTION auditoria.fn_auditar(%L)', 'id_adjunto');
    END IF;
END $$;
