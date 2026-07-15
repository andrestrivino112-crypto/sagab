-- ============================================================================
-- SAGAB — 07_usuario_username.sql : Nombre de usuario para inicio de sesión
-- Añade un nombre de usuario (login) independiente del correo institucional.
-- El correo (email) se conserva sin cambios, para otros usos (JWT, búsquedas
-- por email en otros módulos). Migración aditiva, no destructiva.
-- ============================================================================
SET search_path TO sagab;

ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS username VARCHAR(40) UNIQUE;

COMMENT ON COLUMN usuario.username IS 'Nombre de usuario para inicio de sesión (independiente del correo electrónico).';

-- ─────────────────────────────────────────────────────────────────────────
-- Usuarios iniciales: ANDRESHD (ADMIN) y Saida (DOCENTE)
-- Hash BCrypt(12) real, generado con BCryptPasswordEncoder(12):
--   ANDRESHD → ***REDACTED***
--   Saida    → ***REDACTED***
-- ─────────────────────────────────────────────────────────────────────────
-- Se usa ON CONFLICT (email) — no (username) — porque el email es la clave
-- única siempre poblada; si el usuario ya existía (p. ej. de una prueba
-- manual previa) solo se le completa el username, sin tocar su contraseña.
INSERT INTO usuario (username, email, hash_password, nombres, apellidos, estado, debe_cambiar_clave)
VALUES ('ANDRESHD', 'andreshd@bellini.edu.ec',
        '$2a$12$iR5aa7eoyTC9mhPyupsRu.6X/j0B6ctx3TpRohoFnrHgD71y5pkT6',
        'Andrés', 'Administrador', 'ACTIVO', false)
ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username
WHERE usuario.username IS NULL;

INSERT INTO usuario (username, email, hash_password, nombres, apellidos, estado, debe_cambiar_clave)
VALUES ('Saida', 'saida@bellini.edu.ec',
        '$2a$12$OvoeYGCG8mzUydustU/MAO4uFv7cy4VoUYbPMYlfRQVYFbnXGdAz.',
        'Saida', 'Docente', 'ACTIVO', false)
ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username
WHERE usuario.username IS NULL;

INSERT INTO usuario_rol (id_usuario, id_rol)
SELECT u.id_usuario, r.id_rol FROM usuario u JOIN rol r ON
 (u.email = 'andreshd@bellini.edu.ec' AND r.codigo = 'ADMIN') OR
 (u.email = 'saida@bellini.edu.ec'    AND r.codigo = 'DOCENTE')
ON CONFLICT (id_usuario, id_rol) DO NOTHING;

INSERT INTO docente (id_usuario)
SELECT id_usuario FROM usuario WHERE email = 'saida@bellini.edu.ec'
ON CONFLICT (id_usuario) DO NOTHING;
