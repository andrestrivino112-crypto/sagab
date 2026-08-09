-- ============================================================================
-- SAGAB — 31_super_admin_gestion_cuentas.sql
-- Rol SUPER_ADMIN, revocación de JWT por versión y cuentas iniciales.
--
-- Migración aditiva e idempotente. No modifica contraseñas, estados ni datos
-- personales de cuentas que ya hayan sido creadas por una ejecución anterior.
-- ============================================================================
\set ON_ERROR_STOP on

BEGIN;

-- Serializa ejecuciones concurrentes de esta misma migración.
SELECT pg_advisory_xact_lock(
    hashtextextended('sagab:migracion:31_super_admin_gestion_cuentas', 0)
);

SET LOCAL search_path TO pg_catalog, sagab, auditoria;

-- Fallar de forma clara antes de modificar nada si falta el esquema base.
DO $migracion$
BEGIN
    IF to_regclass('sagab.usuario') IS NULL
       OR to_regclass('sagab.rol') IS NULL
       OR to_regclass('sagab.permiso') IS NULL
       OR to_regclass('sagab.rol_permiso') IS NULL
       OR to_regclass('sagab.usuario_rol') IS NULL
       OR to_regclass('sagab.refresh_token') IS NULL
       OR to_regclass('auditoria.registro_cambio') IS NULL
       OR to_regclass('auditoria.evento_seguridad') IS NULL
       OR to_regprocedure('auditoria.fn_auditar()') IS NULL THEN
        RAISE EXCEPTION
            'No se puede aplicar la migración 31: faltan componentes del esquema base.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM sagab.rol WHERE codigo = 'ADMIN') THEN
        RAISE EXCEPTION
            'No se puede aplicar la migración 31: falta el rol administrativo base.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM sagab.rol admin
        JOIN sagab.rol_permiso rp ON rp.id_rol = admin.id_rol
        WHERE admin.codigo = 'ADMIN'
    ) THEN
        RAISE EXCEPTION
            'No se puede aplicar la migración 31: falta la matriz administrativa base.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'sagab'
          AND table_name = 'usuario'
          AND column_name = 'username'
    ) THEN
        RAISE EXCEPTION
            'No se puede aplicar la migración 31: falta una migración estructural previa.';
    END IF;
END
$migracion$;

-- Los eventos de gestión de cuentas quedan diferenciados de un UPDATE genérico.
ALTER TYPE auditoria.tipo_operacion
    ADD VALUE IF NOT EXISTS 'RESTABLECIMIENTO_CLAVE';
ALTER TYPE auditoria.tipo_operacion
    ADD VALUE IF NOT EXISTS 'CUENTA_DESHABILITADA';
ALTER TYPE auditoria.tipo_operacion
    ADD VALUE IF NOT EXISTS 'CUENTA_HABILITADA';

-- La auditoría de usuario ya ocultaba hash_password. También se elimina cedula
-- del JSON de auditoría para que nunca quede almacenada completa en el historial.
CREATE OR REPLACE FUNCTION auditoria.fn_auditar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auditoria, sagab
AS $auditoria$
DECLARE
    v_antes       JSONB;
    v_despues     JSONB;
    v_cols        TEXT[];
    v_pk          TEXT;
    v_usuario_app TEXT := current_setting('sagab.usuario_app', true);
    v_ip          TEXT := current_setting('sagab.ip_cliente', true);
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_despues := to_jsonb(NEW);
        v_pk := COALESCE(v_despues->>TG_ARGV[0], '?');
    ELSIF TG_OP = 'UPDATE' THEN
        v_antes := to_jsonb(OLD);
        v_despues := to_jsonb(NEW);
        v_pk := COALESCE(v_despues->>TG_ARGV[0], '?');

        SELECT array_agg(key)
        INTO v_cols
        FROM jsonb_each(v_antes) a
        WHERE a.value IS DISTINCT FROM (v_despues->a.key);

        IF v_cols IS NULL THEN
            RETURN NEW;
        END IF;
    ELSE
        v_antes := to_jsonb(OLD);
        v_pk := COALESCE(v_antes->>TG_ARGV[0], '?');
    END IF;

    v_antes := v_antes - 'hash_password' - 'cedula';
    v_despues := v_despues - 'hash_password' - 'cedula';

    INSERT INTO auditoria.registro_cambio
        (esquema, tabla, id_fila, operacion, datos_antes, datos_despues,
         columnas_modificadas, usuario_app, ip_cliente)
    VALUES
        (TG_TABLE_SCHEMA, TG_TABLE_NAME, v_pk,
         TG_OP::auditoria.tipo_operacion, v_antes, v_despues, v_cols,
         NULLIF(v_usuario_app, ''), NULLIF(v_ip, '')::INET);

    RETURN COALESCE(NEW, OLD);
END
$auditoria$;

-- Versión de autenticación incluida en cada JWT. Incrementarla invalida todos
-- los tokens emitidos con una versión anterior.
ALTER TABLE sagab.usuario
    ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0;

-- Repara de forma segura una posible aplicación parcial de la migración.
UPDATE sagab.usuario
SET auth_version = 0
WHERE auth_version IS NULL;

ALTER TABLE sagab.usuario
    ALTER COLUMN auth_version SET DEFAULT 0,
    ALTER COLUMN auth_version SET NOT NULL;

DO $restriccion$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM sagab.usuario
        WHERE auth_version < 0
    ) THEN
        RAISE EXCEPTION
            'No se puede aplicar la migración 31: existe una versión de autenticación inválida.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'sagab.usuario'::regclass
          AND conname = 'ck_usuario_auth_version_no_negativa'
    ) THEN
        ALTER TABLE sagab.usuario
            ADD CONSTRAINT ck_usuario_auth_version_no_negativa
            CHECK (auth_version >= 0);
    END IF;
END
$restriccion$;

COMMENT ON COLUMN sagab.usuario.auth_version IS
    'Versión de seguridad del usuario. Todo cambio invalidador de sesiones la incrementa.';

-- Normalización determinista para búsquedas parciales sin depender de una
-- extensión o de permisos sobre el esquema public. lower() resuelve mayúsculas
-- y translate() elimina los diacríticos habituales en nombres en español.
CREATE OR REPLACE FUNCTION sagab.fn_normalizar_busqueda(valor TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
RETURNS NULL ON NULL INPUT
SET search_path = pg_catalog
AS $normalizar$
    SELECT translate(
        lower(valor),
        'áàäâãåéèëêíìïîóòöôõúùüûñç',
        'aaaaaaeeeeiiiiooooouuuunc'
    )
$normalizar$;

COMMENT ON FUNCTION sagab.fn_normalizar_busqueda(TEXT) IS
    'Normaliza texto para búsquedas de usuarios sin distinguir mayúsculas ni diacríticos comunes.';

-- Rol aplicativo real. Un código existente con otra identidad es un conflicto,
-- no una cuenta de la que esta migración pueda apropiarse.
DO $rol_super_admin$
DECLARE
    v_nombre sagab.rol.nombre%TYPE;
BEGIN
    SELECT nombre
    INTO v_nombre
    FROM sagab.rol
    WHERE codigo = 'SUPER_ADMIN';

    IF FOUND AND v_nombre IS DISTINCT FROM 'Superadministrador' THEN
        RAISE EXCEPTION
            'Conflicto al crear el rol SUPER_ADMIN. Revise el catálogo de roles.';
    END IF;

    IF NOT FOUND THEN
        INSERT INTO sagab.rol (codigo, nombre, descripcion)
        VALUES (
            'SUPER_ADMIN',
            'Superadministrador',
            'Funciones de Secretaría y gestión exclusiva de cuentas del sistema'
        );
    END IF;
END
$rol_super_admin$;

-- SUPER_ADMIN hereda exactamente la matriz vigente de ADMIN. Las restricciones
-- exclusivas del módulo de cuentas se aplican además en Spring Security.
INSERT INTO sagab.rol_permiso (id_rol, id_permiso)
SELECT super.id_rol, rp.id_permiso
FROM sagab.rol super
JOIN sagab.rol admin ON admin.codigo = 'ADMIN'
JOIN sagab.rol_permiso rp ON rp.id_rol = admin.id_rol
WHERE super.codigo = 'SUPER_ADMIN'
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

-- No se eliminan permisos silenciosamente. Si el código ya existía con una
-- matriz distinta, se trata como conflicto y la transacción completa se revierte.
DO $matriz_super_admin$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM sagab.permiso p
        CROSS JOIN sagab.rol admin
        CROSS JOIN sagab.rol super
        LEFT JOIN sagab.rol_permiso permiso_admin
          ON permiso_admin.id_rol = admin.id_rol
         AND permiso_admin.id_permiso = p.id_permiso
        LEFT JOIN sagab.rol_permiso permiso_super
          ON permiso_super.id_rol = super.id_rol
         AND permiso_super.id_permiso = p.id_permiso
        WHERE admin.codigo = 'ADMIN'
          AND super.codigo = 'SUPER_ADMIN'
          AND (permiso_admin.id_permiso IS NULL)
              IS DISTINCT FROM (permiso_super.id_permiso IS NULL)
    ) THEN
        RAISE EXCEPTION
            'Conflicto en la matriz del rol SUPER_ADMIN. Revise el catálogo de permisos.';
    END IF;
END
$matriz_super_admin$;

-- Cuentas iniciales. Los únicos secretos persistidos aquí son hashes BCrypt(12)
-- ya generados; nunca se almacena la contraseña temporal en texto plano.
--
-- Ante cualquier colisión de username/email o rol adicional se aborta toda la
-- migración con un mensaje genérico, sin sobrescribir ni eliminar información.
DO $cuentas_iniciales$
DECLARE
    v_rol_id       sagab.rol.id_rol%TYPE;
    v_usuario_id   sagab.usuario.id_usuario%TYPE;
    v_coincidencias INTEGER;
    v_existente    sagab.usuario%ROWTYPE;
    v_seed         RECORD;
BEGIN
    SELECT id_rol
    INTO STRICT v_rol_id
    FROM sagab.rol
    WHERE codigo = 'SUPER_ADMIN';

    FOR v_seed IN
        SELECT *
        FROM (VALUES
            (
                'triviño'::VARCHAR(40),
                'trivino.superadmin@bellini.edu.ec'::VARCHAR(120),
                'Superadministrador'::VARCHAR(80),
                'Triviño'::VARCHAR(80),
                '$2y$12$buFQn5mDzx2s8ZTx/ziMbeTyHqziZla9Wl7.mO838O//3DiPRkF6S'::VARCHAR(100)
            ),
            (
                'rea'::VARCHAR(40),
                'rea.superadmin@bellini.edu.ec'::VARCHAR(120),
                'Superadministrador'::VARCHAR(80),
                'Rea'::VARCHAR(80),
                '$2y$12$8N7AHG7GJfWsh9SgPX5BROOUru935yAd5fon2cgBYjPh9AcB7CSL.'::VARCHAR(100)
            )
        ) AS semillas(username, email, nombres, apellidos, hash_password)
    LOOP
        SELECT count(*), min(id_usuario)
        INTO v_coincidencias, v_usuario_id
        FROM sagab.usuario
        WHERE username = v_seed.username
           OR email = v_seed.email;

        IF v_coincidencias > 1 THEN
            RAISE EXCEPTION
                'Conflicto al crear una cuenta inicial SUPER_ADMIN. Revise las cuentas existentes.';
        ELSIF v_coincidencias = 1 THEN
            SELECT *
            INTO STRICT v_existente
            FROM sagab.usuario
            WHERE id_usuario = v_usuario_id;

            IF v_existente.username IS DISTINCT FROM v_seed.username
               OR v_existente.email IS DISTINCT FROM v_seed.email
               OR v_existente.nombres IS DISTINCT FROM v_seed.nombres
               OR v_existente.apellidos IS DISTINCT FROM v_seed.apellidos THEN
                RAISE EXCEPTION
                    'Conflicto al crear una cuenta inicial SUPER_ADMIN. Revise las cuentas existentes.';
            END IF;
        ELSE
            INSERT INTO sagab.usuario
                (username, email, hash_password, nombres, apellidos, cedula,
                 estado, intentos_fallidos, bloqueado_hasta,
                 debe_cambiar_clave, auth_version)
            VALUES
                (v_seed.username, v_seed.email, v_seed.hash_password,
                 v_seed.nombres, v_seed.apellidos, NULL,
                 'ACTIVO', 0, NULL, true, 0)
            RETURNING id_usuario INTO v_usuario_id;
        END IF;

        IF EXISTS (
            SELECT 1
            FROM sagab.usuario_rol ur
            JOIN sagab.rol r ON r.id_rol = ur.id_rol
            WHERE ur.id_usuario = v_usuario_id
              AND r.codigo <> 'SUPER_ADMIN'
        ) THEN
            RAISE EXCEPTION
                'Conflicto de roles en una cuenta inicial SUPER_ADMIN. Revise las cuentas existentes.';
        END IF;

        INSERT INTO sagab.usuario_rol (id_usuario, id_rol)
        VALUES (v_usuario_id, v_rol_id)
        ON CONFLICT (id_usuario, id_rol) DO NOTHING;
    END LOOP;
END
$cuentas_iniciales$;

COMMIT;
