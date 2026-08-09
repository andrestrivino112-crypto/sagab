-- ============================================================================
-- SAGAB — 30_reparar_rol_estudiante.sql
-- Reparación idempotente de cuentas 1:1 vinculadas a sagab.estudiante.
-- No crea usuarios, no cambia contraseñas y no elimina información académica.
-- ============================================================================
SET search_path TO sagab, public;

INSERT INTO sagab.rol (codigo, nombre, descripcion) VALUES
 ('ESTUDIANTE', 'Estudiante', 'Consulta sus propias calificaciones, asistencia y mensajería (Portal Familiar)')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO sagab.rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM sagab.rol r
JOIN sagab.permiso p ON p.codigo IN ('CALIFICACION_LEER', 'ASISTENCIA_LEER', 'MENSAJERIA_LIMITADA')
WHERE r.codigo = 'ESTUDIANTE'
ON CONFLICT DO NOTHING;

-- Toda cuenta enlazada directamente desde estudiante debe tener el rol ESTUDIANTE.
INSERT INTO sagab.usuario_rol (id_usuario, id_rol)
SELECT DISTINCT e.id_usuario, r.id_rol
FROM sagab.estudiante e
JOIN sagab.rol r ON r.codigo = 'ESTUDIANTE'
WHERE e.id_usuario IS NOT NULL
ON CONFLICT DO NOTHING;

-- Versiones antiguas asignaron REPRESENTANTE a algunas cuentas propias de estudiante.
-- Se retira solo cuando la misma cuenta NO está vinculada realmente a un representante.
DELETE FROM sagab.usuario_rol ur
USING sagab.rol r
WHERE ur.id_rol = r.id_rol
  AND r.codigo = 'REPRESENTANTE'
  AND EXISTS (SELECT 1 FROM sagab.estudiante e WHERE e.id_usuario = ur.id_usuario)
  AND NOT EXISTS (SELECT 1 FROM sagab.representante rep WHERE rep.id_usuario = ur.id_usuario);
