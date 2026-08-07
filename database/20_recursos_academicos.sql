-- ============================================================================
-- SAGAB — 20_recursos_academicos.sql
-- Recursos académicos por asignación (materia+paralelo+período): sílabo y formatos
-- (archivo, mismo mecanismo S3 que deberes/comprobantes) o link de clase virtual
-- (URL externa, sin archivo). Se listan en "Mis materias" → Información Académica.
-- ============================================================================
SET search_path TO sagab;

CREATE TYPE sagab.tipo_recurso_academico AS ENUM ('SILABO', 'FORMATO', 'LINK_CLASE');

CREATE TABLE sagab.recurso_academico (
    id_recurso              BIGSERIAL PRIMARY KEY,
    id_asignacion           BIGINT NOT NULL REFERENCES sagab.asignacion_docente(id_asignacion),
    tipo                    sagab.tipo_recurso_academico NOT NULL,
    nombre                  VARCHAR(150) NOT NULL,
    -- SILABO/FORMATO: archivo subido a S3 — se guarda la CLAVE del objeto, nunca una URL
    -- pública; la descarga siempre pasa por una URL prefirmada (mismo patrón que entrega_tarea
    -- y pago.comprobante_url).
    archivo_url             VARCHAR(500),
    archivo_nombre_original VARCHAR(255),
    archivo_mime_type       VARCHAR(100),
    archivo_tamano_bytes    BIGINT,
    -- LINK_CLASE: enlace externo (Zoom/Meet/etc.), no es un archivo.
    url_externa             VARCHAR(500),
    creado_por              BIGINT NOT NULL REFERENCES sagab.usuario(id_usuario),
    creado_en               TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (
        (tipo = 'LINK_CLASE' AND url_externa IS NOT NULL AND archivo_url IS NULL)
        OR
        (tipo IN ('SILABO','FORMATO') AND archivo_url IS NOT NULL AND url_externa IS NULL)
    )
);

CREATE INDEX idx_recurso_asignacion ON sagab.recurso_academico (id_asignacion, tipo);

-- Auditoría automática (mismo patrón DO-block que 15_deberes.sql)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_recurso_academico') THEN
        EXECUTE format(
            'CREATE TRIGGER trg_audit_recurso_academico
             AFTER INSERT OR UPDATE OR DELETE ON sagab.recurso_academico
             FOR EACH ROW EXECUTE FUNCTION auditoria.fn_auditar(%L)', 'id_recurso');
    END IF;
END $$;
