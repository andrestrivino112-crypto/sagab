-- ============================================================================
-- SAGAB — 10_asignacion_saida_historia.sql
-- Asigna a la docente "Saida" (usuario username='Saida') la materia Historia
-- en todos los paralelos del período académico activo, para demo.
-- ============================================================================
SET search_path TO sagab;

INSERT INTO asignacion_docente (id_docente, id_materia, id_paralelo, id_periodo)
SELECT d.id_docente, m.id_materia, p.id_paralelo, per.id_periodo
FROM docente d
JOIN usuario u ON u.id_usuario = d.id_usuario
CROSS JOIN materia m
CROSS JOIN paralelo p
JOIN periodo_academico per ON per.activo = true
WHERE u.username = 'Saida'
  AND m.codigo = 'HIS'
ON CONFLICT (id_materia, id_paralelo, id_periodo) DO UPDATE SET id_docente = EXCLUDED.id_docente;
