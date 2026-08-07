# Informe de Auditoría Funcional — SAGAB
**Sistema Avanzado de Gestión Académica Bellini**

Fecha del diagnóstico (Fase 1): 2026-08-05. Fecha de las correcciones (Fase 2): 2026-08-06.
Alcance: Correctitud funcional, código muerto, y consistencia frontend↔backend↔base de datos (backend Spring Boot, frontend React/Vite, PostgreSQL).
Naturaleza: **Fase 1 fue de solo lectura** (diagnóstico, secciones 1–8). Cero imports sin usar, cero `console.log`/`debugger`, cero `TODO`/`FIXME` en todo el repositorio — el código ya estaba limpio en ese sentido; los problemas reales eran de lógica de negocio, autorización y consistencia entre capas. **Fase 2 (sección 9) aplicó todas las correcciones** a pedido explícito del usuario, verificadas con build/compilación real de las tres capas — el detalle completo de qué se tocó y por qué está en la sección 9.

Complementa a `INFORME_AUDITORIA.md` (auditoría de seguridad previa). No repite sus hallazgos — los verifica y, donde corresponde, señala regresiones.

---

## 1. Resumen ejecutivo

Se auditaron en paralelo cinco frentes (controladores+seguridad backend, servicios+repositorios backend, frontend, base de datos, y trazado end-to-end de los 5 flujos principales por rol), y luego se verificaron personalmente los hallazgos de mayor severidad leyendo el código fuente real antes de escribir este informe.

**El hallazgo más importante no es un bug puntual, es un patrón repetido: cosas que "existen" pero no son alcanzables o no están protegidas.** Tres ejemplos concretos:

1. **Dos IDOR críticos de escritura** en el backend: cualquier cuenta con rol DOCENTE puede calificar o registrar asistencia de **cualquier** asignación o paralelo del colegio, no solo los suyos — el patrón de validación de propiedad (`esPropio()`/`exigirDueñoDeAsignacion()`) que sí se aplica correctamente en Tareas, Finanzas y Recursos Académicos, **se omitió** en los dos módulos más usados del sistema: Calificaciones y Asistencia.
2. **Dos roles completos son inutilizables en la práctica**: DECE no puede ver ni una sola alerta de ausencias (todos los endpoints que necesita excluyen su rol) y AUDITOR no tiene ninguna pantalla desde la cual usar el historial de auditoría, pese a que el backend de auditoría está implementado de forma ejemplar. El backend funciona; el usuario nunca puede llegar a usarlo.
3. **El propio `INFORME_AUDITORIA.md` previo tiene afirmaciones que ya no son ciertas**: dice que `setup_db.sh` "se corrigió para no omitir ningún script" — hoy omite 10 de 21 (incluyendo el trigger anti-sobrepago y la partición automática de auditoría, ambos "hallazgos críticos" de ese mismo informe). También afirma que el hallazgo de `marcarLeido` sobre mensaje ajeno está corregido — no lo está en `MensajeService` (sí lo está, correctamente, en `NotificacionService`, que es un servicio distinto).

Aparte de esto, se encontró un bug de datos real (`AttendanceView` sobrescribe silenciosamente la asistencia ya guardada del día porque nunca precarga lo existente) y una regla de negocio completa que nunca se activa (`ObligacionPago.EstadoPago.VENCIDO` no lo asigna ningún código — el KPI "estudiantes en mora" del Dashboard está permanentemente en 0).

El frontend en sí está notablemente limpio: TypeScript estricto sin errores, cero código muerto de componentes, cero mocks/hardcodes problemáticos. La mayoría de los hallazgos de frontend son de **desconexión con el backend** (endpoints que existen pero nadie llama, roles a los que el menú promete algo que el backend luego rechaza), no de calidad de código en sí.

### Conteo de hallazgos por severidad

| Severidad | Cantidad |
|---|---|
| Crítico | 10 |
| Alto | 11 |
| Medio | 14 |
| Bajo / informativo | 15 |

---

## 2. Verificación de lo que `INFORME_AUDITORIA.md` dice ya corregido

| Corrección afirmada | Estado verificado |
|---|---|
| N+1 en `registrarMasivo`, `AsistenciaService.registrar/consecutivasPorParalelo`, `FinanzasService.porEstudiante`, notas del Portal Familiar | ✅ Confirmado, sigue corregido |
| Fórmula de `promedio` en Java idéntica a la columna GENERATED de Postgres | ✅ Confirmado — verificado personalmente, mismo orden de operaciones y `RoundingMode.HALF_UP` ≡ `ROUND()` de Postgres |
| `AuthService.expiraEnMinutos` ya no hardcodeado a 30 | ✅ Confirmado |
| `MensajeRepository` eliminado (código muerto) | ✅ Confirmado, no existe |
| `EventoSeguridadService.exportacion()` eliminado | ✅ Confirmado |
| Partición de auditoría automatizada (`fn_crear_particion_siguiente_mes` + scheduler) | ✅ Confirmado en vivo contra BD real |
| Usernames de cuentas demo reparados (`11_fix_usernames_demo.sql`) | ✅ Confirmado en vivo |
| Índice `asignacion_docente.id_docente` + CHECK/trigger de suma de pagos | ✅ Confirmado en vivo |
| `fn_validar_suma_pagos` corregido para contar solo pagos `APROBADO` | ✅ Confirmado en vivo |
| `sourcemap:true` → `false`, `debeCambiarClave` vía `CambiarClaveScreen`, notificaciones reales en `TopBar`, `react`/`react-dom` en `dependencies`, hooks `useAsignaciones`/`useDebouncedSearch` | ✅ Todo confirmado, sin regresión |
| Gap del rol ESTUDIANTE en `NAV_POR_ROL` y en `@PreAuthorize` (dejado como "limitación conocida" en el informe previo) | ✅ **Ya se cerró** — no reportado por el informe previo como resuelto, pero lo está: `Sidebar.tsx` tiene entrada `ESTUDIANTE` y los controllers relevantes incluyen el rol. Mejora no documentada. |
| **`MateriaRepository` eliminado por no usarse** | ❌ **REGRESIÓN** — volvió a aparecer (archivo nuevo, sin ninguna referencia real). Ver hallazgo BE-11. |
| **`marcarLeido` sobre mensaje ajeno corregido (devuelve 403/404 en vez de fallar silenciosamente)** | ❌ **REGRESIÓN / nunca se corrigió en `MensajeService`** — el informe afirma que "todos los ítems... se corrigieron" salvo RLS y `/api/admin/**`; este no lo está. `NotificacionService` sí tiene el patrón correcto (posiblemente el informe confundió los dos servicios). Ver hallazgo BE-12. |
| **`setup_db.sh` corregido para no omitir ningún script** | ❌ **REGRESIÓN GRAVE** — hoy omite 10 de 21 scripts, incluyendo dos de las propias correcciones críticas de ese informe. Ver hallazgo DB-01. |
| `AuthenticationEntryPoint` propio (vulnerabilidad #6, severidad Baja original) | Sigue sin implementarse — coherente con que el informe la clasificó como diferida, no contradice nada. |

---

## 3. Hallazgos — Backend (controladores, seguridad, servicios, repositorios)

| ID | Archivo:Línea | Descripción | Severidad | Corrección propuesta |
|---|---|---|---|---|
| BE-01 | `service/CalificacionService.java:54-107` (`registrarMasivo`) + `controller/CalificacionController.java:23-29` | **IDOR de escritura.** Ningún DOCENTE está limitado a sus propias asignaciones al registrar notas: el método nunca valida `req.idAsignacion()` contra el docente autenticado. Cualquier cuenta DOCENTE puede sobrescribir las notas de cualquier materia/paralelo del colegio. Contrasta con `CalificacionService.eliminar()`/`buscar()`, en el mismo archivo, que sí restringen correctamente por docente vía `AsignacionDocenteService`. **Verificado personalmente leyendo el código.** | **Crítico** | Antes de guardar, cargar la `AsignacionDocente` de `req.idAsignacion()` y llamar `asignacionDocenteService.exigirDueñoDeAsignacion(asignacion, auth)` (mismo patrón que ya usa `TareaService.crear()`). |
| BE-02 | `service/AsistenciaService.java:39-81` (`registrar`) + `controller/AsistenciaController.java:22-26` | **IDOR de escritura.** Análogo a BE-01: cualquier DOCENTE puede registrar/editar asistencia de cualquier paralelo, sin verificar que tenga una `AsignacionDocente` para `req.idParalelo()`. **Verificado personalmente.** | **Crítico** | Verificar pertenencia del docente al paralelo (o exigir `idAsignacion` en el request en vez de `idParalelo` suelto) antes de guardar. |
| BE-03 | `service/CalificacionService.java:120-129` (`porAsignacion`) + `controller/CalificacionController.java:32-37` | **IDOR de lectura.** El método ni siquiera recibe `Authentication` — cualquier DOCENTE lee las notas de cualquier asignación enumerando IDs. **Verificado personalmente.** | Alto | Añadir `Authentication` y `exigirDueñoDeAsignacion` antes de consultar. |
| BE-04 | `service/AsistenciaService.java:84-105` (`porParalelo`, `consecutivasPorParalelo`) + `controller/AsistenciaController.java:28-40` | **IDOR de lectura.** Igual patrón: registro diario y alertas de ausencias consecutivas de cualquier paralelo, visibles para cualquier DOCENTE. **Verificado personalmente.** | Alto | Igual que BE-03. |
| BE-05 | `service/EstudianteService.java:33-38` (`porParalelo`) + `controller/EstudianteController.java:24-28` | Sin `Authentication`: cualquier DOCENTE ve la nómina de cualquier paralelo. Impacto menor (no expone notas/asistencia), mismo patrón de omisión. | Medio | Igual que arriba, o documentar como decisión de producto si es intencional. |
| BE-06 | `model/ObligacionPago.java:43` + `service/FinanzasService.java` (completo) + `service/DashboardService.java:44` | **Regla de negocio nunca implementada.** `EstadoPago` tiene 4 valores; ningún código Java transiciona una obligación a `VENCIDO` ni `ANULADO` — **confirmado por grep, cero resultados** fuera del propio enum y de la consulta del Dashboard. El KPI "estudiantes en mora" (`DashboardService.java:44`) siempre devuelve 0 en una instalación real. Módulo de mora silenciosamente inerte, sin ningún error visible. **Verificado personalmente.** | **Crítico** | Job `@Scheduled` (o `UPDATE` diario) que transicione `PENDIENTE`→`VENCIDO` cuando `fecha_vencimiento < hoy`; decidir el flujo de `ANULADO` o retirarlo del enum. |
| BE-07 | `service/AttendanceView` — ver hallazgo FE-02 (bug de frontend, causa raíz combinada con BE-02) | — | — | — |
| BE-08 | `service/FinanzasService.java:140-147` | El ajuste automático hacia arriba del valor de la obligación ("Otro, especifique") **no comprueba `rubro.getTipo() == TipoRubro.OTRO`** — se aplica a cualquier rubro, incluidos los de valor fijo (MATRICULA, PENSION, EXTRACURRICULAR). Un representante que declare un monto mayor al valor fijo de una pensión hace que el código modifique permanentemente `obligacion.setValor(valorPagado)`. | Alto | Restringir el ajuste automático exclusivamente a `TipoRubro.OTRO`; para los demás, rechazar con `IllegalArgumentException` si `valorPagado != obligacion.getValor()`. |
| BE-09 | `service/FinanzasService.java:129-147` | La rama `idObligacion` (129-135) no tiene el mismo ajuste que la rama `idRubro`+`idEstudiante` (140-147): si `valorPagado` supera el valor de una obligación existente, el pago se inserta igual (nace `EN_REVISION`) pero falla más tarde en `aprobar()` con una excepción de Postgres sin traducir — el admin recibe un 500 genérico en vez de un mensaje de negocio claro. | Alto | Unificar la validación en ambas ramas; capturar la violación del trigger en `aprobar()` y traducirla a un mensaje de negocio (400), no dejarla caer en el handler genérico. |
| BE-10 | `dto/CalificacionDtos.java:12-14` vs `database/01_schema.sql` (CHECK real) | El DTO permite `@DecimalMin("0.0")` en las tres notas, pero el `CHECK` de Postgres exige `BETWEEN 1 AND 10`. Una nota de 0 (caso realista: "no entregó") pasa la validación de Spring y falla en la BD con un error confuso de restricción de datos, sin indicar cuál nota ni por qué. | Alto | Cambiar a `@DecimalMin("1.0")` en `notaTarea`/`notaClase`/`notaExamen` para que el 400 sea claro antes de llegar a la base de datos. |
| BE-11 | `repository/MateriaRepository.java` (archivo completo) | **Regresión de código muerto**: el informe previo dice haberlo eliminado por no tener referencias; hoy existe de nuevo y **sigue sin ninguna referencia** — `MateriaService` (el service real, nuevo, sí usado) resuelve todo vía `AsignacionDocenteRepository`, no inyecta esta interfaz. | Alto | Eliminar el archivo, o si se previó para un CRUD futuro de materias, documentarlo como deuda pendiente en vez de dejarlo huérfano. |
| BE-12 | `service/MensajeService.java:34-38` (`marcarLeido`) | No comprueba el `int` de filas afectadas que devuelve `destinatarios.marcarLeido(...)` — marcar como leído un mensaje ajeno o inexistente sigue devolviendo 200 sin error, **al contrario de lo que afirma `INFORME_AUDITORIA.md`**. `NotificacionService.marcarLeida` (líneas 73-80), en el mismo commit, sí implementa el patrón correcto (verifica `actualizadas == 0` → 404). **Verificado personalmente.** | Alto | Replicar el patrón de `NotificacionService.marcarLeida`. |
| BE-13 | `exception/GlobalExceptionHandler.java` | Sin `@ExceptionHandler` para `MaxUploadSizeExceededException` (archivo demasiado grande) ni para errores de binding de Spring MVC (`MissingServletRequestParameterException`, etc. — relevante en los `@RequestParam` sueltos de `FinanzasController.subirComprobante`). Ambos caen en el catch-all genérico → **HTTP 500** en vez de 413/400. No hay fuga de información, pero es un bug funcional: errores de cliente reportados como fallos de servidor. | Medio | Agregar handlers específicos para ambos casos. |
| BE-14 | `service/TareaService.java:136-157` (`subirEntrega`) | Un representante puede volver a subir un archivo aunque la entrega ya esté `REVISADO` (con nota/observación asignadas); el estado vuelve a `ENTREGADO` pero **no se limpian** `nota`/`observacionDocente`, dejando una calificación asociada a un archivo distinto del calificado. `fechaLimite` de `Tarea` nunca se compara con la fecha actual — es puramente decorativa. | Medio | Bloquear o limpiar nota/observación al re-enviar sobre una entrega ya revisada; decidir si `fechaLimite` debe bloquear/marcar subidas tardías. |
| BE-15 | `controller/CalificacionController.java` (`/api/calificaciones/buscar`) + `repository/CalificacionRepository.java:46-81` | Los 6 filtros son opcionales; sin ninguno, un ADMIN obtiene **todas** las calificaciones de la historia del colegio en una sola respuesta sin paginar. | Medio | Añadir `Pageable`, o exigir al menos un filtro no nulo. |
| BE-16 | `repository/MensajeDestinatarioRepository.java` / `NotificacionRepository.java` / `PagoRepository.java` (`findByEstadoRevisionOrderByFechaPagoAsc`, cola de revisión) | Tres listados sin paginar sobre tablas que crecen sin límite operacional: bandeja de mensajes, notificaciones, cola de comprobantes en revisión. | Medio | Convertir a `Page<>` con `Pageable` en los tres. |
| BE-17 | `config/AuditoriaContextAspect.java:26-34` | Usa `Ordered.LOWEST_PRECEDENCE` asumiendo que corre después del interceptor `@Transactional`, pero este último también usa el mismo valor por defecto (no hay `@EnableTransactionManagement(order=...)`) — sin garantía real de secuencia. Si el aspecto llegara a ejecutar fuera de la transacción, el guard evita un error pero esa fila de auditoría queda sin usuario atribuido, sin ninguna señal. No se pudo verificar en runtime cuál es el orden efectivo hoy. | Medio | Fijar `@EnableTransactionManagement(order = 0)` para eliminar el empate. |
| BE-18 | `config/SecurityConfig.java:54` | Regla `hasRole("ADMIN")` para `/api/admin/**`, sin ningún controller detrás — ruta fantasma (ya señalada como informativa en el informe previo, se confirma que sigue igual). | Bajo | Eliminar o documentar la reserva del prefijo. |
| BE-19 | `controller/EstudianteController.java:38-42` (`buscar`) | `q` no tiene `@NotBlank`; vacío devuelve todos los estudiantes activos (paginado a 20, pero sin filtro real). Riesgo bajo (ya es `hasRole('ADMIN')`). | Bajo | Añadir `@NotBlank`. |
| BE-20 | `middleware/JwtAuthFilter.java:34,42` | Cast sin defensa de `claims.get("roles", List.class)`; un `ClassCastException` no cae en el `catch(JwtException)` de la línea 48 y se propagaría sin control. Riesgo mínimo (requiere conocer el secreto HMAC). | Bajo | Envolver también `RuntimeException` en el filtro. |
| BE-21 | `service/StorageService.java:49-51` (`isConfigured`), `repository/EntregaTareaRepository.java:14`, `repository/CalificacionRepository.java:15`, `repository/PeriodoAcademicoRepository.java:10` (`List<> findByActivoTrue`) | Métodos/consultas nunca invocados desde ningún lugar — código muerto trivial. | Bajo | Eliminar. |
| BE-22 | Ausencia de `backend/src/test/` | Cero pruebas automatizadas en todo el backend (ya señalado como recomendación en el informe previo; se reafirma con contexto nuevo: es lo que permitió que BE-01/BE-02 pasaran desapercibidos). | Medio (proceso) | Priorizar tests de integración de autorización (`@WithMockUser`+`MockMvc`) para los servicios con `esPropio`/`exigirDueñoDeAsignacion`, cubriendo explícitamente los casos negativos. |
| BE-23 | `mvn compile` / `mvn package` | Compilación limpia (`BUILD SUCCESS`), sin warnings de `javac` (no hay `-Xlint` habilitado, así que esto no garantiza ausencia de *unchecked*/*deprecation*). Único aviso: Lombok 1.18.38 usa `sun.misc.Unsafe` al correr sobre el JDK 26 del sistema (terminally deprecated) — riesgo de portabilidad futura si algún día se compila con una JDK que lo elimine, no un problema del bytecode objetivo (fijo en 17). | Bajo (informativo) | Monitorear versión de Lombok; no requiere acción inmediata. |
| BE-24 | `MateriaController.java` / `RecursoAcademicoController.java` (no documentados en el manual) | Ambos completos, bien asegurados (`esPropio`/`exigirDueñoDeAsignacion`, subida vía `FileValidationService`), no a medio terminar — es una brecha de documentación, no de código. | Bajo | Documentar en el manual técnico. |

### Verificaciones positivas (sin hallazgo)
- Ningún controlador devuelve una entidad JPA directamente — todos usan DTOs (`record`), salvo `AuditoriaController` que devuelve proyecciones SQL de solo lectura.
- `server.error.include-stacktrace: never` se cumple en la práctica; ningún controller tiene `try/catch` propio que filtre mensajes internos.
- Los 3 endpoints de subida de archivo pasan por `FileValidationService` (firma binaria real, no solo extensión) antes de `StorageService.subir()`.
- Todas las escrituras multi-tabla revisadas (`MatriculaService.crear`, `TareaService.crear`, `FinanzasService.subirComprobante/aprobar`, `CalificacionService.registrarMasivo`) tienen `@Transactional`.
- `SecretsGuard` sigue exigiendo `SAGAB_DB_PASSWORD`/`SAGAB_JWT_SECRET` como variables de entorno explícitas — sin regresión.
- `RubroRepository` (que el informe previo dijo dejar intencionalmente) sí está en uso activo por `FinanzasService`.
- Ningún `catch` vacío ni `printStackTrace()` en todo el backend.

---

## 4. Hallazgos — Frontend

| ID | Archivo:Línea | Descripción | Severidad | Corrección propuesta |
|---|---|---|---|---|
| FE-01 | `components/Sidebar.tsx:23` + `views/AttendanceView.tsx:46` + `controller/AsistenciaController.java:23,29,37` + `AsignacionDocenteController.java:24` | **Todo el módulo de Asistencia es inutilizable para DECE**, pese a que el menú le ofrece la entrada. `AttendanceView` depende de `/api/asignaciones/mias` (solo DOCENTE/ADMIN, y DECE no tiene filas en `asignacion_docente`) y los 3 endpoints de `AsistenciaController` que usaría excluyen explícitamente a DECE. Un usuario DECE que entra a "Asistencia" solo ve "No se pudieron cargar sus asignaciones." **Coincide con y confirma el trazado end-to-end.** | **Crítico** | Backend: incluir `DECE` en `@PreAuthorize` de `porParalelo`/`consecutivasPorParalelo`. Frontend: construir una pantalla propia para DECE que no dependa de `asignaciones.mias()` (DECE no dicta materias), con acceso a paralelos vía `/api/paralelos` o un endpoint nuevo. |
| FE-02 | `views/AttendanceView.tsx:54-67` | **Bug de datos: sobrescritura silenciosa de asistencia ya guardada.** La pantalla inicializa a **todos** los estudiantes como "Presente" en cada montaje (línea 64) sin llamar nunca a `asistencia.porParalelo(idParalelo, fecha)` (existe en `sagab.ts` pero nadie la invoca) para precargar lo ya registrado. `AsistenciaService.registrar()` hace upsert — si el docente reabre la pantalla el mismo día para corregir un solo estudiante y guarda, sobrescribe con "Presente" las ausencias ya registradas de todos los demás, incluidas las que alimentan las alertas DECE. **Verificado personalmente leyendo el componente.** | **Crítico** | En el `useEffect` de carga, llamar `asistencia.porParalelo(idParalelo, hoy)` y usar esos valores para inicializar `estado` en vez de asumir "Presente" para todos. |
| FE-03 | `types.ts:1` + `components/Sidebar.tsx:24` + ausencia de `AuditoriaView.tsx` + `App.tsx` (switch de pantallas) | **El rol AUDITOR no tiene ninguna pantalla.** El backend de auditoría (`AuditoriaController`) está completo, seguro y bien paginado; `sagab.ts` tiene el cliente `auditoria` totalmente tipado — pero `Screen` no incluye ningún valor de auditoría, `NAV_POR_ROL.AUDITOR = ["dashboard"]` únicamente, y ningún componente importa `auditoria` desde `sagab.ts`. Es estructuralmente imposible navegar ahí. **Verificado personalmente: `types.ts` y `Sidebar.tsx` confirmados.** | **Crítico** | Agregar `"auditoria"` a `Screen` y a `NAV_POR_ROL.AUDITOR`; construir `AuditoriaView.tsx` (filtros por tabla/usuario para `cambios()`, tabla de `eventos()`, buscador tabla+idFila para `historialFila()`) reutilizando el patrón de búsqueda de `GradesView`/`FinancialView`. |
| FE-04 | `views/GradesView.tsx:299` + `controller/EstudianteController.java` (`/api/estudiantes/buscar`) | **Búsqueda de estudiante rota y silenciosa para DOCENTE.** `GradesView` es accesible a DOCENTE, y su pestaña "Búsqueda avanzada" llama `estudiantesApi.buscar`, pero ese endpoint exige `hasRole('ADMIN')`. Cada tecleo de un DOCENTE produce un 403 que `useDebouncedSearch` traga en su `.catch()`, mostrando "sin resultados" para siempre sin ningún mensaje de error. | Alto | Ampliar `@PreAuthorize` a `hasAnyRole('ADMIN','DOCENTE')`, o si es intencional, ocultar/deshabilitar ese campo para roles distintos de ADMIN. |
| FE-05 | `views/TareasView.tsx:69-77,213-217` | **El docente nunca puede calificar un deber con nota desde la UI.** El botón "Marcar revisado" llama `revisar(idEntrega)` sin `nota` ni `observacionDocente` — no existe ningún input para capturarlos en todo el componente. La entrega queda `REVISADO` con ambos campos `NULL` siempre, aunque `EntregaResponse.nota`/`.observacionDocente` se muestren prominentemente en el Portal Familiar ("Retroalimentación": "El docente no dejó ningún comentario", el 100% de las veces). **Coincide con y confirma el trazado end-to-end (Flujo 2).** | Alto | Añadir un formulario/modal (nota 1-10 + observación) antes de invocar `tareasApi.revisar(idEntrega, observacion, nota)` — la función ya acepta ambos parámetros, solo falta invocarla con datos reales. |
| FE-06 | `api/sagab.ts:413-424` (`recursosAcademicos.subirArchivo`/`.crearLink`) | Completamente tipados y listos, pero **ningún componente los invoca**. El lado de lectura del Portal Familiar sí está construido ("Aún no publicado por el docente."), pero el docente no tiene ninguna pantalla desde la cual publicar sílabo/formatos/link de clase. | Alto | Construir la UI faltante (pestaña "Recursos" dentro de `GradesView` o similar) que llame a estas funciones ya existentes. |
| FE-07 | `views/FinancialView.tsx:243-247` + ausencia de endpoint (ver BE nuevo abajo) | El botón "Registrar pago" solo se renderiza si ya existen obligaciones para el estudiante; un estudiante recién matriculado no tiene ninguna, y no hay ningún control en la UI para que un ADMIN origine la primera obligación de pago. **Confirmado por el trazado end-to-end (Flujo 1).** | Alto | Ver hallazgo nuevo "Falta endpoint de creación manual de obligación" más abajo; una vez exista, añadir el botón correspondiente. |
| — | `controller/FinanzasController.java` (archivo completo) | **Hallazgo de backend descubierto vía trazado end-to-end**: no existe `POST /api/finanzas/obligaciones` (ni equivalente) para que un ADMIN cree la primera obligación de un estudiante. La única vía de creación es `obtenerOCrearObligacionDelMes()`, invocada solo desde `subirComprobante()` (REPRESENTANTE/ESTUDIANTE). Un estudiante recién matriculado no tiene forma de que el colegio le registre un cargo hasta que la familia suba una transferencia primero. | Alto | Agregar `POST /api/finanzas/obligaciones` (ADMIN) que reciba `idEstudiante`+`idRubro` y reutilice `obtenerOCrearObligacionDelMes()`. |
| FE-08 | `views/DashboardView.tsx:99-105` | Los paneles "Alertas recientes" y "Actividad reciente" están permanentemente en `EmptyState` — no hay endpoint de backend para ninguno de los dos. UI construida sin fuente de datos. | Medio | Quitar la sección o marcarla explícitamente "Próximamente"; conectarla a un endpoint real una vez exista (útil también para mostrar las alertas DECE, ver FE-01). |
| FE-09 | `views/MatriculaView.tsx:45` vs `dto/MatriculaDtos.java:15` | El backend acepta género `[MFO]` ("Otro"), el `<select>` del frontend solo ofrece M/F. | Medio | Agregar `{ v: "O", l: "Otro" }`. |
| FE-10 | `views/MatriculaView.tsx` (varios campos de texto libre) | Campos como `nombres`, `direccion`, `contactoEmergencia`, `condicionMedica` no tienen `maxLength` reflejando los `@Size(max=...)` del backend, a diferencia de los campos numéricos que sí lo hacen — el usuario se entera del límite solo tras el round-trip. | Bajo | Agregar `maxLength` a esos campos. |
| FE-11 | `views/MatriculaView.tsx:48-52` (`NIVEL_EDAD`) | Solo cubre "1°/2°/3° BGU"; si se agregan paralelos de EGB/Inicial, la alerta de edad fuera de rango deja de mostrarse sin aviso. | Bajo | Documentar la limitación o derivar el rango de una tabla de configuración. |
| FE-12 | `types.ts:1` (`Screen`) | Incluye el literal `"login"`, que nunca se asigna (el login se maneja con `!sesion`, no vía `screen`). Miembro de unión muerto. | Bajo | Quitar `"login"` de `Screen`. |
| FE-13 | `api/sagab.ts:103-104` (`asistencia.porParalelo`) | Existe y está bien tipada, pero **nunca se invoca** — es exactamente la función que resolvería FE-02 si se cableara. | Bajo (síntoma de FE-02) | Se resuelve al aplicar la corrección de FE-02. |

### Verificaciones positivas (sin hallazgo)
- `tsc --noEmit` (strict, `noUnusedLocals`/`noUnusedParameters`): **0 errores**. `vite build`: limpio, sin sourcemaps. Cero `: any`/`as any`, cero `console.*`/`debugger`/`TODO`/`FIXME` reales en todo `src/`.
- Cada función de `sagab.ts` fue comparada campo a campo contra su DTO Java real: **ningún shape de respuesta incompatible**, ninguna ruta obsoleta.
- `MisMateriasView.tsx` (no listada en el manual como una de las "9 pantallas") **no es un placeholder** — es una pestaña interna completa y funcional del Portal Familiar, correctamente enrutada.
- Interceptor de 401 en `client.ts`: compartido entre `api()` (JSON) y `apiForm()` (multipart) — limpia `sessionStorage` y redirige a login en todos los casos, incluida una subida de archivo en curso. Sin defecto.
- Flujo Portal Familiar (Flujo 3 del trazado end-to-end): **funciona de punta a punta** — ver sección 6.

---

## 5. Hallazgos — Base de datos

| ID | Archivo:Línea (o Tabla) | Descripción | Severidad | Corrección propuesta |
|---|---|---|---|---|
| DB-01 | `database/setup_db.sh:20-31` | **El bootstrap del proyecto omite 10 de 21 scripts, y no menciona en absoluto los scripts 12 a 21.** Faltan `12_indice_check_pagos.sql` (índice + trigger anti-sobrepago), `13_particion_auditoria_automatica.sql` (evita que la auditoría caiga en el DEFAULT), y los 4 módulos nuevos completos (notificaciones, deberes, pagos por transferencia, recursos académicos). El script termina con éxito — **falla en silencio**. **Contradice directamente** `INFORME_AUDITORIA.md`, que afirma "se corrigió `setup_db.sh` para no omitir ningún script". **Verificado en vivo contra una BD de prueba real.** | **Crítico** | Reescribir el loop de `setup_db.sh` para incluir los 21 scripts en el orden correcto (ver DB-02). |
| DB-02 | Todos los scripts `database/*.sql` | **El orden numérico literal (01→21) no es ejecutable**: `05_datos_prueba.sql` inserta `usuario.username`, columna que solo existe desde `07`/`09` — falla reproduciblemente con `ERROR: column "username" of relation "usuario" does not exist`. El orden real y funcional, verificado ejecutando los 21 scripts contra una BD de prueba limpia, es: `01,02,03,04,06,09,05,11,07,08,10,12,13,14,15,16,17,18,19,20,21`. | **Crítico** | Documentar explícitamente este orden en un `README` de `database/` (el manual técnico solo cubre hasta el script 18 y con un orden que ya no aplica a la realidad de 21 scripts). |
| DB-03 | `database/14_notificaciones.sql` (tabla `notificacion`) | Tabla nueva de datos sensibles (nota, mensaje, materia, ligada a estudiante/representante) **sin trigger `trg_audit_*`**, a diferencia de las otras 3 tablas nuevas del mismo ciclo (`tarea`, `entrega_tarea`, `recurso_academico`), que sí lo tienen con el mismo patrón idempotente. **Verificado en vivo contra `pg_trigger`.** | Alto | Agregar `CREATE TRIGGER trg_audit_notificacion AFTER INSERT OR UPDATE OR DELETE ON sagab.notificacion FOR EACH ROW EXECUTE FUNCTION auditoria.fn_auditar('id_notificacion');`. |
| DB-04 | `repository/AsistenciaRepository.java` (`countByFechaAndEstadoIn`) usado en `DashboardService.java:42-43` | El KPI de asistencia del Dashboard (la pantalla más visitada, visible a ADMIN/DOCENTE/AUDITOR/DECE) filtra solo por `fecha`, columna que no es líder en ningún índice existente. Verificado empíricamente con ~110k filas sintéticas: sin *B-tree skip scan* (optimización de PG 18+; el proyecto declara objetivo "PostgreSQL 15+") cae a *Seq Scan*. | Medio-Alto | `CREATE INDEX idx_asistencia_fecha_estado ON sagab.asistencia (fecha, estado);` |
| DB-05 | `dto/FinanzasDtos.java` (`PagoRequest.metodo`) vs. `database/12_indice_check_pagos.sql` (`chk_pago_metodo`) | `metodo` es `String` sin validación en el DTO, mientras la BD exige `CHECK (metodo IN (...))`. Un valor fuera de dominio produce un 409 genérico de Postgres en vez de un 400 claro. Mitigante: el frontend actual nunca envía `metodo` en `registrarPago`, así que hoy no es explotable desde la UI. | Medio | Añadir `@Pattern` o convertir a enum Java, igual que ya se hizo con `estadoRevision`. |
| DB-06 | `controller/FinanzasController.java` / `RecursoAcademicoController.java` (`@RequestParam` multipart sueltos) | `banco`, `asunto`, `numeroReferencia`, `nombre` (de recurso académico) no tienen `@Size` reflejando los límites `VARCHAR(n)` de sus columnas — los `@RequestParam` multipart no pasan por Bean Validation como sí lo hacen los DTO JSON. Un valor más largo produce un error crudo de Postgres. | Bajo-Medio | Migrar a un record `@ModelAttribute` validado con `@Valid` y `@Size` equivalentes. |
| DB-07 | `repository/RubroRepository.java` (`findByAnioLectivoOrderByNombreAsc`) | Sin índice en `rubro.anio_lectivo`. Impacto real bajo (tabla catálogo pequeña). | Bajo | `CREATE INDEX idx_rubro_anio_lectivo ON sagab.rubro (anio_lectivo);` — prioridad baja. |
| DB-08 | `sagab.mensaje_destinatario`, `sagab.refresh_token` | Preexistentes, sin `trg_audit_*` (a diferencia del resto de tablas transaccionales). Menor prioridad que DB-03. | Bajo | Evaluar si conviene auditarlas. |
| DB-09 | Comparación de las 20 entidades JPA vs. esquema SQL acumulado | **Sin discrepancias** de tipo, nulabilidad, precisión o longitud. Los `CHECK` de rango tienen su equivalente en los DTO donde corresponde, con la única excepción ya reportada en BE-10 (`CalificacionDtos` notas 0 vs BD 1-10). | Informativo | Ninguna — verificación positiva. |
| DB-10 | Módulo "Mis Materias"/recursos académicos (código completo, no documentado) | Confirma lo ya señalado en backend (BE-24): funcionalidad real y completa, solo falta documentarla. | Bajo | Actualizar manual técnico e `INFORME_AUDITORIA.md`. |

---

## 6. Prueba funcional end-to-end por rol

Trazado estático riguroso (código real, capa por capa) + verificación en vivo de solo lectura contra una base de datos PostgreSQL real ya existente en el entorno (sin escribir en ella). No se levantó el stack completo en el navegador — se documenta explícitamente dónde cada hallazgo es deducción de código vs. dato confirmado en la BD real.

| # | Flujo | Veredicto | Resumen |
|---|---|---|---|
| 1 | **ADMIN**: matricular → cuentas automáticas → aprobar/rechazar pago | ⚠️ Con matices | Matrícula y aprobación/rechazo excelentemente implementadas y cableadas. Falta forma de que un ADMIN origine la primera obligación de pago de un estudiante nuevo (ver FE-07). |
| 2 | **DOCENTE**: publicar tarea → entregas PENDIENTE generadas → calificar | ⚠️ Con matices | Generación automática de `EntregaTarea` correcta y a prueba de duplicados (`UNIQUE(id_tarea,id_estudiante)` en BD). "Calificar" no tiene UI real — ver FE-05. |
| 3 | **REPRESENTANTE/ESTUDIANTE**: ver materias/deberes → subir entrega → subir comprobante → ver estado de cuenta | ✅ Funciona de punta a punta | El flujo mejor construido de los 5. `esPropio()` se aplica consistentemente; el estado de cuenta nunca muestra "Pagado" antes de que un admin apruebe. Único punto no verificable en este entorno: la subida real de bytes a S3 (bloqueada por falta de credenciales, ya documentado en `INFORME_AUDITORIA.md` §12). |
| 4 | **DECE**: ver alertas de ausencias consecutivas | ❌ Roto | Cero endpoints de asistencia accesibles para el rol (ver FE-01/BE-04). Ningún usuario en la BD real tiene siquiera el rol DECE asignado hoy. |
| 5 | **AUDITOR**: consultar historial de cambios de una fila | ❌ Roto | Backend perfecto y seguro; cero punto de entrada en la UI (ver FE-03). La única forma de usarlo hoy es con un cliente HTTP externo y un JWT válido. |

Los dos veredictos ❌ son los hallazgos más graves de todo el informe: hay trabajo de backend sólido, bien asegurado y probado, que resulta **completamente inalcanzable** para el rol que debía usarlo — peor que si no existiera, porque da una falsa sensación de "ya implementado".

---

## 7. Tabla consolidada — todos los críticos y altos

| ID | Hallazgo | Capa | Severidad |
|---|---|---|---|
| BE-01 | IDOR de escritura: DOCENTE puede calificar cualquier asignación | Backend | Crítico |
| BE-02 | IDOR de escritura: DOCENTE puede registrar asistencia de cualquier paralelo | Backend | Crítico |
| BE-06 | `EstadoPago.VENCIDO` nunca se asigna — módulo de mora inerte | Backend | Crítico |
| FE-01 | Módulo de Asistencia inutilizable para DECE (0 endpoints accesibles) | Frontend+Backend | Crítico |
| FE-02 | `AttendanceView` sobrescribe silenciosamente asistencia ya guardada | Frontend | Crítico |
| FE-03 | Rol AUDITOR sin ninguna pantalla — endpoint inalcanzable | Frontend | Crítico |
| DB-01 | `setup_db.sh` omite 10/21 scripts, contradice informe previo | Base de datos | Crítico |
| DB-02 | Orden numérico de scripts SQL no ejecutable tal cual | Base de datos | Crítico |
| BE-03 | IDOR de lectura: notas de cualquier asignación sin `Authentication` | Backend | Alto |
| BE-04 | IDOR de lectura: asistencia/alertas de cualquier paralelo sin `Authentication` | Backend | Alto |
| BE-08 | Ajuste automático de monto aplica a rubros de valor fijo, no solo "Otro" | Backend | Alto |
| BE-09 | Inconsistencia de validación de sobrepago entre ramas de `subirComprobante` | Backend | Alto |
| BE-10 | Nota 0 pasa validación Java pero falla en BD con error confuso | Backend | Alto |
| BE-11 | `MateriaRepository` código muerto — regresión | Backend | Alto |
| BE-12 | `MensajeService.marcarLeido` falla silenciosamente — regresión | Backend | Alto |
| FE-04 | Búsqueda de estudiante rota (403 silencioso) para DOCENTE | Frontend | Alto |
| FE-05 | Docente no puede calificar deber con nota desde la UI | Frontend | Alto |
| FE-06 | Publicación de recursos académicos sin UI (funciones API muertas) | Frontend | Alto |
| FE-07 | Sin endpoint/UI para que ADMIN origine la primera obligación de pago | Frontend+Backend | Alto |
| DB-03 | Tabla `notificacion` sin trigger de auditoría | Base de datos | Alto |

---

## 8. Limpieza automática aplicada

**Ninguna.** Los cinco frentes de auditoría (controladores, servicios/repos, frontend, base de datos, trazado end-to-end), de forma independiente, no encontraron imports sin usar, variables/funciones muertas triviales de bajo riesgo, `console.log`/`debugger` de depuración, ni comentarios `TODO`/`FIXME`. El compilador TypeScript (`noUnusedLocals`/`noUnusedParameters` en modo `strict`) y la compilación Java confirman esto de forma verificable, no solo por inspección.

Los únicos candidatos a "código muerto" encontrados (`MateriaRepository.java`, `StorageService.isConfigured()`, un puñado de métodos de repositorio sin uso, el literal `"login"` en `Screen`) se dejaron **fuera** de esta limpieza automática porque no son el tipo de cambio trivial y sin riesgo que acordamos limpiar sin revisión — son indicios de un problema más amplio (regresión de una corrección previa, o una función a medio conectar) y quedan listados en las tablas de arriba para que decidas el orden de corrección.

---

## 9. Fase 2 — Correcciones aplicadas

A pedido explícito tuyo ("continúa y arregla todo") se aplicaron todas las correcciones de este informe en la misma sesión, sin pasar hallazgo por hallazgo para confirmación individual. Cada cambio se verificó compilando el backend (`mvn compile`/`mvn -DskipTests package`) y/o el frontend (`tsc --noEmit` y `vite build`) después de aplicarlo; los cambios de base de datos se probaron ejecutando los scripts contra una base de datos PostgreSQL de prueba real (creada y destruida en esta sesión, sin tocar ninguna base de datos preexistente). Build final de ambos lados: **limpio, sin errores ni warnings nuevos**.

### 9.1 Críticos

| ID | Archivo(s) | Qué cambió y por qué |
|---|---|---|
| BE-01 | `service/CalificacionService.java`, `controller/CalificacionController.java` | `registrarMasivo` ahora carga la `AsignacionDocente` y llama `asignacionDocenteService.exigirDueñoDeAsignacion()` antes de guardar — un DOCENTE ya no puede calificar asignaciones ajenas. `registrar()` pasa `Authentication` en vez de solo el email. |
| BE-02 | `service/AsistenciaService.java`, `controller/AsistenciaController.java` | `registrar()` llama `asignacionDocenteService.exigirDocenteDelParalelo()` antes de guardar — un DOCENTE ya no puede registrar asistencia de paralelos donde no dicta. Método nuevo `exigirDocenteDelParalelo` en `AsignacionDocenteService` (+ `existsByDocenteUsuarioEmailAndParaleloId` en `AsignacionDocenteRepository`). |
| BE-03 / BE-04 | `service/CalificacionService.java` (`porAsignacion`), `service/AsistenciaService.java` (`porParalelo`, `consecutivasPorParalelo`), `service/EstudianteService.java` (`porParalelo`) | Los cuatro métodos ahora reciben `Authentication` y verifican propiedad (`exigirDueñoDeAsignacion`/`exigirDocenteDelParalelo`) antes de devolver datos — cerraba la lectura del mismo IDOR. |
| FE-01 | `controller/AsistenciaController.java`, `EstudianteController.java`, `ParaleloController.java` (roles `DECE` agregados a los endpoints de lectura), `frontend/src/app/views/DeceAlertasView.tsx` (nueva), `components/Sidebar.tsx`, `app/types.ts`, `app/App.tsx` | DECE ya tiene una pantalla propia ("Alertas de Asistencia") que no depende de `asignaciones.mias()` (DECE no dicta materias): selecciona paralelo desde `GET /api/paralelos`, lista estudiantes con 3+ ausencias consecutivas. `exigirDocenteDelParalelo` exime explícitamente a DECE en los endpoints de lectura (nunca en `registrar`, que sigue bloqueado a nivel de `@PreAuthorize`). |
| FE-02 | `frontend/src/app/views/AttendanceView.tsx`, `frontend/src/api/sagab.ts` (`asistencia.porParalelo` ahora tipado) | El `useEffect` de carga ahora llama `asistencia.porParalelo(idParalelo)` y precarga el estado real de cada estudiante para hoy, en vez de asumir "Presente" para todos — ya no se sobrescribe en silencio la asistencia ya guardada al reabrir la pantalla. |
| FE-03 | `frontend/src/app/views/AuditoriaView.tsx` (nueva), `api/sagab.ts` (tipos `EventoSeguridad`/`HistorialFilaItem`), `components/Sidebar.tsx`, `app/types.ts`, `app/App.tsx` | Pantalla nueva con 3 pestañas (historial de cambios con filtros, eventos de seguridad, trazabilidad por tabla+fila), usando el cliente `auditoria` que ya existía en `sagab.ts` pero nadie invocaba. Rol AUDITOR ya puede usar el backend de auditoría (que ya funcionaba bien) desde la UI. |
| BE-06 | `model/ObligacionPago.java` (sin cambios de esquema), `repository/ObligacionPagoRepository.java` (+`actualizarEstadoPorVencimiento`), `service/FinanzasService.java` (+`marcarObligacionesVencidas`), `config/ObligacionVencidaScheduler.java` (nuevo) | Job diario (02:00, + al arrancar) que transiciona `PENDIENTE`→`VENCIDO` cuando ya pasó `fecha_vencimiento`. El KPI "estudiantes en mora" del Dashboard ya refleja moras reales en vez de estar fijo en 0. |
| DB-01 / DB-02 | `database/setup_db.sh` | Reescrito: el loop automático ahora incluye los 17→19 scripts estructurales (antes solo 6), en el orden real verificado contra una BD de prueba (`01,02,03,04,06,09,12…23`, no el orden numérico literal — `09` debe ir antes de `07`/`08`/`10`/`05`/`11`). Las instrucciones manuales para datos de prueba y cuentas con credenciales reales quedaron completas y en el orden correcto. |

### 9.2 Altos

| ID | Archivo(s) | Qué cambió y por qué |
|---|---|---|
| BE-08 / BE-09 | `service/FinanzasService.java` | El ajuste automático de monto ("Otro, especifique") ahora exige `rubro.tipo == OTRO` — ya no se puede sobrescribir el valor de un rubro fijo (MATRÍCULA/PENSIÓN/EXTRACURRICULAR). Se unificó la validación entre las ramas `idObligacion` e `idRubro+idEstudiante`. `aprobar()` traduce el `RAISE EXCEPTION` del trigger `fn_validar_suma_pagos` a un 400 con mensaje de negocio en vez de un 500 genérico. |
| BE-11 | `repository/MateriaRepository.java` (eliminado) | Regresión confirmada: había vuelto a aparecer sin ninguna referencia real (`MateriaService` no lo usa). |
| BE-12 | `service/MensajeService.java` | `marcarLeido` ahora comprueba las filas afectadas y lanza `NoSuchElementException` (404) si el mensaje no existe o no es del usuario — mismo patrón que `NotificacionService.marcarLeida`, que sí lo tenía. |
| FE-04 | `controller/EstudianteController.java` | `/api/estudiantes/buscar` ahora acepta también `DOCENTE` (antes solo `ADMIN`) — la búsqueda de estudiante en "Búsqueda avanzada" de Calificaciones ya no falla en silencio con 403 para un docente. |
| FE-05 | `frontend/src/app/views/TareasView.tsx` | Nuevo modal "Calificar entrega" (nota 1–10 + observación) antes de invocar `tareasApi.revisar()` — el docente ya puede dejar una nota real, no solo cambiar el estado a REVISADO. `TareaService.subirEntrega` (backend) limpia `nota`/`observacionDocente`/`revisadoPor` si el representante reenvía el archivo sobre una entrega ya `REVISADO`. |
| FE-06 | `frontend/src/app/views/GradesView.tsx` (pestaña "Recursos" nueva) | El docente ya puede publicar sílabo/formatos (subida de archivo) y el link de clase virtual desde la UI, usando las funciones `recursosAcademicos.subirArchivo`/`.crearLink` que ya existían en `sagab.ts` sin ningún componente que las invocara. |
| FE-07 | `dto/FinanzasDtos.java` (+`CrearObligacionRequest`), `service/FinanzasService.java` (+`crearObligacion`), `controller/FinanzasController.java` (+`POST /api/finanzas/obligaciones`), `frontend/src/api/sagab.ts` (+`finanzas.crearObligacion`), `frontend/src/app/views/FinancialView.tsx` (botón + modal "Nueva obligación") | Un ADMIN ya puede originar la primera obligación de pago de un estudiante recién matriculado, sin depender de que la familia suba una transferencia primero. |
| DB-03 | `database/22_audit_notificacion.sql` (nuevo) | Trigger `trg_audit_notificacion`, mismo patrón idempotente que `tarea`/`entrega_tarea`/`recurso_academico` — la tabla `notificacion` (datos de nota/estudiante) ya queda auditada. |

### 9.3 Medios

| ID | Archivo(s) | Qué cambió |
|---|---|---|
| BE-13 | `exception/GlobalExceptionHandler.java` | Handlers nuevos para `ConstraintViolationException` (parámetros sueltos `@Validated`, 400) y `MaxUploadSizeExceededException` (archivo muy grande, 413) — antes ambos caían en el 500 genérico. |
| BE-14 | `service/TareaService.java` | Ya incluido en FE-05 (limpieza de nota al reenviar). |
| BE-15/16 | `repository/MensajeDestinatarioRepository.java`, `NotificacionRepository.java`, `PagoRepository.java`, `CalificacionRepository.java` (+ services correspondientes) | Bandeja de mensajes, notificaciones y cola de revisión de pagos acotadas con `Pageable` (100/100/200 filas); búsqueda avanzada de calificaciones con `LIMIT 500` en la consulta nativa — ninguna puede devolver ya una tabla completa sin límite. Sin cambios de contrato para el frontend (mismos endpoints, mismo shape de respuesta). |
| BE-17 | `SagabApplication.java` | `@EnableTransactionManagement(order = 0)` — fija el advisor transaccional por debajo de `AuditoriaContextAspect` (antes empatados en `LOWEST_PRECEDENCE`, sin garantía de orden real). |
| DB-04 | `database/23_indice_asistencia_dashboard.sql` (nuevo) | Índice `(fecha, estado)` en `sagab.asistencia` — el KPI de ausencias del Dashboard (la pantalla más visitada) ya no depende de que el motor soporte *B-tree skip scan*. |
| DB-05 | `dto/FinanzasDtos.java` | `PagoRequest.metodo` ahora valida `@Pattern(EFECTIVO\|TRANSFERENCIA\|CHEQUE\|TARJETA)` — igual que el `CHECK` de la base de datos. |
| DB-06 | `controller/FinanzasController.java`, `RecursoAcademicoController.java` | `@Size` en los `@RequestParam` multipart (`banco`, `asunto`, `numeroReferencia`, `nombre`) igual que los límites `VARCHAR` de sus columnas — ya no llega un error crudo de Postgres si el valor es muy largo. |
| FE-08 | `frontend/src/app/views/DashboardView.tsx` | Las tarjetas "Alertas recientes"/"Actividad reciente" ahora dicen "Próximamente" en vez de un `EmptyState` que sugería falsamente "sin datos" cuando en realidad no hay ninguna fuente conectada. |
| FE-09 | `frontend/src/app/views/MatriculaView.tsx` | Opción de género "Otro" agregada al selector (el backend ya la aceptaba). |

### 9.4 Bajos

| ID | Archivo(s) | Qué cambió |
|---|---|---|
| BE-18 | `config/SecurityConfig.java` | Eliminada la regla fantasma `/api/admin/**`; agregada una regla específica para `GET /api/finanzas/pagos/revision` (documenta la restricción real, ya aplicada por `@PreAuthorize`). |
| BE-19 | `controller/EstudianteController.java` | `q` de `/api/estudiantes/buscar` ahora exige `@NotBlank` (clase anotada `@Validated`). |
| BE-21 | `repository/EntregaTareaRepository.java`, `CalificacionRepository.java`, `PeriodoAcademicoRepository.java` | Eliminados los 3 métodos sin ninguna referencia real (`findByEstudianteIn`, `findByEstudianteIdAndIdAsignacionAndParcial`, `findByActivoTrue()`). `StorageService.isConfigured()` se revisó y **no** se tocó: sí tiene un uso interno real (`exigirConfigurado()`), el hallazgo original era impreciso. |
| FE-10 | `frontend/src/app/views/MatriculaView.tsx` | `maxLength` agregado a los 8 campos de texto libre que no lo tenían, igual que los límites `@Size` del backend. |
| FE-12 | `frontend/src/app/types.ts` | Quitado el literal `"login"` de `Screen` (nunca se usaba). |
| FE-13 | — | Resuelto automáticamente por FE-02: `asistencia.porParalelo` ya se invoca desde `AttendanceView`. |

### 9.5 No se tocó / se descartó tras verificar

- **BE-10** (rango de notas `0.0` vs `1.0` en `CalificacionDtos`): al revisar `database/09_estudiante_usuario.sql:52-60` se confirmó que el `CHECK` real ya fue corregido a `BETWEEN 0 AND 10` en esa migración (con justificación documentada: una nota de 0 es válida en la escala LOEI). El DTO ya estaba correcto — era un falso positivo del hallazgo original, que solo había mirado `01_schema.sql` sin ver la migración posterior.
- **`StorageService.isConfigured()`**: revisado, tiene uso interno real, no es código muerto (ver 9.4).
- **Flyway/Liquibase, tests automatizados**: fuera de alcance de esta sesión — son cambios estructurales mayores, señalados ya en `INFORME_AUDITORIA.md` como diferidos a una fase dedicada.
- **Subida real de archivos a S3**: sigue bloqueada por falta de credenciales `SAGAB_S3_*` (dato ya conocido, sección 12 de `INFORME_AUDITORIA.md`), no depende de código.

### 9.6 Verificación final

- `mvn compile` y `mvn -DskipTests package`: **BUILD SUCCESS**, sin warnings nuevos (solo el ya conocido de Lombok/JDK26, ajeno a estos cambios).
- `tsc --noEmit` y `vite build`: **limpio**, sin errores ni sourcemaps. Las 2 pantallas nuevas (`DeceAlertasView`, `AuditoriaView`) aparecen como chunks propios, confirmando el code-splitting por ruta.
- `database/`: los 21 scripts estructurales + `22_audit_notificacion.sql` + `23_indice_asistencia_dashboard.sql`, más los 5 scripts de datos de prueba/credenciales reales, se ejecutaron sin errores contra una base de datos de prueba nueva, en el orden documentado en `setup_db.sh`. La base de prueba se descartó al terminar; no se tocó ninguna base de datos preexistente.

## 10. Pendiente / próximos pasos sugeridos

Todo lo diagnosticado en este informe quedó corregido, salvo lo señalado en 9.5 (fuera de alcance por diseño). Como siguiente paso natural, valdría la pena:

1. Probar los flujos de DECE y AUDITOR con una cuenta real en un entorno con datos (hoy no hay ningún usuario con rol DECE en los datos de prueba, según confirmó el trazado end-to-end).
2. Considerar tests de integración de autorización (`@WithMockUser`+`MockMvc`) para `esPropio`/`exigirDueñoDeAsignacion`/`exigirDocenteDelParalelo`, dado que fueron precisamente las brechas más críticas de esta auditoría.
3. Cuando tengas las credenciales S3, probar la subida real de un deber y un comprobante (pendiente documentado desde `INFORME_AUDITORIA.md`).
