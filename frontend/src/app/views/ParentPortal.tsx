import { useEffect, useState } from "react";
import {
  AlertCircle, AlertTriangle, BookOpen, CheckCircle2, Clock, DollarSign, FileUp as FileUpIcon,
  GraduationCap, Home, Loader2, LogOut, Send, Smartphone, Upload, Users,
} from "lucide-react";
import { ApiError } from "../../api/client";
import type { RolSistema } from "../../api/auth";
import {
  estudiantes as estudiantesApi, calificaciones as calificacionesApi, asistencia as asistenciaApi,
  finanzas as finanzasApi, mensajes as mensajesApi, notificaciones as notificacionesApi,
  tareas as tareasApi,
  type EstudianteConParalelo, type NotaEstudianteResponse, type AsistenciaRegistro,
  type ObligacionResponse, type MensajeResponse, type NotificacionResponse, type EntregaResponse,
  type RubroResponse, type TipoNotificacion,
} from "../../api/sagab";
import { EmptyState } from "../components/EmptyState";
import { Badge } from "../components/Badge";
import { Btn } from "../components/Btn";
import { DateField } from "../components/DateField";
import { FileUpload } from "../components/FileUpload";
import { useToast } from "../components/Toast";
import { initials } from "../helpers";
import { PAYMENT_CFG, ESTADO_TO_STATUS } from "../paymentConfig";
import { MisMateriasView } from "./MisMateriasView";
// Formulario de pago por transferencia en Bootstrap (a pedido explícito), escopado bajo
// ".matricula-form" — mismo mecanismo que ya usa MatriculaView, ver scripts/scope-bootstrap.mjs.
import "../../styles/bootstrap-scoped.css";

type ParentTab = "home" | "grades" | "attendance" | "tareas" | "materias" | "payments";

const ESTADO_ENTREGA_BADGE: Record<EntregaResponse["estado"], { v: "success" | "warning" | "error" | "info"; label: string }> = {
  PENDIENTE: { v: "info", label: "Pendiente" },
  ENTREGADO: { v: "warning", label: "Entregado" },
  REVISADO:  { v: "success", label: "Revisado" },
};

// Título de la notificación cuando no es de tipo CALIFICACION (esas usan n.materia directamente).
const TITULO_NOTIFICACION: Record<TipoNotificacion, string> = {
  CALIFICACION: "Calificación",
  PAGO: "Pago pendiente",
  MENSAJE: "Mensaje",
  SISTEMA: "Aviso",
};

export function ParentPortal({ onLogout, embed = false, nombre = "", rol = "REPRESENTANTE" }: {
  onLogout: () => void; embed?: boolean; nombre?: string; rol?: RolSistema;
}) {
  const toast = useToast();
  const esRepresentante = rol === "REPRESENTANTE";
  const [tab, setTab] = useState<ParentTab>("home");
  const [hijos, setHijos] = useState<EstudianteConParalelo[]>([]);
  const [idEstudiante, setIdEstudiante] = useState<number | null>(null);
  const [notas, setNotas] = useState<NotaEstudianteResponse[]>([]);
  const [asistenciaHist, setAsistenciaHist] = useState<AsistenciaRegistro[]>([]);
  const [obligaciones, setObligaciones] = useState<ObligacionResponse[]>([]);
  const [entregas, setEntregas] = useState<EntregaResponse[]>([]);
  const [inbox, setInbox] = useState<MensajeResponse[]>([]);
  const [notifs, setNotifs] = useState<NotificacionResponse[]>([]);
  const [loading, setLoading] = useState(!embed);
  const [errorApi, setErrorApi] = useState<string | null>(null);

  const tabs: { id: ParentTab; label: string; icon: React.ElementType }[] = [
    { id:"home",       label:"Inicio",     icon: Home },
    { id:"grades",     label:"Notas",      icon: BookOpen },
    { id:"attendance", label:"Asistencia", icon: Users },
    { id:"tareas",     label:"Deberes",    icon: FileUpIcon },
    { id:"materias",   label:"Mis materias", icon: GraduationCap },
    { id:"payments",   label:"Pagos",      icon: DollarSign },
  ];

  useEffect(() => {
    if (embed) { setLoading(false); return; }
    estudiantesApi.mios()
      .then(lista => {
        setHijos(lista);
        if (lista.length > 0) setIdEstudiante(lista[0].id);
      })
      .catch(e => setErrorApi(e instanceof ApiError ? e.message : "No se pudo cargar la información."))
      .finally(() => setLoading(false));
    mensajesApi.mias().then(setInbox).catch(() => {});
    notificacionesApi.mias().then(setNotifs).catch(() => {});
  }, [embed]);

  const marcarNotificacionLeida = async (id: number) => {
    setNotifs(prev => prev.map(n => n.idNotificacion === id ? { ...n, leida: true } : n));
    try {
      await notificacionesApi.marcarLeida(id);
    } catch {
      notificacionesApi.mias().then(setNotifs).catch(() => {});
    }
  };

  useEffect(() => {
    if (embed || idEstudiante == null) return;
    Promise.all([
      calificacionesApi.porEstudiante(idEstudiante),
      asistenciaApi.porEstudiante(idEstudiante),
      finanzasApi.porEstudiante(idEstudiante),
      tareasApi.misEntregas(idEstudiante),
    ]).then(([n, a, o, e]) => { setNotas(n); setAsistenciaHist(a); setObligaciones(o); setEntregas(e); })
      .catch(e => setErrorApi(e instanceof ApiError ? e.message : "No se pudo cargar la información del estudiante."));
  }, [embed, idEstudiante]);

  const recargarEntregas = () => {
    if (idEstudiante != null) tareasApi.misEntregas(idEstudiante).then(setEntregas).catch(() => {});
  };
  const recargarObligaciones = () => {
    if (idEstudiante != null) finanzasApi.porEstudiante(idEstudiante).then(setObligaciones).catch(() => {});
  };

  const promedios = notas.map(n => n.promedio).filter((p): p is number => p != null);
  const promedioGeneral = promedios.length > 0 ? promedios.reduce((a, b) => a + b, 0) / promedios.length : null;

  const presentes = asistenciaHist.filter(a => a.estado === "PRESENTE").length;
  const justificadas = asistenciaHist.filter(a => a.estado === "AUSENCIA_JUSTIFICADA").length;
  const injustificadas = asistenciaHist.filter(a => a.estado === "AUSENCIA_INJUSTIFICADA").length;
  const totalAsistencia = asistenciaHist.length;
  const pctAsistencia = totalAsistencia > 0 ? Math.round((presentes / totalAsistencia) * 100) : null;

  const saldoPendiente = obligaciones
    .filter(o => o.estado === "PENDIENTE" || o.estado === "VENCIDO")
    .reduce((s, o) => s + o.valor, 0);
  const vencidas = obligaciones.filter(o => o.estado === "VENCIDO");

  const hijoActivo = hijos.find(h => h.id === idEstudiante) ?? null;

  return (
    <div className={embed ? "p-6" : "min-h-screen bg-[#F5F7FA] p-4 sm:p-6"} style={{ fontFamily:"'Inter', sans-serif" }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-[#1F4E79] rounded-2xl px-5 sm:px-7 pt-5 pb-5 sm:pt-6 sm:pb-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-white/60 text-xs">Buenos días,</p>
              <h1 className="text-white text-xl sm:text-2xl font-bold mt-0.5">{nombre || (esRepresentante ? "Representante" : "Estudiante")}</h1>
            </div>
            <button type="button" onClick={onLogout} aria-label="Cerrar sesión"
              className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 transition-colors flex-shrink-0">
              <LogOut size={16} className="text-white" aria-hidden="true" />
            </button>
          </div>
          {hijos.length > 1 && (
            <label>
              <span className="sr-only">Seleccionar estudiante</span>
              <select value={idEstudiante ?? ""} onChange={e => setIdEstudiante(Number(e.target.value))}
                className="mt-3 w-full sm:w-72 bg-white/10 text-white text-xs rounded-lg px-2.5 py-1.5 outline-none">
                {hijos.map(h => <option key={h.id} value={h.id} className="text-[#1A1A1A]">{h.nombreCompleto}</option>)}
              </select>
            </label>
          )}

          {/* Tabs */}
          {!embed && hijoActivo && (
            <div className="flex gap-2 mt-5 overflow-x-auto" role="tablist" aria-label="Secciones del portal familiar">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60
                    ${tab === id ? "bg-white text-[#1F4E79]" : "text-white/70 hover:bg-white/10"}`}>
                  <Icon size={15} aria-hidden="true" />{label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="mt-5 space-y-5">
          {embed && (
            <EmptyState icon={Smartphone} title="Vista previa del Portal Familiar"
              description="Inicie sesión con una cuenta de representante para ver los datos reales de un estudiante." />
          )}

          {!embed && loading && (
            <div className="text-center text-sm text-gray-600 py-8"><Loader2 size={16} className="animate-spin inline-block mr-2" aria-hidden="true" />Cargando…</div>
          )}

          {!embed && !loading && errorApi && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />{errorApi}
            </div>
          )}

          {!embed && !loading && !errorApi && hijos.length === 0 && (
            <EmptyState icon={Users}
              title={esRepresentante ? "Aún no tiene estudiantes registrados a su cargo." : "No se encontró su información de estudiante. Contacte a la administración."} />
          )}

          {!embed && !loading && hijoActivo && tab === "home" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Columna principal */}
              <div className="lg:col-span-2 space-y-5">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div aria-hidden="true" className="w-11 h-11 bg-[#EAF2FB] rounded-full flex items-center justify-center text-sm font-bold text-[#1F4E79] flex-shrink-0">
                      {initials(hijoActivo.nombreCompleto)}
                    </div>
                    <div>
                      <p className="font-semibold text-[#1A1A1A] text-sm">{hijoActivo.nombreCompleto}</p>
                      {hijoActivo.paralelo && <p className="text-xs text-gray-600">{hijoActivo.paralelo}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className={`rounded-xl p-4 border text-center ${promedioGeneral != null && promedioGeneral < 7 ? "bg-red-50 border-red-100" : "bg-gray-50 border-gray-100"}`}>
                      <p className="text-[10px] text-gray-600 mb-1">Promedio</p>
                      <p className={`text-2xl font-bold ${promedioGeneral != null && promedioGeneral < 7 ? "text-[#C62828]" : "text-[#1A1A1A]"}`}>
                        {promedioGeneral != null ? promedioGeneral.toFixed(1) : "--"}
                      </p>
                      {promedioGeneral != null && promedioGeneral < 7 && <p className="text-[10px] text-[#C62828] font-medium mt-0.5">En riesgo</p>}
                    </div>
                    <div className="bg-[#EAF2FB] rounded-xl p-4 border border-blue-100 text-center">
                      <p className="text-[10px] text-gray-600 mb-1">Asistencia</p>
                      <p className="text-2xl font-bold text-[#1F4E79]">{pctAsistencia != null ? `${pctAsistencia}%` : "--"}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">Últimos 6 meses</p>
                    </div>
                    <div className={`rounded-xl p-4 border text-center ${saldoPendiente > 0 ? "bg-amber-50 border-amber-100" : "bg-gray-50 border-gray-100"}`}>
                      <p className="text-[10px] text-gray-600 mb-1">Saldo</p>
                      <p className={`text-2xl font-bold ${saldoPendiente > 0 ? "text-amber-600" : "text-[#1A1A1A]"}`}>${saldoPendiente.toFixed(0)}</p>
                      <p className={`text-[10px] font-medium mt-0.5 ${saldoPendiente > 0 ? "text-amber-600" : "text-gray-600"}`}>
                        {saldoPendiente > 0 ? "Pendiente" : "Al día"}
                      </p>
                    </div>
                  </div>
                </div>

                {promedioGeneral != null && promedioGeneral < 7 && (
                  <div className="bg-red-50 rounded-2xl border border-red-200 p-4 flex gap-3">
                    <AlertTriangle size={17} className="text-[#C62828] flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-[#C62828]">Riesgo académico detectado</p>
                      <p className="text-xs text-red-700 mt-0.5 leading-relaxed">Promedio general {promedioGeneral.toFixed(1)}/10. Se recomienda refuerzo académico.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Columna lateral */}
              <div className="lg:col-span-1 space-y-5">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-[#1A1A1A]">Notificaciones académicas</p>
                    {notifs.some(n => !n.leida) && (
                      <span className="text-[10px] font-semibold text-white bg-[#C62828] rounded-full px-1.5 py-0.5">
                        {notifs.filter(n => !n.leida).length} nueva{notifs.filter(n => !n.leida).length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  {notifs.length === 0 ? (
                    <p className="text-xs text-gray-600">No hay notificaciones por el momento.</p>
                  ) : (
                    <ul className="space-y-3">
                      {notifs.map(n => {
                        // materia/calificacion solo existen para tipo CALIFICACION; el resto
                        // (PAGO, MENSAJE, SISTEMA) solo trae texto libre en n.mensaje.
                        const titulo = n.tipo === "CALIFICACION" ? n.materia : TITULO_NOTIFICACION[n.tipo];
                        return (
                        <li key={n.idNotificacion}>
                          <button type="button" onClick={() => !n.leida && marcarNotificacionLeida(n.idNotificacion)}
                            aria-label={n.leida ? undefined : `Marcar como leída: ${titulo}`}
                            className={`w-full text-left rounded-xl border p-3 transition-colors
                              ${n.leida ? "border-gray-100 bg-white" : "border-red-200 bg-red-50 hover:bg-red-100/70 cursor-pointer"}`}>
                            <div className="flex items-start gap-2.5">
                              <span aria-hidden="true" className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.leida ? "bg-[#C62828]" : "bg-transparent"}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className={`text-xs font-semibold ${!n.leida ? "text-[#1A1A1A]" : "text-gray-500"}`}>
                                    {!n.leida && <span className="sr-only">No leída: </span>}{titulo}
                                  </p>
                                  {n.tipo === "CALIFICACION" && n.calificacion != null && (
                                    <span className={`text-xs font-bold font-mono flex-shrink-0 ${!n.leida ? "text-[#C62828]" : "text-gray-500"}`}>{n.calificacion}</span>
                                  )}
                                </div>
                                <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">{n.mensaje}</p>
                                <p className="text-[10px] text-gray-500 mt-1.5">
                                  {new Date(n.creadoEn).toLocaleString("es-EC", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                                </p>
                              </div>
                            </div>
                          </button>
                        </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <p className="text-sm font-semibold text-[#1A1A1A] mb-3">Mensajes institucionales</p>
                  {inbox.length === 0 ? (
                    <p className="text-xs text-gray-600">Aún no tiene mensajes.</p>
                  ) : (
                    <ul className="space-y-3">
                      {inbox.slice(0, 5).map(m => (
                        <li key={m.idMensaje} className="flex items-start gap-2.5">
                          <span aria-hidden="true" className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!m.leido ? "bg-[#2E75B6]" : "bg-transparent"}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold ${!m.leido ? "text-[#1A1A1A]" : "text-gray-500"}`}>
                              {!m.leido && <span className="sr-only">No leído: </span>}{m.asunto}
                            </p>
                            <p className="text-[11px] text-gray-600 mt-0.5 truncate">{m.cuerpo}</p>
                          </div>
                          <span className="text-[10px] text-gray-600 whitespace-nowrap">
                            {new Date(m.enviadoEn).toLocaleDateString("es-EC", { day:"2-digit", month:"short" })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {!embed && !loading && hijoActivo && tab === "grades" && <>
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Calificaciones por materia</p>
            {notas.length === 0 ? (
              <EmptyState icon={BookOpen} title="Sin calificaciones registradas." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {notas.map(n => (
                  <div key={n.idCalificacion} className={`bg-white rounded-2xl border p-4 shadow-sm ${n.enRiesgo ? "border-red-200" : "border-gray-200"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-[#1A1A1A]">{n.materia} <span className="text-xs font-normal text-gray-600">· Parcial {n.parcial}</span></p>
                      <span className={`text-lg font-bold ${n.enRiesgo ? "text-[#C62828]" : "text-[#2E7D32]"}`}>{n.promedio ?? "—"}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-center mb-3">
                      {[["Tarea 20%", n.notaTarea], ["Clase 20%", n.notaClase], ["Examen 60%", n.notaExamen]].map(([l, v]) => (
                        <div key={String(l)}>
                          <p className="text-gray-600 mb-0.5">{l}</p>
                          <p className="font-mono font-semibold text-gray-700">{v ?? "—"}</p>
                        </div>
                      ))}
                    </div>
                    {n.promedio != null && (
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${n.enRiesgo ? "bg-[#C62828]" : "bg-[#2E7D32]"}`}
                          style={{ width:`${(n.promedio/10)*100}%`, transition:"width 0.4s ease" }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>}

          {!embed && !loading && hijoActivo && tab === "attendance" && <>
            {totalAsistencia === 0 ? (
              <EmptyState icon={Clock} title="Sin registros de asistencia." />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 max-w-xl">
                <p className="text-sm font-semibold text-[#1A1A1A] mb-4">Resumen · Últimos 6 meses</p>
                <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                  <div><p className="text-2xl font-bold text-[#2E7D32]">{presentes}</p><p className="text-xs text-gray-600 mt-0.5">Presente</p></div>
                  <div><p className="text-2xl font-bold text-amber-500">{justificadas}</p><p className="text-xs text-gray-600 mt-0.5">A. justif.</p></div>
                  <div><p className="text-2xl font-bold text-[#C62828]">{injustificadas}</p><p className="text-xs text-gray-600 mt-0.5">A. injustif.</p></div>
                </div>
                <div className="h-2 rounded-full overflow-hidden flex bg-gray-100">
                  <div className="bg-[#2E7D32] h-full" style={{ width:`${(presentes/totalAsistencia)*100}%` }} />
                  <div className="bg-amber-400 h-full" style={{ width:`${(justificadas/totalAsistencia)*100}%` }} />
                  <div className="bg-[#C62828] h-full" style={{ width:`${(injustificadas/totalAsistencia)*100}%` }} />
                </div>
                <p className="text-xs text-center text-gray-600 mt-2">{pctAsistencia}% de asistencia</p>
              </div>
            )}
          </>}

          {!embed && !loading && hijoActivo && tab === "tareas" && <>
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Deberes</p>
            {entregas.length === 0 ? (
              <EmptyState icon={FileUpIcon} title="Sin deberes publicados todavía." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {entregas.map(en => (
                  <EntregaCard key={en.idEntrega} entrega={en} idEstudiante={idEstudiante!}
                    onSubido={recargarEntregas} toast={toast} />
                ))}
              </div>
            )}
          </>}

          {!embed && !loading && hijoActivo && tab === "materias" && (
            <MisMateriasView idEstudiante={idEstudiante!} />
          )}

          {!embed && !loading && hijoActivo && tab === "payments" && <>
            <div className="space-y-4">
              {vencidas.length > 0 && (
                <div className="bg-red-50 rounded-2xl border border-red-200 p-3.5 flex gap-2.5">
                  <AlertTriangle size={15} className="text-[#C62828] flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-xs text-red-700 leading-relaxed">
                    Tiene <strong>{vencidas.length} {vencidas.length === 1 ? "obligación vencida" : "obligaciones vencidas"} (${vencidas.reduce((s, o) => s + o.valor, 0).toFixed(2)})</strong>. Por favor regularice su pago.
                  </p>
                </div>
              )}

              <NuevoPagoForm idEstudiante={idEstudiante!} onPagado={recargarObligaciones} toast={toast} />

              {obligaciones.length === 0 ? (
                <EmptyState icon={DollarSign} title="Aún no tiene otras obligaciones de pago registradas." />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {obligaciones.map(o => (
                    <ObligacionCard key={o.idObligacion} obligacion={o} onPagado={recargarObligaciones} toast={toast} />
                  ))}
                </div>
              )}
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}

// ── Tarjeta de entrega de deber (con subida de archivo si está pendiente) ───
// El estudiante y su representante comparten el mismo acceso — ambos pueden entregar.
function EntregaCard({ entrega, idEstudiante, onSubido, toast }: {
  entrega: EntregaResponse; idEstudiante: number; onSubido: () => void; toast: ReturnType<typeof useToast>;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const badge = ESTADO_ENTREGA_BADGE[entrega.estado];

  const enviar = async () => {
    if (!archivo) return;
    setEnviando(true);
    try {
      await tareasApi.subirEntrega(entrega.idTarea, idEstudiante, archivo);
      toast.success("Deber entregado correctamente");
      onSubido();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo subir el archivo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className={`bg-white rounded-2xl border p-4 shadow-sm ${entrega.estado === "PENDIENTE" ? "border-amber-200" : "border-gray-200"}`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-semibold text-[#1A1A1A]">{entrega.tituloTarea}</p>
        <Badge v={badge.v}>{badge.label}</Badge>
      </div>
      <p className="text-xs text-gray-600">{entrega.materia} · {entrega.curso}</p>
      <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
        <Clock size={11} aria-hidden="true" />
        Vence {new Date(entrega.fechaLimite).toLocaleString("es-EC", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
      </p>

      {entrega.estado === "PENDIENTE" && (
        <div className="mt-3 space-y-2">
          <FileUpload accept=".pdf,.doc,.docx,.zip,.jpg,.jpeg,.png,.webp" maxSizeMb={15}
            onFileSelected={setArchivo} disabled={enviando} label="Adjuntar tarea (PDF, Word, imagen o ZIP)" />
          <Btn size="sm" onClick={enviar} disabled={!archivo || enviando} className="w-full">
            {enviando ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Send size={13} aria-hidden="true" />}
            Entregar
          </Btn>
        </div>
      )}

      {entrega.estado !== "PENDIENTE" && (
        <div className="mt-3 text-xs text-gray-600">
          <p className="flex items-center gap-1"><CheckCircle2 size={12} className="text-[#2E7D32]" aria-hidden="true" />{entrega.archivoNombreOriginal}</p>
          {entrega.observacionDocente && (
            <p className="mt-1.5 italic text-gray-600">"{entrega.observacionDocente}"</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Registrar un pago nuevo eligiendo el motivo (rubro) directamente — no depende de que un ─
// admin haya generado antes la obligación de este estudiante; se genera sola con el valor del rubro.
const OTRO_MOTIVO_NOMBRE = "Otro (especifique)";

interface NuevoPagoData {
  idRubro: number | "";
  motivoLibre: string;
  montoLibre: string;
  nombreCuenta: string;
  asunto: string;
  numeroTransaccion: string;
  fechaTransferencia: string;
}

function nuevoPagoErrors(f: NuevoPagoData, esOtro: boolean): Partial<Record<keyof NuevoPagoData, string>> {
  const e: Partial<Record<keyof NuevoPagoData, string>> = {};
  if (!f.idRubro) e.idRubro = "Seleccione un motivo de pago";
  if (esOtro) {
    if (f.motivoLibre.trim().length < 4) e.motivoLibre = "Describa el motivo (mín. 4 caracteres)";
    const monto = Number(f.montoLibre);
    if (!f.montoLibre.trim() || isNaN(monto) || monto <= 0) e.montoLibre = "Ingrese un monto válido mayor a 0";
  }
  if (f.nombreCuenta.trim().length < 4) e.nombreCuenta = "Ingrese el nombre de la cuenta de origen";
  if (!esOtro && f.asunto.trim().length < 4) e.asunto = "Ingrese el asunto (mín. 4 caracteres)";
  if (f.numeroTransaccion.trim().length < 3) e.numeroTransaccion = "Ingrese el número de transacción";
  if (!f.fechaTransferencia) e.fechaTransferencia = "Seleccione la fecha de la transferencia";
  return e;
}

const NUEVO_PAGO_EMPTY: NuevoPagoData = {
  idRubro: "", motivoLibre: "", montoLibre: "", nombreCuenta: "", asunto: "",
  numeroTransaccion: "", fechaTransferencia: new Date().toISOString().slice(0, 10),
};

function NuevoPagoForm({ idEstudiante, onPagado, toast }: {
  idEstudiante: number; onPagado: () => void; toast: ReturnType<typeof useToast>;
}) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [rubros, setRubros] = useState<RubroResponse[]>([]);
  const [form, setForm] = useState<NuevoPagoData>(NUEVO_PAGO_EMPTY);
  const [touched, setTouched] = useState<Partial<Record<keyof NuevoPagoData, boolean>>>({});
  const [attempted, setAttempted] = useState(false);
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [comprobanteTocado, setComprobanteTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (mostrarForm && rubros.length === 0) {
      finanzasApi.rubros().then(setRubros).catch(() => toast.error("No se pudieron cargar los motivos de pago."));
    }
  }, [mostrarForm]); // eslint-disable-line react-hooks/exhaustive-deps

  const idBase = "pago-nuevo";
  const rubroSeleccionado = rubros.find(r => r.idRubro === form.idRubro);
  const esOtro = rubroSeleccionado?.nombre === OTRO_MOTIVO_NOMBRE;

  const set = <K extends keyof NuevoPagoData>(key: K, value: NuevoPagoData[K]) => {
    setForm(p => ({ ...p, [key]: value }));
    setTouched(p => ({ ...p, [key]: true }));
  };

  const errors = nuevoPagoErrors(form, esOtro);
  const err = (key: keyof NuevoPagoData) => (touched[key] || attempted) ? errors[key] : undefined;
  const cls = (key: keyof NuevoPagoData, base: string) => {
    if (!touched[key] && !attempted) return base;
    if (errors[key]) return `${base} is-invalid`;
    const v = form[key];
    return String(v).trim().length > 0 ? `${base} is-valid` : base;
  };
  const comprobanteInvalido = (comprobanteTocado || attempted) && !comprobante;
  const allOk = Object.keys(errors).length === 0 && comprobante != null;

  const limpiar = () => {
    setForm(NUEVO_PAGO_EMPTY);
    setTouched({});
    setAttempted(false);
    setComprobante(null);
    setComprobanteTocado(false);
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    setComprobanteTocado(true);
    if (!allOk) return;
    setEnviando(true);
    try {
      await finanzasApi.subirComprobante({
        idRubro: Number(form.idRubro), idEstudiante, banco: form.nombreCuenta.trim(),
        asunto: (esOtro ? form.motivoLibre : form.asunto).trim(),
        numeroReferencia: form.numeroTransaccion.trim(), fechaPago: form.fechaTransferencia,
        valorPagado: esOtro ? Number(form.montoLibre) : undefined,
        comprobante: comprobante!,
      });
      toast.success("Comprobante enviado. Un administrador lo revisará pronto.");
      setMostrarForm(false);
      limpiar();
      onPagado();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo enviar el comprobante.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      {!mostrarForm ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#1A1A1A]">Registrar un pago por transferencia</p>
            <p className="text-xs text-gray-600 mt-0.5">Matrícula, mensualidad, uniforme u otro motivo — no necesita esperar a que administración lo registre primero.</p>
          </div>
          <Btn size="sm" onClick={() => setMostrarForm(true)} className="flex-shrink-0">
            <Upload size={13} aria-hidden="true" />Nuevo pago
          </Btn>
        </div>
      ) : (
        <div className="matricula-form">
          <form onSubmit={enviar} className="card border-0" noValidate>
            <div className="card-body p-0 d-flex flex-column gap-3">
              <p className="text-sm font-semibold text-[#1A1A1A] mb-0">Registrar un pago por transferencia</p>

              <div>
                <label htmlFor={`${idBase}-motivo`} className="form-label">Motivo de pago</label>
                <select id={`${idBase}-motivo`} className={cls("idRubro", "form-select")} disabled={enviando}
                  value={form.idRubro} onChange={e => set("idRubro", e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Seleccione…</option>
                  {rubros.map(r => (
                    <option key={r.idRubro} value={r.idRubro}>
                      {r.nombre}{r.nombre !== OTRO_MOTIVO_NOMBRE ? ` — $${r.valor.toFixed(2)}` : ""}
                    </option>
                  ))}
                </select>
                {err("idRubro") ? (
                  <div className="invalid-feedback d-block">{err("idRubro")}</div>
                ) : rubroSeleccionado && !esOtro ? (
                  <div className="form-text">Monto a pagar: <strong>${rubroSeleccionado.valor.toFixed(2)}</strong></div>
                ) : null}
              </div>

              {esOtro && (
                <div>
                  <label htmlFor={`${idBase}-motivo-libre`} className="form-label">Especifique el motivo</label>
                  <input id={`${idBase}-motivo-libre`} type="text" className={cls("motivoLibre", "form-control")}
                    maxLength={150} placeholder="Ej. Cuota de excursión, carnet, multa por daño de material…"
                    value={form.motivoLibre} onChange={e => set("motivoLibre", e.target.value)} disabled={enviando} />
                  {err("motivoLibre") && <div className="invalid-feedback d-block">{err("motivoLibre")}</div>}
                </div>
              )}

              {esOtro && (
                <div>
                  <label htmlFor={`${idBase}-monto-libre`} className="form-label">Monto a pagar</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input id={`${idBase}-monto-libre`} type="number" min="0.01" step="0.01"
                      className={cls("montoLibre", "form-control")}
                      value={form.montoLibre} onChange={e => set("montoLibre", e.target.value)} disabled={enviando} />
                  </div>
                  {err("montoLibre") && <div className="invalid-feedback d-block">{err("montoLibre")}</div>}
                </div>
              )}

              <div>
                <label htmlFor={`${idBase}-cuenta`} className="form-label">Nombre de la cuenta</label>
                <input id={`${idBase}-cuenta`} type="text" className={cls("nombreCuenta", "form-control")} maxLength={60}
                  placeholder="Ej. Banco Pichincha — Juan Pérez"
                  value={form.nombreCuenta} onChange={e => set("nombreCuenta", e.target.value)} disabled={enviando} />
                {err("nombreCuenta") && <div className="invalid-feedback d-block">{err("nombreCuenta")}</div>}
              </div>

              {!esOtro && (
                <div>
                  <label htmlFor={`${idBase}-asunto`} className="form-label">Asunto</label>
                  <input id={`${idBase}-asunto`} type="text" className={cls("asunto", "form-control")} maxLength={150}
                    placeholder="Ej. Pago de pensión"
                    value={form.asunto} onChange={e => set("asunto", e.target.value)} disabled={enviando} />
                  {err("asunto") && <div className="invalid-feedback d-block">{err("asunto")}</div>}
                </div>
              )}

              <div>
                <label htmlFor={`${idBase}-numero`} className="form-label">Número de transacción</label>
                <input id={`${idBase}-numero`} type="text" className={cls("numeroTransaccion", "form-control")} maxLength={50}
                  value={form.numeroTransaccion} onChange={e => set("numeroTransaccion", e.target.value)} disabled={enviando} />
                {err("numeroTransaccion") && <div className="invalid-feedback d-block">{err("numeroTransaccion")}</div>}
              </div>

              <div>
                <label htmlFor={`${idBase}-fecha`} className="form-label">Fecha de la transferencia</label>
                <DateField id={`${idBase}-fecha`} className={cls("fechaTransferencia", "form-control")}
                  value={form.fechaTransferencia} onChange={v => set("fechaTransferencia", v)}
                  maxDate={new Date()} disabled={enviando} />
                {err("fechaTransferencia") && <div className="invalid-feedback d-block">{err("fechaTransferencia")}</div>}
              </div>

              <div>
                <label htmlFor={`${idBase}-archivo`} className="form-label">Subir comprobante de transferencia</label>
                <input id={`${idBase}-archivo`} type="file"
                  className={`form-control ${comprobanteInvalido ? "is-invalid" : comprobante ? "is-valid" : ""}`}
                  accept=".jpg,.jpeg,.png,.webp,.pdf" disabled={enviando}
                  onChange={e => { setComprobante(e.target.files?.[0] ?? null); setComprobanteTocado(true); }} />
                {comprobanteInvalido ? (
                  <div className="invalid-feedback d-block">Adjunte la imagen o PDF del comprobante</div>
                ) : comprobante ? (
                  <div className="form-text">{comprobante.name} · {(comprobante.size / 1024).toFixed(0)} KB</div>
                ) : null}
              </div>

              <div className="d-flex gap-2 pt-1">
                <button type="button" className="btn btn-outline-secondary flex-fill" disabled={enviando}
                  onClick={() => { setMostrarForm(false); limpiar(); }}>
                  Cancelar
                </button>
                <button type="submit" className={`btn ${attempted && !allOk ? "btn-danger" : "btn-primary"} flex-fill`} disabled={enviando}>
                  {enviando ? "Enviando…" : attempted && !allOk ? "Corrija los campos marcados" : "Subir"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ── Tarjeta de obligación de pago (con subida de comprobante por transferencia) ─
// El estudiante y su representante comparten el mismo acceso — ambos pueden pagar.
function ObligacionCard({ obligacion: o, onPagado, toast }: {
  obligacion: ObligacionResponse; onPagado: () => void; toast: ReturnType<typeof useToast>;
}) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nombreCuenta, setNombreCuenta] = useState("");
  const [asunto, setAsunto] = useState("");
  const [numeroTransaccion, setNumeroTransaccion] = useState("");
  const [fechaTransferencia, setFechaTransferencia] = useState(hoy);
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cfg = PAYMENT_CFG[ESTADO_TO_STATUS[o.estado]];
  const Icon = cfg.icon;
  const obligacionPendiente = o.estado === "PENDIENTE" || o.estado === "VENCIDO";
  const yaEnRevision = o.pago?.estadoRevision === "EN_REVISION";
  const idBase = `pago-${o.idObligacion}`;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comprobante || !nombreCuenta.trim() || !asunto.trim() || !numeroTransaccion.trim() || !fechaTransferencia) return;
    setEnviando(true);
    try {
      await finanzasApi.subirComprobante({
        idObligacion: o.idObligacion, valorPagado: o.valor, banco: nombreCuenta.trim(),
        asunto: asunto.trim(), numeroReferencia: numeroTransaccion.trim(),
        fechaPago: fechaTransferencia, comprobante,
      });
      toast.success("Comprobante enviado. Un administrador lo revisará pronto.");
      setMostrarForm(false);
      setNombreCuenta(""); setAsunto(""); setNumeroTransaccion(""); setFechaTransferencia(hoy); setComprobante(null);
      onPagado();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo enviar el comprobante.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className={`bg-white rounded-2xl border p-4 shadow-sm ${o.estado === "VENCIDO" ? "border-red-200" : "border-gray-200"}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#1A1A1A]">{o.rubro}</p>
          <p className="text-xs text-gray-600">Vence: {o.fechaVencimiento}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold font-mono text-[#1A1A1A]">${o.valor.toFixed(2)}</p>
          <Badge v={cfg.badge}><Icon size={10} aria-hidden="true" />{cfg.label}</Badge>
        </div>
      </div>

      {yaEnRevision && (
        <p className="text-[11px] text-amber-600 mt-2">Comprobante enviado, en revisión por administración.</p>
      )}

      {obligacionPendiente && !yaEnRevision && (
        <div className="mt-3">
          {!mostrarForm ? (
            <Btn size="sm" variant="secondary" onClick={() => setMostrarForm(true)} className="w-full">
              <Upload size={13} aria-hidden="true" />Pagar por transferencia
            </Btn>
          ) : (
            // Formulario en Bootstrap 5 (a pedido explícito) — escopado bajo ".matricula-form"
            // (ver src/styles/bootstrap-scoped.css) para que Bootstrap no afecte al resto de la app.
            <div className="matricula-form">
              <form onSubmit={enviar} className="card border-0">
                <div className="card-body p-0 pt-2">
                  <div className="mb-3">
                    <label htmlFor={`${idBase}-cuenta`} className="form-label">Nombre de la cuenta</label>
                    <input id={`${idBase}-cuenta`} type="text" className="form-control" required maxLength={60}
                      placeholder="Ej. Banco Pichincha — Juan Pérez"
                      value={nombreCuenta} onChange={e => setNombreCuenta(e.target.value)} disabled={enviando} />
                  </div>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label htmlFor={`${idBase}-asunto`} className="form-label">Asunto</label>
                      <input id={`${idBase}-asunto`} type="text" className="form-control" required maxLength={150}
                        placeholder="Ej. Pago de pensión"
                        value={asunto} onChange={e => setAsunto(e.target.value)} disabled={enviando} />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label htmlFor={`${idBase}-numero`} className="form-label">Número de transacción</label>
                      <input id={`${idBase}-numero`} type="text" className="form-control" required maxLength={50}
                        value={numeroTransaccion} onChange={e => setNumeroTransaccion(e.target.value)} disabled={enviando} />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label htmlFor={`${idBase}-fecha`} className="form-label">Fecha de la transferencia</label>
                    <DateField id={`${idBase}-fecha`} className="form-control" value={fechaTransferencia}
                      onChange={setFechaTransferencia} maxDate={new Date()} disabled={enviando} />
                  </div>

                  <div className="mb-3">
                    <label htmlFor={`${idBase}-archivo`} className="form-label">Subir comprobante de transferencia</label>
                    <input id={`${idBase}-archivo`} type="file" className="form-control"
                      accept=".jpg,.jpeg,.png,.webp,.pdf" required disabled={enviando}
                      onChange={e => setComprobante(e.target.files?.[0] ?? null)} />
                    {comprobante && (
                      <div className="form-text">{comprobante.name} · {(comprobante.size / 1024).toFixed(0)} KB</div>
                    )}
                  </div>

                  <div className="d-flex gap-2">
                    <button type="button" className="btn btn-outline-secondary flex-fill" disabled={enviando}
                      onClick={() => setMostrarForm(false)}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary flex-fill" disabled={enviando || !comprobante}>
                      {enviando ? "Enviando…" : "Subir"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
