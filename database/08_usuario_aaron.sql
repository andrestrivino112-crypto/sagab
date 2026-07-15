-- ============================================================================
-- SAGAB — 08_usuario_aaron.sql : Usuario representante de prueba "Aaron"
-- Cuenta REPRESENTANTE (Portal Familiar), sin estudiante vinculado todavía —
-- se matricula un estudiante real desde el flujo de Matrícula existente y el
-- Portal Familiar se pobla solo, sin tocar código.
-- ============================================================================
SET search_path TO sagab;

-- Hash BCrypt(12) real de '***REDACTED***' (verificado con BCryptPasswordEncoder(12).matches).
INSERT INTO usuario (username, email, hash_password, nombres, apellidos, estado, debe_cambiar_clave)
VALUES ('Aaron', 'aaron@bellini.edu.ec',
        '$2a$12$hpIxt4lmRZEJPxc5ppJT8ehlVEx568OysFFCqDBQpAIZTpdZGSKoG',
        'Aaron', 'Representante', 'ACTIVO', false)
ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username
WHERE usuario.username IS NULL;

INSERT INTO usuario_rol (id_usuario, id_rol)
SELECT u.id_usuario, r.id_rol FROM usuario u JOIN rol r ON
 (u.email = 'aaron@bellini.edu.ec' AND r.codigo = 'REPRESENTANTE')
ON CONFLICT (id_usuario, id_rol) DO NOTHING;

INSERT INTO representante (id_usuario)
SELECT id_usuario FROM usuario WHERE email = 'aaron@bellini.edu.ec'
ON CONFLICT (id_usuario) DO NOTHING;
