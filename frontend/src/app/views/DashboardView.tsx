import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { AlertCircle, AlertTriangle, BarChart3, Clock, MessageSquare, TrendingUp, Users } from "lucide-react";
import { ApiError } from "../../api/client";
import { dashboard as dashboardApi, type ResumenDashboard } from "../../api/sagab";
import { EmptyState } from "../components/EmptyState";
import { KpiCard } from "../components/KpiCard";
import { TopBar } from "../components/TopBar";
import { barColor } from "../helpers";

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-gray-700">{label}</p>
      <p className="text-[#1F4E79]">Promedio: <strong>{payload[0].value}</strong></p>
    </div>
  );
};

export function DashboardView() {
  const [resumen, setResumen] = useState<ResumenDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorApi, setErrorApi] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    dashboardApi.resumen()
      .then(setResumen)
      .catch(e => setErrorApi(e instanceof ApiError ? e.message : "No se pudieron cargar los indicadores."))
      .finally(() => setLoading(false));
  }, []);

  const rendimiento = resumen?.rendimientoPorParalelo ?? [];

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
              icon={AlertTriangle} accent="red" alert={!loading && (resumen?.estudiantesEnMora ?? 0) > 0} />
            <KpiCard label="Promedio institucional"
              value={loading ? "…" : (resumen?.promedioInstitucional != null ? resumen.promedioInstitucional.toFixed(1) : "--")}
              icon={TrendingUp} accent="blue" />
            <KpiCard label="Ausencias hoy" value={loading ? "…" : (resumen?.ausenciasHoy ?? 0)} icon={Users} accent="amber" />
            <KpiCard label="Mensajes pendientes" value={loading ? "…" : (resumen?.mensajesPendientes ?? 0)} icon={MessageSquare} accent="blue" />
          </div>
        </div>

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
            <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">Alertas recientes</h3>
            <EmptyState icon={AlertTriangle} title="Aún no hay alertas recientes." />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">Actividad reciente</h3>
            <EmptyState icon={Clock} title="Aún no hay actividad reciente." />
          </div>
        </div>
      </div>
    </div>
  );
}
