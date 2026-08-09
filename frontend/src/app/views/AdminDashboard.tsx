import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle, CalendarDays, CircleDollarSign, Clock,
  Loader2, Mail, ReceiptText, RefreshCw, Users,
} from "lucide-react";
import { ApiError } from "../../api/client";
import { dashboard as dashboardApi, type ResumenAdministrativo } from "../../api/sagab";
import { Btn } from "../components/Btn";
import { EmptyState } from "../components/EmptyState";
import { KpiCard } from "../components/KpiCard";
import { TopBar } from "../components/TopBar";
import { ValoresPendientesDrilldown } from "../components/ValoresPendientesDrilldown";

const fechaHora = (valor: string) => new Date(valor).toLocaleString("es-EC", {
  day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
});

export function AdminDashboard() {
  const navigate = useNavigate();
  const [resumen, setResumen] = useState<ResumenAdministrativo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [valoresAbiertos, setValoresAbiertos] = useState(false);

  const cargar = () => {
    setLoading(true); setError(null);
    dashboardApi.administrativo().then(setResumen)
      .catch(e => setError(e instanceof ApiError ? e.message : "No se pudo cargar el resumen administrativo."))
      .finally(() => setLoading(false));
  };
  useEffect(cargar, []);

  return <div>
    <TopBar title="Inicio de Secretaría" subtitle={resumen?.anioLectivoActivo ? `Resumen administrativo · Año lectivo ${resumen.anioLectivoActivo}` : "Resumen administrativo"} />
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#C62828]"><span className="flex items-start gap-2"><AlertCircle size={16} className="mt-0.5 flex-shrink-0" />{error}</span><Btn type="button" variant="secondary" size="sm" onClick={cargar}><RefreshCw size={14} />Reintentar</Btn></div>}

      <section aria-labelledby="admin-indicadores">
        <h2 id="admin-indicadores" className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-600">Indicadores administrativos</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy={loading}>
          <KpiCard label="Estudiantes matriculados" value={loading ? "…" : (resumen?.estudiantesMatriculados ?? 0)} sub={resumen?.anioLectivoActivo ?? "Sin periodo activo"} icon={Users} accent="blue" onClick={() => navigate("/matriculados")} opensDialog={false} />
          <KpiCard label="Comprobantes por revisar" value={loading ? "…" : (resumen?.pagosPendientesRevision ?? 0)} sub="Pagos en revisión" icon={ReceiptText} accent="blue" onClick={() => navigate("/financial")} opensDialog={false} />
          <KpiCard label="Valores pendientes" value={loading ? "…" : (resumen?.estudiantesConValoresPendientes ?? 0)} sub="Estudiantes con saldo" icon={CircleDollarSign} accent="red" alert={!loading && (resumen?.estudiantesConValoresPendientes ?? 0) > 0} onClick={() => setValoresAbiertos(true)} />
        </div>
      </section>

      {loading ? <div role="status" className="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-500"><Loader2 size={18} className="mr-2 inline animate-spin" />Cargando actividad de Secretaría…</div>
        : resumen && <>
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-[#1A1A1A]">Matrículas recientes</h2><p className="text-sm text-gray-500">Últimas altas del periodo activo</p></div><button type="button" onClick={() => navigate("/matriculados")} className="text-xs font-semibold text-[#2E75B6] hover:underline">Ver matriculados</button></div>
            {resumen.matriculasRecientes.length === 0 ? <EmptyState icon={Users} title="Sin matrículas recientes" description="No hay estudiantes activos registrados en el periodo actual." /> : <ul className="divide-y divide-gray-100">{resumen.matriculasRecientes.map(item => <li key={item.idEstudiante} className="flex items-start justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-800">{item.nombreCompleto}</p><p className="text-xs text-gray-500">{item.codigo} · {item.curso} {item.paralelo}</p></div><span className="whitespace-nowrap text-[11px] text-gray-400">{fechaHora(item.creadoEn)}</span></li>)}</ul>}
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><CalendarDays size={18} className="text-[#2E75B6]" /><div><h2 className="font-semibold text-[#1A1A1A]">Próximos eventos</h2><p className="text-sm text-gray-500">Agenda institucional publicada</p></div></div><button type="button" onClick={() => navigate("/calendar")} className="text-xs font-semibold text-[#2E75B6] hover:underline">Abrir calendario</button></div>
              {resumen.proximosEventos.length === 0 ? <EmptyState icon={CalendarDays} title="Sin eventos próximos" description="No hay eventos publicados para los siguientes 45 días." /> : <ul className="divide-y divide-gray-100">{resumen.proximosEventos.map(evento => <li key={evento.idEvento} className="py-3"><p className="text-sm font-semibold text-gray-800">{evento.titulo}</p><p className="mt-1 flex items-center gap-1 text-xs text-gray-500"><Clock size={12} />{fechaHora(evento.inicio)}{evento.lugar ? ` · ${evento.lugar}` : ""}</p></li>)}</ul>}
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><Mail size={18} className="text-[#2E75B6]" /><div><h2 className="font-semibold text-[#1A1A1A]">Mensajes recientes</h2><p className="text-sm text-gray-500">{resumen.mensajesNoLeidos} sin leer</p></div></div><button type="button" onClick={() => navigate("/messages")} className="text-xs font-semibold text-[#2E75B6] hover:underline">Abrir mensajes</button></div>
              {resumen.mensajesRecientes.length === 0 ? <EmptyState icon={Mail} title="Sin mensajes recientes" description="Los mensajes recibidos aparecerán aquí." /> : <ul className="divide-y divide-gray-100">{resumen.mensajesRecientes.map(mensaje => <li key={mensaje.idMensaje} className="flex items-start gap-3 py-3"><span className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${mensaje.leido ? "bg-gray-300" : "bg-[#2E75B6]"}`} aria-label={mensaje.leido ? "Leído" : "No leído"} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className={`truncate text-sm ${mensaje.leido ? "font-medium text-gray-700" : "font-semibold text-[#1A1A1A]"}`}>{mensaje.asunto}</p><span className="whitespace-nowrap text-[11px] text-gray-400">{fechaHora(mensaje.enviadoEn)}</span></div><p className="truncate text-xs text-gray-500">De: {mensaje.remitente} · {mensaje.leido ? "Leído" : "No leído"}</p></div></li>)}</ul>}
            </section>
          </div>
        </>}
    </div>
    {valoresAbiertos && <ValoresPendientesDrilldown onClose={() => setValoresAbiertos(false)} />}
  </div>;
}
