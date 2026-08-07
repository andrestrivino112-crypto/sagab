-- ============================================================================
-- SAGAB — 05_datos_prueba.sql : Datos de desarrollo (NO ejecutar en producción)
-- Contraseña de todos los usuarios demo: pedir al equipo (no se documenta en el repo).
-- El hash BCrypt(12) de abajo es real y funcional (verificado con
-- BCryptPasswordEncoder(12).matches) — a diferencia de versiones anteriores de
-- este script, que traían un placeholder inválido y dejaban estas cuentas sin
-- poder iniciar sesión.
-- ============================================================================
SET search_path TO sagab;

-- Período y estructura
INSERT INTO periodo_academico (nombre, anio_lectivo, fecha_inicio, fecha_fin, activo)
VALUES ('Quimestre I 2026-2027', '2026-2027', '2026-09-01', '2027-01-31', true);

INSERT INTO paralelo (nivel, seccion, anio_lectivo) VALUES
 ('1° BGU','A','2026-2027'), ('1° BGU','B','2026-2027'),
 ('2° BGU','A','2026-2027'), ('2° BGU','B','2026-2027'),
 ('3° BGU','A','2026-2027'), ('3° BGU','B','2026-2027');

INSERT INTO materia (codigo, nombre, area) VALUES
 ('MAT','Matemáticas','Ciencias Exactas'),
 ('LEN','Lengua y Literatura','Lengua'),
 ('CCNN','Ciencias Naturales','Ciencias'),
 ('HIS','Historia','Sociales'),
 ('ING','Inglés','Idiomas');

-- Usuarios demo. username incluido a propósito: AuthService.login busca por username, no por
-- email — sin esta columna estas cuentas quedan creadas pero no pueden iniciar sesión (ver
-- INFORME_AUDITORIA.md, hallazgo "Cuentas demo rotas").
INSERT INTO usuario (email, username, hash_password, nombres, apellidos, debe_cambiar_clave) VALUES
 ('direccion@bellini.edu.ec', 'direccion',   '$2a$12$BenMdYCCcM3K4er2X7seaumSUE4LlKKmXqZvLUrbKou07/WzFP.rG', 'María', 'Rectora Bellini', false),
 ('docente@bellini.edu.ec',   'carlos.perez','$2a$12$BenMdYCCcM3K4er2X7seaumSUE4LlKKmXqZvLUrbKou07/WzFP.rG', 'Carlos', 'Pérez Docente', false),
 ('auditor@bellini.edu.ec',   'ana.auditora','$2a$12$BenMdYCCcM3K4er2X7seaumSUE4LlKKmXqZvLUrbKou07/WzFP.rG', 'Ana', 'Auditora Externa', false),
 ('padre@bellini.edu.ec',     'luis.morales','$2a$12$BenMdYCCcM3K4er2X7seaumSUE4LlKKmXqZvLUrbKou07/WzFP.rG', 'Luis', 'Morales Representante', false);

INSERT INTO usuario_rol (id_usuario, id_rol)
SELECT u.id_usuario, r.id_rol FROM usuario u JOIN rol r ON
 (u.email='direccion@bellini.edu.ec' AND r.codigo='ADMIN') OR
 (u.email='docente@bellini.edu.ec'   AND r.codigo='DOCENTE') OR
 (u.email='auditor@bellini.edu.ec'   AND r.codigo='AUDITOR') OR
 (u.email='padre@bellini.edu.ec'     AND r.codigo='REPRESENTANTE');

INSERT INTO docente (id_usuario) SELECT id_usuario FROM usuario WHERE email='docente@bellini.edu.ec';
INSERT INTO representante (id_usuario) SELECT id_usuario FROM usuario WHERE email='padre@bellini.edu.ec';

-- Estudiantes de ejemplo en 2° BGU A
INSERT INTO estudiante (codigo, nombres, apellidos, fecha_nacimiento, genero, id_paralelo, id_representante)
SELECT 'EST-' || lpad(g::text, 4, '0'),
       (ARRAY['Alejandra','Bryan','Carolina','Diego','Elena','Fernando','Gabriela','Héctor','Isabel','José'])[g],
       (ARRAY['Morales Vega','Castillo Reyes','Fuentes Díaz','Hernández Ruiz','Pacheco Torres','Salazar Lima','Quispe Mamani','Villanueva Cruz','Coronado Peña','Maldonado Ortiz'])[g],
       DATE '2010-01-01' + (g * 30),
       CASE WHEN g % 2 = 0 THEN 'M' ELSE 'F' END,
       (SELECT id_paralelo FROM paralelo WHERE nivel='2° BGU' AND seccion='A'),
       (SELECT id_representante FROM representante LIMIT 1)
FROM generate_series(1, 10) g;

-- Asignación: docente demo dicta Matemáticas en 2° BGU A
INSERT INTO asignacion_docente (id_docente, id_materia, id_paralelo, id_periodo)
SELECT d.id_docente, m.id_materia, p.id_paralelo, pe.id_periodo
FROM docente d, materia m, paralelo p, periodo_academico pe
WHERE m.codigo='MAT' AND p.nivel='2° BGU' AND p.seccion='A' AND pe.activo
LIMIT 1;

-- Rubro de pensión y obligaciones del año
INSERT INTO rubro (tipo, nombre, valor, anio_lectivo) VALUES ('PENSION', 'Pensión mensual', 180.00, '2026-2027');

INSERT INTO obligacion_pago (id_estudiante, id_rubro, mes, valor, fecha_vencimiento, estado)
SELECT e.id_estudiante, r.id_rubro,
       make_date(2026, m, 1), r.valor, make_date(2026, m, 10),
       CASE WHEN m < 7 THEN 'PAGADO'::estado_pago
            WHEN m = 7 THEN 'VENCIDO'::estado_pago
            ELSE 'PENDIENTE'::estado_pago END
FROM estudiante e, rubro r, generate_series(1, 12) m
WHERE r.tipo = 'PENSION';
