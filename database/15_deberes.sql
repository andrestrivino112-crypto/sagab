-- ============================================================================
-- SAGAB — 15_deberes.sql
-- Módulo de subida de tareas/deberes. El docente crea una tarea para una
-- asignación (materia+paralelo+período); al crearla se genera una fila
-- PENDIENTE por cada estudiante activo del paralelo, que pasa a ENTREGADO
-- cuando el estudiante (o su representante) sube el archivo, y a REVISADO
-- cuando el docente la califica/comenta.
-- ============================================================================
SET search_path TO sagab;

CREATE TYPE sagab.estado_entrega AS ENUM ('PENDIENTE', 'ENTREGADO', 'REVISADO');

CREATE TABLE sagab.tarea (
    id_tarea        BIGSERIAL PRIMARY KEY,
    id_asignacion   BIGINT NOT NULL REFERENCES sagab.asignacion_docente(id_asignacion),
    titulo          VARCHAR(150) NOT NULL,
    descripcion     VARCHAR(1000),
    fecha_limite    TIMESTAMPTZ NOT NULL,
    creado_por      BIGINT NOT NULL REFERENCES sagab.usuario(id_usuario),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tarea_asignacion ON sagab.tarea (id_asignacion);

CREATE TABLE sagab.entrega_tarea (
    id_entrega                 BIGSERIAL PRIMARY KEY,
    id_tarea                   BIGINT NOT NULL REFERENCES sagab.tarea(id_tarea),
    id_estudiante               BIGINT NOT NULL REFERENCES sagab.estudiante(id_estudiante),
    estado                      sagab.estado_entrega NOT NULL DEFAULT 'PENDIENTE',
    archivo_url                 VARCHAR(500),
    archivo_nombre_original     VARCHAR(255),
    archivo_mime_type           VARCHAR(100),
    archivo_tamano_bytes        BIGINT,
    fecha_entrega               TIMESTAMPTZ,
    observacion_docente         VARCHAR(500),
    revisado_por                BIGINT REFERENCES sagab.usuario(id_usuario),
    fecha_revision               TIMESTAMPTZ,
    UNIQUE (id_tarea, id_estudiante)
);

CREATE INDEX idx_entrega_estudiante ON sagab.entrega_tarea (id_estudiante);
CREATE INDEX idx_entrega_estado ON sagab.entrega_tarea (id_tarea, estado);

DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT * FROM (VALUES
        ('tarea',          'id_tarea'),
        ('entrega_tarea',  'id_entrega')
    ) AS t(tabla, pk)
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_' || r.tabla) THEN
            EXECUTE format(
                'CREATE TRIGGER trg_audit_%s
                 AFTER INSERT OR UPDATE OR DELETE ON sagab.%I
                 FOR EACH ROW EXECUTE FUNCTION auditoria.fn_auditar(%L)',
                r.tabla, r.tabla, r.pk);
        END IF;
    END LOOP;
END $$;
