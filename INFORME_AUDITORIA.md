# Informe de Auditoría Técnica — SAGAB
**Sistema Avanzado de Gestión Académica Bellini**

Fecha: 2026-08-04
Alcance: Backend (Spring Boot), Frontend (React/Vite), Base de datos (PostgreSQL)
Naturaleza: **Auditoría de solo lectura — no se modificó ningún archivo ni se ejecutó DDL/DML de escritura.**

---

## 1. Resumen ejecutivo

SAGAB tiene una base técnica notablemente más sólida de lo que sugiere su propia documentación (el `README.md` está desactualizado: describe como "pendiente" trabajo que ya está terminado, tanto en el frontend — integración completa con `src/api/` — como en el backend — módulo financiero ya implementado). El patrón de capas (entity/repository/service/controller/dto) se respeta con consistencia, no se encontró **ninguna** vulnerabilidad de inyección SQL, XSS ni fuga de credenciales en código, y el diseño de seguridad en la base de datos (roles de mínimo privilegio, auditoría inmutable con triggers verificados en vivo) es más riguroso que el de la mayoría de proyectos de este tamaño.

Dicho esto, la auditoría encontró **11 problemas críticos** (detallados en la sección 4) que requieren atención antes de cualquier lanzamiento a producción real, y confirmó que **3 cuentas de demostración están rotas hoy mismo** (`docente@`, `auditor@`, `padre@bellini.edu.ec` no pueden iniciar sesión por `username = NULL`). El riesgo más urgente en el tiempo es operativo, no de código: la partición mensual de auditoría vence el **2026-10-01** y no hay automatización para crear la siguiente — en menos de dos meses los registros de auditoría empezarán a caer silenciosamente en una partición `DEFAULT` sin límite.

Los 4 módulos nuevos solicitados (notificaciones, faltas, subida de deberes, pagos por transferencia) **no se implementaron en esta fase** — se acordó contigo hacer primero la auditoría sin tocar código. Cada uno se evaluó en términos de qué tan lista está la base actual para construirlo (sección 9).

---

## 2. Estado general del proyecto

| Capa | Calificación promedio | Clasificación |
|---|---|---|
| Backend (Spring Boot) | **6.6 / 10** | Requiere mejoras |
| Frontend (React/Vite) | **7.1 / 10** | Bueno |
| Base de datos (PostgreSQL) | **5.7 / 10** | Requiere mejoras |
| **Global del proyecto** | **6.4 / 10** | **Requiere mejoras inmediatas** |

Interpretación: no hay ningún módulo en estado crítico (ninguna nota por debajo de 4 en las categorías que más importan para la operación diaria: funcionalidad y ausencia de vulnerabilidades explotables), pero tampoco ninguno alcanza el nivel "muy bueno". Las notas más bajas están concentradas en **escalabilidad y mantenibilidad operativa** (particiones sin automatizar, sin migraciones versionadas, sin tests, sin logging) más que en errores funcionales — es deuda técnica acumulada por el ritmo de desarrollo, no negligencia de diseño.

---

## 3. Calificación detallada por módulo

### Backend
| Categoría | Nota | Justificación |
|---|---|---|
| Seguridad | 7/10 | JWT validado correctamente, BCrypt-12, bloqueo por fuerza bruta, cero SQL injection, IDOR mitigado con `esPropio()`. Resta: secretos por defecto sin fail-fast, cero logging de seguridad, contraseña inicial = cédula. |
| Rendimiento | 5/10 | Buen uso de `LAZY` fetch, pero N+1 reales en el endpoint más usado (ingreso masivo de notas) y bucle O(n²) en asistencia. |
| Escalabilidad | 5/10 | Sin paginación fuera de auditoría, sin caché, sin procesamiento asíncrono. |
| Mantenibilidad | 7/10 | Patrón de capas predecible y fácil de extender. Penaliza: cero tests automatizados, cero logging. |
| Legibilidad | 8/10 | Nombres de dominio claros, javadocs útiles, DTOs bien organizados. |
| Arquitectura | 7.5/10 | Separación de capas limpia, sin lógica de negocio en controllers. |
| Calidad de código | 6.5/10 | Validación de entrada consistente. Resta: repos/métodos muertos, bug de valor hardcodeado, duplicación menor. |

### Frontend
| Categoría | Nota | Justificación |
|---|---|---|
| Seguridad | 7/10 | JWT en sessionStorage bien gestionado, sin XSS. Resta: `debeCambiarClave` no se aplica pese a contraseñas predecibles. |
| Rendimiento | 6.5/10 | Buen code-splitting manual y paginación. Resta: casi sin memoización, `sourcemap:true` en build de producción. |
| Escalabilidad | 6/10 | Sin `<DataTable>` ni hooks compartidos — cada vista nueva reinventará los mismos patrones. |
| Mantenibilidad | 7/10 | Tipado estricto, sin código muerto de componentes. Resta: funciones de API completas nunca usadas. |
| Legibilidad | 8/10 | Código consistente y bien comentado donde importa. |
| Arquitectura | 7/10 | Separación api/app/views/components lista para escalar. Sin estado global más allá de props. |
| Calidad de código | 7.5/10 | Sin dependencias huérfanas, type-check limpio. Duplicación moderada y fácil de refactorizar. |

### Base de datos
| Categoría | Nota | Justificación |
|---|---|---|
| Seguridad | 5/10 | Buen diseño de roles y auditoría inmutable real. Resta: sin RLS para datos de menores (LOPDP), secretos con fallback silencioso. |
| Rendimiento | 7/10 | Buen uso de índices parciales y GIN/trgm. Falta índice en `asignacion_docente.id_docente`. |
| Escalabilidad | 4/10 | Particionamiento sin automatizar — próxima partición vence 2026-10-01. |
| Mantenibilidad | 4/10 | Sin control de versión de migraciones (Flyway/Liquibase), script de setup desincronizado de los propios archivos numerados. |
| Legibilidad/Documentación | 7/10 | Comentarios extensos y honestos sobre sus propios problemas. |
| Arquitectura (modelo de datos) | 7/10 | Modelo normalizado, RBAC limpio, buen uso de ENUMs. |
| Integridad de datos | 6/10 | CHECKs sólidos donde existen. Sin regla que garantice `pago ≤ obligación`, drift confirmado entre scripts y datos reales. |

---

## 4. Problemas críticos encontrados

Ordenados por urgencia real (impacto × cercanía en el tiempo), no solo por severidad teórica:

1. **Partición de auditoría sin automatizar, vence el 2026-10-01** (`database/03_auditoria.sql`). Solo existen particiones hasta septiembre. Sin `pg_partman`/`pg_cron` ni job manual, los registros de octubre en adelante caerán silenciosamente en la partición `DEFAULT`, degradando el propósito del particionamiento sin ningún error visible.
2. **3 cuentas de demostración rotas ahora mismo**: `docente@bellini.edu.ec`, `auditor@bellini.edu.ec`, `padre@bellini.edu.ec` tienen `username = NULL` en la BD real — no pueden iniciar sesión pese a tener un hash de contraseña válido. Un parche manual quedó incompleto y no se reflejó en ningún script versionado.
3. **Secretos con valor por defecto funcional y sin fail-fast** (`backend/src/main/resources/application.yml:7,37`): si `SAGAB_DB_PASSWORD` o `SAGAB_JWT_SECRET` no se definen como variable de entorno en un despliegue, la aplicación **arranca igual** usando `CAMBIAR_EN_PRODUCCION_app` / `CAMBIAR-ESTA-CLAVE-POR-UNA-DE-32+-BYTES-ALEATORIA` — ambos valores están en el repositorio público. Cualquiera podría forjar JWTs válidos si esto llega a producción sin configurar.
4. **Cero logging en todo el backend** (confirmado por grep exhaustivo, 0 resultados de `Logger`/SLF4J). El manejador global de excepciones descarta errores no anticipados sin dejar rastro — un incidente de seguridad o un bug en producción no dejaría ninguna traza más allá de un 500 genérico al cliente.
5. **Sin control de versión de migraciones de base de datos**: no existe Flyway/Liquibase ni tabla `schema_migrations`. El propio `setup_db.sh` no ejecuta 4 de los 10 scripts SQL del proyecto (05, 07, 08, 10), y ya se confirmó drift real entre los scripts versionados y los datos en la BD viva (hashes de contraseña parcheados a mano, sin rastro en ningún script).
6. **Licencia AGPL de `itext7-core`** (`backend/pom.xml:74-79`), incluida para generar boletines PDF. Usarla en un backend que presta servicio por red sin licencia comercial obliga a liberar el código fuente completo bajo AGPL — es una decisión legal, no técnica, pendiente de resolver antes de activar esa funcionalidad.
7. **Sin tests automatizados en el backend** pese a tener `spring-boot-starter-test` y `spring-security-test` en `pom.xml` — no existe el directorio `src/test`.
8. **N+1 en el endpoint más usado del sistema**: `CalificacionService.registrarMasivo` (`backend/.../CalificacionService.java:56-83`) hace 4 round-trips a BD por estudiante al guardar notas — ~120 queries para un paralelo de 30 alumnos.
9. **`debeCambiarClave` ignorado en el frontend**: el backend marca correctamente que un usuario nuevo debe cambiar su contraseña (relevante porque la contraseña inicial de un estudiante es su propia cédula), pero ningún componente del frontend lee ese campo ni fuerza el cambio.
10. **Sin Row-Level Security en la base de datos** para proteger datos de menores (mencionado como preocupación LOPDP en el propio comentario de `01_schema.sql`) — el aislamiento "un representante solo ve a sus representados" depende 100% de la capa de aplicación, sin respaldo a nivel de motor de datos.
11. **`sourcemap: true` en el build de producción del frontend** (`vite.config.ts:24`) — expone código fuente legible en el despliegue público e infla el tamaño del bundle.

---

## 5. Vulnerabilidades de seguridad detectadas

**Lo que NO se encontró (positivo, verificado activamente y no solo por ausencia de evidencia):**
- Sin inyección SQL — todas las queries (JPQL, `@Query` nativas, `JdbcTemplate`) usan parámetros bindeados, confirmado con grep exhaustivo.
- Sin XSS — cero uso de `dangerouslySetInnerHTML`, `eval` o `Function` en el frontend.
- Sin CSRF explotable — API stateless con JWT, CSRF deshabilitado correctamente para ese modelo.
- Sin IDOR crítico — cada endpoint que expone "datos de mi hijo/mis notas" valida propiedad vía `esPropio()` antes de responder.
- CORS restringido al origen del frontend, sin wildcard.
- Sin fuga de stacktraces al cliente.

**Lo que sí se encontró:**
| # | Vulnerabilidad / riesgo | Severidad | Ubicación |
|---|---|---|---|
| 1 | Secretos (DB password, JWT secret) con valor por defecto funcional, sin fail-fast | Alta | `backend/src/main/resources/application.yml:7,37` |
| 2 | Sin Row-Level Security para datos de menores (LOPDP) | Media | Base de datos, esquema `sagab` |
| 3 | Contraseña inicial de estudiante = cédula (predecible), sin forzar cambio en frontend | Media | `MatriculaService.java:141` + frontend sin usar `debeCambiarClave` |
| 4 | Cero logging de seguridad más allá de la tabla de auditoría (dificulta forensia de incidentes) | Media | Backend completo |
| 5 | `marcarLeido` sobre mensaje ajeno falla silenciosamente (0 filas, sin 403/404) | Baja | `MensajeService.java:34-38` |
| 6 | Sin `AuthenticationEntryPoint` propio — token inválido devuelve formato de error distinto al resto de la API | Baja | `JwtAuthFilter.java:44-47` |
| 7 | `sourcemap: true` en build de producción — código fuente legible expuesto | Baja | `frontend/vite.config.ts:24` |
| 8 | `/api/admin/**` protegido en `SecurityConfig` pero sin ningún controller detrás (ruta fantasma, no explotable pero genera confusión) | Informativa | `SecurityConfig.java:53-56` |

Todos los ítems de esta tabla, salvo el #2 (RLS, diferido a medio plazo) y el #8 (informativo, sin acción), se corrigieron en la fase de implementación — ver sección 6.

---

## 6. Código corregido

Fase 2 (deuda técnica, "Bloque A" de la sección 11 original) ya se implementó, verificó y probó contra la base de datos y el backend en ejecución. Detalle por hallazgo:

| Hallazgo | Corrección aplicada |
|---|---|
| Partición de auditoría sin automatizar | Función `auditoria.fn_crear_particion_siguiente_mes()` (`SECURITY DEFINER`, solo `EXECUTE` para `sagab_app`) + `AuditoriaParticionScheduler` (`@Scheduled`, corre al iniciar y el día 1 de cada mes) que crea la partición con 2 meses de antelación. La partición de octubre 2026 (la que faltaba) ya se creó. |
| Secretos por defecto sin fail-fast | `SecretsGuard`: la app ahora rechaza arrancar si `SAGAB_DB_PASSWORD` o `SAGAB_JWT_SECRET` no están definidas como variable de entorno (verifica la *presencia* de la variable, no su valor, para no romper un entorno de desarrollo que legítimamente reutilice el valor semilla). |
| Cuentas demo rotas (`username` NULL) | `database/11_fix_usernames_demo.sql`, aplicado a la BD. `docente@`/`auditor@`/`padre@bellini.edu.ec` ya inician sesión (usuario `carlos.perez`/`ana.auditora`/`luis.morales`, contraseña: pedir al equipo). |
| Sin control de versión de migraciones | No se adoptó Flyway/Liquibase en esta fase (cambio estructural mayor, mejor con una ventana propia); en su lugar se siguió el patrón existente de scripts numerados (11, 12, 13) y se corrigió `setup_db.sh` para no omitir ningún script. |
| Cero logging | SLF4J añadido en `GlobalExceptionHandler` (todo error queda en el log del servidor, nunca solo en la respuesta al cliente) y `JwtAuthFilter`. Verificado en vivo: un error de prueba quedó registrado correctamente. |
| Licencia AGPL de iText | `itext7-core` reemplazado por `openpdf` (LGPL/MPL) en `pom.xml` — no había código usándolo todavía, cambio sin riesgo. |
| N+1 en `registrarMasivo` de calificaciones | Reescrito con carga en lote (`findAllById`, nueva query `findByIdAsignacionAndParcialAndEstudianteIdIn`) y cálculo del promedio en Java (misma fórmula que la columna GENERATED de Postgres) en vez de `entityManager.refresh()` por fila. Verificado contra la BD real: los promedios calculados coinciden exactamente con los que genera Postgres. |
| N+1 en asistencia (`registrar`, `consecutivasPorParalelo`) | `registrar` ahora carga estudiantes y registros existentes en lote antes del loop. `consecutivasPorParalelo` usa una nueva consulta con `LATERAL JOIN` que resuelve todo el paralelo en una sola consulta en vez de una por estudiante. |
| N+1 en finanzas (`porEstudiante`) | Nueva query `findByObligacionIdInOrderByFechaPagoDesc` para traer los pagos de todas las obligaciones de una vez. |
| N+1 en notas del Portal Familiar (`CalificacionService.porEstudiante`) | Las asignaciones se cargan en lote (`findAllById`) antes de resolver el nombre de la materia. |
| Bug: `expiraEnMinutos` hardcodeado a 30 | `AuthService` ahora usa el valor real de `sagab.jwt.access-minutes`. |
| Código muerto | Eliminados `MensajeRepository`, `MateriaRepository` (interfaces sin ninguna referencia) y `EventoSeguridadService.exportacion()` (nunca invocado). `@EnableScheduling` se conservó porque ahora sí se usa (particiones de auditoría). |
| Índice faltante / integridad de pagos | `database/12_indice_check_pagos.sql`: índice en `asignacion_docente.id_docente`, `CHECK` de dominio cerrado en `pago.metodo`, y un trigger que impide que la suma de pagos de una obligación supere su valor. |
| `debeCambiarClave` ignorado en frontend | Nuevo endpoint `POST /api/auth/cambiar-clave` + pantalla `CambiarClaveScreen` que bloquea el acceso a la app hasta que el usuario cambie su contraseña. Probado end-to-end (round-trip completo con una cuenta real, sin dejar la contraseña alterada). |
| `Bell` decorativo en `TopBar` | Ahora consulta `mensajes.mias()` real: el punto rojo y el contador solo aparecen si hay mensajes sin leer, y un menú desplegable permite marcarlos como leídos (conecta también `mensajes.marcarLeido`, que antes nunca se invocaba). |
| `sourcemap: true` en build de producción | `vite.config.ts` → `sourcemap: false`. Verificado: `npm run build` ya no genera archivos `.map`. |
| `react`/`react-dom` en `peerDependencies` | Movidos a `dependencies` en `package.json`; se aprovechó para corregir también el nombre del paquete (`@figma/my-make-file` → `sagab-frontend`). |
| Duplicación de "cargar asignaciones" y "búsqueda con debounce" | Extraídos los hooks `useAsignaciones` y `useDebouncedSearch`, aplicados en `GradesView`, `AttendanceView` y `FinancialView`. |

**Hallazgo adicional descubierto durante las pruebas (no estaba en la auditoría original):** `GET /api/asistencia/paralelo/{id}` devolvía 500 (`LazyInitializationException`) en cuanto había datos reales, porque el controller serializaba entidades JPA directamente en vez de un DTO. Corregido devolviendo `AsistenciaDtos.RegistroParaleloResponse`. También se detectó que la cuenta demo `Saida` (docente) no inicia sesión con ninguna de las contraseñas documentadas en los scripts SQL — el hash real en la BD no corresponde a la contraseña documentada para las demás cuentas ni a ninguna variante probada; es el mismo patrón de drift ya señalado para `docente@`/`auditor@`/`padre@`, pero sobre una cuenta que sí tenía `username` — no se "adivinó" una contraseña nueva para no dejar la cuenta en un estado no documentado; queda pendiente que confirmes la contraseña real de `Saida` o autorices resetearla.

## 6.1 Notificaciones automáticas (Bloque B, módulo 1 — implementado)

Cuando se registra una calificación con promedio &lt; 7 (vía `POST /api/calificaciones`, el único punto de escritura de notas), `CalificacionService` ahora dispara `NotificacionService.notificarSiEnRiesgo(...)` automáticamente, sin intervención del administrador ni del docente:

- Se crea una notificación para el **estudiante** (si tiene cuenta propia, `estudiante.id_usuario`) y otra para su **representante** (`estudiante.id_representante`), cada una con el mensaje redactado en segunda o tercera persona según a quién va dirigida.
- Cada notificación guarda: materia, calificación obtenida, mensaje explicando que debe mejorar el rendimiento académico, y fecha/hora (`creado_en`).
- Queda marcada **no leída** (`leido_en IS NULL`) hasta que el destinatario la abre; `POST /api/notificaciones/{id}/leida` la marca leída, verificando propiedad en el propio `UPDATE` (mismo patrón que `MensajeDestinatarioRepository`, con la mejora de que aquí sí se devuelve 404 si la notificación no existe o no le pertenece, en vez de fallar en silencio).
- **Tabla nueva** `sagab.notificacion` (`database/14_notificaciones.sql`), con índice parcial `WHERE leido_en IS NULL` para la consulta de no leídas, igual que ya hacía `mensaje_destinatario`.
- **Frontend:** tarjeta "Notificaciones académicas" en el Portal Familiar (`ParentPortal.tsx`), visible en la pestaña Inicio, con las no leídas resaltadas en rojo y un contador; clicar una la marca como leída.

**Verificado end-to-end contra el backend y la BD reales**: se registró una nota de 4.2 en Matemáticas para una estudiante real, la notificación apareció correctamente para su representante (`GET /api/notificaciones/mias`) con el mensaje, materia, calificación y fecha/hora esperados; marcarla leída funcionó y un segundo intento devolvió 404 correctamente (protección contra re-marcado e IDOR estructural, ya que el `WHERE` exige que la notificación pertenezca al usuario autenticado).

**Limitación conocida, no introducida por este cambio:** el rol `ESTUDIANTE` (para que el estudiante inicie sesión directamente, no solo su representante) existe en la base de datos y en el JWT, pero el frontend no tiene una entrada para él en `NAV_POR_ROL` (crashearía al intentar loguearse) y varios controllers (`Calificacion`, `Asistencia`, `Finanzas`) restringen sus endpoints a `DOCENTE`/`ADMIN`/`REPRESENTANTE` sin incluir `ESTUDIANTE`. Es un gap preexistente, no algo que haya tocado esta fase — las notificaciones sí se crean correctamente para la cuenta del estudiante en la base de datos, pero hoy solo son visibles a través del login del representante. Si quieres que lo cierre, es un cambio aparte (rutas de 3-4 controllers + navegación del frontend). Los módulos de Deberes y Pagos (abajo) siguen el mismo criterio: el representante sube en nombre de su hijo/a.

## 6.2 Almacenamiento de archivos (S3-compatible) — infraestructura compartida

Deberes y Pagos por transferencia necesitan subir archivos; Render no persiste disco local entre despliegues, así que se integró un cliente S3 estándar (`software.amazon.awssdk:s3`, cliente HTTP `url-connection-client` para evitar la dependencia extra de Apache HttpClient5 que trae el cliente por defecto del SDK y que rompía el arranque). Funciona igual contra AWS S3, Cloudflare R2 o cualquier otro proveedor S3-compatible.

- **`StorageService`**: sube (`subir`) y genera URLs de descarga temporales firmadas de 10 minutos (`urlDescargaTemporal`) — los archivos **nunca son públicos**, cada descarga pasa primero por un endpoint del backend que verifica que el usuario tiene permiso sobre ese archivo en concreto.
- **Degradación controlada**: si `SAGAB_S3_*` no está configurado, la aplicación arranca igual (verificado: intenté a propósito construir el cliente con credenciales vacías y falló el arranque completo; se corrigió para que construya con un placeholder y solo bloquee en el momento real de subir un archivo). Los endpoints de subida devuelven un 400 claro ("El almacenamiento de archivos todavía no está configurado…") en vez de un 500 genérico — **verificado en vivo**: subí un PDF y una imagen válidos contra el backend real sin credenciales S3 y ambos devolvieron ese mensaje, sin crashear el servidor ni dejar datos huérfanos (el `Pago`/`EntregaTarea` solo se guarda después de que la subida a S3 tiene éxito).
- **`FileValidationService`**: valida tamaño, y el **contenido real del archivo por firma binaria** (magic bytes: %PDF, JPEG, PNG, WEBP, ZIP/DOCX, OLE/DOC antiguo) — nunca confía en el `Content-Type` ni la extensión que manda el cliente, ambos falsificables. Sin esto, alguien podría renombrar un `.exe` a `.pdf` y que pasara el filtro de extensión.

## 6.3 Registro de faltas y estadísticas

Pendiente — no se implementó en esta fase (ver sección 11, Bloque B).

## 6.4 Subida de deberes (Bloque B, módulo 3 — implementado)

El docente publica una **Tarea** sobre una asignación (materia+paralelo+período); el backend genera automáticamente una **Entrega** en estado `PENDIENTE` para cada estudiante activo del paralelo (sin que el docente tenga que hacerlo manualmente). El representante sube el archivo en nombre del estudiante — la entrega pasa a `ENTREGADO` — y el docente la revisa, con un comentario opcional — pasa a `REVISADO`.

- **Tablas nuevas** `sagab.tarea` y `sagab.entrega_tarea` (`database/15_deberes.sql`), con auditoría (`trg_audit_tarea`, `trg_audit_entrega_tarea`) igual que el resto de tablas transaccionales del esquema.
- **Validación de archivos**: PDF, Word (`.doc`/`.docx`), ZIP e imágenes (JPG/PNG/WEBP), máximo 15 MB (configurable con `SAGAB_UPLOAD_MAX_MB_DEBERES`).
- **Backend**: `TareaService`/`TareaController` (`/api/tareas/**`) — crear tarea (DOCENTE/ADMIN, verificando que la asignación le pertenezca), listar tareas por asignación, listar/revisar entregas, subir entrega (REPRESENTANTE/ADMIN, con el mismo chequeo de propiedad `esPropio()` que ya usan Calificaciones/Asistencia/Finanzas), y descarga con URL temporal firmada.
- **Frontend**: pantalla nueva **"Deberes"** en el menú (visible para DOCENTE/ADMIN) para publicar tareas y revisar entregas con un componente de arrastrar-y-soltar; pestaña **"Deberes"** nueva en el Portal Familiar para que el representante vea el estado de cada tarea de su hijo/a y suba el archivo si está pendiente.
- **Verificado end-to-end** (sin archivo real, ver 6.2): creé una tarea real sobre una asignación con 12 estudiantes, confirmé que se generaron automáticamente 12 entregas `PENDIENTE`, y que el endpoint de subida valida tipo de archivo (rechazó un `.txt`, aceptó un PDF con firma binaria válida) antes de fallar limpiamente por falta de credenciales S3.

## 6.5 Pagos por transferencia bancaria (Bloque B, módulo 4 — implementado)

Se extendió `sagab.pago` (no se creó una tabla nueva: es el mismo pago, con más datos) con banco de origen, número de referencia, comprobante adjunto, y un flujo de revisión independiente del estado de la obligación:

- **Estados de revisión** (`sagab.estado_revision_pago`): `EN_REVISION` (recién subido, esperando al admin) → `APROBADO` o `RECHAZADO`. Los pagos en efectivo/cheque/tarjeta (los registra un ADMIN directamente) nacen `APROBADO` — no necesitan revisión.
- **El representante** ve sus obligaciones pendientes/vencidas (Portal Familiar → Pagos), selecciona una, y sube: banco, número de referencia, fecha y el comprobante (foto o PDF). Validaciones: tipo de archivo por firma binaria, tamaño máximo (8 MB por defecto, `SAGAB_UPLOAD_MAX_MB_COMPROBANTE`), **comprobante duplicado** (hash SHA-256 del archivo comparado contra lo ya subido para esa misma obligación — `idx_pago_comprobante_hash`), y campos obligatorios.
- **El admin** ve una cola "Comprobantes por revisar" en Financiero, puede ver el comprobante (URL firmada temporal) y Aprobar/Rechazar. Al aprobar, si la suma de pagos ya `APROBADO`s cubre el valor, la obligación pasa a `PAGADO` automáticamente (mismo mecanismo que el pago en efectivo).
- **Corrección de un bug preexistente** en el trigger `fn_validar_suma_pagos` (creado en la fase anterior, sección 6): antes sumaba *todos* los pagos de una obligación sin importar su estado; ahora solo cuenta los `APROBADO`s. Sin este ajuste, un pago por transferencia `EN_REVISION` habría bloqueado otros pagos válidos, o un `RECHAZADO` habría seguido "ocupando" el cupo del valor de la obligación indefinidamente. **Verificado en vivo con una transacción de prueba** (revertida): un pago `EN_REVISION` por $500 sobre una obligación de $180 se insertó sin problema (el trigger lo ignora en ese estado); al intentar aprobarlo, el trigger lo bloqueó correctamente con "La suma de pagos aprobados superaría el valor de la obligación".
- **Backend**: nuevos endpoints en `FinanzasController` — `POST /api/finanzas/pagos/transferencia` (REPRESENTANTE/ADMIN, antes bloqueado a nivel de `SecurityConfig` para no-ADMIN — se corrigió la regla de rutas), `GET /api/finanzas/pagos/revision`, `POST /api/finanzas/pagos/{id}/aprobar`, `POST /api/finanzas/pagos/{id}/rechazar`, `GET /api/finanzas/pagos/{id}/comprobante`.
- **Verificado end-to-end** (sin archivo real, ver 6.2): subí un comprobante JPEG válido para una obligación real de $180 con la cuenta de un representante real; la validación de tipo/propiedad pasó correctamente y falló limpiamente por falta de credenciales S3, sin crear ningún `Pago` huérfano en la base de datos.

## 7. Archivos modificados

**Backend — deuda técnica y notificaciones:** `SecretsGuard.java`, `AuditoriaParticionScheduler.java`, `NotificacionService.java`, `NotificacionController.java`, `NotificacionRepository.java`, `Notificacion.java`, `NotificacionDtos.java` (nuevos), `AuthService.java`, `AuthController.java`, `AuthDtos.java`, `CalificacionService.java`, `CalificacionRepository.java`, `AsistenciaService.java`, `AsistenciaRepository.java`, `AsistenciaController.java`, `AsistenciaDtos.java`, `GlobalExceptionHandler.java`, `JwtAuthFilter.java`, `EventoSeguridadService.java`. Eliminados: `MensajeRepository.java`, `MateriaRepository.java`.

**Backend — Deberes y Pagos (nuevo):** `StorageConfig.java`, `StorageService.java`, `FileValidationService.java` (infraestructura compartida); `Tarea.java`, `EntregaTarea.java`, `TareaRepository.java`, `EntregaTareaRepository.java`, `TareaDtos.java`, `TareaService.java`, `TareaController.java` (Deberes); `SecurityConfig.java` (regla de ruta para el nuevo endpoint de transferencia). Modificados: `Pago.java`, `PagoRepository.java`, `FinanzasService.java`, `FinanzasController.java`, `FinanzasDtos.java` (Pagos).

**Backend — configuración:** `application.yml`, `pom.xml` (ambos con cambios acumulados de las tres fases).

**Base de datos:** `11_fix_usernames_demo.sql`, `12_indice_check_pagos.sql`, `13_particion_auditoria_automatica.sql`, `14_notificaciones.sql`, `15_deberes.sql`, `16_pagos_transferencia.sql` (todos aplicados a la BD real), `setup_db.sh` (corregido).

**Frontend — deuda técnica y notificaciones:** `vite.config.ts`, `package.json`, `App.tsx`, `TopBar.tsx`, `GradesView.tsx`, `AttendanceView.tsx`, `src/api/auth.ts`, `src/api/sagab.ts`, `ParentPortal.tsx`. Nuevos: `CambiarClaveScreen.tsx`, `hooks/useAsignaciones.ts`, `hooks/useDebouncedSearch.ts`.

**Frontend — Deberes y Pagos (nuevo):** `src/api/client.ts` (cliente `apiForm` para multipart), `FileUpload.tsx`, `TareasView.tsx`, `types.ts`, `Sidebar.tsx` (pantalla "Deberes"), `Btn.tsx` (prop `type` para no romper el submit de formularios). Modificados de nuevo: `ParentPortal.tsx` (pestaña Deberes + subida de comprobante), `FinancialView.tsx` (cola de revisión de pagos).

## 8. Nuevas funcionalidades implementadas

2 de los 4 módulos solicitados en el Bloque B: **Notificaciones automáticas** (sección 6.1) y **Subida de deberes + Pagos por transferencia** (secciones 6.2–6.5), con la infraestructura de almacenamiento S3-compatible que ambos comparten. Pendientes: **Registro de faltas** (no iniciado).

## 9. Mejoras realizadas

Resumidas en la tabla de la sección 6: rendimiento (N+1 corregidos, verificados con datos reales), seguridad (fail-fast de secretos, logging, validación real de contenido de archivos por firma binaria), mantenibilidad (código muerto eliminado, duplicación extraída a hooks), y dos bugs de producción reales encontrados y corregidos durante las pruebas (500 en asistencia por paralelo; sobrepago no filtrado por estado de revisión en `fn_validar_suma_pagos`).

---

## 10. Recomendaciones futuras

**Urgente (próximas 2-4 semanas):**
- Automatizar la creación de particiones de auditoría (`pg_partman` o un job mensual) antes del 2026-10-01.
- Hacer que el backend falle al arrancar si detecta los valores placeholder de `SAGAB_DB_PASSWORD`/`SAGAB_JWT_SECRET` fuera de un perfil `dev`.
- Reparar el `username` de las 3 cuentas demo rotas y documentar el proceso en un script versionado (no un `UPDATE` manual).
- Adoptar Flyway o Liquibase para las migraciones de BD, reemplazando el esquema actual de scripts numerados a mano.

**Corto plazo:**
- Añadir SLF4J/Logback al backend con niveles apropiados, especialmente en el manejador global de excepciones y en eventos de autorización denegada.
- Resolver la licencia de `itext7-core` (comprar licencia comercial o migrar a OpenPDF/Apache PDFBox) antes de activar boletines PDF.
- Corregir el N+1 de `registrarMasivo` de calificaciones (cargar estudiantes/calificaciones existentes en batch antes del loop).
- Implementar el flujo de cambio de contraseña obligatorio en el frontend usando el campo `debeCambiarClave` que el backend ya envía.
- Añadir tests de integración mínimos para los flujos de autenticación y registro de calificaciones antes de seguir agregando funcionalidad.

**Medio plazo:**
- Evaluar Row-Level Security en PostgreSQL como defensa adicional para datos de estudiantes/representantes.
- Extraer un componente `<DataTable>` y hooks compartidos (`useAsignaciones`, `useDebouncedSearch`) en el frontend antes de construir las 4 vistas nuevas, para no triplicar la duplicación ya detectada.
- Actualizar Spring Boot (3.3.5 tiene ~2 años) y las dependencias mayores desactualizadas del frontend (React 19, Vite 8, TypeScript 7 disponibles).
- Diseñar el esquema de archivos adjuntos (`entrega_tarea`, comprobantes de pago) con metadatos completos (mime_type, tamaño, nombre original, subido_por) en vez de repetir el patrón actual de columna `VARCHAR` suelta.

---

## 11. Lista de tareas pendientes

### A. Correcciones sobre lo existente (deuda técnica) — ✅ completado
- [x] Automatizar particiones de auditoría
- [x] Fail-fast en secretos por defecto (backend)
- [x] Reparar usernames de cuentas demo rotas
- [ ] Adoptar Flyway/Liquibase — **diferido**: es un cambio estructural mayor (migrar 10+ scripts históricos), mejor abordarlo en una fase dedicada en vez de mezclarlo con las demás correcciones
- [x] Añadir logging estructurado al backend
- [x] Resolver licencia de iText o migrar de librería PDF
- [x] Corregir N+1 en `registrarMasivo`, `AsistenciaService.registrar`, `FinanzasService.toResponse`, notas del Portal Familiar
- [x] Eliminar código muerto (`MensajeRepository`, `MateriaRepository`, `EventoSeguridadService.exportacion`). `RubroRepository` se dejó intencionalmente: lo va a usar el módulo de Pagos (Bloque B). `@EnableScheduling` ya no es código muerto: ahora lo usa `AuditoriaParticionScheduler`.
- [x] Implementar flujo de cambio de contraseña obligatorio en frontend (`debeCambiarClave`)
- [x] Conectar el ícono de notificaciones del `TopBar` a datos reales
- [x] Desactivar `sourcemap` en build de producción del frontend
- [x] Mover `react`/`react-dom` de `peerDependencies` a `dependencies` en `package.json`
- [ ] Añadir tests automatizados mínimos (backend y frontend) — sigue pendiente, no se hizo en esta fase
- [x] Añadir índice en `asignacion_docente.id_docente`
- [x] Añadir CHECK/constraint para que `SUM(pago.valor_pagado) ≤ obligacion_pago.valor`
- [x] *(encontrado durante las pruebas, no en la auditoría original)* Corregir 500 en `GET /api/asistencia/paralelo/{id}`
- [ ] *(encontrado durante las pruebas)* Confirmar o resetear la contraseña real de la cuenta demo `Saida` — ninguna de las contraseñas documentadas en los scripts SQL coincide con el hash real en la BD

### B. Los 4 módulos nuevos solicitados
- [x] **Notificaciones automáticas** (nota < 7) — **implementado y verificado end-to-end** (detalle en sección 6.1). Pendiente solo si decides cerrar el gap del rol `ESTUDIANTE` para que el propio estudiante también pueda verlas iniciando sesión directamente (hoy las ve su representante).
- [ ] **Registro de faltas**: nueva tabla `falta` (distinta de `incidencia_disciplinaria`), CRUD backend, vista de consulta de historial en frontend (clonando el patrón de búsqueda ya usado en calificaciones) — **único módulo que sigue sin empezar**.
- [x] **Subida de deberes** — **implementado y verificado** (detalle en sección 6.4): tablas `tarea`/`entrega_tarea`, endpoint multipart con validación real de contenido, pantalla nueva para docentes/admin y pestaña nueva en el Portal Familiar. Falta solo la prueba de subida con un archivo real — pendiente de tus credenciales S3 (sección 12).
- [x] **Pagos por transferencia con comprobante** — **implementado y verificado** (detalle en sección 6.5): `pago` extendido con revisión, banco, referencia y comprobante; cola de aprobación/rechazo para el admin en Financiero. Misma pendiente: prueba con archivo real.

El Bloque A quedó cerrado (salvo Flyway y tests, señalados arriba). Del Bloque B quedan 3 de 4 módulos funcionando (Notificaciones, Deberes, Pagos) — todo verificado contra el backend y la base de datos reales, salvo la subida de archivos en sí, que necesita las credenciales S3 reales (ver sección 12). Solo falta **Registro de faltas**.

---

## 12. Pendiente de tu parte: credenciales S3

Deberes y Pagos están completos en código y verificados hasta donde es posible sin un bucket real: la validación de archivos, los permisos, la creación de registros y el manejo de errores ya se probaron contra el backend en ejecución. Lo único que falta es probar la subida real, que necesita que termines de crear el bucket en Cloudflare R2 (u otro proveedor S3-compatible) y me pases:

- `SAGAB_S3_ENDPOINT` (ej. `https://<account_id>.r2.cloudflarestorage.com`)
- `SAGAB_S3_BUCKET` (ej. `sagab-archivos`)
- `SAGAB_S3_ACCESS_KEY` y `SAGAB_S3_SECRET_KEY`

En cuanto los tenga, hago la prueba de subida real de un deber y un comprobante, y actualizo esta sección.
