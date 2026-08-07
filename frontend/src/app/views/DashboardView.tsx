import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { AlertCircle, AlertTriangle, BarChart3, BellRing, CalendarDays, Clock, DollarSign, FileUp, Home, IdCard, MessageSquare, TrendingUp, Users, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../api/client";
import {
  dashboard as dashboardApi,
  mensajes as mensajesApi,
  notificaciones as notificacionesApi,
  type MensajeResponse,
  type NotificacionResponse,
  type ResumenDashboard,
} from "../../api/sagab";
import { EmptyState } from "../components/EmptyState";
import { KpiCard } from "../components/KpiCard";
import { AusenciasDrilldown } from "../components/AusenciasDrilldown";
import { MensajesDrilldown } from "../components/MensajesDrilldown";
import { MoraDrilldown } from "../components/MoraDrilldown";
import { PromedioDrilldown } from "../components/PromedioDrilldown";
import { TopBar } from "../components/TopBar";
import { barColor } from "../helpers";
import type { RolSistema } from "../../api/auth";

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-gray-700">{label}</p>
      <p className="text-[#1F4E79]">Promedio: <strong>{payload[0].value}</strong></p>
    </div>
  );
};

export function DashboardView({ rol }: { rol: RolSistema }) {
  const navigate = useNavigate();
  const [resumen, setResumen] = useState<ResumenDashboard | null>(null);
  const [notificaciones, setNotificaciones] = useState<NotificacionResponse[]>([]);
  const [mensajesRecientes, setMensajesRecientes] = useState<MensajeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [moraAbierta, setMoraAbierta] = useState(false);
  const [promedioAbierto, setPromedioAbierto] = useState(false);
  const [ausenciasAbiertas, setAusenciasAbiertas] = useState(false);
  const [mensajesAbiertos, setMensajesAbiertos] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      dashboardApi.resumen(),
      notificacionesApi.mias(),
      mensajesApi.mias(),
    ]).then(([resumenRes, notificacionesRes, mensajesRes]) => {
      if (resumenRes.status === "fulfilled") {
        setResumen(resumenRes.value);
      } else {
        setErrorApi(resumenRes.reason instanceof ApiError ? resumenRes.reason.message : "No se pudieron cargar los indicadores.");
      }
      if (notificacionesRes.status === "fulfilled") {
        setNotificaciones(notificacionesRes.value.slice(0, 4));
      }
      if (mensajesRes.status === "fulfilled") {
        setMensajesRecientes(mensajesRes.value.slice(0, 4));
      }
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const actualizarMensajes = () => {
      dashboardApi.resumen().then(setResumen).catch(() => {});
      mensajesApi.mias().then(lista => setMensajesRecientes(lista.slice(0, 4))).catch(() => {});
    };
    window.addEventListener("sagab:mensajes-actualizados", actualizarMensajes);
    return () => window.removeEventListener("sagab:mensajes-actualizados", actualizarMensajes);
  }, []);

  const rendimiento = resumen?.rendimientoPorParalelo ?? [];
  const accionesRapidas = {
    ADMIN: [
      { label: "Matrícula", path: "/matricula", icon: UserPlus },
      { label: "Asistencia", path: "/attendance", icon: Users },
      { label: "Financiero", path: "/financial", icon: DollarSign },
      { label: "Personal", path: "/personal", icon: IdCard },
    ],
    DOCENTE: [
      { label: "Académico", path: "/grades", icon: TrendingUp },
      { label: "Asistencia", path: "/attendance", icon: Users },
      { label: "Deberes", path: "/tareas", icon: FileUp },
      { label: "Calendario", path: "/calendar", icon: CalendarDays },
    ],
    DECE: [
      { label: "Alertas", path: "/deceAlertas", icon: AlertTriangle },
      { label: "Calendario", path: "/calendar", icon: CalendarDays },
    ],
    AUDITOR: [
      { label: "Auditoría", path: "/auditoria", icon: BarChart3 },
      { label: "Inicio", path: "/dashboard", icon: Home },
    ],
    REPRESENTANTE: [],
    ESTUDIANTE: [],
  }[rol];
  const tipoNotificacion = (tipo: NotificacionResponse["tipo"]) => ({
    CALIFICACION: "Calificación",
    PAGO: "Pago",
    MENSAJE: "Mensaje",
    SISTEMA: "Sistema",
  }[tipo] ?? "Sistema");

  const formatearFecha = (valor: string) => new Date(valor).toLocaleString("es-EC", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div>
      <TopBar title="Panel de Control" subtitle="Resumen institucional" />
      <div className="p-6 space-y-6">
        {errorApi && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />{errorApi}
          </div>
        )}

        {/* KPIs */}
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-3">Indicadores del día</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-live="polite" aria-busy={loading}>
            <KpiCard label="Estudiantes en mora" value={loading ? "…" : (resumen?.estudiantesEnMora ?? 0)}
              icon={AlertTriangle} accent="red" alert={!loading && (resumen?.estudiantesEnMora ?? 0) > 0}
              onClick={() => setMoraAbierta(true)} />
            <KpiCard label="Promedio institucional"
              value={loading ? "…" : (resumen?.promedioInstitucional != null ? resumen.promedioInstitucional.toFixed(1) : "--")}
              icon={TrendingUp} accent="blue" onClick={() => setPromedioAbierto(true)} />
            <KpiCard label="Ausencias hoy" value={loading ? "…" : (resumen?.ausenciasHoy ?? 0)} icon={Users} accent="amber"
              onClick={() => setAusenciasAbiertas(true)} />
            <KpiCard label="Mensajes pendientes" value={loading ? "…" : (resumen?.mensajesPendientes ?? 0)} icon={MessageSquare} accent="blue"
              onClick={() => setMensajesAbiertos(true)} />
          </div>
        </div>

        {accionesRapidas.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-[#1A1A1A]">Accesos rápidos</h2>
                <p className="text-sm text-gray-600">Ir directo a los módulos más usados</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {accionesRapidas.map(({ label, path, icon: Icon }) => (
                <button key={path} type="button" onClick={() => navigate(path)} className="flex items-center justify-between rounded-lg border border-gray-200 bg-[#F8FAFC] px-3 py-3 text-left transition hover:border-[#2E75B6] hover:bg-[#EAF2FB]">
                  <span className="flex items-center gap-2">
                    <span className="rounded-md bg-white p-2 shadow-sm">
                      <Icon size={15} className="text-[#2E75B6]" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-semibold text-[#1A1A1A]">{label}</span>
                  </span>
                  <span className="text-xs text-gray-500">Abrir</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-[#1A1A1A]">Rendimiento por paralelo</h2>
              <p className="text-sm text-gray-600">Promedio general</p>
            </div>
            {rendimiento.length > 0 && (
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#2E7D32] inline-block" /> ≥ 8.0</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#2E75B6] inline-block" /> 7.0 – 7.9</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#C62828] inline-block" /> &lt; 7.0</span>
              </div>
            )}
          </div>
          {!loading && rendimiento.length === 0 ? (
            <EmptyState icon={BarChart3} title="No existen calificaciones registradas para graficar." />
          ) : (
            <div role="img" aria-label={`Gráfico de barras del promedio de calificaciones por paralelo: ${rendimiento.map(d => `${d.paralelo} ${d.promedio}`).join(", ")}`}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={rendimiento} margin={{ top:0, right:0, left:-15, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" vertical={false} />
                  <XAxis dataKey="paralelo" tick={{ fontSize:12, fill:"#64748B" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0,10]} ticks={[0,2,4,6,7,8,10]} tick={{ fontSize:12, fill:"#64748B" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill:"#F5F7FA" }} />
                  <Bar dataKey="promedio" radius={[4,4,0,0]}>
                    {rendimiento.map((d, i) => <Cell key={i} fill={barColor(d.promedio)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Activity & Alerts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#1A1A1A]">Alertas recientes</h3>
              <span className="text-[11px] font-medium text-gray-500">Resumen del día</span>
            </div>
            {resumen && (resumen.estudiantesEnMora > 0 || resumen.ausenciasHoy > 0 || resumen.mensajesPendientes > 0) ? (
              <div className="space-y-3">
                {resumen.estudiantesEnMora > 0 && (
                  <div className="rounded-lg border border-red-100 bg-red-50 p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={14} className="mt-0.5 text-[#C62828]" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-semibold text-[#C62828]">{resumen.estudiantesEnMora} estudiantes en mora</p>
                        <p className="text-xs text-red-700 mt-0.5">Requiere seguimiento de pagos y comunicación con representantes.</p>
                      </div>
                    </div>
                  </div>
                )}
                {resumen.ausenciasHoy > 0 && (
                  <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
                    <div className="flex items-start gap-2">
                      <Users size={14} className="mt-0.5 text-amber-700" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-semibold text-amber-800">{resumen.ausenciasHoy} ausencias registradas hoy</p>
                        <p className="text-xs text-amber-700 mt-0.5">Se recomienda revisar la asistencia del día y notificar a DECE si aplica.</p>
                      </div>
                    </div>
                  </div>
                )}
                {resumen.mensajesPendientes > 0 && (
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                    <div className="flex items-start gap-2">
                      <MessageSquare size={14} className="mt-0.5 text-[#2E75B6]" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-semibold text-[#2E75B6]">{resumen.mensajesPendientes} mensajes sin leer</p>
                        <p className="text-xs text-blue-700 mt-0.5">Hay mensajes pendientes para revisar en la bandeja institucional.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState icon={BellRing} title="Sin alertas activas" description="Los indicadores del día están estables en este momento." />
            )}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#1A1A1A]">Actividad reciente</h3>
              <span className="text-[11px] font-medium text-gray-500">Últimos movimientos</span>
            </div>
            {notificaciones.length > 0 || mensajesRecientes.length > 0 ? (
              <div className="space-y-3">
                {notificaciones.map(n => (
                  <div key={n.idNotificacion} className="rounded-lg border border-gray-200 bg-[#F8FAFC] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-[#1A1A1A]">{tipoNotificacion(n.tipo)}</p>
                      <span className="text-[11px] text-gray-500 whitespace-nowrap">{formatearFecha(n.creadoEn)}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{n.mensaje}</p>
                  </div>
                ))}
                {mensajesRecientes.map(m => (
                  <div key={m.idMensaje} className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-[#1A1A1A]">{m.asunto || "Mensaje nuevo"}</p>
                      <span className="text-[11px] text-gray-500 whitespace-nowrap">{formatearFecha(m.enviadoEn)}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-3">{m.cuerpo}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Clock} title="Sin actividad reciente" description="Cuando lleguen mensajes o notificaciones, aparecerán aquí." />
            )}
          </div>
        </div>
      </div>

      {moraAbierta && <MoraDrilldown onClose={() => setMoraAbierta(false)} />}
      {promedioAbierto && <PromedioDrilldown onClose={() => setPromedioAbierto(false)} />}
      {ausenciasAbiertas && <AusenciasDrilldown onClose={() => setAusenciasAbiertas(false)} rol={rol} />}
      {mensajesAbiertos && <MensajesDrilldown onClose={() => setMensajesAbiertos(false)} rol={rol} />}
    </div>
  );
}
