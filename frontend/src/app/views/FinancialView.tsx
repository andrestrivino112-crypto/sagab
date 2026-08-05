import { useEffect, useState } from "react";
import { AlertCircle, Check, Eye, Loader2, Receipt, Search, X } from "lucide-react";
import { ApiError } from "../../api/client";
import {
  estudiantes as estudiantesApi, finanzas as finanzasApi,
  type EstudianteConParalelo, type ObligacionResponse, type PagoRevisionResponse,
} from "../../api/sagab";
import { EmptyState } from "../components/EmptyState";
import { Badge } from "../components/Badge";
import { Btn } from "../components/Btn";
import { TopBar } from "../components/TopBar";
import { useToast } from "../components/Toast";
import { useDebouncedSearch } from "../hooks/useDebouncedSearch";
import { PAYMENT_CFG, ESTADO_TO_STATUS } from "../paymentConfig";

export function FinancialView() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const resultados = useDebouncedSearch(query, estudiantesApi.buscar);
  const [estudiante, setEstudiante] = useState<EstudianteConParalelo | null>(null);
  const [obligaciones, setObligaciones] = useState<ObligacionResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagando, setPagando] = useState<number | null>(null);
  const [errorApi, setErrorApi] = useState<string | null>(null);

  const [cola, setCola] = useState<PagoRevisionResponse[]>([]);
  const [procesando, setProcesando] = useState<number | null>(null);

  const cargarCola = () => { finanzasApi.colaRevision().then(setCola).catch(() => {}); };
  useEffect(cargarCola, []);

  const verComprobante = async (idPago: number) => {
    try {
      const { url } = await finanzasApi.urlComprobante(idPago);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo abrir el comprobante.");
    }
  };

  const revisar = async (idPago: number, accion: "aprobar" | "rechazar") => {
    setProcesando(idPago);
    try {
      await (accion === "aprobar" ? finanzasApi.aprobar(idPago) : finanzasApi.rechazar(idPago));
      toast.success(accion === "aprobar" ? "Pago aprobado" : "Pago rechazado");
      setCola(prev => prev.filter(p => p.idPago !== idPago));
      if (estudiante) cargarObligaciones(estudiante.id);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo procesar la revisión.");
    } finally {
      setProcesando(null);
    }
  };

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
        {/* Comprobantes de transferencia pendientes de revisión */}
        {cola.length > 0 && (
          <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-amber-100 bg-amber-50">
              <h3 className="text-sm font-semibold text-amber-800">Comprobantes por revisar ({cola.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Pagos por transferencia pendientes de aprobar o rechazar</caption>
                <thead>
                  <tr className="bg-[#F5F7FA]">
                    {["Estudiante","Rubro","Monto","Nombre de la cuenta","Asunto","N° transacción","Fecha","Comprobante","Acción"].map(h => (
                      <th key={h} scope="col" className="px-4 py-2.5 text-[10px] font-semibold text-gray-600 uppercase tracking-widest whitespace-nowrap text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cola.map(p => (
                    <tr key={p.idPago} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium text-[#1A1A1A] whitespace-nowrap">{p.estudiante}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.rubro}</td>
                      <td className="px-4 py-3 font-mono font-semibold whitespace-nowrap">${p.valorPagado.toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.bancoOrigen}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.asunto}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono text-xs">{p.numeroReferencia}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(p.fechaPago).toLocaleDateString("es-EC")}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button type="button" onClick={() => verComprobante(p.idPago)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#2E75B6] hover:underline focus:outline-none">
                          <Eye size={12} aria-hidden="true" />Ver
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button type="button" disabled={procesando === p.idPago} onClick={() => revisar(p.idPago, "aprobar")}
                            aria-label={`Aprobar pago de ${p.estudiante}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-white bg-[#2E7D32] hover:bg-[#256428] px-2 py-1 rounded-md disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D32]/40">
                            <Check size={12} aria-hidden="true" />Aprobar
                          </button>
                          <button type="button" disabled={procesando === p.idPago} onClick={() => revisar(p.idPago, "rechazar")}
                            aria-label={`Rechazar pago de ${p.estudiante}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#C62828] hover:bg-red-50 px-2 py-1 rounded-md disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C62828]/40">
                            <X size={12} aria-hidden="true" />Rechazar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Búsqueda */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Buscar estudiante</label>
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
                      {r.paralelo && <span className="text-xs text-gray-600">{r.paralelo}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {errorApi && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />{errorApi}
          </div>
        )}

        {!estudiante && <EmptyState icon={Search} title="Busque un estudiante para ver su estado de cuenta." />}

        {estudiante && loading && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-sm text-gray-600">
            <Loader2 size={16} className="animate-spin inline-block mr-2" aria-hidden="true" />Cargando…
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
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Total pagado</p>
            <p className="text-[28px] font-bold text-[#2E7D32] leading-none">${totals.paid.toFixed(2)}</p>
            <p className="text-xs text-gray-600 mt-1">{obligaciones.filter(o => o.estado === "PAGADO").length} obligaciones al día</p>
          </div>
          <div className="bg-white rounded-xl border-l-4 border-l-amber-500 p-4 shadow-sm">
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Saldo pendiente</p>
            <p className="text-[28px] font-bold text-amber-600 leading-none">${totals.pending.toFixed(2)}</p>
            <p className="text-xs text-gray-600 mt-1">{obligaciones.filter(o => o.estado === "PENDIENTE").length} obligaciones pendientes</p>
          </div>
          <div className="bg-white rounded-xl border-l-4 border-l-[#C62828] p-4 shadow-sm">
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Monto vencido</p>
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
            <caption className="sr-only">Detalle de obligaciones de pago de {estudiante.nombreCompleto}</caption>
            <thead>
              <tr className="bg-[#F5F7FA]">
                {["Rubro","Monto","Vencimiento","Fecha de pago","Estado","Acción"].map(h => (
                  <th key={h} scope="col" className={`px-5 py-3 text-[10px] font-semibold text-gray-600 uppercase tracking-widest whitespace-nowrap ${h === "Monto" ? "text-right" : h === "Acción" ? "sr-only" : "text-center"}`}>{h}</th>
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
                      <Badge v={cfg.badge}><Icon size={11} aria-hidden="true" />{cfg.label}</Badge>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {(o.estado === "PENDIENTE" || o.estado === "VENCIDO") && (
                        <Btn variant="secondary" size="sm" disabled={pagando === o.idObligacion} onClick={() => registrarPago(o)}>
                          {pagando === o.idObligacion ? <><Loader2 size={12} className="animate-spin" aria-hidden="true" />Registrando…</> : "Registrar pago"}
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
