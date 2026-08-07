# SAGAB — Informe técnico de implementación, Prompt Maestro Parte 2

Fecha de cierre técnico: 7 de agosto de 2026.

## 1. Resultado ejecutivo

La Parte 2 se implementó sobre la arquitectura existente, conservando los cambios de la Parte 1 y
sin crear fuentes de datos paralelas. Los flujos entregados usan PostgreSQL, entidades JPA,
servicios transaccionales y la API REST real.

Resultado funcional:

- ausencias del docente con Curso/Paralelo encadenados y limitados a sus asignaciones;
- bandeja docente con No leídos, Leídos e Historial, apertura con lectura automática y contadores;
- recepción docente limitada en backend a mensajes cuyo remitente tenga rol ADMIN;
- recursos con carga, persistencia, descarga y metadatos reales, mediante S3/R2 o disco persistente;
- enlaces de clase HTTP/HTTPS validados;
- eliminación completa de Período y Docente del flujo de búsqueda avanzada;
- eliminación del Panel de Control para DECE, incluso por URL directa;
- módulo persistente de estudiantes en seguimiento, con búsqueda institucional, prevención de
  duplicados, datos personales/académicos, edición, eliminación lógica e historial;
- mensajes DECE exclusivos para estudiantes seguidos, con estado de lectura por destinatario;
- validación automatizada y E2E contra PostgreSQL temporal limpio.

## 2. Auditoría inicial y causas raíz

| Hallazgo | Severidad | Causa raíz | Corrección aplicada |
|---|---:|---|---|
| Selectores vacíos de ausencias para DOCENTE | Alta | La UI llamaba `/api/paralelos`, endpoint restringido a ADMIN/DECE | El docente construye sus opciones desde `/api/asignaciones/mias`; curso y paralelo quedan encadenados |
| Un docente podía consultar ausencias institucionales por API | Crítica | `AsistenciaService.reporteAusencias` no recibía autenticación ni imponía alcance | La consulta SQL exige una asignación del docente autenticado sobre el paralelo de cada fila |
| Bandeja docente recibía mensajes de cualquier rol | Alta | `mias()` consultaba todos los registros de `mensaje_destinatario` | Consulta específica con `EXISTS` sobre `usuario_rol` y `rol.codigo = 'ADMIN'` |
| Mensaje se mostraba completo sin semántica de apertura/lectura | Media | UI separaba “ver” y “marcar” mediante un botón manual | La apertura muestra el detalle, persiste `leido_en` y emite un evento que sincroniza contadores |
| Recursos fallaban sin credenciales S3 | Crítica operativa | `StorageService` tenía un único proveedor y bloqueaba toda subida si faltaban `SAGAB_S3_*` | Proveedor local real con directorio configurable y descarga HMAC; S3 conserva prioridad |
| Formatos de recursos incompletos | Alta | Validador de materiales no contemplaba TXT/CSV ni varios formatos multimedia | Catálogo ampliado con detección de contenido real y MIME seguro |
| Listado de recursos sin contexto completo | Media | DTO solo exponía autor y metadatos básicos | DTO incluye materia, curso, paralelo, docente, nombre original, MIME, tamaño y fecha |
| Período y Docente seguían en búsqueda avanzada | Media | Existían estado React, parámetros REST, DTO, joins SQL y columnas de tabla | Eliminados del frontend, contrato REST, DTO, servicio, proyección y joins SQL |
| DECE aterrizaba en Panel de Control | Alta | `pantallaInicial`, navegación y ruta `/dashboard` no diferenciaban DECE | Inicio DECE en `/deceSeguimiento`, menú sin dashboard y guard de ruta; backend también niega Dashboard |
| No existía expediente de seguimiento DECE | Crítica funcional | No había tablas, dominio, API ni pantalla para ese proceso | Migración 29 y módulo completo de seguimiento, historial y mensajería |
| Conversión de fechas en proyección nativa | Alta, detectada en E2E | PostgreSQL/JDBC proyectó `TIMESTAMPTZ` como `Instant`, no `OffsetDateTime` | Proyecciones nativas usan `Instant` y el servicio convierte explícitamente a UTC |

## 3. Implementación de backend

### 3.1 Ausencias

`GET /api/asistencia/reporte` ahora entrega `Authentication` al servicio. Para un DOCENTE, la
consulta añade una condición `EXISTS` que une `asignacion_docente`, `docente` y `usuario` y compara
el correo del JWT. ADMIN, AUDITOR y DECE mantienen el alcance institucional.

La restricción se ejecuta aunque el cliente omita o manipule `idParalelo`/`curso`. La UI no es la
barrera de seguridad.

### 3.2 Mensajería docente

`MensajeDestinatarioRepository` incorpora:

- bandeja docente exclusiva desde ADMIN;
- conteo de no leídos bajo la misma regla;
- consulta acotada a 100 mensajes, como el resto de la bandeja.

`MensajeService` resuelve remitentes en lote para evitar una consulta por fila. El Dashboard usa el
mismo conteo filtrado. Las cuentas con ADMIN y DOCENTE simultáneos conservan el alcance de ADMIN.

### 3.3 Recursos y almacenamiento

`StorageService` selecciona proveedor así:

1. si las cinco variables esenciales S3 están completas, usa S3/R2;
2. si todas están vacías, usa `SAGAB_STORAGE_LOCAL_DIR`;
3. si solo algunas están definidas, rechaza la operación con un error claro.

El proveedor local:

- genera claves UUID y normaliza rutas para impedir path traversal;
- persiste bytes reales con `CREATE_NEW`;
- emite una URL válida por 10 minutos con HMAC-SHA256;
- valida firma, expiración y pertenencia de la ruta al directorio configurado;
- sirve el archivo en streaming, sin cargarlo completo en memoria al descargar;
- elimina el objeto físico cuando se elimina el recurso.

Variables de entorno:

| Variable | Uso | Valor predeterminado |
|---|---|---|
| `SAGAB_STORAGE_LOCAL_DIR` | Directorio/volumen para objetos locales | `./data/uploads` |
| `SAGAB_PUBLIC_API_URL` | Origen público usado en enlaces firmados | `http://localhost:8080` |
| `SAGAB_UPLOAD_MAX_MB_RECURSOS` | Límite lógico para recursos | `100` |
| `SAGAB_UPLOAD_MAX_MB` | Límite multipart global | `100` |
| `SAGAB_S3_ENDPOINT` | Endpoint S3/R2 | vacío |
| `SAGAB_S3_REGION` | Región | `auto` |
| `SAGAB_S3_BUCKET` | Bucket privado | vacío |
| `SAGAB_S3_ACCESS_KEY` | Access key | vacío |
| `SAGAB_S3_SECRET_KEY` | Secret key | vacío |

Para un despliegue en Render sin Persistent Disk debe usarse S3/R2. Si se habilita Persistent Disk,
`SAGAB_STORAGE_LOCAL_DIR` debe apuntar al punto de montaje y `SAGAB_PUBLIC_API_URL` al dominio HTTPS
del servicio.

Formatos admitidos por recursos:

- PDF;
- Word, PowerPoint y Excel, tanto OOXML como formatos OLE antiguos;
- ZIP y RAR;
- JPG/JPEG, PNG, WEBP y GIF;
- MP4, MOV, WEBM y AVI;
- MP3, M4A, WAV y OGG;
- TXT y CSV UTF-8.

No se confía en el nombre ni `Content-Type` del navegador: se verifican magic bytes, estructura ZIP
de Office o contenido UTF-8 según el tipo. Un archivo renombrado como PDF se rechaza.

### 3.4 Búsqueda avanzada

Se eliminaron `idPeriodo` e `idDocente` como filtros públicos y las propiedades `periodo`/`docente`
del resultado. También se eliminaron los joins de `periodo_academico`, `docente` y `usuario` que solo
alimentaban esas columnas.

La restricción interna del DOCENTE se conserva como un parámetro técnico no expuesto: es necesaria
para impedir que el docente consulte calificaciones de asignaciones ajenas. No es un filtro de UI ni
código muerto.

### 3.5 Seguimiento DECE

API nueva, exclusiva de `ROLE_DECE`:

| Método | Ruta | Función |
|---|---|---|
| GET | `/api/dece/seguimientos/estudiantes?q=` | Buscar estudiantes institucionales existentes |
| GET | `/api/dece/seguimientos` | Listar/filtrar expedientes |
| GET | `/api/dece/seguimientos/{id}` | Datos personales y resumen académico |
| POST | `/api/dece/seguimientos` | Crear o reactivar un expediente archivado |
| PUT | `/api/dece/seguimientos/{id}` | Editar fecha, estado y observación |
| DELETE | `/api/dece/seguimientos/{id}` | Archivar mediante eliminación lógica |
| GET | `/api/dece/seguimientos/{id}/historial` | Historial de estados/cambios |
| POST | `/api/dece/seguimientos/{id}/mensajes` | Enviar mensaje al estudiante seguido |
| GET | `/api/dece/seguimientos/{id}/mensajes` | Historial y lectura por destinatario |

La búsqueda recibe nombres/apellidos y recupera de PostgreSQL código, curso, paralelo, correo y si
ya existe seguimiento. `UNIQUE(id_estudiante)` y la validación del servicio impiden duplicados.

El resumen académico se calcula en una consulta con subconsultas `LATERAL` para promedio, total de
calificaciones y ausencias injustificadas, evitando una consulta por estudiante.

La eliminación es lógica (`eliminado = true`, estado `ARCHIVADO`) para conservar auditoría,
historial y mensajes. Una nueva alta reactiva el mismo expediente en lugar de crear un duplicado.

El mensaje DECE solo puede enviarse cuando:

- el expediente existe y no está eliminado;
- el estudiante posee una cuenta propia activa;
- el destinatario es exactamente `estudiante.id_usuario`.

Cada envío reutiliza `mensaje`/`mensaje_destinatario`, registra el vínculo de seguimiento y genera
una notificación `MENSAJE`. La lectura automática del estudiante actualiza la misma fila
`mensaje_destinatario`; el historial DECE refleja `leido_en` real.

## 4. Implementación de frontend

### 4.1 DOCENTE

- Ausencias carga cursos/paralelos desde sus asignaciones activas.
- Cambiar Curso reinicia y filtra Paralelo.
- Filtrar ejecuta la consulta real; Imprimir genera el reporte de las filas filtradas.
- La impresión escapa HTML de nombres, justificaciones y filtros.
- Mensajes muestra No leídos, Leídos e Historial.
- Abrir un mensaje muestra el cuerpo y lo marca leído automáticamente.
- La campana, el modal, el KPI y el Portal Familiar comparten el evento
  `sagab:mensajes-actualizados` para refrescar contadores.
- El compositor docente mantiene Curso → Paralelo → estudiantes de sus asignaciones.

### 4.2 Recursos

- Selector de 100 MB con todos los formatos documentados.
- Mensajes de error provenientes de la API, sin simulaciones.
- Listado con tipo, fecha, materia, paralelo, docente, archivo original, MIME y tamaño.
- Descarga real mediante URL firmada.
- Publicación de enlaces de clase HTTP/HTTPS.
- Material semanal separado de Sílabo/Formato/Link para evitar filas duplicadas en la pantalla.

### 4.3 DECE

- El Sidebar no contiene Inicio/Panel de Control para DECE.
- `/dashboard` redirige a `/deceSeguimiento`; el endpoint backend también responde 403.
- La pantalla nueva permite buscar por Nombres y Apellidos.
- Los resultados muestran datos recuperados, no campos manuales duplicados.
- El expediente muestra datos personales, condición médica y resumen académico.
- Incluye edición, eliminación confirmada, historial y mensajería personalizada.
- El historial de mensajes diferencia Leído/No leído y muestra la fecha de lectura.

## 5. Base de datos

Migración nueva: `database/29_seguimiento_dece.sql`.

### `seguimiento_dece`

- expediente único por estudiante;
- usuario DECE que lo registró;
- fecha de inicio, estado y observación;
- eliminación lógica;
- fechas de creación/actualización;
- trigger de actualización y auditoría.

### `seguimiento_dece_historial`

- estado anterior/nuevo;
- observación vigente en el cambio;
- usuario que realizó el cambio;
- fecha inmutable del cambio;
- auditoría de INSERT/UPDATE/DELETE.

### `seguimiento_dece_mensaje`

- vínculo entre expediente y mensaje real;
- destinatario exacto;
- usuario DECE remitente;
- fecha de vínculo;
- unicidad de mensaje y auditoría.

`database/setup_db.sh` incorpora la migración 29 y ahora ejecuta 23 scripts estructurales.

## 6. Seguridad y privacidad

- RBAC en controlador y método: el módulo DECE exige `ROLE_DECE`.
- Autorización por ámbito docente aplicada en SQL, no solo en componentes React.
- Mensajes docentes filtrados por rol real del remitente.
- Mensajes DECE dirigidos únicamente a la cuenta propia del estudiante seguido.
- No se exponen hashes, credenciales de almacenamiento ni rutas físicas.
- Enlaces locales firmados con HMAC, expiración de 10 minutos y comparación constante de firma.
- Claves de objetos con UUID y defensa contra path traversal.
- MIME/firmas validados en servidor.
- URL de clase restringida a HTTP/HTTPS con host y sin credenciales incrustadas.
- Eliminación lógica e historial para trazabilidad LOPDP/institucional.
- Límites de texto, archivos, resultados y bandejas para reducir abuso de recursos.

## 7. Rendimiento y mantenibilidad

- Reportes de ausencias limitados a 500 filas y filtrados en base.
- Expedientes limitados a 500 filas, con índices por estado/actualización.
- Búsqueda de estudiantes limitada a 15 coincidencias.
- Agregados académicos resueltos en una consulta mediante `LATERAL`.
- Remitentes de bandeja resueltos en lote.
- Eliminación de tres joins y columnas innecesarias en búsqueda avanzada.
- Vistas cargadas con `React.lazy`; el módulo DECE es un chunk separado (~18.7 kB sin comprimir).
- Descarga local en streaming.
- Configuración de proveedor centralizada en `StorageService`.

## 8. Validación ejecutada

### Automatizada

- `mvn test`: 12 pruebas, 0 fallos.
- Nuevas pruebas de TXT UTF-8, binario disfrazado, firma falsa de PDF, persistencia local,
  token HMAC manipulado y configuración S3 parcial.
- `npm run type-check`: sin errores.
- `npm run build`: producción generada correctamente.
- `git diff --check`: sin errores de espacios/parches.

El build mantiene una advertencia ya conocida: `vendor-charts` mide aproximadamente 553 kB antes
de gzip. No bloquea el despliegue y el módulo nuevo sí queda separado por ruta.

### PostgreSQL limpio

Se creó una instancia PostgreSQL 18 temporal y desechable:

1. se aplicaron los 23 scripts estructurales con `ON_ERROR_STOP=1`;
2. se comprobaron 31 tablas en `sagab` y 8 en `auditoria`;
3. Hibernate arrancó con `ddl-auto: validate` sin diferencias de esquema;
4. al terminar, backend, base y archivos temporales fueron detenidos/eliminados.

### E2E HTTP real

Escenario aprobado:

- login ADMIN, DOCENTE, DECE y ESTUDIANTE;
- 403 de DECE sobre Dashboard y de DOCENTE sobre seguimiento DECE;
- reporte institucional con dos ausencias frente a una sola fila autorizada para el docente;
- búsqueda, alta, rechazo de duplicado, edición, historial, eliminación lógica y conservación del
  historial DECE;
- envío DECE, recepción no leída, lectura automática y visualización de `leido_en`;
- notificación MENSAJE al estudiante;
- carga TXT multipart real, persistencia, metadatos, URL HMAC y descarga del mismo contenido;
- publicación de enlace Meet válido;
- exclusión de un mensaje no administrativo inyectado deliberadamente en la bandeja docente;
- búsqueda de calificaciones sin propiedades `periodo` ni `docente`.

Resultado del escenario: `E2E_OK`.

## 9. Despliegue y operación

En una base existente con 01–27:

```bash
sudo -u postgres psql -d sagab -v ON_ERROR_STOP=1 -f database/28_calendario_institucional.sql
sudo -u postgres psql -d sagab -v ON_ERROR_STOP=1 -f database/29_seguimiento_dece.sql
```

Estas migraciones deben ejecutarse con el propietario del esquema. La base operativa del equipo no
se modificó durante esta implementación; solo se usó PostgreSQL temporal. Hasta aplicar 28 y 29 en
la base operativa, `ddl-auto: validate` impedirá correctamente arrancar este código contra ese
esquema incompleto.

Para almacenamiento local de producción:

```bash
export SAGAB_STORAGE_LOCAL_DIR=/var/lib/sagab/uploads
export SAGAB_PUBLIC_API_URL=https://api.sagab.institucion.edu.ec
export SAGAB_JWT_SECRET='<secreto aleatorio de 32+ bytes>'
```

El directorio debe pertenecer al usuario del proceso Java, tener permisos mínimos y formar parte de
la política de copias de seguridad. No debe publicarse directamente con Nginx; las descargas deben
seguir pasando por los enlaces firmados.

## 10. Recomendaciones siguientes

1. Aplicar migraciones 28 y 29 en una ventana controlada y ejecutar respaldo previo.
2. Decidir proveedor definitivo: volumen persistente institucional o bucket S3/R2 privado.
3. Definir `SAGAB_PUBLIC_API_URL` y secretos reales antes de producción.
4. Incorporar Flyway/Liquibase para registrar versión de esquema automáticamente.
5. Añadir antivirus/antimalware asíncrono para archivos si el entorno institucional dispone de
   ClamAV u otro motor; la validación actual cubre tipo/contenido, no análisis de malware.
6. Añadir paginación UI/API si el seguimiento supera 500 expedientes o las bandejas 100 mensajes.
7. Separar `vendor-charts` o cargar gráficos bajo demanda si se quiere eliminar la advertencia de
   tamaño de Vite.
8. Integrar las pruebas E2E en CI con PostgreSQL de servicio.

## 11. Archivos principales

- `database/29_seguimiento_dece.sql`
- `backend/.../service/SeguimientoDeceService.java`
- `backend/.../controller/SeguimientoDeceController.java`
- `backend/.../service/StorageService.java`
- `backend/.../controller/StorageController.java`
- `backend/.../service/FileValidationService.java`
- `frontend/src/app/views/DeceSeguimientoView.tsx`
- `frontend/src/app/components/AusenciasDrilldown.tsx`
- `frontend/src/app/components/MensajesDrilldown.tsx`
- `frontend/src/app/components/MaterialSemanalPanel.tsx`
- `frontend/src/app/views/GradesView.tsx`
