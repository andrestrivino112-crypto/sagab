-- ============================================================================
-- SAGAB — 26_recursos_clase_semanal.sql
-- Extiende recurso_academico (20_recursos_academicos.sql, hoy solo sílabo/formato/link)
-- para soportar un repositorio de material de clase organizado por semana: nuevo tipo
-- MATERIAL (documentos/imágenes/video/audio/comprimidos — ver FileValidationService.
-- validarMaterialClase()), número de semana y descripción libre. SILABO/FORMATO/LINK_CLASE
-- siguen funcionando exactamente igual (no llevan semana).
-- ============================================================================
SET search_path TO sagab;

ALTER TYPE sagab.tipo_recurso_academico ADD VALUE IF NOT EXISTS 'MATERIAL';

ALTER TABLE sagab.recurso_academico ADD COLUMN IF NOT EXISTS semana SMALLINT CHECK (semana BETWEEN 1 AND 52);
ALTER TABLE sagab.recurso_academico ADD COLUMN IF NOT EXISTS descripcion VARCHAR(500);

-- El CHECK original solo contemplaba SILABO/FORMATO (con archivo) y LINK_CLASE (con url_externa).
-- Se reemplaza por uno con nombre explícito que además cubre MATERIAL (con archivo, igual que
-- SILABO/FORMATO) y permite que MATERIAL también se publique como enlace (p. ej. un video de
-- YouTube en vez de un archivo subido).
ALTER TABLE sagab.recurso_academico DROP CONSTRAINT IF EXISTS recurso_academico_check;
ALTER TABLE sagab.recurso_academico ADD CONSTRAINT ck_recurso_academico_archivo_o_enlace CHECK (
    (tipo IN ('LINK_CLASE', 'MATERIAL') AND url_externa IS NOT NULL AND archivo_url IS NULL)
    OR
    (tipo IN ('SILABO', 'FORMATO', 'MATERIAL') AND archivo_url IS NOT NULL AND url_externa IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_recurso_asignacion_semana ON sagab.recurso_academico (id_asignacion, semana);
