-- ============================================================================
-- SAGAB — 04_roles_bd.sql : Roles a nivel de PostgreSQL (defensa en profundidad)
-- La aplicación usa RBAC propio (tabla sagab.rol), pero además la conexión
-- a la BD se hace con roles de mínimo privilegio:
--   sagab_app      → rol con el que se conecta Spring Boot (sin DDL, sin DELETE en auditoría)
--   sagab_auditor  → solo lectura del esquema auditoria (para auditores externos)
--   sagab_readonly → solo lectura de sagab (reportería / BI)
-- ⚠ Cambiar las contraseñas antes de producción.
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sagab_app') THEN
        CREATE ROLE sagab_app LOGIN PASSWORD 'CAMBIAR_EN_PRODUCCION_app' CONNECTION LIMIT 60;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sagab_auditor') THEN
        CREATE ROLE sagab_auditor LOGIN PASSWORD 'CAMBIAR_EN_PRODUCCION_aud' CONNECTION LIMIT 5;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sagab_readonly') THEN
        CREATE ROLE sagab_readonly LOGIN PASSWORD 'CAMBIAR_EN_PRODUCCION_ro' CONNECTION LIMIT 10;
    END IF;
END $$;

-- ── sagab_app: CRUD sobre negocio, solo INSERT sobre auditoría ──────────
GRANT USAGE ON SCHEMA sagab, auditoria TO sagab_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sagab TO sagab_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA sagab TO sagab_app;
GRANT INSERT ON auditoria.registro_cambio, auditoria.evento_seguridad TO sagab_app;
GRANT SELECT ON auditoria.registro_cambio, auditoria.evento_seguridad, auditoria.v_historial TO sagab_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA auditoria TO sagab_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA sagab GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sagab_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA sagab GRANT USAGE ON SEQUENCES TO sagab_app;

-- ── sagab_auditor: SOLO lectura de auditoría + catálogos mínimos ────────
GRANT USAGE ON SCHEMA auditoria TO sagab_auditor;
GRANT SELECT ON ALL TABLES IN SCHEMA auditoria TO sagab_auditor;
GRANT USAGE ON SCHEMA sagab TO sagab_auditor;
GRANT SELECT ON sagab.rol, sagab.permiso, sagab.rol_permiso TO sagab_auditor;

-- ── sagab_readonly: lectura de negocio (reportes ministeriales/BI) ──────
GRANT USAGE ON SCHEMA sagab TO sagab_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA sagab TO sagab_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA sagab GRANT SELECT ON TABLES TO sagab_readonly;

-- Nadie salvo el propietario puede tocar el DDL
REVOKE CREATE ON SCHEMA sagab, auditoria FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;

-- ============================================================================
-- DATOS SEMILLA: roles y permisos de la aplicación (matriz sección 17 + AUDITOR)
-- ============================================================================
SET search_path TO sagab;

INSERT INTO sagab.rol (codigo, nombre, descripcion) VALUES
 ('ADMIN',         'Administrador',       'Acceso total: configuración, usuarios y todos los módulos'),
 ('DOCENTE',       'Docente de Aula',     'Registra calificaciones, asistencia e incidencias de sus paralelos'),
 ('REPRESENTANTE', 'Representante Legal', 'Consulta información de sus representados y mensajería limitada'),
 ('AUDITOR',       'Auditor',             'Solo lectura de la bitácora de auditoría y eventos de seguridad'),
 ('DECE',          'Consejería DECE',     'Gestión y seguimiento de incidencias disciplinarias')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO sagab.permiso (codigo, modulo, descripcion) VALUES
 ('CALIFICACION_LEER',      'ACADEMICO',  'Consultar calificaciones'),
 ('CALIFICACION_ESCRIBIR',  'ACADEMICO',  'Registrar/editar calificaciones propias'),
 ('CALIFICACION_ELIMINAR',  'ACADEMICO',  'Eliminar calificaciones'),
 ('ASISTENCIA_LEER',        'ASISTENCIA', 'Consultar asistencia'),
 ('ASISTENCIA_ESCRIBIR',    'ASISTENCIA', 'Registrar asistencia'),
 ('ASISTENCIA_ELIMINAR',    'ASISTENCIA', 'Eliminar registros de asistencia'),
 ('DISCIPLINA_LEER',        'DISCIPLINA', 'Consultar incidencias'),
 ('DISCIPLINA_ESCRIBIR',    'DISCIPLINA', 'Registrar incidencias y actas'),
 ('DISCIPLINA_ELIMINAR',    'DISCIPLINA', 'Eliminar incidencias'),
 ('FINANZAS_LEER',          'FINANCIERO', 'Consultar estados de cuenta'),
 ('FINANZAS_ESCRIBIR',      'FINANCIERO', 'Registrar pagos y rubros'),
 ('FINANZAS_ELIMINAR',      'FINANCIERO', 'Anular obligaciones/pagos'),
 ('MENSAJERIA_TOTAL',       'MENSAJERIA', 'Enviar a cualquier actor y circulares'),
 ('MENSAJERIA_LIMITADA',    'MENSAJERIA', 'Enviar/recibir con docentes y dirección'),
 ('CONFIG_TOTAL',           'CONFIG',     'Períodos, paralelos, materias, parámetros'),
 ('USUARIOS_TOTAL',         'CONFIG',     'Gestión de usuarios y roles'),
 ('AUDITORIA_LEER',         'AUDITORIA',  'Consultar bitácora de auditoría'),
 ('REPORTES_EXPORTAR',      'ACADEMICO',  'Exportar reportes PDF/Excel')
ON CONFLICT (codigo) DO NOTHING;

-- Matriz rol-permiso
INSERT INTO sagab.rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso FROM sagab.rol r JOIN sagab.permiso p ON (
    (r.codigo = 'ADMIN') OR
    (r.codigo = 'DOCENTE'       AND p.codigo IN ('CALIFICACION_LEER','CALIFICACION_ESCRIBIR',
                                                 'ASISTENCIA_LEER','ASISTENCIA_ESCRIBIR',
                                                 'DISCIPLINA_LEER','DISCIPLINA_ESCRIBIR',
                                                 'MENSAJERIA_TOTAL','REPORTES_EXPORTAR')) OR
    (r.codigo = 'REPRESENTANTE' AND p.codigo IN ('CALIFICACION_LEER','ASISTENCIA_LEER',
                                                 'DISCIPLINA_LEER','FINANZAS_LEER',
                                                 'MENSAJERIA_LIMITADA')) OR
    (r.codigo = 'AUDITOR'       AND p.codigo IN ('AUDITORIA_LEER')) OR
    (r.codigo = 'DECE'          AND p.codigo IN ('DISCIPLINA_LEER','DISCIPLINA_ESCRIBIR',
                                                 'ASISTENCIA_LEER','MENSAJERIA_TOTAL'))
)
ON CONFLICT DO NOTHING;
