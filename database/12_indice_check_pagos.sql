-- ============================================================================
-- SAGAB — 12_indice_check_pagos.sql
-- Corrige dos hallazgos de la auditoría técnica (INFORME_AUDITORIA.md, sección 4):
--   1) Falta índice en asignacion_docente.id_docente (consulta frecuente:
--      "materias/paralelos de un docente").
--   2) pago.metodo no tenía un dominio cerrado, y no había ninguna regla que
--      impidiera que la suma de pagos de una obligación superara su valor.
-- ============================================================================
SET search_path TO sagab;

CREATE INDEX IF NOT EXISTS idx_asignacion_docente_id_docente
    ON sagab.asignacion_docente (id_docente);

ALTER TABLE sagab.pago
    ADD CONSTRAINT chk_pago_metodo CHECK (metodo IN ('EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'TARJETA'));

-- No se puede expresar "SUM(pago.valor_pagado) <= obligacion.valor" como CHECK
-- (los CHECK de PostgreSQL son por fila); se aplica con un trigger, igual que
-- el resto de reglas de negocio del esquema.
CREATE OR REPLACE FUNCTION sagab.fn_validar_suma_pagos() RETURNS TRIGGER AS $$
DECLARE
    v_valor_obligacion NUMERIC(8,2);
    v_total_pagado     NUMERIC(8,2);
BEGIN
    SELECT valor INTO v_valor_obligacion
    FROM sagab.obligacion_pago WHERE id_obligacion = NEW.id_obligacion;

    SELECT COALESCE(SUM(valor_pagado), 0) INTO v_total_pagado
    FROM sagab.pago
    WHERE id_obligacion = NEW.id_obligacion AND id_pago <> COALESCE(NEW.id_pago, -1);

    v_total_pagado := v_total_pagado + NEW.valor_pagado;

    IF v_total_pagado > v_valor_obligacion THEN
        RAISE EXCEPTION 'La suma de pagos (%) superaría el valor de la obligación (%)',
            v_total_pagado, v_valor_obligacion;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_suma_pagos ON sagab.pago;
CREATE TRIGGER trg_validar_suma_pagos
    BEFORE INSERT OR UPDATE ON sagab.pago
    FOR EACH ROW EXECUTE FUNCTION sagab.fn_validar_suma_pagos();
