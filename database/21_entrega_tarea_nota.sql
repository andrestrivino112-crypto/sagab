-- ============================================================================
-- SAGAB — 21_entrega_tarea_nota.sql
-- Permite calificar una entrega (no solo comentarla) al revisarla — mismo rango y
-- precisión que calificacion.nota_examen. Nullable: una entrega puede quedar REVISADO
-- solo con observación, sin nota, si el docente no calificó numéricamente.
-- ============================================================================
SET search_path TO sagab;

ALTER TABLE sagab.entrega_tarea
    ADD COLUMN nota NUMERIC(4,2) CHECK (nota BETWEEN 1 AND 10);
