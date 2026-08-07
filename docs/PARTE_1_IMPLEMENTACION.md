# SAGAB — Implementación del Prompt Maestro, Parte 1

Fecha de cierre técnico: 7 de agosto de 2026.

## Resultado

La Parte 1 quedó integrada sobre la arquitectura existente: React 18 + React Router en el frontend, API REST Spring Boot 3.3 y PostgreSQL como fuente persistente. No se creó una segunda fuente de usuarios, asignaciones, mensajes, tareas o recursos.

La migración que habilita el calendario es `database/28_calendario_institucional.sql`. Hibernate mantiene `ddl-auto: validate`; por tanto, la migración debe ejecutarse antes de arrancar esta versión del backend.

```bash
sudo -u postgres psql -d sagab -v ON_ERROR_STOP=1 \
  -f database/28_calendario_institucional.sql
```

En una instalación nueva, `database/setup_db.sh` ya incluye la migración 28 en el orden estructural verificado.

## Cambios funcionales

### Navegación interna protegida

La sesión válida crea un límite en el historial del navegador. El botón Atrás recorre pantallas internas reales, pero no puede regresar al login ni abandonar la SPA por el punto anterior al inicio de sesión. Las rutas siguen protegidas por rol; un acceso directo no autorizado se redirige al panel válido del usuario.

### Calendario institucional único

La vista compartida ofrece modos mensual, semanal y diario, navegación anterior/siguiente/hoy, salto por fecha, detalle y actualización automática. El endpoint central es:

```text
GET /api/calendario?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
```

El servicio compone, en una sola respuesta:

- eventos institucionales persistidos en `sagab.evento_calendario`;
- feriados nacionales, traslados legales y efemérides educativas ecuatorianas;
- fechas límite de tareas;
- fechas límite opcionales de recursos académicos;
- metadatos de materia, docente, adjuntos y enlace al elemento relacionado.

La zona horaria institucional es `America/Guayaquil` y el rango máximo por consulta es de 370 días. La vista conserva modo y fecha dentro de la sesión y refresca cada 30 segundos y al recuperar el foco.

Los feriados recurrentes aplican las reglas del Registro Oficial Suplemento 906, incluidas las reglas especiales de los días consecutivos 2 y 3 de noviembre. También se incluyen los descansos extraordinarios nacionales de 2026 dispuestos por los Decretos Ejecutivos 249 (2 de enero) y 354 (30 de abril). Los futuros puentes extraordinarios decretados después de esta versión deben incorporarse al catálogo del servicio o registrarse como evento institucional.

#### Gestión administrativa

Solo `ADMIN` puede crear, editar, duplicar y eliminar eventos mediante `/api/calendario`. Los estados son:

- `BORRADOR`: visible solo para administración;
- `PUBLICADO`: visible para todos los roles autorizados;
- `OCULTO`: visible solo para administración;
- `PROGRAMADO`: se publica automáticamente cuando llega `publicarEn`;
- `CANCELADO`: visible con su estado de cancelación.

Cada evento admite categoría, color, ubicación, descripción, un enlace externo opcional y hasta 10 archivos privados. Los archivos reutilizan el bucket S3, la inspección de firma binaria y las URLs temporales del proyecto; no quedan públicos ni se confía en la extensión enviada por el navegador. Las tablas `evento_calendario` y `evento_calendario_adjunto` tienen validaciones, índices y auditoría de inserciones, cambios y eliminaciones.

#### Visibilidad académica

| Rol | Eventos/fechas Ecuador | Tareas y recursos con fecha límite |
|---|---|---|
| ADMIN | Todos los estados | Todos |
| DOCENTE | Publicados, programados vigentes y cancelados | Solo sus asignaciones |
| ESTUDIANTE | Publicados, programados vigentes y cancelados | Solo su paralelo |
| REPRESENTANTE | Publicados, programados vigentes y cancelados | Solo los paralelos de sus representados |
| DECE | Publicados, programados vigentes y cancelados | No se exponen datos académicos ajenos |

### Portal Familiar y Deberes en Administración

El menú y el conjunto de pantallas permitidas de `ADMIN` ya no incluyen Portal Familiar ni Deberes. Las rutas se conservan para los roles que sí las utilizan; un administrador que intente abrirlas por URL es redirigido por el guard de permisos.

### Mensajes Institucionales

Administración dispone de la pantalla `/messages`, con dos destinos:

- todos los docentes activos;
- un docente activo concreto.

El envío usa las tablas existentes `mensaje` y `mensaje_destinatario`: se crea una fila de destinatario por profesor, por lo que cada copia conserva su propio estado y fecha de lectura. El historial administrativo muestra asunto, cuerpo, fecha, total de destinatarios y cantidad leída. El canal nuevo es `POST /api/mensajes/institucionales`.

La autorización del broadcast docente también se reforzó: un docente solo puede seleccionar estudiantes o paralelos pertenecientes a sus asignaciones vigentes; los grupos de alcance institucional quedan reservados para administración.

### Personal y asignaciones docentes

La pantalla Personal mantiene el alta/listado de cuentas y añade la administración central de `asignacion_docente`:

- un docente puede recibir una o varias materias en una sola operación;
- la asignación relaciona docente, materia, curso/paralelo y período/año lectivo;
- búsqueda y filtros por docente y período;
- edición y eliminación con validación de duplicados y coherencia del año lectivo;
- eliminación protegida por las relaciones existentes cuando ya hay información académica dependiente.

Endpoints:

```text
GET    /api/asignaciones/catalogos
POST   /api/asignaciones
PUT    /api/asignaciones/{id}
DELETE /api/asignaciones/{id}
GET    /api/asignaciones/mias
```

Calificaciones, asistencia, tareas, recursos, reportes y mensajería siguen leyendo la misma tabla `asignacion_docente`; por eso un cambio administrativo se propaga sin sincronizaciones paralelas.

## Seguridad y compatibilidad

- Los endpoints administrativos tienen `@PreAuthorize("hasRole('ADMIN')")`; el frontend no es la barrera de seguridad.
- Las credenciales de login/cambio de contraseña y el JWT se enmascaran en `toString()` y los logs HTTP/SQL se fijan en `INFO`, incluso si el entorno activa depuración global.
- Los cambios son aditivos: dos tablas nuevas y una columna nullable (`recurso_academico.fecha_limite`).
- El frontend carga las nuevas vistas de forma diferida para no aumentar el arranque inicial innecesariamente.

## Verificación ejecutada

```bash
cd backend && mvn test
cd frontend && npm run type-check
cd frontend && npm run build
git diff --check
```

También se validó desde cero sobre PostgreSQL 18 temporal:

1. ejecución secuencial de los scripts estructurales vigentes con `ON_ERROR_STOP`;
2. arranque del backend con validación de esquema Hibernate;
3. login de administrador y docente;
4. alta y eliminación de una asignación;
5. creación, publicación, duplicación, ocultación y visibilidad por rol de eventos;
6. consulta de feriados ecuatorianos;
7. mensaje institucional, recepción, lectura y contador administrativo;
8. aparición de vencimientos de tarea y recurso para docente y representante.

Desde la Parte 2, la carga real funciona también sin S3 mediante almacenamiento local y enlaces
HMAC temporales. En producción, `SAGAB_STORAGE_LOCAL_DIR` debe apuntar a un volumen persistente;
S3/R2 sigue siendo el proveedor recomendado para despliegues sin disco persistente.

La base temporal se usó exclusivamente para las pruebas integrales; no contiene ni reemplaza la base local/operativa.

## Archivos principales

- `database/28_calendario_institucional.sql`
- `backend/src/main/java/ec/edu/bellini/sagab/service/CalendarioService.java`
- `backend/src/main/java/ec/edu/bellini/sagab/service/FechasEcuadorService.java`
- `frontend/src/app/views/CalendarView.tsx`
- `frontend/src/app/views/MensajesInstitucionalesView.tsx`
- `frontend/src/app/views/PersonalView.tsx`
- `frontend/src/app/hooks/useInternalHistoryBoundary.ts`
