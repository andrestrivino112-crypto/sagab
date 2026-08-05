-- ============================================================================
-- SAGAB — 16_pagos_transferencia.sql
-- Extiende sagab.pago para soportar pagos por transferencia bancaria con
-- comprobante adjunto y flujo de revisión manual (a diferencia del efectivo,
-- que un ADMIN registra y da por aprobado en el acto).
-- ============================================================================
SET search_path TO sagab;

CREATE TYPE sagab.estado_revision_pago AS ENUM ('EN_REVISION', 'APROBADO', 'RECHAZADO');

ALTER TABLE sagab.pago
    ADD COLUMN banco_origen                 VARCHAR(60),
    ADD COLUMN numero_referencia            VARCHAR(50),
    ADD COLUMN comprobante_url              VARCHAR(500),
    ADD COLUMN comprobante_nombre_original  VARCHAR(255),
    ADD COLUMN comprobante_mime_type        VARCHAR(100),
    ADD COLUMN comprobante_tamano_bytes     BIGINT,
    -- SHA-256 en hex del contenido del archivo — detecta comprobantes duplicados
    -- (la misma imagen subida dos veces para la misma obligación).
    ADD COLUMN comprobante_hash             VARCHAR(64),
    -- Efectivo/cheque/tarjeta no requieren revisión manual: nacen APROBADO.
    -- Una transferencia nace EN_REVISION hasta que un ADMIN la aprueba o rechaza.
    ADD COLUMN estado_revision              sagab.estado_revision_pago NOT NULL DEFAULT 'APROBADO',
    ADD COLUMN revisado_por                 BIGINT REFERENCES sagab.usuario(id_usuario),
    ADD COLUMN fecha_revision                TIMESTAMPTZ,
    ADD COLUMN observaciones_admin          VARCHAR(500);

ALTER TABLE sagab.pago
    ADD CONSTRAINT chk_pago_transferencia_comprobante
    CHECK (metodo <> 'TRANSFERENCIA' OR comprobante_url IS NOT NULL);

-- Cola de revisión del admin: solo lo que está EN_REVISION.
CREATE INDEX idx_pago_en_revision ON sagab.pago (fecha_pago) WHERE estado_revision = 'EN_REVISION';
-- Detección de comprobante duplicado dentro de la misma obligación.
CREATE INDEX idx_pago_comprobante_hash ON sagab.pago (id_obligacion, comprobante_hash) WHERE comprobante_hash IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- Redefine la validación de sobrepago (ver 12_indice_check_pagos.sql) para que
-- solo sume pagos ya APROBADOS: una transferencia EN_REVISION todavía no es
-- dinero confirmado, así que no debe bloquear otros pagos ni contar para el
-- total hasta que el admin la apruebe explícitamente (ese es el momento en
-- que este mismo trigger la valida, porque el UPDATE que aprueba dispara
-- BEFORE UPDATE otra vez).
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sagab.fn_validar_suma_pagos() RETURNS TRIGGER AS $$
DECLARE
    v_valor_obligacion NUMERIC(8,2);
    v_total_aprobado   NUMERIC(8,2);
BEGIN
    IF NEW.estado_revision = 'APROBADO' THEN
        SELECT valor INTO v_valor_obligacion
        FROM sagab.obligacion_pago WHERE id_obligacion = NEW.id_obligacion;

        SELECT COALESCE(SUM(valor_pagado), 0) INTO v_total_aprobado
        FROM sagab.pago
        WHERE id_obligacion = NEW.id_obligacion
          AND estado_revision = 'APROBADO'
          AND id_pago <> COALESCE(NEW.id_pago, -1);

        v_total_aprobado := v_total_aprobado + NEW.valor_pagado;

        IF v_total_aprobado > v_valor_obligacion THEN
            RAISE EXCEPTION 'La suma de pagos aprobados (%) superaría el valor de la obligación (%)',
                v_total_aprobado, v_valor_obligacion;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
