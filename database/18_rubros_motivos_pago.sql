-- ============================================================================
-- SAGAB — 18_rubros_motivos_pago.sql
-- Agrega los motivos de pago (rubro) que el Portal Familiar ofrece en el
-- selector "Motivo de pago" al registrar una transferencia (ver
-- FinanzasController.rubros() / GET /api/finanzas/rubros). Sin esto, el
-- selector aparece vacío si la única fila de "rubro" es la de datos de
-- prueba ("Pensión mensual").
--
-- ⚠ Los valores (250.00, 180.00, 45.00) son placeholders razonables — el
--   administrador debe ajustarlos a los montos reales de la institución
--   (UPDATE sagab.rubro SET valor = ... WHERE nombre = '...').
--
-- "Otro (especifique)" es el motivo de monto variable: el Portal Familiar
-- deja que el usuario escriba su propio motivo y monto; FinanzasService la
-- ajusta (aumenta obligacion_pago.valor) automáticamente si hace falta —
-- ver FinanzasService.obtenerOCrearObligacionDelMes().
-- ============================================================================
SET search_path TO sagab;

INSERT INTO sagab.rubro (tipo, nombre, valor, anio_lectivo)
SELECT 'MATRICULA', 'Matrícula', 250.00, p.anio_lectivo
FROM sagab.periodo_academico p
WHERE p.activo
  AND NOT EXISTS (
      SELECT 1 FROM sagab.rubro r WHERE r.nombre = 'Matrícula' AND r.anio_lectivo = p.anio_lectivo
  );

INSERT INTO sagab.rubro (tipo, nombre, valor, anio_lectivo)
SELECT 'PENSION', 'Mensualidad', 180.00, p.anio_lectivo
FROM sagab.periodo_academico p
WHERE p.activo
  AND NOT EXISTS (
      SELECT 1 FROM sagab.rubro r WHERE r.nombre = 'Mensualidad' AND r.anio_lectivo = p.anio_lectivo
  );

INSERT INTO sagab.rubro (tipo, nombre, valor, anio_lectivo)
SELECT 'OTRO', 'Uniforme', 45.00, p.anio_lectivo
FROM sagab.periodo_academico p
WHERE p.activo
  AND NOT EXISTS (
      SELECT 1 FROM sagab.rubro r WHERE r.nombre = 'Uniforme' AND r.anio_lectivo = p.anio_lectivo
  );

INSERT INTO sagab.rubro (tipo, nombre, valor, anio_lectivo)
SELECT 'OTRO', 'Otro (especifique)', 0.00, p.anio_lectivo
FROM sagab.periodo_academico p
WHERE p.activo
  AND NOT EXISTS (
      SELECT 1 FROM sagab.rubro r WHERE r.nombre = 'Otro (especifique)' AND r.anio_lectivo = p.anio_lectivo
  );
