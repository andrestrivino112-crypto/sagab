-- ============================================================================
-- SAGAB — 23_indice_asistencia_dashboard.sql
-- Corrige un hallazgo de la auditoría funcional (INFORME_AUDITORIA_FUNCIONAL.md,
-- hallazgo DB-04): DashboardService.resumen() cuenta ausencias/justificaciones de HOY
-- filtrando solo por "fecha" (AsistenciaRepository.countByFechaAndEstadoIn), columna que
-- no es líder en ningún índice existente de sagab.asistencia (idx_asistencia_paralelo_fecha
-- e idx_asistencia_estudiante_fecha requieren id_paralelo/id_estudiante como filtro para ser
-- eficientes). Es el KPI de la pantalla más visitada (ADMIN/DOCENTE/AUDITOR/DECE), sobre una
-- tabla que crece ~1 fila por estudiante por día.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_asistencia_fecha_estado ON sagab.asistencia (fecha, estado);
