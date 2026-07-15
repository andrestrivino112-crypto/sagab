-- ============================================================================
-- SAGAB — Sistema Avanzado de Gestión Académica Bellini
-- 01_schema.sql : Esquema principal (PostgreSQL 15+)
-- Ejecutar como superusuario o propietario de la BD "sagab"
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS sagab;      -- datos de negocio
CREATE SCHEMA IF NOT EXISTS auditoria;  -- registros de auditoría (solo INSERT)

SET search_path TO sagab, public;

-- ─────────────────────────────────────────────────────────────────────────
-- TIPOS ENUMERADOS
-- ─────────────────────────────────────────────────────────────────────────
CREATE TYPE sagab.estado_asistencia   AS ENUM ('PRESENTE','AUSENCIA_JUSTIFICADA','AUSENCIA_INJUSTIFICADA','ATRASO');
CREATE TYPE sagab.gravedad_falta      AS ENUM ('LEVE','GRAVE','MUY_GRAVE');
CREATE TYPE sagab.estado_incidencia   AS ENUM ('REGISTRADA','EN_SEGUIMIENTO','RESUELTA','ESCALADA_DECE');
CREATE TYPE sagab.estado_pago         AS ENUM ('PENDIENTE','PAGADO','VENCIDO','ANULADO');
CREATE TYPE sagab.tipo_rubro          AS ENUM ('MATRICULA','PENSION','EXTRACURRICULAR','OTRO');
CREATE TYPE sagab.estado_usuario      AS ENUM ('ACTIVO','INACTIVO','BLOQUEADO');
CREATE TYPE auditoria.tipo_operacion  AS ENUM ('INSERT','UPDATE','DELETE','LOGIN','LOGIN_FALLIDO','LOGOUT','ACCESO_DENEGADO','EXPORTACION');

-- ─────────────────────────────────────────────────────────────────────────
-- SEGURIDAD: USUARIOS, ROLES Y PERMISOS (RBAC)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE sagab.rol (
    id_rol          SMALLSERIAL PRIMARY KEY,
    codigo          VARCHAR(30)  NOT NULL UNIQUE,          -- ADMIN, DOCENTE, REPRESENTANTE, AUDITOR, DECE
    nombre          VARCHAR(60)  NOT NULL,
    descripcion     TEXT,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON TABLE sagab.rol IS 'Roles del sistema (RBAC). El rol AUDITOR tiene acceso de solo lectura al esquema auditoria.';

CREATE TABLE sagab.permiso (
    id_permiso      SERIAL PRIMARY KEY,
    codigo          VARCHAR(60) NOT NULL UNIQUE,           -- p.ej. CALIFICACION_ESCRIBIR
    modulo          VARCHAR(40) NOT NULL,                  -- ACADEMICO, ASISTENCIA, DISCIPLINA, FINANCIERO, MENSAJERIA, CONFIG, AUDITORIA
    descripcion     TEXT
);

CREATE TABLE sagab.rol_permiso (
    id_rol          SMALLINT NOT NULL REFERENCES sagab.rol(id_rol)         ON DELETE CASCADE,
    id_permiso      INT      NOT NULL REFERENCES sagab.permiso(id_permiso) ON DELETE CASCADE,
    PRIMARY KEY (id_rol, id_permiso)
);

CREATE TABLE sagab.usuario (
    id_usuario          BIGSERIAL PRIMARY KEY,
    uuid                UUID         NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    email               VARCHAR(120) NOT NULL UNIQUE CHECK (email = lower(email)),
    hash_password       VARCHAR(100) NOT NULL,             -- BCrypt (nunca texto plano)
    nombres             VARCHAR(80)  NOT NULL,
    apellidos           VARCHAR(80)  NOT NULL,
    cedula              VARCHAR(10)  UNIQUE,
    telefono            VARCHAR(15),
    estado              sagab.estado_usuario NOT NULL DEFAULT 'ACTIVO',
    intentos_fallidos   SMALLINT     NOT NULL DEFAULT 0,
    bloqueado_hasta     TIMESTAMPTZ,
    ultimo_acceso       TIMESTAMPTZ,
    debe_cambiar_clave  BOOLEAN      NOT NULL DEFAULT true,
    creado_en           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON COLUMN sagab.usuario.hash_password IS 'Hash BCrypt fuerza 12. Cumple RNF-03 y LOPDP.';

CREATE TABLE sagab.usuario_rol (
    id_usuario  BIGINT   NOT NULL REFERENCES sagab.usuario(id_usuario) ON DELETE CASCADE,
    id_rol      SMALLINT NOT NULL REFERENCES sagab.rol(id_rol),
    asignado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    asignado_por BIGINT REFERENCES sagab.usuario(id_usuario),
    PRIMARY KEY (id_usuario, id_rol)
);

CREATE TABLE sagab.refresh_token (
    id_token    BIGSERIAL PRIMARY KEY,
    id_usuario  BIGINT      NOT NULL REFERENCES sagab.usuario(id_usuario) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,               -- SHA-256 del token, nunca el token en claro
    expira_en   TIMESTAMPTZ NOT NULL,
    revocado    BOOLEAN     NOT NULL DEFAULT false,
    ip_origen   INET,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- ESTRUCTURA ACADÉMICA
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE sagab.periodo_academico (
    id_periodo      SERIAL PRIMARY KEY,
    nombre          VARCHAR(60) NOT NULL,                  -- "Quimestre I 2025-2026"
    anio_lectivo    VARCHAR(9)  NOT NULL,                  -- "2025-2026"
    fecha_inicio    DATE NOT NULL,
    fecha_fin       DATE NOT NULL,
    activo          BOOLEAN NOT NULL DEFAULT false,
    CHECK (fecha_fin > fecha_inicio),
    UNIQUE (nombre, anio_lectivo)
);

CREATE TABLE sagab.paralelo (
    id_paralelo     SERIAL PRIMARY KEY,
    nivel           VARCHAR(30) NOT NULL,                  -- "1° EGB" … "3° BGU"
    seccion         VARCHAR(1)  NOT NULL,                  -- A, B, C
    anio_lectivo    VARCHAR(9)  NOT NULL,
    aforo_maximo    SMALLINT    NOT NULL DEFAULT 35 CHECK (aforo_maximo BETWEEN 1 AND 45),
    UNIQUE (nivel, seccion, anio_lectivo)
);

CREATE TABLE sagab.materia (
    id_materia      SERIAL PRIMARY KEY,
    codigo          VARCHAR(15) NOT NULL UNIQUE,
    nombre          VARCHAR(80) NOT NULL,
    area            VARCHAR(60)
);

CREATE TABLE sagab.docente (
    id_docente      BIGSERIAL PRIMARY KEY,
    id_usuario      BIGINT NOT NULL UNIQUE REFERENCES sagab.usuario(id_usuario),
    titulo          VARCHAR(80),
    fecha_ingreso   DATE
);

CREATE TABLE sagab.representante (
    id_representante BIGSERIAL PRIMARY KEY,
    id_usuario       BIGINT NOT NULL UNIQUE REFERENCES sagab.usuario(id_usuario),
    parentesco       VARCHAR(30) NOT NULL DEFAULT 'PADRE/MADRE',
    direccion        VARCHAR(150)
);

CREATE TABLE sagab.estudiante (
    id_estudiante    BIGSERIAL PRIMARY KEY,
    codigo           VARCHAR(15) NOT NULL UNIQUE,          -- código institucional
    cedula           VARCHAR(10) UNIQUE,
    nombres          VARCHAR(80) NOT NULL,
    apellidos        VARCHAR(80) NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    genero           VARCHAR(1) CHECK (genero IN ('M','F','O')),
    id_paralelo      INT REFERENCES sagab.paralelo(id_paralelo),
    id_representante BIGINT REFERENCES sagab.representante(id_representante),
    activo           BOOLEAN NOT NULL DEFAULT true,
    creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE sagab.estudiante IS 'Datos de menores de edad — protegidos por LOPDP. Acceso restringido por rol.';

CREATE TABLE sagab.asignacion_docente (
    id_asignacion   BIGSERIAL PRIMARY KEY,
    id_docente      BIGINT NOT NULL REFERENCES sagab.docente(id_docente),
    id_materia      INT    NOT NULL REFERENCES sagab.materia(id_materia),
    id_paralelo     INT    NOT NULL REFERENCES sagab.paralelo(id_paralelo),
    id_periodo      INT    NOT NULL REFERENCES sagab.periodo_academico(id_periodo),
    UNIQUE (id_materia, id_paralelo, id_periodo)           -- una materia-paralelo tiene un solo docente por período
);

-- ─────────────────────────────────────────────────────────────────────────
-- MÓDULO ACADÉMICO (CALIFICACIONES)
-- Ponderación LOEI: tarea 20% + clase 20% + examen 60%; aprobación >= 7/10
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE sagab.calificacion (
    id_calificacion BIGSERIAL PRIMARY KEY,
    id_estudiante   BIGINT NOT NULL REFERENCES sagab.estudiante(id_estudiante),
    id_asignacion   BIGINT NOT NULL REFERENCES sagab.asignacion_docente(id_asignacion),
    parcial         SMALLINT NOT NULL CHECK (parcial BETWEEN 1 AND 3),
    nota_tarea      NUMERIC(4,2) CHECK (nota_tarea  BETWEEN 1 AND 10),
    nota_clase      NUMERIC(4,2) CHECK (nota_clase  BETWEEN 1 AND 10),
    nota_examen     NUMERIC(4,2) CHECK (nota_examen BETWEEN 1 AND 10),
    promedio        NUMERIC(4,2) GENERATED ALWAYS AS
                    (ROUND(nota_tarea*0.20 + nota_clase*0.20 + nota_examen*0.60, 2)) STORED,
    observacion     VARCHAR(250),
    registrado_por  BIGINT NOT NULL REFERENCES sagab.usuario(id_usuario),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id_estudiante, id_asignacion, parcial)
);

-- ─────────────────────────────────────────────────────────────────────────
-- MÓDULO DE ASISTENCIA
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE sagab.asistencia (
    id_asistencia   BIGSERIAL PRIMARY KEY,
    id_estudiante   BIGINT NOT NULL REFERENCES sagab.estudiante(id_estudiante),
    id_paralelo     INT    NOT NULL REFERENCES sagab.paralelo(id_paralelo),
    fecha           DATE   NOT NULL DEFAULT CURRENT_DATE,
    estado          sagab.estado_asistencia NOT NULL DEFAULT 'PRESENTE',
    justificacion   VARCHAR(300),
    documento_url   VARCHAR(255),                          -- certificado médico cargado por representante
    registrado_por  BIGINT NOT NULL REFERENCES sagab.usuario(id_usuario),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id_estudiante, fecha)
);

-- ─────────────────────────────────────────────────────────────────────────
-- MÓDULO DISCIPLINARIO
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE sagab.incidencia_disciplinaria (
    id_incidencia   BIGSERIAL PRIMARY KEY,
    id_estudiante   BIGINT NOT NULL REFERENCES sagab.estudiante(id_estudiante),
    gravedad        sagab.gravedad_falta NOT NULL,
    estado          sagab.estado_incidencia NOT NULL DEFAULT 'REGISTRADA',
    descripcion     TEXT NOT NULL,
    fecha_incidente DATE NOT NULL DEFAULT CURRENT_DATE,
    acta_url        VARCHAR(255),                          -- PDF del acta de compromiso
    firmada_por_representante BOOLEAN NOT NULL DEFAULT false,
    registrado_por  BIGINT NOT NULL REFERENCES sagab.usuario(id_usuario),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- MÓDULO FINANCIERO
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE sagab.rubro (
    id_rubro        SERIAL PRIMARY KEY,
    tipo            sagab.tipo_rubro NOT NULL,
    nombre          VARCHAR(80) NOT NULL,
    valor           NUMERIC(8,2) NOT NULL CHECK (valor >= 0),
    anio_lectivo    VARCHAR(9) NOT NULL
);

CREATE TABLE sagab.obligacion_pago (
    id_obligacion   BIGSERIAL PRIMARY KEY,
    id_estudiante   BIGINT NOT NULL REFERENCES sagab.estudiante(id_estudiante),
    id_rubro        INT    NOT NULL REFERENCES sagab.rubro(id_rubro),
    mes             DATE   NOT NULL,                       -- primer día del mes (para pensiones)
    valor           NUMERIC(8,2) NOT NULL CHECK (valor >= 0),
    fecha_vencimiento DATE NOT NULL,
    estado          sagab.estado_pago NOT NULL DEFAULT 'PENDIENTE',
    UNIQUE (id_estudiante, id_rubro, mes)
);

CREATE TABLE sagab.pago (
    id_pago         BIGSERIAL PRIMARY KEY,
    id_obligacion   BIGINT NOT NULL REFERENCES sagab.obligacion_pago(id_obligacion),
    valor_pagado    NUMERIC(8,2) NOT NULL CHECK (valor_pagado > 0),
    metodo          VARCHAR(30) NOT NULL DEFAULT 'EFECTIVO',
    numero_recibo   VARCHAR(20) NOT NULL UNIQUE,
    recibo_url      VARCHAR(255),
    registrado_por  BIGINT NOT NULL REFERENCES sagab.usuario(id_usuario),
    fecha_pago      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- MENSAJERÍA INTERNA (con confirmación de lectura, RF-09)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE sagab.mensaje (
    id_mensaje      BIGSERIAL PRIMARY KEY,
    id_remitente    BIGINT NOT NULL REFERENCES sagab.usuario(id_usuario),
    asunto          VARCHAR(150) NOT NULL,
    cuerpo          TEXT NOT NULL,
    es_circular     BOOLEAN NOT NULL DEFAULT false,
    enviado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sagab.mensaje_destinatario (
    id_mensaje      BIGINT NOT NULL REFERENCES sagab.mensaje(id_mensaje) ON DELETE CASCADE,
    id_destinatario BIGINT NOT NULL REFERENCES sagab.usuario(id_usuario),
    leido_en        TIMESTAMPTZ,                           -- NULL = no leído (trazabilidad)
    PRIMARY KEY (id_mensaje, id_destinatario)
);

-- ─────────────────────────────────────────────────────────────────────────
-- Trigger genérico para mantener actualizado_en
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sagab.fn_touch_actualizado()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['usuario','estudiante','calificacion','asistencia','incidencia_disciplinaria']
    LOOP
        EXECUTE format('CREATE TRIGGER trg_touch_%s BEFORE UPDATE ON sagab.%I
                        FOR EACH ROW EXECUTE FUNCTION sagab.fn_touch_actualizado()', t, t);
    END LOOP;
END $$;
