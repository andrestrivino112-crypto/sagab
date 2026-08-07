-- ============================================================================
-- SAGAB — 22_audit_notificacion.sql
-- Corrige un hallazgo de la auditoría funcional (INFORME_AUDITORIA_FUNCIONAL.md,
-- hallazgo DB-03): sagab.notificacion (14_notificaciones.sql) es una tabla de datos
-- sensibles (nota, materia, mensaje, ligada a estudiante/representante) que, a
-- diferencia de tarea/entrega_tarea/recurso_academico (creadas en el mismo ciclo),
-- nunca recibió su trigger trg_audit_*. Mismo patrón idempotente que 15_deberes.sql
-- y 20_recursos_academicos.sql.
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_notificacion') THEN
        EXECUTE format(
            'CREATE TRIGGER trg_audit_notificacion
             AFTER INSERT OR UPDATE OR DELETE ON sagab.%I
             FOR EACH ROW EXECUTE FUNCTION auditoria.fn_auditar(%L)',
            'notificacion', 'id_notificacion');
    END IF;
END $$;
