// ============================================================================
// SAGAB — Servicios de dominio (calificaciones, asistencia, auditoría)
// ============================================================================
import { api, apiBlob, apiForm } from "./client";

// ── Calificaciones ─────────────────────────────────────────────────────
export interface NotaRequest {
  idEstudiante: number;
  notaTarea: number;
  notaClase: number;
  notaExamen: number;
  observacion?: string;
}

export interface NotaResponse {
  idCalificacion: number;
  idEstudiante: number;
  estudiante: string;
  notaTarea: number;
  notaClase: number;
  notaExamen: number;
  promedio: number;
  enRiesgo: boolean;      // promedio < 7 → alerta al representante
}

export interface NotaEstudianteResponse {
  idCalificacion: number;
  materia: string;
  parcial: number;
  notaTarea: number;
  notaClase: number;
  notaExamen: number;
  promedio: number;
  enRiesgo: boolean;
}

export interface NotaBusquedaResponse {
  idCalificacion: number;
  idEstudiante: number;
  estudiante: string;
  curso: string;
  materia: string;
  parcial: number;
  notaTarea: number;
  notaClase: number;
  notaExamen: number;
  promedio: number;
  enRiesgo: boolean;
}

export interface BusquedaCalificacionesFiltros {
  idEstudiante?: number;
  idParalelo?: number;
  idMateria?: number;
  parcial?: number;
}

export const calificaciones = {
  registrarMasivo: (idAsignacion: number, parcial: number, notas: NotaRequest[]) =>
    api<NotaResponse[]>("/api/calificaciones", {
      method: "POST",
      body: { idAsignacion, parcial, notas },
    }),
  porAsignacion: (idAsignacion: number, parcial: number) =>
    api<NotaResponse[]>(`/api/calificaciones/asignacion/${idAsignacion}/parcial/${parcial}`),
  porEstudiante: (idEstudiante: number) =>
    api<NotaEstudianteResponse[]>(`/api/calificaciones/estudiante/${idEstudiante}`),
  buscar: (filtros: BusquedaCalificacionesFiltros) => {
    const q = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => { if (v !== undefined && v !== null) q.set(k, String(v)); });
    return api<NotaBusquedaResponse[]>(`/api/calificaciones/buscar?${q}`);
  },
  eliminar: (idCalificacion: number) =>
    api<void>(`/api/calificaciones/${idCalificacion}`, { method: "DELETE" }),
  /** Papeleta de calificaciones en PDF — botón "Generar Papeleta" de la búsqueda avanzada. */
  papeleta: (idEstudiante: number, idPeriodo?: number) =>
    apiBlob(`/api/calificaciones/${idEstudiante}/papeleta${idPeriodo != null ? `?idPeriodo=${idPeriodo}` : ""}`),
};

// ── Asistencia ─────────────────────────────────────────────────────────
export type EstadoAsistencia =
  | "PRESENTE" | "AUSENCIA_JUSTIFICADA" | "AUSENCIA_INJUSTIFICADA" | "ATRASO";

export interface MarcaAsistencia {
  idEstudiante: number;
  estado: EstadoAsistencia;
  justificacion?: string;
}

export interface AsistenciaRegistro {
  fecha: string;
  estado: EstadoAsistencia;
  justificacion: string | null;
}

export interface RegistroParaleloItem {
  idEstudiante: number;
  estudiante: string;
  estado: EstadoAsistencia;
  justificacion: string | null;
}

export interface ReporteAusenciaResponse {
  idAsistencia: number;
  idEstudiante: number;
  estudiante: string;
  curso: string;
  paralelo: string;
  fecha: string;
  estado: EstadoAsistencia;
  justificacion: string | null;
  registradoPor: string | null;
}

export const asistencia = {
  registrar: (idParalelo: number, marcas: MarcaAsistencia[], fecha?: string) =>
    api<{ fecha: string; registrados: number; alertasDece: unknown[] }>("/api/asistencia", {
      method: "POST",
      body: { idParalelo, marcas, fecha },
    }),
  porParalelo: (idParalelo: number, fecha?: string) =>
    api<RegistroParaleloItem[]>(`/api/asistencia/paralelo/${idParalelo}${fecha ? `?fecha=${fecha}` : ""}`),
  consecutivasPorParalelo: (idParalelo: number) =>
    api<Record<number, number>>(`/api/asistencia/paralelo/${idParalelo}/consecutivas`),
  porEstudiante: (idEstudiante: number) =>
    api<AsistenciaRegistro[]>(`/api/asistencia/estudiante/${idEstudiante}`),
  /** Drill-down "Ausencias" del Dashboard — faltas y atrasos institucionales, con filtros. */
  reporte: (filtros: { desde?: string; hasta?: string; idParalelo?: number; curso?: string } = {}) => {
    const q = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") q.set(k, String(v)); });
    return api<ReporteAusenciaResponse[]>(`/api/asistencia/reporte?${q}`);
  },
};

// ── Paralelos (para el selector de Matrícula) ──────────────────────────
export interface ParaleloOpcion {
  id: number;
  nivel: string;
  seccion: string;
  anioLectivo: string;
  etiqueta: string;
}

export const paralelos = {
  listar: () => api<ParaleloOpcion[]>("/api/paralelos"),
};

// ── Asignaciones docentes (qué clases dicta el docente autenticado) ────
export interface AsignacionOpcion {
  idAsignacion: number;
  idParalelo: number;
  paralelo: string;
  nivel: string;
  seccion: string;
  anioLectivo: string;
  idMateria: number;
  materia: string;
  idPeriodo: number;
  periodo: string;
  periodoActivo: boolean;
  idDocente: number;
  docente: string;
}

export interface AsignacionCatalogos {
  docentes: { idDocente: number; idUsuario: number; nombre: string; email: string }[];
  materias: { idMateria: number; codigo: string; nombre: string; area: string | null }[];
  paralelos: { idParalelo: number; nivel: string; seccion: string; anioLectivo: string; etiqueta: string }[];
  periodos: { idPeriodo: number; nombre: string; anioLectivo: string; etiqueta: string; activo: boolean }[];
}

export const asignaciones = {
  mias: () => api<AsignacionOpcion[]>("/api/asignaciones/mias"),
  catalogos: () => api<AsignacionCatalogos>("/api/asignaciones/catalogos"),
  crear: (req: { idDocente: number; idsMaterias: number[]; idParalelo: number; idPeriodo: number }) =>
    api<AsignacionOpcion[]>("/api/asignaciones", { method: "POST", body: req }),
  editar: (id: number, req: { idDocente: number; idMateria: number; idParalelo: number; idPeriodo: number }) =>
    api<AsignacionOpcion>(`/api/asignaciones/${id}`, { method: "PUT", body: req }),
  eliminar: (id: number) => api<void>(`/api/asignaciones/${id}`, { method: "DELETE" }),
};

// ── Estudiantes (nómina por paralelo, para Notas y Asistencia) ─────────
export interface EstudianteResumen {
  id: number;
  codigo: string;
  nombreCompleto: string;
}

export interface EstudianteConParalelo extends EstudianteResumen {
  paralelo: string | null;
}

export const estudiantes = {
  porParalelo: (idParalelo: number) => api<EstudianteResumen[]>(`/api/estudiantes/paralelo/${idParalelo}`),
  mios: () => api<EstudianteConParalelo[]>("/api/estudiantes/mios"),
  buscar: (q: string) => api<EstudianteConParalelo[]>(`/api/estudiantes/buscar?q=${encodeURIComponent(q)}`),
};

// ── Matrícula (alta de estudiante + representante) ──────────────────────
export interface MatriculaRequest {
  estudianteNombres: string;
  estudianteApellidos: string;
  estudianteCedula: string;
  fechaNacimiento: string;
  genero: string;
  nivel: string;
  seccion: string;
  anioLectivo: string;
  institucionProcedencia?: string;
  direccion: string;
  telefonoEstudiante?: string;
  tipoSangre?: string;
  condicionMedica?: string;
  representanteNombres: string;
  representanteApellidos: string;
  representanteCedula: string;
  parentesco: string;
  representanteEmail: string;
  representanteTelefono: string;
  contactoEmergencia: string;
  documentos: string[];
}

export interface MatriculaResponse {
  idEstudiante: number;
  codigo: string;
  usuarioEstudiante: string;
  representanteNuevo: boolean;
  usuarioRepresentante: string;
  claveTemporal: string | null;
}

export const matriculas = {
  crear: (req: MatriculaRequest) =>
    api<MatriculaResponse>("/api/matriculas", { method: "POST", body: req }),
};

// ── Dashboard (indicadores institucionales) ─────────────────────────────
export interface RendimientoParalelo {
  paralelo: string;
  promedio: number;
}

export interface ResumenDashboard {
  promedioInstitucional: number | null;
  estudiantesEnMora: number;
  ausenciasHoy: number;
  mensajesPendientes: number;
  rendimientoPorParalelo: RendimientoParalelo[];
}

export interface PromedioAgrupado {
  etiqueta: string;
  promedio: number;
  totalCalificaciones: number;
}

/** Fila de la pestaña "Tendencia por año": el promedio de un curso/paralelo puntual en un año
 * lectivo puntual (no un número aislado sin contexto). */
export interface TendenciaAnual {
  anioLectivo: string;
  curso: string;
  paralelo: string;
  promedio: number;
  totalCalificaciones: number;
}

export interface PromedioDetalle {
  promedioInstitucional: number | null;
  porCurso: PromedioAgrupado[];
  porParalelo: PromedioAgrupado[];
  porMateria: PromedioAgrupado[];
  porAnioLectivo: TendenciaAnual[];
}

export const dashboard = {
  resumen: () => api<ResumenDashboard>("/api/dashboard/resumen"),
  /** Drill-down "Promedio institucional": desglose por curso/paralelo/materia/docente/año. */
  promedio: () => api<PromedioDetalle>("/api/dashboard/promedio"),
};

// ── Finanzas (pagos/obligaciones de un estudiante) ──────────────────────
export type EstadoRevisionPago = "EN_REVISION" | "APROBADO" | "RECHAZADO";

export interface PagoResponse {
  idPago: number;
  valorPagado: number;
  metodo: string;
  numeroRecibo: string;
  fechaPago: string;
  estadoRevision: EstadoRevisionPago;
}

export interface ObligacionResponse {
  idObligacion: number;
  rubro: string;
  tipo: string;
  mes: string;
  valor: number;
  fechaVencimiento: string;
  estado: "PENDIENTE" | "PAGADO" | "VENCIDO" | "ANULADO";
  pago: PagoResponse | null;
}

export interface PagoRevisionResponse {
  idPago: number;
  idObligacion: number;
  estudiante: string;
  rubro: string;
  valorPagado: number;
  bancoOrigen: string | null;
  asunto: string | null;
  numeroReferencia: string | null;
  fechaPago: string;
  comprobanteNombreOriginal: string | null;
  estadoRevision: EstadoRevisionPago;
  observacionesAdmin: string | null;
}

/** Motivo de pago disponible (rubro del año lectivo vigente) — selector del Portal Familiar. */
export interface RubroResponse {
  idRubro: number;
  nombre: string;
  tipo: string;
  valor: number;
}

export const finanzas = {
  porEstudiante: (idEstudiante: number) =>
    api<ObligacionResponse[]>(`/api/finanzas/estudiante/${idEstudiante}`),
  registrarPago: (idObligacion: number, valorPagado: number, metodo?: string) =>
    api<ObligacionResponse>("/api/finanzas/pagos", {
      method: "POST",
      body: { idObligacion, valorPagado, metodo },
    }),
  crearObligacion: (idEstudiante: number, idRubro: number) =>
    api<ObligacionResponse>("/api/finanzas/obligaciones", {
      method: "POST",
      body: { idEstudiante, idRubro },
    }),
  /**
   * Sube el comprobante de una transferencia; el pago queda EN_REVISION hasta que un admin lo apruebe.
   * Se indica `idObligacion` (una obligación ya generada) o, si el estudiante todavía no tiene
   * ninguna, `idRubro` + `idEstudiante` (el motivo de pago) — el backend genera la obligación
   * del mes automáticamente, así no hace falta que un admin la cree a mano de antemano.
   */
  subirComprobante: (params: {
    idObligacion?: number; idRubro?: number; idEstudiante?: number; valorPagado?: number;
    banco: string; asunto: string; numeroReferencia: string; fechaPago: string; comprobante: File;
  }) => {
    const fd = new FormData();
    if (params.idObligacion != null) fd.append("idObligacion", String(params.idObligacion));
    if (params.idRubro != null) fd.append("idRubro", String(params.idRubro));
    if (params.idEstudiante != null) fd.append("idEstudiante", String(params.idEstudiante));
    if (params.valorPagado != null) fd.append("valorPagado", String(params.valorPagado));
    fd.append("banco", params.banco);
    fd.append("asunto", params.asunto);
    fd.append("numeroReferencia", params.numeroReferencia);
    fd.append("fechaPago", params.fechaPago);
    fd.append("comprobante", params.comprobante);
    return apiForm<PagoRevisionResponse>("/api/finanzas/pagos/transferencia", fd);
  },
  rubros: () => api<RubroResponse[]>("/api/finanzas/rubros"),
  colaRevision: () => api<PagoRevisionResponse[]>("/api/finanzas/pagos/revision"),
  aprobar: (idPago: number, observaciones?: string) =>
    api<PagoRevisionResponse>(`/api/finanzas/pagos/${idPago}/aprobar`, { method: "POST", body: { observaciones } }),
  rechazar: (idPago: number, observaciones?: string) =>
    api<PagoRevisionResponse>(`/api/finanzas/pagos/${idPago}/rechazar`, { method: "POST", body: { observaciones } }),
  urlComprobante: (idPago: number) => api<{ url: string }>(`/api/finanzas/pagos/${idPago}/comprobante`),
  /** Drill-down "Estudiantes en mora" del Dashboard. */
  mora: () => api<EstudianteMoraResponse[]>("/api/finanzas/mora"),
  enviarComunicacion: (idEstudiante: number, body: ComunicacionMoraRequest) =>
    api<void>(`/api/finanzas/mora/${idEstudiante}/comunicacion`, { method: "POST", body }),
};

/** Fila del drill-down "Estudiantes en mora" — un registro por estudiante, con el total de
 * sus obligaciones vencidas y los datos de contacto de su representante. */
export interface EstudianteMoraResponse {
  idEstudiante: number;
  codigo: string;
  nombreCompleto: string;
  paralelo: string | null;
  representante: string | null;
  representanteTelefono: string | null;
  representanteEmail: string | null;
  valorPendiente: number;
  fechaVencimientoMasAntigua: string;
  obligacionesVencidas: number;
}

/** El backend admite además NOTIFICACION/EMAIL, pero el Dashboard solo ofrece estos dos canales
 * (ver MoraDrilldown: "Enviar recordatorio de pago" y "Enviar mensaje privado"). */
export type CanalComunicacionMora = "RECORDATORIO" | "MENSAJE_INTERNO";

export interface ComunicacionMoraRequest {
  canal: CanalComunicacionMora;
  asunto?: string;
  mensaje: string;
}

// ── Mensajería (bandeja de entrada) ──────────────────────────────────────
export interface MensajeResponse {
  idMensaje: number;
  asunto: string;
  cuerpo: string;
  esCircular: boolean;
  remitente: string;
  enviadoEn: string;
  leido: boolean;
}

export const mensajes = {
  mias: () => api<MensajeResponse[]>("/api/mensajes/mias"),
  marcarLeido: (idMensaje: number) =>
    api<void>(`/api/mensajes/${idMensaje}/leido`, { method: "POST" }),
  /** Envío directo a ids ya resueltos (ADMIN); docentes utilizan enviarBroadcast(). */
  enviar: (idsDestinatarios: number[], asunto: string, cuerpo: string) =>
    api<MensajeResponse>("/api/mensajes", { method: "POST", body: { idsDestinatarios, asunto, cuerpo } }),
  enviados: () => api<MensajeEnviadoResponse[]>("/api/mensajes/enviados"),
  /** Envío masivo por grupo — el backend resuelve el grupo a destinatarios concretos. */
  enviarBroadcast: (req: EnviarBroadcastRequest) =>
    api<MensajeResponse>("/api/mensajes/broadcast", { method: "POST", body: req }),
  enviarInstitucional: (req: { idDocenteUsuario?: number; asunto: string; cuerpo: string }) =>
    api<MensajeResponse>("/api/mensajes/institucionales", { method: "POST", body: req }),
};

export type GrupoDestinatario =
  | "ESTUDIANTES" | "TODO_CURSO" | "TODO_PARALELO" | "TODOS_REPRESENTANTES" | "TODOS_DOCENTES" | "TODO_COLEGIO";

export interface EnviarBroadcastRequest {
  grupo: GrupoDestinatario;
  idsEstudiantes?: number[];
  idParalelo?: number;
  curso?: string;
  asunto: string;
  cuerpo: string;
}

/** Fila de la pestaña "Enviados" — incluye cuántos de los destinatarios ya lo leyeron. */
export interface MensajeEnviadoResponse {
  idMensaje: number;
  asunto: string;
  cuerpo: string;
  esCircular: boolean;
  enviadoEn: string;
  totalDestinatarios: number;
  leidos: number;
}

// ── Notificaciones (calificación < 7, pagos, y otras genéricas) ──────────
export type TipoNotificacion = "CALIFICACION" | "PAGO" | "MENSAJE" | "SISTEMA";

export interface NotificacionResponse {
  idNotificacion: number;
  tipo: TipoNotificacion;
  materia: string | null;
  calificacion: number | null;
  mensaje: string;
  creadoEn: string;
  leida: boolean;
}

export const notificaciones = {
  mias: () => api<NotificacionResponse[]>("/api/notificaciones/mias"),
  marcarLeida: (idNotificacion: number) =>
    api<void>(`/api/notificaciones/${idNotificacion}/leida`, { method: "POST" }),
};

// ── Calendario institucional unificado ─────────────────────────────────
export type EstadoEventoCalendario = "BORRADOR" | "PUBLICADO" | "OCULTO" | "PROGRAMADO" | "CANCELADO";
export type CategoriaEventoCalendario = "INSTITUCIONAL" | "ACADEMICO" | "REUNION" | "CAPACITACION" | "EVALUACION" | "DEPORTIVO" | "CULTURAL" | "OTRO";

export interface CalendarioItemResponse {
  id: string;
  idEvento: number | null;
  tipo: "INSTITUCIONAL" | "FERIADO" | "FECHA_IMPORTANTE" | "TAREA" | "RECURSO";
  titulo: string;
  descripcion: string | null;
  inicio: string;
  fin: string;
  lugar: string | null;
  categoria: string;
  color: string;
  estado: EstadoEventoCalendario | "PUBLICADO";
  publicarEn: string | null;
  creador: string;
  creadoEn: string | null;
  materia: string | null;
  docente: string | null;
  idRelacionado: number | null;
  rutaRelacionada: string | null;
  adjuntos: { idAdjunto: number | null; nombre: string; url: string }[];
}

export interface GuardarEventoCalendario {
  titulo: string;
  descripcion?: string;
  inicio: string;
  fin: string;
  lugar?: string;
  categoria: CategoriaEventoCalendario;
  color: string;
  estado: EstadoEventoCalendario;
  publicarEn?: string;
  adjuntoNombre?: string;
  adjuntoUrl?: string;
}

export const calendario = {
  listar: (desde: string, hasta: string) =>
    api<CalendarioItemResponse[]>(`/api/calendario?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`),
  crear: (req: GuardarEventoCalendario) =>
    api<CalendarioItemResponse>("/api/calendario", { method: "POST", body: req }),
  editar: (id: number, req: GuardarEventoCalendario) =>
    api<CalendarioItemResponse>(`/api/calendario/${id}`, { method: "PUT", body: req }),
  duplicar: (id: number) =>
    api<CalendarioItemResponse>(`/api/calendario/${id}/duplicar`, { method: "POST" }),
  eliminar: (id: number) => api<void>(`/api/calendario/${id}`, { method: "DELETE" }),
  subirAdjunto: (id: number, archivo: File, nombre?: string) => {
    const fd = new FormData();
    fd.append("archivo", archivo);
    if (nombre) fd.append("nombre", nombre);
    return apiForm<{ idAdjunto: number; nombre: string; url: string }>(`/api/calendario/${id}/adjuntos`, fd);
  },
  eliminarAdjunto: (idAdjunto: number) =>
    api<void>(`/api/calendario/adjuntos/${idAdjunto}`, { method: "DELETE" }),
};

// ── Deberes (tareas y entregas con archivo adjunto) ──────────────────────
export type EstadoEntrega = "PENDIENTE" | "ENTREGADO" | "REVISADO";

export interface TareaResponse {
  idTarea: number;
  titulo: string;
  descripcion: string | null;
  fechaLimite: string;
  parcial: 1 | 2 | 3;
  puntaje: number;
  materia: string;
  curso: string;
  creadoEn: string;
}

/** Material de apoyo adjunto a la tarea (no a la entrega del estudiante). */
export interface AdjuntoTareaResponse {
  idAdjunto: number;
  nombre: string;
  archivoNombreOriginal: string;
  archivoMimeType: string;
  archivoTamanoBytes: number;
  creadoEn: string;
}

export interface EntregaResponse {
  idEntrega: number;
  idTarea: number;
  tituloTarea: string;
  materia: string;
  curso: string;
  fechaLimite: string;
  parcial: 1 | 2 | 3;
  puntaje: number;
  idEstudiante: number;
  estudiante: string;
  estado: EstadoEntrega;
  archivoNombreOriginal: string | null;
  fechaEntrega: string | null;
  observacionDocente: string | null;
  nota: number | null;
}

export const tareas = {
  crear: (idAsignacion: number, titulo: string, descripcion: string | undefined, fechaLimite: string, parcial: 1 | 2 | 3, puntaje?: number) =>
    api<TareaResponse>("/api/tareas", { method: "POST", body: { idAsignacion, titulo, descripcion, fechaLimite, parcial, puntaje } }),
  editar: (idTarea: number, titulo: string, descripcion: string | undefined, fechaLimite: string, parcial: 1 | 2 | 3, puntaje: number) =>
    api<TareaResponse>(`/api/tareas/${idTarea}`, { method: "PUT", body: { titulo, descripcion, fechaLimite, parcial, puntaje } }),
  /** Solo se puede eliminar un deber sin entregas subidas ni calificadas. */
  eliminar: (idTarea: number) => api<void>(`/api/tareas/${idTarea}`, { method: "DELETE" }),
  porAsignacion: (idAsignacion: number) => api<TareaResponse[]>(`/api/tareas/asignacion/${idAsignacion}`),
  entregasDeTarea: (idTarea: number) => api<EntregaResponse[]>(`/api/tareas/${idTarea}/entregas`),
  misEntregas: (idEstudiante: number) => api<EntregaResponse[]>(`/api/tareas/estudiante/${idEstudiante}`),
  subirEntrega: (idTarea: number, idEstudiante: number, archivo: File) => {
    const fd = new FormData();
    fd.append("archivo", archivo);
    return apiForm<EntregaResponse>(`/api/tareas/${idTarea}/estudiante/${idEstudiante}/entrega`, fd);
  },
  revisar: (idEntrega: number, observacionDocente?: string, nota?: number) =>
    api<EntregaResponse>(`/api/tareas/entregas/${idEntrega}/revisar`, { method: "POST", body: { observacionDocente, nota } }),
  urlDescarga: (idEntrega: number) => api<{ url: string }>(`/api/tareas/entregas/${idEntrega}/descarga`),
  /** Material de apoyo de la tarea (guías, imágenes de referencia, etc. — no la entrega del estudiante). */
  adjuntosDeTarea: (idTarea: number, idEstudiante?: number) =>
    api<AdjuntoTareaResponse[]>(`/api/tareas/${idTarea}/adjuntos${idEstudiante != null ? `?idEstudiante=${idEstudiante}` : ""}`),
  subirAdjunto: (idTarea: number, nombre: string, archivo: File) => {
    const fd = new FormData();
    fd.append("nombre", nombre);
    fd.append("archivo", archivo);
    return apiForm<AdjuntoTareaResponse>(`/api/tareas/${idTarea}/adjuntos`, fd);
  },
  urlDescargaAdjunto: (idAdjunto: number, idEstudiante?: number) =>
    api<{ url: string }>(`/api/tareas/adjuntos/${idAdjunto}/descarga${idEstudiante != null ? `?idEstudiante=${idEstudiante}` : ""}`),
  eliminarAdjunto: (idAdjunto: number) => api<void>(`/api/tareas/adjuntos/${idAdjunto}`, { method: "DELETE" }),
};

// ── Materias del estudiante (Portal Familiar — "Mis materias") ─────────
export interface MateriaEstudianteResponse {
  idMateria: number;
  codigo: string;
  nombre: string;
  area: string | null;
  idAsignacion: number;
  docente: string;
  porcentajeAvance: number;
}

export const materias = {
  porEstudiante: (idEstudiante: number) =>
    api<MateriaEstudianteResponse[]>(`/api/materias/estudiante/${idEstudiante}`),
};

// ── Recursos académicos (sílabo, formatos, link de clase, material semanal) ─
export type TipoRecursoAcademico = "SILABO" | "FORMATO" | "LINK_CLASE" | "MATERIAL";

export interface RecursoAcademicoResponse {
  idRecurso: number;
  tipo: TipoRecursoAcademico;
  nombre: string;
  descripcion: string | null;
  semana: number | null;
  urlExterna: string | null;
  archivoNombreOriginal: string | null;
  archivoMimeType: string | null;
  archivoTamanoBytes: number | null;
  materia: string;
  curso: string;
  paralelo: string;
  docente: string;
  autor: string;
  creadoEn: string;
  fechaLimite: string | null;
}

export const recursosAcademicos = {
  porAsignacion: (idAsignacion: number, idEstudiante?: number) =>
    api<RecursoAcademicoResponse[]>(
      `/api/recursos-academicos/asignacion/${idAsignacion}${idEstudiante != null ? `?idEstudiante=${idEstudiante}` : ""}`),
  subirArchivo: (idAsignacion: number, tipo: Exclude<TipoRecursoAcademico, "LINK_CLASE">, nombre: string, archivo: File,
                 opciones: { descripcion?: string; semana?: number; fechaLimite?: string } = {}) => {
    const fd = new FormData();
    fd.append("idAsignacion", String(idAsignacion));
    fd.append("tipo", tipo);
    fd.append("nombre", nombre);
    if (opciones.descripcion) fd.append("descripcion", opciones.descripcion);
    if (opciones.semana != null) fd.append("semana", String(opciones.semana));
    if (opciones.fechaLimite) fd.append("fechaLimite", opciones.fechaLimite);
    fd.append("archivo", archivo);
    return apiForm<RecursoAcademicoResponse>("/api/recursos-academicos/archivo", fd);
  },
  crearLink: (idAsignacion: number, nombre: string, urlExterna: string,
              opciones: { descripcion?: string; semana?: number; fechaLimite?: string } = {}) =>
    api<RecursoAcademicoResponse>("/api/recursos-academicos/link", {
      method: "POST", body: { idAsignacion, nombre, urlExterna, descripcion: opciones.descripcion, semana: opciones.semana, fechaLimite: opciones.fechaLimite },
    }),
  editar: (idRecurso: number, nombre: string, descripcion: string | undefined, semana: number | undefined, fechaLimite?: string) =>
    api<RecursoAcademicoResponse>(`/api/recursos-academicos/${idRecurso}`, {
      method: "PATCH", body: { nombre, descripcion, semana, fechaLimite },
    }),
  eliminar: (idRecurso: number) =>
    api<void>(`/api/recursos-academicos/${idRecurso}`, { method: "DELETE" }),
  urlDescarga: (idRecurso: number, idEstudiante?: number) =>
    api<{ url: string }>(
      `/api/recursos-academicos/${idRecurso}/descarga${idEstudiante != null ? `?idEstudiante=${idEstudiante}` : ""}`),
};

// ── Consejería DECE: estudiantes en seguimiento ───────────────────────
export type EstadoSeguimientoDece = "ACTIVO" | "EN_OBSERVACION" | "INTERVENCION" | "RESUELTO" | "ARCHIVADO";

export interface EstudianteBusquedaDece {
  idEstudiante: number;
  codigo: string;
  estudiante: string;
  curso: string | null;
  paralelo: string | null;
  email: string | null;
  enSeguimiento: boolean;
  idSeguimiento: number | null;
}

export interface SeguimientoDeceResponse {
  idSeguimiento: number;
  idEstudiante: number;
  codigo: string;
  estudiante: string;
  cedula: string | null;
  email: string | null;
  fechaNacimiento: string;
  genero: string | null;
  telefono: string | null;
  tipoSangre: string | null;
  condicionMedica: string | null;
  contactoEmergencia: string | null;
  curso: string | null;
  paralelo: string | null;
  promedioGeneral: number | null;
  totalCalificaciones: number;
  ausenciasInjustificadas: number;
  fechaInicio: string;
  estado: EstadoSeguimientoDece;
  observacion: string | null;
  registradoPor: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface HistorialSeguimientoDece {
  idHistorial: number;
  estadoAnterior: EstadoSeguimientoDece | null;
  estadoNuevo: EstadoSeguimientoDece;
  observacion: string | null;
  cambiadoPor: string;
  cambiadoEn: string;
}

export interface MensajeSeguimientoDece {
  idMensaje: number;
  asunto: string;
  cuerpo: string;
  remitente: string;
  enviadoEn: string;
  leidoEn: string | null;
  leido: boolean;
}

export const seguimientoDece = {
  buscarEstudiantes: (q: string) =>
    api<EstudianteBusquedaDece[]>(`/api/dece/seguimientos/estudiantes?q=${encodeURIComponent(q)}`),
  listar: (filtros: { q?: string; estado?: EstadoSeguimientoDece } = {}) => {
    const q = new URLSearchParams();
    if (filtros.q) q.set("q", filtros.q);
    if (filtros.estado) q.set("estado", filtros.estado);
    return api<SeguimientoDeceResponse[]>(`/api/dece/seguimientos${q.size ? `?${q}` : ""}`);
  },
  detalle: (id: number) => api<SeguimientoDeceResponse>(`/api/dece/seguimientos/${id}`),
  crear: (req: { idEstudiante: number; fechaInicio: string; estado: EstadoSeguimientoDece; observacion?: string }) =>
    api<SeguimientoDeceResponse>("/api/dece/seguimientos", { method: "POST", body: req }),
  editar: (id: number, req: { fechaInicio: string; estado: EstadoSeguimientoDece; observacion?: string }) =>
    api<SeguimientoDeceResponse>(`/api/dece/seguimientos/${id}`, { method: "PUT", body: req }),
  eliminar: (id: number) => api<void>(`/api/dece/seguimientos/${id}`, { method: "DELETE" }),
  historial: (id: number) => api<HistorialSeguimientoDece[]>(`/api/dece/seguimientos/${id}/historial`),
  mensajes: (id: number) => api<MensajeSeguimientoDece[]>(`/api/dece/seguimientos/${id}/mensajes`),
  enviarMensaje: (id: number, asunto: string, cuerpo: string) =>
    api<MensajeSeguimientoDece>(`/api/dece/seguimientos/${id}/mensajes`, { method: "POST", body: { asunto, cuerpo } }),
};

// ── Auditoría (solo roles AUDITOR / ADMIN) ─────────────────────────────
export interface RegistroCambio {
  id_registro: number;
  ejecutado_en: string;
  usuario_app: string | null;
  operacion: string;
  tabla: string;
  id_fila: string;
  columnas_modificadas: string[] | null;
  datos_antes: string | null;
  datos_despues: string | null;
  ip_cliente: string | null;
}

export interface EventoSeguridad {
  id_evento: number;
  ejecutado_en: string;
  operacion: string;
  usuario_app: string | null;
  detalle: string | null;
  ip_cliente: string | null;
  user_agent: string | null;
}

export interface HistorialFilaItem {
  ejecutado_en: string;
  usuario_app: string | null;
  operacion: string;
  columnas_modificadas: string[] | null;
  datos_antes: string | null;
  datos_despues: string | null;
}

export const auditoria = {
  cambios: (filtros: { tabla?: string; usuario?: string; pagina?: number } = {}) => {
    const q = new URLSearchParams();
    if (filtros.tabla) q.set("tabla", filtros.tabla);
    if (filtros.usuario) q.set("usuario", filtros.usuario);
    q.set("pagina", String(filtros.pagina ?? 0));
    return api<RegistroCambio[]>(`/api/auditoria/cambios?${q}`);
  },
  eventos: (pagina = 0) =>
    api<EventoSeguridad[]>(`/api/auditoria/eventos?pagina=${pagina}`),
  historialFila: (tabla: string, idFila: string | number) =>
    api<HistorialFilaItem[]>(`/api/auditoria/historial/${tabla}/${idFila}`),
};

// ── Personal (alta de cuentas DOCENTE / DECE / AUDITOR — solo ADMIN) ───
export type RolPersonal = "DOCENTE" | "DECE" | "AUDITOR";

export interface PersonalRequest {
  nombres: string;
  apellidos: string;
  cedula: string;
  email: string;
  telefono?: string;
  rol: RolPersonal;
  tituloDocente?: string;
}

export interface PersonalResponse {
  idUsuario: number;
  nombreCompleto: string;
  username: string;
  email: string;
  rol: string;
  claveTemporal: string;
}

export interface PersonalResumen {
  idUsuario: number;
  nombreCompleto: string;
  username: string;
  email: string;
  rol: string;
  estado: string;
}

export const personal = {
  crear: (req: PersonalRequest) =>
    api<PersonalResponse>("/api/personal", { method: "POST", body: req }),
  listar: () => api<PersonalResumen[]>("/api/personal"),
};
