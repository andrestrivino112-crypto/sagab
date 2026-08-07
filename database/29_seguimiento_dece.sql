-- ============================================================================
-- SAGAB — 29_seguimiento_dece.sql
-- Expediente de seguimiento DECE, trazabilidad de estados y mensajes privados.
-- ============================================================================
SET search_path TO sagab;

CREATE TABLE IF NOT EXISTS sagab.seguimiento_dece (
    id_seguimiento  BIGSERIAL PRIMARY KEY,
    id_estudiante   BIGINT NOT NULL UNIQUE REFERENCES sagab.estudiante(id_estudiante),
    registrado_por  BIGINT NOT NULL REFERENCES sagab.usuario(id_usuario),
    fecha_inicio    DATE NOT NULL DEFAULT CURRENT_DATE,
    estado          VARCHAR(30) NOT NULL DEFAULT 'ACTIVO',
    observacion     VARCHAR(2000),
    eliminado       BOOLEAN NOT NULL DEFAULT false,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_seguimiento_dece_estado CHECK (estado IN
        ('ACTIVO','EN_OBSERVACION','INTERVENCION','RESUELTO','ARCHIVADO'))
);

CREATE INDEX IF NOT EXISTS idx_seguimiento_dece_estado
    ON sagab.seguimiento_dece (estado, actualizado_en DESC) WHERE eliminado = false;
CREATE INDEX IF NOT EXISTS idx_seguimiento_dece_registrado_por
    ON sagab.seguimiento_dece (registrado_por);

CREATE TABLE IF NOT EXISTS sagab.seguimiento_dece_historial (
    id_historial    BIGSERIAL PRIMARY KEY,
    id_seguimiento BIGINT NOT NULL REFERENCES sagab.seguimiento_dece(id_seguimiento) ON DELETE CASCADE,
    estado_anterior VARCHAR(30),
    estado_nuevo   VARCHAR(30) NOT NULL,
    observacion    VARCHAR(2000),
    cambiado_por   BIGINT NOT NULL REFERENCES sagab.usuario(id_usuario),
    cambiado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_seguimiento_hist_estado_anterior CHECK (estado_anterior IS NULL OR estado_anterior IN
        ('ACTIVO','EN_OBSERVACION','INTERVENCION','RESUELTO','ARCHIVADO')),
    CONSTRAINT ck_seguimiento_hist_estado_nuevo CHECK (estado_nuevo IN
        ('ACTIVO','EN_OBSERVACION','INTERVENCION','RESUELTO','ARCHIVADO'))
);

CREATE INDEX IF NOT EXISTS idx_seguimiento_historial_seguimiento
    ON sagab.seguimiento_dece_historial (id_seguimiento, cambiado_en DESC);

CREATE TABLE IF NOT EXISTS sagab.seguimiento_dece_mensaje (
    id_seguimiento_mensaje BIGSERIAL PRIMARY KEY,
    id_seguimiento BIGINT NOT NULL REFERENCES sagab.seguimiento_dece(id_seguimiento) ON DELETE CASCADE,
    id_mensaje     BIGINT NOT NULL UNIQUE REFERENCES sagab.mensaje(id_mensaje) ON DELETE CASCADE,
    id_destinatario BIGINT NOT NULL REFERENCES sagab.usuario(id_usuario),
    enviado_por    BIGINT NOT NULL REFERENCES sagab.usuario(id_usuario),
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seguimiento_mensaje_seguimiento
    ON sagab.seguimiento_dece_mensaje (id_seguimiento, creado_en DESC);

DROP TRIGGER IF EXISTS trg_touch_seguimiento_dece ON sagab.seguimiento_dece;
CREATE TRIGGER trg_touch_seguimiento_dece
BEFORE UPDATE ON sagab.seguimiento_dece
FOR EACH ROW EXECUTE FUNCTION sagab.fn_touch_actualizado();

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_seguimiento_dece') THEN
        EXECUTE format(
            'CREATE TRIGGER trg_audit_seguimiento_dece
             AFTER INSERT OR UPDATE OR DELETE ON sagab.seguimiento_dece
             FOR EACH ROW EXECUTE FUNCTION auditoria.fn_auditar(%L)', 'id_seguimiento');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_seguimiento_dece_historial') THEN
        EXECUTE format(
            'CREATE TRIGGER trg_audit_seguimiento_dece_historial
             AFTER INSERT OR UPDATE OR DELETE ON sagab.seguimiento_dece_historial
             FOR EACH ROW EXECUTE FUNCTION auditoria.fn_auditar(%L)', 'id_historial');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_seguimiento_dece_mensaje') THEN
        EXECUTE format(
            'CREATE TRIGGER trg_audit_seguimiento_dece_mensaje
             AFTER INSERT OR UPDATE OR DELETE ON sagab.seguimiento_dece_mensaje
             FOR EACH ROW EXECUTE FUNCTION auditoria.fn_auditar(%L)', 'id_seguimiento_mensaje');
    END IF;
END $$;
