-- ============================================================================
-- SAGAB — 14_notificaciones.sql
-- Módulo de notificaciones automáticas: cuando un estudiante obtiene una nota
-- menor a 7/10, se notifica dentro de la aplicación tanto al estudiante (si
-- tiene cuenta propia) como a su representante. Sin intervención manual del
-- administrador — se dispara desde CalificacionService al guardar la nota.
-- ============================================================================
SET search_path TO sagab;

CREATE TABLE sagab.notificacion (
    id_notificacion BIGSERIAL PRIMARY KEY,
    id_destinatario BIGINT NOT NULL REFERENCES sagab.usuario(id_usuario),
    -- Se conserva aunque se borre la calificación (ON DELETE SET NULL): la notificación
    -- ya se envió y debe seguir siendo consultable como parte del historial del usuario.
    id_calificacion BIGINT REFERENCES sagab.calificacion(id_calificacion) ON DELETE SET NULL,
    materia         VARCHAR(100) NOT NULL,
    calificacion    NUMERIC(4,2) NOT NULL CHECK (calificacion BETWEEN 0 AND 10),
    mensaje         VARCHAR(500) NOT NULL,
    leido_en        TIMESTAMPTZ,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notificacion_destinatario ON sagab.notificacion (id_destinatario, creado_en DESC);
-- Índice parcial (mismo patrón que idx_msg_dest_noleido): la consulta más frecuente
-- es "notificaciones sin leer de este usuario".
CREATE INDEX idx_notificacion_noleida ON sagab.notificacion (id_destinatario) WHERE leido_en IS NULL;
