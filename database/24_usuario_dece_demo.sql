-- ============================================================================
-- SAGAB — 24_usuario_dece_demo.sql : Usuario de demostración con rol DECE
-- El trazado end-to-end de INFORME_AUDITORIA_FUNCIONAL.md confirmó que ningún usuario
-- tenía asignado el rol DECE en los datos de prueba — sin esta cuenta era imposible
-- probar el flujo de "Alertas de Asistencia" (ver DeceAlertasView.tsx) de punta a punta.
-- Mismo patrón que 07_usuario_username.sql/08_usuario_aaron.sql: hash BCrypt(12) real
-- (verificado con BCryptPasswordEncoder(12).matches); contraseña: pedir al equipo.
-- ============================================================================
SET search_path TO sagab;

INSERT INTO usuario (username, email, hash_password, nombres, apellidos, estado, debe_cambiar_clave)
VALUES ('karina.salazar', 'dece@bellini.edu.ec',
        '$2a$12$6y93WcwtwSIyhPSM713CJezG/vbiLbkSvZYeBSeX4hvEnR7tPzK16',
        'Karina', 'Salazar', 'ACTIVO', false)
ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username
WHERE usuario.username IS NULL;

INSERT INTO usuario_rol (id_usuario, id_rol)
SELECT u.id_usuario, r.id_rol FROM usuario u JOIN rol r ON
 (u.email = 'dece@bellini.edu.ec' AND r.codigo = 'DECE')
ON CONFLICT (id_usuario, id_rol) DO NOTHING;
