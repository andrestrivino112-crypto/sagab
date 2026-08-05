-- ============================================================================
-- SAGAB — 17_pago_asunto.sql
-- Añade "asunto" (concepto/motivo) al formulario de pago por transferencia,
-- a pedido explícito del usuario tras probar el módulo de Pagos (16_pagos_transferencia.sql).
-- ============================================================================
SET search_path TO sagab;

ALTER TABLE sagab.pago
    ADD COLUMN asunto VARCHAR(150);
