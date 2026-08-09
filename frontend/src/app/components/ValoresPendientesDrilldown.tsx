import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, CircleDollarSign, Loader2, Search, Send } from "lucide-react";
import { ApiError } from "../../api/client";
import { finanzas as finanzasApi, type ValorPendienteResponse } from "../../api/sagab";
import { Btn } from "./Btn";
import { EmptyState } from "./EmptyState";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

const moneda = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
const fecha = (valor: string) => new Date(`${valor}T00:00:00`).toLocaleDateString("es-EC");

export function ValoresPendientesDrilldown({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [filas, setFilas] = useState<ValorPendienteResponse[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<ValorPendienteResponse | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviadas, setEnviadas] = useState<Set<number>>(new Set());

  const cargar = () => {
    setLoading(true); setError(null);
    finanzasApi.pendientes().then(setFilas)
      .catch(e => setError(e instanceof ApiError ? e.message : "No se pudieron cargar los valores pendientes."))
      .finally(() => setLoading(false));
  };
  useEffect(cargar, []);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase("es");
    if (!q) return filas;
    return filas.filter(fila => [fila.nombreCompleto, fila.codigo, fila.curso ?? "", fila.paralelo ?? "",
      fila.representante ?? "", fila.representanteEmail ?? "", fila.representanteTelefono ?? ""]
      .some(valor => valor.toLocaleLowerCase("es").includes(q)));
  }, [busqueda, filas]);

  const confirmar = (fila: ValorPendienteResponse) => {
    setSeleccionado(fila);
    setMensaje(`Recordatorio de pago: ${fila.nombreCompleto} mantiene ${fila.cantidadObligaciones} obligación(es) pendiente(s) por un total de ${moneda.format(fila.valorTotalPendiente)}. Por favor revise su estado de cuenta.`);
  };
  const enviar = async () => {
    if (!seleccionado || !mensaje.trim()) return;
    setEnviando(true);
    try {
      await finanzasApi.notificarPendiente(seleccionado.idEstudiante, mensaje.trim());
      setEnviadas(actual => new Set(actual).add(seleccionado.idEstudiante));
      setSeleccionado(null);
      toast.success("Notificación de pago enviada correctamente");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo enviar la notificación.");
    } finally { setEnviando(false); }
  };

  return <Modal title={seleccionado ? "Confirmar notificación de pago" : "Valores pendientes"} onClose={onClose} size="xl">
    {seleccionado ? <div className="space-y-4">
      <button type="button" onClick={() => setSeleccionado(null)} className="inline-flex items-center gap-1 text-sm font-medium text-[#2E75B6] hover:underline"><ArrowLeft size={14} />Volver al listado</button>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">{seleccionado.nombreCompleto} · {seleccionado.codigo}</p><p className="mt-1">{seleccionado.cantidadObligaciones} obligación(es), {seleccionado.obligacionesVencidas} vencida(s) · <strong>{moneda.format(seleccionado.valorTotalPendiente)}</strong></p></div>
      <div><label htmlFor="mensaje-pendiente" className="mb-1 block text-xs font-semibold text-gray-600">Mensaje editable</label><textarea id="mensaje-pendiente" rows={6} maxLength={500} value={mensaje} onChange={e => setMensaje(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#2E75B6] focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/20" /><p className="mt-1 text-right text-[11px] text-gray-400">{mensaje.length}/500</p></div>
      <div className="flex justify-end gap-2"><Btn type="button" variant="secondary" onClick={() => setSeleccionado(null)}>Cancelar</Btn><Btn type="button" disabled={enviando || !mensaje.trim()} onClick={() => void enviar()}>{enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}Enviar notificación</Btn></div>
    </div> : <div className="space-y-4">
      <label className="relative block"><span className="sr-only">Buscar estudiante con valores pendientes</span><Search size={16} className="absolute left-3 top-2.5 text-gray-400" /><input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar nombre, código, curso o representante" className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-[#2E75B6] focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/20" /></label>
      {error && <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]"><span className="flex gap-2"><AlertCircle size={16} className="mt-0.5" />{error}</span><Btn type="button" size="sm" variant="secondary" onClick={cargar}>Reintentar</Btn></div>}
      {loading ? <div role="status" className="py-12 text-center text-sm text-gray-500"><Loader2 size={18} className="mr-2 inline animate-spin" />Cargando valores…</div>
        : !error && visibles.length === 0 ? <EmptyState icon={CircleDollarSign} title={filas.length === 0 ? "No hay valores pendientes" : "No hay coincidencias"} description={filas.length === 0 ? "No existen obligaciones pendientes o vencidas para estudiantes activos." : "Pruebe con otro criterio de búsqueda."} />
        : visibles.length > 0 && <div className="overflow-x-auto rounded-xl border border-gray-200"><table className="w-full min-w-[1120px] text-left text-sm"><thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500"><tr><th className="px-3 py-2">Estudiante</th><th className="px-3 py-2">Curso</th><th className="px-3 py-2">Representante / contacto</th><th className="px-3 py-2">Saldo</th><th className="px-3 py-2">Obligaciones</th><th className="px-3 py-2">Vencimiento más antiguo</th><th className="px-3 py-2 text-right">Acción</th></tr></thead><tbody className="divide-y divide-gray-100">{visibles.map(fila => <tr key={fila.idEstudiante} className="hover:bg-gray-50"><td className="px-3 py-3"><p className="font-medium text-gray-800">{fila.nombreCompleto}</p><p className="text-xs text-gray-500">{fila.codigo}</p></td><td className="px-3 py-3 text-gray-600">{fila.curso ?? "—"} {fila.paralelo ?? ""}</td><td className="px-3 py-3"><p className="text-gray-700">{fila.representante ?? "Sin representante"}</p><p className="text-xs text-gray-500">{fila.representanteEmail ?? fila.representanteTelefono ?? "Sin contacto"}</p></td><td className="px-3 py-3 font-semibold text-[#C62828]">{moneda.format(fila.valorTotalPendiente)}</td><td className="px-3 py-3 text-gray-600">{fila.cantidadObligaciones} total · {fila.obligacionesVencidas} vencida(s)</td><td className="px-3 py-3 text-gray-600">{fecha(fila.fechaVencimientoMasAntigua)}</td><td className="px-3 py-3 text-right"><button type="button" onClick={() => confirmar(fila)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${enviadas.has(fila.idEstudiante) ? "bg-green-50 text-[#2E7D32]" : "bg-[#EAF2FB] text-[#1F4E79] hover:bg-blue-100"}`}>{enviadas.has(fila.idEstudiante) ? <CheckCircle2 size={14} /> : <Send size={14} />}{enviadas.has(fila.idEstudiante) ? "Enviada · reenviar" : "Enviar notificación"}</button></td></tr>)}</tbody></table></div>}
      {!loading && <p className="text-xs text-gray-500">{visibles.length} de {filas.length} estudiante(s)</p>}
    </div>}
  </Modal>;
}
