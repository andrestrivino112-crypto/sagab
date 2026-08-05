-- ============================================================================
-- SAGAB — 11_fix_usernames_demo.sql
-- Repara las 3 cuentas demo que quedaron con username = NULL tras un parche
-- manual de sus contraseñas (ver INFORME_AUDITORIA.md, sección 4, hallazgo #2).
-- Sin username no pueden iniciar sesión: AuthService.login busca por username,
-- no por email (ver 09_estudiante_usuario.sql).
-- Patrón usado en todo el proyecto: primerNombre.primerApellido en minúsculas
-- sin tildes (ec.edu.bellini.sagab.utils.UsernameGenerator).
-- ============================================================================
SET search_path TO sagab;

UPDATE usuario SET username = 'carlos.perez'  WHERE email = 'docente@bellini.edu.ec'  AND username IS NULL;
UPDATE usuario SET username = 'ana.auditora'  WHERE email = 'auditor@bellini.edu.ec'  AND username IS NULL;
UPDATE usuario SET username = 'luis.morales'  WHERE email = 'padre@bellini.edu.ec'    AND username IS NULL;
