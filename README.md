# SAGAB — Sistema Avanzado de Gestión Académica Bellini

Implementación de la propuesta profesional (Triviño & Cifuentes, 2025) para la Unidad Educativa Particular Giovanni Bellini.

**Stack:** Java 17 + Spring Boot 3.3 · React 18 + Vite + Tailwind (shadcn/ui) · PostgreSQL 15

```
sagab/
├── database/    Scripts SQL (esquema, índices, auditoría, roles, datos de prueba)
├── backend/     API REST Spring Boot (JWT, RBAC, auditoría)
└── frontend/    SPA React (prototipo Figma + capa src/api conectada al backend)
```

---

## 1. Base de datos (PostgreSQL 15+)

```bash
createdb sagab
psql -d sagab -f database/01_schema.sql
psql -d sagab -f database/02_indices.sql
psql -d sagab -f database/03_auditoria.sql
psql -d sagab -f database/04_roles_bd.sql      # ⚠ cambiar contraseñas antes de producción
psql -d sagab -f database/05_datos_prueba.sql  # solo desarrollo
```

### Diseño de seguridad en la BD (defensa en profundidad)

| Capa | Mecanismo |
|---|---|
| Roles de conexión | `sagab_app` (CRUD negocio), `sagab_auditor` (solo lectura de auditoría), `sagab_readonly` (BI/reportes). Sin DDL para ninguno. |
| RBAC de aplicación | Tablas `rol`, `permiso`, `rol_permiso`, `usuario_rol` con la matriz de la sección 17 del proyecto **+ rol AUDITOR**. |
| Auditoría inmutable | Esquema `auditoria` con triggers `AFTER INSERT/UPDATE/DELETE` sobre las 8 tablas sensibles. Guarda `datos_antes`/`datos_despues` en JSONB, columnas modificadas, usuario de la app e IP. Triggers `BEFORE UPDATE/DELETE` bloquean cualquier alteración de la bitácora. |
| Particionamiento | `auditoria.registro_cambio` particionada por mes (crear particiones nuevas mensualmente o instalar `pg_partman`). |
| Índices | PK/UNIQUE + índices compuestos y **parciales** (p. ej. solo `promedio < 7`, solo obligaciones `PENDIENTE/VENCIDO`) y GIN `pg_trgm` para búsqueda instantánea de estudiantes. |
| Integridad | CHECKs de rango 1–10 en notas, `promedio` como **columna generada** (tarea 20 % + clase 20 % + examen 60 %), UNIQUE por (estudiante, asignación, parcial) y por (estudiante, fecha) en asistencia. |

### ¿Cómo sabe la BD *quién* hizo el cambio?

El backend, al inicio de cada transacción, ejecuta
`SELECT set_config('sagab.usuario_app', '<email>', true)` (ver `AuditoriaContextAspect`).
Los triggers leen ese valor con `current_setting`, de modo que la bitácora registra al usuario real de la aplicación aunque todas las conexiones usen el rol `sagab_app`.

---

## 2. Backend (Spring Boot)

```bash
cd backend
export SAGAB_DB_PASSWORD='...'          # contraseña de sagab_app
export SAGAB_JWT_SECRET='<32+ bytes aleatorios>'   # openssl rand -base64 48
mvn spring-boot:run                      # http://localhost:8080
```

### Seguridad implementada (RNF-03, LOPDP)

- **JWT HS256** con expiración de 30 min; roles embebidos en el token.
- **BCrypt fuerza 12** para contraseñas; el hash jamás sale en DTOs ni queda en la auditoría (el trigger lo elimina del JSONB).
- **Bloqueo por fuerza bruta:** 5 intentos fallidos → cuenta bloqueada 15 min; todo intento queda en `auditoria.evento_seguridad`.
- **Mensajes de error genéricos** (no se revela si un email existe) y sin stacktraces al cliente.
- **CORS** restringido al origen del frontend; cabeceras HSTS y X-Frame-Options DENY.
- **Autorización en dos niveles:** rutas (`SecurityFilterChain`) + métodos (`@PreAuthorize`).
- `ddl-auto: validate`: Hibernate nunca modifica el esquema; los scripts SQL son la única fuente de verdad.

### Endpoints principales

| Método | Ruta | Roles |
|---|---|---|
| POST | `/api/auth/login` | público |
| POST | `/api/calificaciones` (ingreso masivo) | DOCENTE, ADMIN |
| GET | `/api/calificaciones/asignacion/{id}/parcial/{p}` | DOCENTE, ADMIN |
| POST | `/api/asistencia` (registro diario + alertas DECE) | DOCENTE, ADMIN |
| GET | `/api/asistencia/paralelo/{id}` | DOCENTE, ADMIN |
| GET | `/api/auditoria/cambios` · `/eventos` · `/historial/{tabla}/{id}` | **AUDITOR**, ADMIN |

### Generar el hash BCrypt para los usuarios semilla

```java
System.out.println(new BCryptPasswordEncoder(12).encode("***REDACTED***"));
```
Reemplazar los hashes de `database/05_datos_prueba.sql` con el resultado.

### Pendiente por implementar (siguiendo el mismo patrón entity/repo/service/controller)

Módulo disciplinario (tabla `incidencia_disciplinaria` ya creada), módulo financiero
(`rubro`, `obligacion_pago`, `pago`), mensajería interna (`mensaje`, `mensaje_destinatario`),
generación de boletines PDF con iText (dependencia ya incluida en `pom.xml`) y envío de
correos con `spring-boot-starter-mail` (configurado en `application.yml`).

---

## 3. Frontend (React + Vite)

```bash
cd frontend
cp .env.example .env       # ajustar VITE_API_URL si aplica
pnpm install               # o npm install
pnpm dev                   # http://localhost:5173
```

La capa `src/api/` ya está lista para reemplazar los datos ficticios del prototipo:

- `client.ts` — fetch central con JWT en `sessionStorage`, manejo de 401 y errores uniformes.
- `auth.ts` — `login()` / `logout()` contra `/api/auth/login`; devuelve nombre, roles y bandera `debeCambiarClave`.
- `sagab.ts` — servicios tipados de calificaciones, asistencia y auditoría.

**Integración en `App.tsx`:** sustituir `INIT_GRADES` por `calificaciones.porAsignacion(...)`,
el guardado de `GradesView` por `calificaciones.registrarMasivo(...)`, y el login simulado
por `auth.login(...)` mapeando los roles del backend (`ADMIN → admin`, `DOCENTE → teacher`,
`REPRESENTANTE → parent`) a las pantallas existentes. Añadir una vista de auditoría para
el rol `AUDITOR` consumiendo `auditoria.cambios()`.

---

## 4. Despliegue en producción (servidor local institucional)

1. HTTPS obligatorio: certificado TLS (Let's Encrypt o interno) en un reverse proxy Nginx delante de Tomcat.
2. Cambiar todas las credenciales marcadas `CAMBIAR_EN_PRODUCCION` y definir secretos por variables de entorno.
3. Respaldo diario: `pg_dump -Fc sagab` vía cron hacia servidor secundario (recomendación del proyecto).
4. Crear partición mensual de auditoría (cron o `pg_partman`).
5. Restringir `pg_hba.conf` a la red institucional y desactivar acceso remoto al superusuario.
