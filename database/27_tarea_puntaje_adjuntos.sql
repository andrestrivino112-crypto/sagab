-- ============================================================================
-- SAGAB — 27_tarea_puntaje_adjuntos.sql
-- Completa el módulo de deberes (15_deberes.sql): puntaje de la tarea (independiente de la
-- nota 1-10 de cada entrega, es el "vale X puntos" que ve el estudiante) y material de apoyo
-- que el docente adjunta a la tarea misma (no a la entrega) — archivos e imágenes de referencia,
-- mismo mecanismo S3 que el resto de módulos (ver FileValidationService.validarMaterialClase()).
-- ============================================================================
SET search_path TO sagab;

ALTER TABLE sagab.tarea ADD COLUMN IF NOT EXISTS puntaje NUMERIC(5,2) NOT NULL DEFAULT 10.00 CHECK (puntaje > 0);

CREATE TABLE sagab.tarea_adjunto (
    id_adjunto              BIGSERIAL PRIMARY KEY,
    id_tarea                BIGINT NOT NULL REFERENCES sagab.tarea(id_tarea) ON DELETE CASCADE,
    nombre                  VARCHAR(150) NOT NULL,
    archivo_url             VARCHAR(500) NOT NULL,
    archivo_nombre_original VARCHAR(255) NOT NULL,
    archivo_mime_type       VARCHAR(100) NOT NULL,
    archivo_tamano_bytes    BIGINT NOT NULL,
    creado_por              BIGINT NOT NULL REFERENCES sagab.usuario(id_usuario),
    creado_en               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tarea_adjunto_tarea ON sagab.tarea_adjunto (id_tarea);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_tarea_adjunto') THEN
        EXECUTE format(
            'CREATE TRIGGER trg_audit_tarea_adjunto
             AFTER INSERT OR UPDATE OR DELETE ON sagab.tarea_adjunto
             FOR EACH ROW EXECUTE FUNCTION auditoria.fn_auditar(%L)', 'id_adjunto');
    END IF;
END $$;
