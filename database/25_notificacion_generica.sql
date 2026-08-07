-- ============================================================================
-- SAGAB — 25_notificacion_generica.sql
-- sagab.notificacion (14_notificaciones.sql) se documentó como "genérica a
-- propósito, para reutilizarse desde otros módulos (faltas, pagos) sin cambiar
-- el esquema", pero materia/calificacion quedaron NOT NULL — hoy solo sirve
-- para alertas de nota baja. Se agrega un tipo explícito y se relajan esas dos
-- columnas para que el módulo de Dashboard (mora) y futuros módulos puedan
-- crear notificaciones no académicas sin inventar una tabla paralela.
-- ============================================================================
SET search_path TO sagab;

CREATE TYPE sagab.tipo_notificacion AS ENUM ('CALIFICACION', 'PAGO', 'MENSAJE', 'SISTEMA');

ALTER TABLE sagab.notificacion
    ADD COLUMN tipo sagab.tipo_notificacion NOT NULL DEFAULT 'CALIFICACION';

ALTER TABLE sagab.notificacion ALTER COLUMN materia DROP NOT NULL;
ALTER TABLE sagab.notificacion ALTER COLUMN calificacion DROP NOT NULL;
