-- ============================================================================
-- SAGAB — 19_tarea_parcial.sql
-- Agrega el parcial (1-3) a cada deber, igual que ya existe en calificacion.parcial,
-- para poder agrupar los deberes de una materia por parcial en el Portal Familiar
-- ("Mis materias" → pestañas Primer/Segundo/Tercer Parcial).
-- ============================================================================
SET search_path TO sagab;

-- Los deberes ya existentes no tenían parcial: se asumen del parcial 1 por defecto
-- (ajustar a mano si corresponde a otro). Los nuevos deberes deben declararlo siempre
-- desde la app — se retira el DEFAULT después de poblar, mismo criterio que
-- calificacion.parcial, que tampoco tiene DEFAULT.
ALTER TABLE sagab.tarea
    ADD COLUMN parcial SMALLINT NOT NULL DEFAULT 1 CHECK (parcial BETWEEN 1 AND 3);
ALTER TABLE sagab.tarea ALTER COLUMN parcial DROP DEFAULT;

-- Sustituye a idx_tarea_asignacion (creado en 15_deberes.sql): queda redundante porque
-- todo índice compuesto sirve también para buscar solo por id_asignacion (prefijo izquierdo).
DROP INDEX IF EXISTS sagab.idx_tarea_asignacion;
CREATE INDEX idx_tarea_asignacion_parcial ON sagab.tarea (id_asignacion, parcial);
