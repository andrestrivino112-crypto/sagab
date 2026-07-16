import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Receipt, Search } from "lucide-react";
import { ApiError } from "../../api/client";
import {
  estudiantes as estudiantesApi, finanzas as finanzasApi,
  type EstudianteConParalelo, type ObligacionResponse,
} from "../../api/sagab";
import { EmptyState } from "../components/EmptyState";
import { Badge } from "../components/Badge";
import { Btn } from "../components/Btn";
import { TopBar } from "../components/TopBar";
import { useToast } from "../components/Toast";
import { PAYMENT_CFG, ESTADO_TO_STATUS } from "../paymentConfig";

export function FinancialView() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<EstudianteConParalelo[]>([]);
  const [estudiante, setEstudiante] = useState<EstudianteConParalelo | null>(null);
  const [obligaciones, setObligaciones] = useState<ObligacionResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagando, setPagando] = useState<number | null>(null);
  const [errorApi, setErrorApi] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) { setResultados([]); return; }
    const t = setTimeout(() => {
      estudiantesApi.buscar(query.trim()).then(setResultados).catch(() => setResultados([]));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const cargarObligaciones = (idEstudiante: number) => {
    setLoading(true);
    setErrorApi(null);
    finanzasApi.porEstudiante(idEstudiante)
      .then(setObligaciones)
      .catch(e => setErrorApi(e instanceof ApiError ? e.message : "No se pudo cargar el estado de cuenta."))
      .finally(() => setLoading(false));
  };

  const seleccionar = (e: EstudianteConParalelo) => {
    setEstudiante(e);
    setResultados([]);
    setQuery("");
    cargarObligaciones(e.id);
  };

  const registrarPago = async (o: ObligacionResponse) => {
    setPagando(o.idObligacion);
    try {
      await finanzasApi.registrarPago(o.idObligacion, o.valor);
      toast.success("Pago registrado correctamente");
      if (estudiante) cargarObligaciones(estudiante.id);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo registrar el pago.");
    } finally {
      setPagando(null);
    }
  };

  const totals = {
    paid:    obligaciones.filter(o => o.estado === "PAGADO").reduce((s, o) => s + o.valor, 0),
    pending: obligaciones.filter(o => o.estado === "PENDIENTE").reduce((s, o) => s + o.valor, 0),
    overdue: obligaciones.filter(o => o.estado === "VENCIDO").reduce((s, o) => s + o.valor, 0),
  };

  return (
    <div>
      <TopBar title="Estado de Cuenta"
        subtitle={estudiante ? `${estudiante.nombreCompleto}${estudiante.paralelo ? ` · ${estudiante.paralelo}` : ""}` : "Busque un estudiante"} />
      <div className="p-6 space-y-5">
        {/* Búsqueda */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Buscar estudiante</label>
          <div className="relative mt-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Nombre o apellido del estudiante"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
            {resultados.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                {resultados.map(r => (
                  <li key={r.id}>
                    <button onClick={() => seleccionar(r)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#EAF2FB] flex items-center justify-between">
                      <span className="font-medium text-[#1A1A1A]">{r.nombreCompleto}</span>
                      {r.paralelo && <span className="text-xs text-gray-400">{r.paralelo}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {errorApi && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />{errorApi}
          </div>
        )}

        {!estudiante && <EmptyState icon={Search} title="Busque un estudiante para ver su estado de cuenta." />}

        {estudiante && loading && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-sm text-gray-400">
            <Loader2 size={16} className="animate-spin inline-block mr-2" />Cargando…
          </div>
        )}

        {estudiante && !loading && obligaciones.length === 0 && (
          <EmptyState icon={Receipt} title="Este estudiante no tiene obligaciones de pago registradas." />
        )}

        {estudiante && !loading && obligaciones.length > 0 && (
        <>
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border-l-4 border-l-[#2E7D32] p-4 shadow-sm">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Total pagado</p>
            <p className="text-[28px] font-bold text-[#2E7D32] leading-none">${totals.paid.toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">{obligaciones.filter(o => o.estado === "PAGADO").length} obligaciones al día</p>
          </div>
          <div className="bg-white rounded-xl border-l-4 border-l-amber-500 p-4 shadow-sm">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Saldo pendiente</p>
            <p className="text-[28px] font-bold text-amber-600 leading-none">${totals.pending.toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">{obligaciones.filter(o => o.estado === "PENDIENTE").length} obligaciones pendientes</p>
          </div>
          <div className="bg-white rounded-xl border-l-4 border-l-[#C62828] p-4 shadow-sm">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Monto vencido</p>
            <p className="text-[28px] font-bold text-[#C62828] leading-none">${totals.overdue.toFixed(2)}</p>
            <p className="text-xs text-[#C62828] mt-1">{totals.overdue > 0 ? "Requiere atención inmediata" : "Sin vencidos"}</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-[#1A1A1A]">Detalle de obligaciones</h3>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F5F7FA]">
                {["Rubro","Monto","Vencimiento","Fecha de pago","Estado",""].map(h => (
                  <th key={h} className={`px-5 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap ${h === "Monto" ? "text-right" : h === "" ? "" : "text-center"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {obligaciones.map((o, idx) => {
                const cfg = PAYMENT_CFG[ESTADO_TO_STATUS[o.estado]];
                const Icon = cfg.icon;
                return (
                  <tr key={o.idObligacion}
                    className={`border-t border-gray-100 transition-colors ${cfg.row || (idx % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]")} hover:bg-[#EAF2FB]/20`}>
                    <td className="px-5 py-3.5 font-medium text-[#1A1A1A] whitespace-nowrap">{o.rubro}</td>
                    <td className="px-5 py-3.5 text-right font-mono font-semibold text-[#1A1A1A]">${o.valor.toFixed(2)}</td>
                    <td className="px-5 py-3.5 text-center text-gray-500 text-xs whitespace-nowrap">{o.fechaVencimiento}</td>
                    <td className="px-5 py-3.5 text-center text-gray-500 text-xs whitespace-nowrap">
                      {o.pago ? new Date(o.pago.fechaPago).toLocaleDateString("es-EC") : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <Badge v={cfg.badge}><Icon size={11} />{cfg.label}</Badge>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {(o.estado === "PENDIENTE" || o.estado === "VENCIDO") && (
                        <Btn variant="secondary" size="sm" disabled={pagando === o.idObligacion} onClick={() => registrarPago(o)}>
                          {pagando === o.idObligacion ? <Loader2 size={12} className="animate-spin" /> : "Registrar pago"}
                        </Btn>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
