-- ============================================================================
-- SAGAB — 06_matricula_campos.sql : Campos adicionales de matrícula
-- Añade a estudiante los campos que ya recolecta el formulario de matrícula
-- del frontend (salud, contacto de emergencia, procedencia, documentos) pero
-- que no existían en el esquema original. Migración aditiva, no destructiva.
-- ============================================================================
SET search_path TO sagab;

ALTER TABLE estudiante
  ADD COLUMN IF NOT EXISTS telefono VARCHAR(15),
  ADD COLUMN IF NOT EXISTS tipo_sangre VARCHAR(5),
  ADD COLUMN IF NOT EXISTS condicion_medica VARCHAR(500),
  ADD COLUMN IF NOT EXISTS institucion_procedencia VARCHAR(150),
  ADD COLUMN IF NOT EXISTS contacto_emergencia VARCHAR(150),
  ADD COLUMN IF NOT EXISTS documentos_entregados TEXT;

-- Secuencia para el código de estudiante (EST-####), evitando condiciones de
-- carrera de un enfoque basado en COUNT(*). Se inicializa después del máximo
-- código ya sembrado por 05_datos_prueba.sql para no chocar con esos datos.
-- En una base de datos vacía (sin 05_datos_prueba.sql) no se toca la
-- secuencia: setval con valor 0 falla porque el mínimo de la secuencia es 1.
CREATE SEQUENCE IF NOT EXISTS estudiante_codigo_seq;
DO $$
DECLARE v_max INT;
BEGIN
    SELECT MAX(substring(codigo from 5)::int) INTO v_max FROM estudiante WHERE codigo ~ '^EST-\d+$';
    IF v_max IS NOT NULL THEN
        PERFORM setval('estudiante_codigo_seq', v_max, true);
    END IF;
END $$;

GRANT USAGE ON SEQUENCE estudiante_codigo_seq TO sagab_app;
