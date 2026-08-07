import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, ArrowUpDown, Bell, FileDown, Loader2, MessageSquare, Search, Send,
} from "lucide-react";
import { ApiError } from "../../api/client";
import {
  finanzas as finanzasApi,
  type CanalComunicacionMora, type EstudianteMoraResponse,
} from "../../api/sagab";
import { Badge } from "./Badge";
import { Btn } from "./Btn";
import { Modal } from "./Modal";
import { useToast } from "./Toast";
import { initials } from "../helpers";

type Columna = "nombre" | "valor" | "vencimiento";

const CANAL_LABEL: Record<CanalComunicacionMora, string> = {
  RECORDATORIO: "Recordatorio de pago",
  MENSAJE_INTERNO: "Mensaje privado",
};

function diasVencido(fecha: string): number {
  const ms = Date.now() - new Date(fecha + "T00:00:00").getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function MoraDrilldown({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [filas, setFilas] = useState<EstudianteMoraResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [ordenPor, setOrdenPor] = useState<Columna>("vencimiento");
  const [ordenAsc, setOrdenAsc] = useState(true);

  const [comunicacionDe, setComunicacionDe] = useState<{ fila: EstudianteMoraResponse; canal: CanalComunicacionMora } | null>(null);
  const [asunto, setAsunto] = useState("");
  const [mensajeTexto, setMensajeTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    finanzasApi.mora()
      .then(setFilas)
      .catch(e => setErrorApi(e instanceof ApiError ? e.message : "No se pudo cargar el listado de estudiantes en mora."))
      .finally(() => setLoading(false));
  }, []);

  const filasVisibles = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtradas = q
      ? filas.filter(f =>
          f.nombreCompleto.toLowerCase().includes(q) ||
          f.codigo.toLowerCase().includes(q) ||
          (f.representante ?? "").toLowerCase().includes(q))
      : filas;
    const signo = ordenAsc ? 1 : -1;
    return [...filtradas].sort((a, b) => {
      if (ordenPor === "nombre") return signo * a.nombreCompleto.localeCompare(b.nombreCompleto);
      if (ordenPor === "valor") return signo * (a.valorPendiente - b.valorPendiente);
      return signo * (a.fechaVencimientoMasAntigua < b.fechaVencimientoMasAntigua ? -1 : a.fechaVencimientoMasAntigua > b.fechaVencimientoMasAntigua ? 1 : 0);
    });
  }, [filas, query, ordenPor, ordenAsc]);

  const ordenar = (col: Columna) => {
    if (col === ordenPor) setOrdenAsc(a => !a);
    else { setOrdenPor(col); setOrdenAsc(true); }
  };

  const abrirComunicacion = (fila: EstudianteMoraResponse, canal: CanalComunicacionMora) => {
    setComunicacionDe({ fila, canal });
    setAsunto("Pago pendiente");
    setMensajeTexto(
      canal === "RECORDATORIO"
        ? `Le recordamos que ${fila.nombreCompleto} tiene un saldo pendiente de $${fila.valorPendiente.toFixed(2)}, vencido desde el ${fila.fechaVencimientoMasAntigua}. Agradecemos regularizar su pago a la brevedad.`
        : "");
  };

  const enviarComunicacion = async () => {
    if (!comunicacionDe || !mensajeTexto.trim()) return;
    setEnviando(true);
    try {
      await finanzasApi.enviarComunicacion(comunicacionDe.fila.idEstudiante, {
        canal: comunicacionDe.canal, asunto, mensaje: mensajeTexto.trim(),
      });
      toast.success(`${CANAL_LABEL[comunicacionDe.canal]} enviado correctamente`);
      setComunicacionDe(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo enviar la comunicación.");
    } finally {
      setEnviando(false);
    }
  };

  // jspdf/jspdf-autotable se cargan solo al exportar (no en cada visita al Dashboard).
  const exportarPdf = async () => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"), import("jspdf-autotable"),
    ]);
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Estudiantes en mora", 14, 15);
    doc.setFontSize(9);
    doc.text(`Generado el ${new Date().toLocaleDateString("es-EC")} — ${filasVisibles.length} estudiante(s)`, 14, 21);
    autoTable(doc, {
      startY: 26,
      head: [["Código", "Estudiante", "Curso", "Representante", "Valor pendiente", "Vencido desde", "Teléfono", "Email"]],
      body: filasVisibles.map(f => [
        f.codigo, f.nombreCompleto, f.paralelo ?? "—", f.representante ?? "—",
        `$${f.valorPendiente.toFixed(2)}`, f.fechaVencimientoMasAntigua,
        f.representanteTelefono ?? "—", f.representanteEmail ?? "—",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [31, 78, 121] },
    });
    doc.save(`estudiantes-en-mora-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const encabezado = (col: Columna, label: string) => (
    <button type="button" onClick={() => ordenar(col)}
      className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-600 uppercase tracking-widest hover:text-[#1F4E79] focus:outline-none">
      {label}<ArrowUpDown size={11} className={ordenPor === col ? "text-[#2E75B6]" : "text-gray-300"} aria-hidden="true" />
    </button>
  );

  return (
    <Modal title="Estudiantes en mora" onClose={onClose} size="xl">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div className="relative max-w-xs w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por estudiante, código o representante"
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
          </div>
          <div className="flex items-center gap-2">
            <Btn variant="secondary" size="sm" onClick={exportarPdf} disabled={filasVisibles.length === 0}>
              <FileDown size={13} aria-hidden="true" />Exportar PDF
            </Btn>
          </div>
        </div>

        {errorApi && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />{errorApi}
          </div>
        )}

        {loading && (
          <div className="p-8 text-center text-sm text-gray-600">
            <Loader2 size={16} className="animate-spin inline-block mr-2" aria-hidden="true" />Cargando…
          </div>
        )}

        {!loading && filasVisibles.length === 0 && !errorApi && (
          <p className="text-sm text-gray-600 text-center py-8">
            {filas.length === 0 ? "No hay estudiantes en mora." : "Ningún estudiante coincide con la búsqueda."}
          </p>
        )}

        {!loading && filasVisibles.length > 0 && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Estudiantes con al menos una obligación de pago vencida</caption>
                <thead>
                  <tr className="bg-[#F5F7FA]">
                    <th scope="col" className="px-4 py-2.5 text-left">{encabezado("nombre", "Estudiante")}</th>
                    <th scope="col" className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Curso</th>
                    <th scope="col" className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Representante</th>
                    <th scope="col" className="px-4 py-2.5 text-right">{encabezado("valor", "Valor pendiente")}</th>
                    <th scope="col" className="px-4 py-2.5 text-center">{encabezado("vencimiento", "Vencido desde")}</th>
                    <th scope="col" className="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Estado</th>
                    <th scope="col" className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Contacto</th>
                    <th scope="col" className="px-4 py-2.5 sr-only">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filasVisibles.map((f, idx) => (
                    <tr key={f.idEstudiante} className={`border-t border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]"}`}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-full bg-[#EAF2FB] text-[#1F4E79] text-xs font-semibold flex items-center justify-center flex-shrink-0" aria-hidden="true">
                            {initials(f.nombreCompleto)}
                          </span>
                          <div>
                            <p className="font-medium text-[#1A1A1A] leading-tight">{f.nombreCompleto}</p>
                            <p className="text-xs text-gray-500">{f.codigo}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{f.paralelo ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{f.representante ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-[#1A1A1A] whitespace-nowrap">${f.valorPendiente.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap">{f.fechaVencimientoMasAntigua}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <Badge v="error">Vencido hace {diasVencido(f.fechaVencimientoMasAntigua)} días</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        <p>{f.representanteTelefono ?? "—"}</p>
                        <p>{f.representanteEmail ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button type="button" title="Enviar recordatorio de pago" onClick={() => abrirComunicacion(f, "RECORDATORIO")}
                            className="p-1.5 rounded-md text-gray-500 hover:bg-[#EAF2FB] hover:text-[#1F4E79] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E75B6]/40">
                            <Bell size={14} aria-hidden="true" />
                          </button>
                          <button type="button" title="Enviar mensaje privado" onClick={() => abrirComunicacion(f, "MENSAJE_INTERNO")}
                            className="p-1.5 rounded-md text-gray-500 hover:bg-[#EAF2FB] hover:text-[#1F4E79] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E75B6]/40">
                            <MessageSquare size={14} aria-hidden="true" />
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
      </div>

      {comunicacionDe && (
        <Modal title={`${CANAL_LABEL[comunicacionDe.canal]} — ${comunicacionDe.fila.nombreCompleto}`} onClose={() => setComunicacionDe(null)} size="md">
          <div className="space-y-3">
            {comunicacionDe.canal === "MENSAJE_INTERNO" && (
              <div>
                <label htmlFor="mora-com-asunto" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Asunto</label>
                <input id="mora-com-asunto" value={asunto} onChange={e => setAsunto(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
              </div>
            )}
            <div>
              <label htmlFor="mora-com-mensaje" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Mensaje</label>
              <textarea id="mora-com-mensaje" value={mensajeTexto} onChange={e => setMensajeTexto(e.target.value)} rows={4} maxLength={500}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6] resize-none" />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Btn type="button" variant="secondary" onClick={() => setComunicacionDe(null)}>Cancelar</Btn>
              <Btn type="button" onClick={enviarComunicacion} disabled={enviando || !mensajeTexto.trim()}>
                {enviando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
                Enviar
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
