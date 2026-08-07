# SAGAB — Sistema Avanzado de Gestión Académica Bellini

Implementación de la propuesta profesional (Triviño & Cifuentes, 2025) para la Unidad Educativa Particular Giovanni Bellini.

**Stack:** Java 17 + Spring Boot 3.3 · React 18 + Vite + Tailwind (shadcn/ui) · PostgreSQL 15

La implementación y validación del Prompt Maestro — Parte 1 (calendario unificado, mensajes
institucionales, gestión de asignaciones y navegación protegida) está documentada en
[`docs/PARTE_1_IMPLEMENTACION.md`](docs/PARTE_1_IMPLEMENTACION.md).

La Parte 2 (ausencias/mensajes del docente, recursos reales, búsqueda depurada y seguimiento
DECE) está documentada en [`docs/PARTE_2_IMPLEMENTACION.md`](docs/PARTE_2_IMPLEMENTACION.md).

```
sagab/
├── database/    Scripts SQL (esquema, índices, auditoría, roles, datos de prueba)
├── backend/     API REST Spring Boot (JWT, RBAC, auditoría)
└── frontend/    SPA React (prototipo Figma + capa src/api conectada al backend)
```

---

## 1. Base de datos (PostgreSQL 15+)

```bash
bash database/setup_db.sh
```

El inicializador ejecuta los 23 scripts estructurales en su orden real de dependencias. Los datos
de demostración y las cuentas nominales se mantienen fuera de la ejecución automática. En una base
existente que ya tenga las migraciones 01–27, aplicar:

```bash
sudo -u postgres psql -d sagab -v ON_ERROR_STOP=1 -f database/28_calendario_institucional.sql
sudo -u postgres psql -d sagab -v ON_ERROR_STOP=1 -f database/29_seguimiento_dece.sql
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
| GET | `/api/calendario?desde=…&hasta=…` | todos los roles autenticados |
| POST/PUT/DELETE | `/api/calendario` | ADMIN |
| POST | `/api/mensajes/institucionales` | ADMIN |
| GET/POST/PUT/DELETE | `/api/asignaciones` | ADMIN; `/mias` también DOCENTE |
| GET/POST/PUT/DELETE | `/api/dece/seguimientos` | DECE |
| POST/GET | `/api/dece/seguimientos/{id}/mensajes` | DECE |
| GET | `/api/auditoria/cambios` · `/eventos` · `/historial/{tabla}/{id}` | **AUDITOR**, ADMIN |

### Almacenamiento de archivos

- Sin variables S3, SAGAB usa almacenamiento local real en `./data/uploads`.
- En producción local, monte `SAGAB_STORAGE_LOCAL_DIR` sobre un volumen persistente.
- Configure `SAGAB_PUBLIC_API_URL` con el origen público del backend para los enlaces firmados.
- Para S3/R2 defina el conjunto completo `SAGAB_S3_ENDPOINT`, `SAGAB_S3_REGION`,
  `SAGAB_S3_BUCKET`, `SAGAB_S3_ACCESS_KEY` y `SAGAB_S3_SECRET_KEY`.
- Una configuración S3 parcial se rechaza expresamente para evitar una caída silenciosa a disco.

### Generar el hash BCrypt para los usuarios semilla

```java
System.out.println(new BCryptPasswordEncoder(12).encode("TuContraseñaSegura123"));
```
Reemplazar los hashes de `database/05_datos_prueba.sql` con el resultado.

---

## 3. Frontend (React + Vite)

```bash
cd frontend
cp .env.example .env       # ajustar VITE_API_URL si aplica
pnpm install               # o npm install
pnpm dev                   # http://localhost:5173
```

La capa `src/api/` conecta la SPA con el backend:

- `client.ts` — fetch central con JWT en `sessionStorage`, manejo de 401 y errores uniformes.
- `auth.ts` — `login()` / `logout()` contra `/api/auth/login`; devuelve nombre, roles y bandera `debeCambiarClave`.
- `sagab.ts` — servicios tipados de matrícula, calificaciones, asistencia, deberes, recursos,
  calendario, asignaciones, mensajería, pagos, notificaciones y auditoría.

`App.tsx` ya usa autenticación real, reconstruye una sesión válida al recargar, aplica permisos
por rol y carga las vistas principales de forma diferida.

---

## 4. Despliegue en producción (servidor local institucional)

1. HTTPS obligatorio: certificado TLS (Let's Encrypt o interno) en un reverse proxy Nginx delante de Tomcat.
2. Cambiar todas las credenciales marcadas `CAMBIAR_EN_PRODUCCION` y definir secretos por variables de entorno.
3. Respaldo diario: `pg_dump -Fc sagab` vía cron hacia servidor secundario (recomendación del proyecto).
4. Crear partición mensual de auditoría (cron o `pg_partman`).
5. Restringir `pg_hba.conf` a la red institucional y desactivar acceso remoto al superusuario.
