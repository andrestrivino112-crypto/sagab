import { useEffect, useState } from "react";
import {
  AlertCircle, AlertTriangle, BookOpen, Clock, DollarSign, Home, Loader2, LogOut, Smartphone, Users,
} from "lucide-react";
import { ApiError } from "../../api/client";
import {
  estudiantes as estudiantesApi, calificaciones as calificacionesApi, asistencia as asistenciaApi,
  finanzas as finanzasApi, mensajes as mensajesApi,
  type EstudianteConParalelo, type NotaEstudianteResponse, type AsistenciaRegistro,
  type ObligacionResponse, type MensajeResponse,
} from "../../api/sagab";
import { EmptyState } from "../components/EmptyState";
import { Badge } from "../components/Badge";
import { initials } from "../helpers";
import { PAYMENT_CFG, ESTADO_TO_STATUS } from "../paymentConfig";

type ParentTab = "home" | "grades" | "attendance" | "payments";

export function ParentPortal({ onLogout, embed = false, nombre = "" }: { onLogout: () => void; embed?: boolean; nombre?: string }) {
  const [tab, setTab] = useState<ParentTab>("home");
  const [hijos, setHijos] = useState<EstudianteConParalelo[]>([]);
  const [idEstudiante, setIdEstudiante] = useState<number | null>(null);
  const [notas, setNotas] = useState<NotaEstudianteResponse[]>([]);
  const [asistenciaHist, setAsistenciaHist] = useState<AsistenciaRegistro[]>([]);
  const [obligaciones, setObligaciones] = useState<ObligacionResponse[]>([]);
  const [inbox, setInbox] = useState<MensajeResponse[]>([]);
  const [loading, setLoading] = useState(!embed);
  const [errorApi, setErrorApi] = useState<string | null>(null);

  const tabs: { id: ParentTab; label: string; icon: React.ElementType }[] = [
    { id:"home",       label:"Inicio",     icon: Home },
    { id:"grades",     label:"Notas",      icon: BookOpen },
    { id:"attendance", label:"Asistencia", icon: Users },
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
  }, [embed]);

  useEffect(() => {
    if (embed || idEstudiante == null) return;
    Promise.all([
      calificacionesApi.porEstudiante(idEstudiante),
      asistenciaApi.porEstudiante(idEstudiante),
      finanzasApi.porEstudiante(idEstudiante),
    ]).then(([n, a, o]) => { setNotas(n); setAsistenciaHist(a); setObligaciones(o); })
      .catch(e => setErrorApi(e instanceof ApiError ? e.message : "No se pudo cargar la información del estudiante."));
  }, [embed, idEstudiante]);

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
              <h1 className="text-white text-xl sm:text-2xl font-bold mt-0.5">{nombre || "Representante"}</h1>
            </div>
            <button onClick={onLogout} className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors flex-shrink-0">
              <LogOut size={16} className="text-white" />
            </button>
          </div>
          {hijos.length > 1 && (
            <select value={idEstudiante ?? ""} onChange={e => setIdEstudiante(Number(e.target.value))}
              className="mt-3 w-full sm:w-72 bg-white/10 text-white text-xs rounded-lg px-2.5 py-1.5 outline-none">
              {hijos.map(h => <option key={h.id} value={h.id} className="text-[#1A1A1A]">{h.nombreCompleto}</option>)}
            </select>
          )}

          {/* Tabs */}
          {!embed && hijoActivo && (
            <div className="flex gap-2 mt-5 overflow-x-auto">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0
                    ${tab === id ? "bg-white text-[#1F4E79]" : "text-white/70 hover:bg-white/10"}`}>
                  <Icon size={15} />{label}
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
            <div className="text-center text-sm text-gray-400 py-8"><Loader2 size={16} className="animate-spin inline-block mr-2" />Cargando…</div>
          )}

          {!embed && !loading && errorApi && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />{errorApi}
            </div>
          )}

          {!embed && !loading && !errorApi && hijos.length === 0 && (
            <EmptyState icon={Users} title="Aún no tiene estudiantes registrados a su cargo." />
          )}

          {!embed && !loading && hijoActivo && tab === "home" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Columna principal */}
              <div className="lg:col-span-2 space-y-5">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 bg-[#EAF2FB] rounded-full flex items-center justify-center text-sm font-bold text-[#1F4E79] flex-shrink-0">
                      {initials(hijoActivo.nombreCompleto)}
                    </div>
                    <div>
                      <p className="font-semibold text-[#1A1A1A] text-sm">{hijoActivo.nombreCompleto}</p>
                      {hijoActivo.paralelo && <p className="text-xs text-gray-400">{hijoActivo.paralelo}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className={`rounded-xl p-4 border text-center ${promedioGeneral != null && promedioGeneral < 7 ? "bg-red-50 border-red-100" : "bg-gray-50 border-gray-100"}`}>
                      <p className="text-[10px] text-gray-400 mb-1">Promedio</p>
                      <p className={`text-2xl font-bold ${promedioGeneral != null && promedioGeneral < 7 ? "text-[#C62828]" : "text-[#1A1A1A]"}`}>
                        {promedioGeneral != null ? promedioGeneral.toFixed(1) : "--"}
                      </p>
                      {promedioGeneral != null && promedioGeneral < 7 && <p className="text-[10px] text-[#C62828] font-medium mt-0.5">En riesgo</p>}
                    </div>
                    <div className="bg-[#EAF2FB] rounded-xl p-4 border border-blue-100 text-center">
                      <p className="text-[10px] text-gray-400 mb-1">Asistencia</p>
                      <p className="text-2xl font-bold text-[#1F4E79]">{pctAsistencia != null ? `${pctAsistencia}%` : "--"}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Últimos 6 meses</p>
                    </div>
                    <div className={`rounded-xl p-4 border text-center ${saldoPendiente > 0 ? "bg-amber-50 border-amber-100" : "bg-gray-50 border-gray-100"}`}>
                      <p className="text-[10px] text-gray-400 mb-1">Saldo</p>
                      <p className={`text-2xl font-bold ${saldoPendiente > 0 ? "text-amber-600" : "text-[#1A1A1A]"}`}>${saldoPendiente.toFixed(0)}</p>
                      <p className={`text-[10px] font-medium mt-0.5 ${saldoPendiente > 0 ? "text-amber-600" : "text-gray-400"}`}>
                        {saldoPendiente > 0 ? "Pendiente" : "Al día"}
                      </p>
                    </div>
                  </div>
                </div>

                {promedioGeneral != null && promedioGeneral < 7 && (
                  <div className="bg-red-50 rounded-2xl border border-red-200 p-4 flex gap-3">
                    <AlertTriangle size={17} className="text-[#C62828] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-[#C62828]">Riesgo académico detectado</p>
                      <p className="text-xs text-red-700 mt-0.5 leading-relaxed">Promedio general {promedioGeneral.toFixed(1)}/10. Se recomienda refuerzo académico.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Columna lateral */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <p className="text-sm font-semibold text-[#1A1A1A] mb-3">Mensajes institucionales</p>
                  {inbox.length === 0 ? (
                    <p className="text-xs text-gray-400">Aún no tiene mensajes.</p>
                  ) : (
                    <ul className="space-y-3">
                      {inbox.slice(0, 5).map(m => (
                        <li key={m.idMensaje} className="flex items-start gap-2.5">
                          <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!m.leido ? "bg-[#2E75B6]" : "bg-transparent"}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold ${!m.leido ? "text-[#1A1A1A]" : "text-gray-500"}`}>{m.asunto}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5 truncate">{m.cuerpo}</p>
                          </div>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">
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
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Calificaciones por materia</p>
            {notas.length === 0 ? (
              <EmptyState icon={BookOpen} title="Sin calificaciones registradas." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {notas.map(n => (
                  <div key={n.idCalificacion} className={`bg-white rounded-2xl border p-4 shadow-sm ${n.enRiesgo ? "border-red-200" : "border-gray-200"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-[#1A1A1A]">{n.materia} <span className="text-xs font-normal text-gray-400">· Parcial {n.parcial}</span></p>
                      <span className={`text-lg font-bold ${n.enRiesgo ? "text-[#C62828]" : "text-[#2E7D32]"}`}>{n.promedio ?? "—"}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-center mb-3">
                      {[["Tarea 20%", n.notaTarea], ["Clase 20%", n.notaClase], ["Examen 60%", n.notaExamen]].map(([l, v]) => (
                        <div key={String(l)}>
                          <p className="text-gray-400 mb-0.5">{l}</p>
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
                  <div><p className="text-2xl font-bold text-[#2E7D32]">{presentes}</p><p className="text-xs text-gray-400 mt-0.5">Presente</p></div>
                  <div><p className="text-2xl font-bold text-amber-500">{justificadas}</p><p className="text-xs text-gray-400 mt-0.5">A. justif.</p></div>
                  <div><p className="text-2xl font-bold text-[#C62828]">{injustificadas}</p><p className="text-xs text-gray-400 mt-0.5">A. injustif.</p></div>
                </div>
                <div className="h-2 rounded-full overflow-hidden flex bg-gray-100">
                  <div className="bg-[#2E7D32] h-full" style={{ width:`${(presentes/totalAsistencia)*100}%` }} />
                  <div className="bg-amber-400 h-full" style={{ width:`${(justificadas/totalAsistencia)*100}%` }} />
                  <div className="bg-[#C62828] h-full" style={{ width:`${(injustificadas/totalAsistencia)*100}%` }} />
                </div>
                <p className="text-xs text-center text-gray-400 mt-2">{pctAsistencia}% de asistencia</p>
              </div>
            )}
          </>}

          {!embed && !loading && hijoActivo && tab === "payments" && <>
            {obligaciones.length === 0 ? (
              <EmptyState icon={DollarSign} title="Sin obligaciones de pago registradas." />
            ) : (
              <div className="space-y-4">
                {vencidas.length > 0 && (
                  <div className="bg-red-50 rounded-2xl border border-red-200 p-3.5 flex gap-2.5">
                    <AlertTriangle size={15} className="text-[#C62828] flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 leading-relaxed">
                      Tiene <strong>{vencidas.length} {vencidas.length === 1 ? "obligación vencida" : "obligaciones vencidas"} (${vencidas.reduce((s, o) => s + o.valor, 0).toFixed(2)})</strong>. Por favor regularice su pago.
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {obligaciones.map(o => {
                    const cfg = PAYMENT_CFG[ESTADO_TO_STATUS[o.estado]];
                    const Icon = cfg.icon;
                    return (
                      <div key={o.idObligacion} className={`bg-white rounded-2xl border p-4 flex items-center justify-between ${o.estado === "VENCIDO" ? "border-red-200" : "border-gray-200"} shadow-sm`}>
                        <div>
                          <p className="text-sm font-semibold text-[#1A1A1A]">{o.rubro}</p>
                          <p className="text-xs text-gray-400">Vence: {o.fechaVencimiento}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold font-mono text-[#1A1A1A]">${o.valor.toFixed(2)}</p>
                          <Badge v={cfg.badge}><Icon size={10} />{cfg.label}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>}
        </div>
      </div>
    </div>
  );
}
