// ============================================================================
// SAGAB — Servicios de dominio (calificaciones, asistencia, auditoría)
// ============================================================================
import { api, apiForm } from "./client";

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
  periodo: string;
  docente: string;
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
  idPeriodo?: number;
  idDocente?: number;
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

export const asistencia = {
  registrar: (idParalelo: number, marcas: MarcaAsistencia[], fecha?: string) =>
    api<{ fecha: string; registrados: number; alertasDece: unknown[] }>("/api/asistencia", {
      method: "POST",
      body: { idParalelo, marcas, fecha },
    }),
  porParalelo: (idParalelo: number, fecha?: string) =>
    api<unknown[]>(`/api/asistencia/paralelo/${idParalelo}${fecha ? `?fecha=${fecha}` : ""}`),
  consecutivasPorParalelo: (idParalelo: number) =>
    api<Record<number, number>>(`/api/asistencia/paralelo/${idParalelo}/consecutivas`),
  porEstudiante: (idEstudiante: number) =>
    api<AsistenciaRegistro[]>(`/api/asistencia/estudiante/${idEstudiante}`),
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
  idMateria: number;
  materia: string;
  idPeriodo: number;
  periodo: string;
  periodoActivo: boolean;
  idDocente: number;
  docente: string;
}

export const asignaciones = {
  mias: () => api<AsignacionOpcion[]>("/api/asignaciones/mias"),
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

export const dashboard = {
  resumen: () => api<ResumenDashboard>("/api/dashboard/resumen"),
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

export const finanzas = {
  porEstudiante: (idEstudiante: number) =>
    api<ObligacionResponse[]>(`/api/finanzas/estudiante/${idEstudiante}`),
  registrarPago: (idObligacion: number, valorPagado: number, metodo?: string) =>
    api<ObligacionResponse>("/api/finanzas/pagos", {
      method: "POST",
      body: { idObligacion, valorPagado, metodo },
    }),
  /** Sube el comprobante de una transferencia; el pago queda EN_REVISION hasta que un admin lo apruebe. */
  subirComprobante: (params: {
    idObligacion: number; valorPagado: number; banco: string; asunto: string; numeroReferencia: string;
    fechaPago: string; comprobante: File;
  }) => {
    const fd = new FormData();
    fd.append("idObligacion", String(params.idObligacion));
    fd.append("valorPagado", String(params.valorPagado));
    fd.append("banco", params.banco);
    fd.append("asunto", params.asunto);
    fd.append("numeroReferencia", params.numeroReferencia);
    fd.append("fechaPago", params.fechaPago);
    fd.append("comprobante", params.comprobante);
    return apiForm<PagoRevisionResponse>("/api/finanzas/pagos/transferencia", fd);
  },
  colaRevision: () => api<PagoRevisionResponse[]>("/api/finanzas/pagos/revision"),
  aprobar: (idPago: number, observaciones?: string) =>
    api<PagoRevisionResponse>(`/api/finanzas/pagos/${idPago}/aprobar`, { method: "POST", body: { observaciones } }),
  rechazar: (idPago: number, observaciones?: string) =>
    api<PagoRevisionResponse>(`/api/finanzas/pagos/${idPago}/rechazar`, { method: "POST", body: { observaciones } }),
  urlComprobante: (idPago: number) => api<{ url: string }>(`/api/finanzas/pagos/${idPago}/comprobante`),
};

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
};

// ── Notificaciones automáticas (hoy: calificación < 7) ───────────────────
export interface NotificacionResponse {
  idNotificacion: number;
  materia: string;
  calificacion: number;
  mensaje: string;
  creadoEn: string;
  leida: boolean;
}

export const notificaciones = {
  mias: () => api<NotificacionResponse[]>("/api/notificaciones/mias"),
  marcarLeida: (idNotificacion: number) =>
    api<void>(`/api/notificaciones/${idNotificacion}/leida`, { method: "POST" }),
};

// ── Deberes (tareas y entregas con archivo adjunto) ──────────────────────
export type EstadoEntrega = "PENDIENTE" | "ENTREGADO" | "REVISADO";

export interface TareaResponse {
  idTarea: number;
  titulo: string;
  descripcion: string | null;
  fechaLimite: string;
  materia: string;
  curso: string;
  creadoEn: string;
}

export interface EntregaResponse {
  idEntrega: number;
  idTarea: number;
  tituloTarea: string;
  materia: string;
  curso: string;
  fechaLimite: string;
  idEstudiante: number;
  estudiante: string;
  estado: EstadoEntrega;
  archivoNombreOriginal: string | null;
  fechaEntrega: string | null;
  observacionDocente: string | null;
}

export const tareas = {
  crear: (idAsignacion: number, titulo: string, descripcion: string | undefined, fechaLimite: string) =>
    api<TareaResponse>("/api/tareas", { method: "POST", body: { idAsignacion, titulo, descripcion, fechaLimite } }),
  porAsignacion: (idAsignacion: number) => api<TareaResponse[]>(`/api/tareas/asignacion/${idAsignacion}`),
  entregasDeTarea: (idTarea: number) => api<EntregaResponse[]>(`/api/tareas/${idTarea}/entregas`),
  misEntregas: (idEstudiante: number) => api<EntregaResponse[]>(`/api/tareas/estudiante/${idEstudiante}`),
  subirEntrega: (idTarea: number, idEstudiante: number, archivo: File) => {
    const fd = new FormData();
    fd.append("archivo", archivo);
    return apiForm<EntregaResponse>(`/api/tareas/${idTarea}/estudiante/${idEstudiante}/entrega`, fd);
  },
  revisar: (idEntrega: number, observacionDocente?: string) =>
    api<EntregaResponse>(`/api/tareas/entregas/${idEntrega}/revisar`, { method: "POST", body: { observacionDocente } }),
  urlDescarga: (idEntrega: number) => api<{ url: string }>(`/api/tareas/entregas/${idEntrega}/descarga`),
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

export const auditoria = {
  cambios: (filtros: { tabla?: string; usuario?: string; pagina?: number } = {}) => {
    const q = new URLSearchParams();
    if (filtros.tabla) q.set("tabla", filtros.tabla);
    if (filtros.usuario) q.set("usuario", filtros.usuario);
    q.set("pagina", String(filtros.pagina ?? 0));
    return api<RegistroCambio[]>(`/api/auditoria/cambios?${q}`);
  },
  eventos: (pagina = 0) =>
    api<unknown[]>(`/api/auditoria/eventos?pagina=${pagina}`),
  historialFila: (tabla: string, idFila: string | number) =>
    api<unknown[]>(`/api/auditoria/historial/${tabla}/${idFila}`),
};
