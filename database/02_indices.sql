-- ============================================================================
-- SAGAB — 02_indices.sql : Índices de rendimiento (RNF-01: < 2 s / 50 usuarios)
-- Nota: las claves primarias y UNIQUE ya crean sus propios índices.
-- ============================================================================
SET search_path TO sagab, public;

-- ── Usuarios y autenticación ────────────────────────────────────────────
-- Búsqueda de login por email (case-insensitive garantizado por CHECK lower)
CREATE INDEX idx_usuario_estado          ON sagab.usuario (estado) WHERE estado <> 'ACTIVO';
CREATE INDEX idx_refresh_token_usuario   ON sagab.refresh_token (id_usuario) WHERE NOT revocado;
CREATE INDEX idx_refresh_token_expira    ON sagab.refresh_token (expira_en)  WHERE NOT revocado;

-- ── Estudiantes ─────────────────────────────────────────────────────────
CREATE INDEX idx_estudiante_paralelo     ON sagab.estudiante (id_paralelo) WHERE activo;
CREATE INDEX idx_estudiante_representante ON sagab.estudiante (id_representante);
-- Búsqueda instantánea por nombre (Arquetipo 3: 800+ estudiantes)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_estudiante_nombre_trgm  ON sagab.estudiante
    USING gin ((apellidos || ' ' || nombres) gin_trgm_ops);

-- ── Calificaciones (consulta más frecuente del sistema) ────────────────
CREATE INDEX idx_calificacion_estudiante ON sagab.calificacion (id_estudiante, id_asignacion);
CREATE INDEX idx_calificacion_asignacion ON sagab.calificacion (id_asignacion, parcial);
-- Alertas de promedio en riesgo (< 7): índice parcial
CREATE INDEX idx_calificacion_riesgo     ON sagab.calificacion (id_estudiante) WHERE promedio < 7;

-- ── Asistencia ──────────────────────────────────────────────────────────
CREATE INDEX idx_asistencia_paralelo_fecha ON sagab.asistencia (id_paralelo, fecha);
CREATE INDEX idx_asistencia_estudiante_fecha ON sagab.asistencia (id_estudiante, fecha DESC);
-- Detección de ausencias injustificadas (alerta DECE, 3+ consecutivas)
CREATE INDEX idx_asistencia_injustificada ON sagab.asistencia (id_estudiante, fecha)
    WHERE estado = 'AUSENCIA_INJUSTIFICADA';

-- ── Disciplina ──────────────────────────────────────────────────────────
CREATE INDEX idx_incidencia_estudiante   ON sagab.incidencia_disciplinaria (id_estudiante, fecha_incidente DESC);
CREATE INDEX idx_incidencia_estado       ON sagab.incidencia_disciplinaria (estado)
    WHERE estado IN ('REGISTRADA','EN_SEGUIMIENTO');

-- ── Financiero ──────────────────────────────────────────────────────────
CREATE INDEX idx_obligacion_estudiante   ON sagab.obligacion_pago (id_estudiante, estado);
-- Recordatorios automáticos: solo cuentas pendientes/vencidas
CREATE INDEX idx_obligacion_vencimiento  ON sagab.obligacion_pago (fecha_vencimiento)
    WHERE estado IN ('PENDIENTE','VENCIDO');
CREATE INDEX idx_pago_obligacion         ON sagab.pago (id_obligacion);
CREATE INDEX idx_pago_fecha              ON sagab.pago (fecha_pago DESC);

-- ── Mensajería ──────────────────────────────────────────────────────────
CREATE INDEX idx_mensaje_remitente       ON sagab.mensaje (id_remitente, enviado_en DESC);
CREATE INDEX idx_msg_dest_noleido        ON sagab.mensaje_destinatario (id_destinatario)
    WHERE leido_en IS NULL;
