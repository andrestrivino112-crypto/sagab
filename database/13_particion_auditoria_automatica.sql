-- ============================================================================
-- SAGAB — 13_particion_auditoria_automatica.sql
-- Automatiza la creación de particiones mensuales de auditoria.registro_cambio
-- (INFORME_AUDITORIA.md, hallazgo crítico #1: sin esto, la partición vigente
-- vence el 2026-10-01 y los registros nuevos caerían en el DEFAULT sin aviso).
--
-- sagab_app no tiene privilegio CREATE sobre el esquema auditoria a propósito
-- (04_roles_bd.sql: "Sin DDL para ninguno"), así que la función se define
-- SECURITY DEFINER (se ejecuta con los privilegios de su dueño, postgres) y
-- solo se le concede EXECUTE a sagab_app — el backend puede invocarla desde un
-- job programado (@Scheduled) sin necesitar privilegios de DDL en general.
-- ============================================================================

CREATE OR REPLACE FUNCTION auditoria.fn_crear_particion_siguiente_mes() RETURNS void
    SECURITY DEFINER
    SET search_path = auditoria, pg_temp
    LANGUAGE plpgsql AS $$
DECLARE
    -- Crea con 2 meses de antelación para dejar siempre un mes de margen
    -- aunque el job programado no corra exactamente el día 1.
    v_inicio DATE := date_trunc('month', now() + interval '2 months')::date;
    v_fin    DATE := date_trunc('month', now() + interval '3 months')::date;
    v_nombre TEXT := 'registro_cambio_' || to_char(v_inicio, 'YYYY_MM');
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'auditoria' AND c.relname = v_nombre
    ) THEN
        EXECUTE format(
            'CREATE TABLE auditoria.%I PARTITION OF auditoria.registro_cambio FOR VALUES FROM (%L) TO (%L)',
            v_nombre, v_inicio, v_fin);
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION auditoria.fn_crear_particion_siguiente_mes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auditoria.fn_crear_particion_siguiente_mes() TO sagab_app;

-- Cierra de inmediato el hueco detectado en la auditoría (partición de
-- octubre 2026 ausente); de aquí en adelante lo mantiene el scheduler del
-- backend (ver AuditoriaParticionScheduler).
SELECT auditoria.fn_crear_particion_siguiente_mes();
