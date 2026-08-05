import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, Download, FileUp, Loader2, Plus, Send } from "lucide-react";
import { ApiError } from "../../api/client";
import { tareas as tareasApi, type TareaResponse, type EntregaResponse } from "../../api/sagab";
import { EmptyState } from "../components/EmptyState";
import { Btn } from "../components/Btn";
import { Badge } from "../components/Badge";
import { TopBar } from "../components/TopBar";
import { useToast } from "../components/Toast";
import { useAsignaciones } from "../hooks/useAsignaciones";

const ESTADO_BADGE: Record<EntregaResponse["estado"], { v: "success" | "warning" | "error" | "info"; label: string }> = {
  PENDIENTE: { v: "info", label: "Pendiente" },
  ENTREGADO: { v: "warning", label: "Entregado" },
  REVISADO:  { v: "success", label: "Revisado" },
};

export function TareasView({ soloLectura = false }: { soloLectura?: boolean }) {
  const toast = useToast();
  const { opciones: asignacionesOpciones, idAsignacion, setIdAsignacion, asignacion, error: errorAsignaciones } = useAsignaciones();
  const [tareas, setTareas] = useState<TareaResponse[]>([]);
  const [idTareaSel, setIdTareaSel] = useState<number | null>(null);
  const [entregas, setEntregas] = useState<EntregaResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorApi, setErrorApi] = useState<string | null>(null);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fechaLimite, setFechaLimite] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargarTareas = () => {
    if (!asignacion) { setTareas([]); return; }
    setLoading(true);
    setErrorApi(null);
    tareasApi.porAsignacion(asignacion.idAsignacion)
      .then(lista => { setTareas(lista); setIdTareaSel(lista[0]?.idTarea ?? null); })
      .catch(e => setErrorApi(e instanceof ApiError ? e.message : "No se pudieron cargar los deberes."))
      .finally(() => setLoading(false));
  };

  useEffect(cargarTareas, [asignacion?.idAsignacion]);

  useEffect(() => {
    if (idTareaSel == null) { setEntregas([]); return; }
    tareasApi.entregasDeTarea(idTareaSel).then(setEntregas)
      .catch(e => setErrorApi(e instanceof ApiError ? e.message : "No se pudieron cargar las entregas."));
  }, [idTareaSel]);

  const crearTarea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asignacion || !titulo.trim() || !fechaLimite) return;
    setGuardando(true);
    try {
      await tareasApi.crear(asignacion.idAsignacion, titulo.trim(), descripcion.trim() || undefined,
        new Date(fechaLimite).toISOString());
      toast.success("Deber publicado correctamente");
      setTitulo(""); setDescripcion(""); setFechaLimite(""); setMostrarForm(false);
      cargarTareas();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo publicar el deber.");
    } finally {
      setGuardando(false);
    }
  };

  const revisar = async (idEntrega: number) => {
    try {
      const actualizada = await tareasApi.revisar(idEntrega);
      setEntregas(prev => prev.map(en => en.idEntrega === idEntrega ? actualizada : en));
      toast.success("Entrega marcada como revisada");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo marcar como revisada.");
    }
  };

  const descargar = async (idEntrega: number) => {
    try {
      const { url } = await tareasApi.urlDescarga(idEntrega);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo generar el enlace de descarga.");
    }
  };

  const tareaSel = tareas.find(t => t.idTarea === idTareaSel);

  return (
    <div>
      <TopBar title="Deberes"
        subtitle={soloLectura ? "Consulte los deberes publicados y el estado de las entregas" : "Publique tareas y revise las entregas de sus estudiantes"} />
      <div className="p-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4 flex items-end gap-4 flex-wrap">
          <div className="flex flex-col gap-1 min-w-[280px]">
            <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Asignación</label>
            <select value={idAsignacion} onChange={e => setIdAsignacion(e.target.value ? Number(e.target.value) : "")}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6] bg-white">
              {asignacionesOpciones.length === 0 && <option value="">Sin asignaciones</option>}
              {asignacionesOpciones.map(a => (
                <option key={a.idAsignacion} value={a.idAsignacion}>
                  {a.paralelo} · {a.materia} · {a.periodo}{a.docente ? ` · ${a.docente}` : ""}
                </option>
              ))}
            </select>
          </div>
          {!soloLectura && (
            <Btn onClick={() => setMostrarForm(v => !v)} disabled={!asignacion} className="ml-auto">
              <Plus size={14} aria-hidden="true" />Nuevo deber
            </Btn>
          )}
        </div>

        {(errorApi || errorAsignaciones) && (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />{errorApi ?? errorAsignaciones}
          </div>
        )}

        {!soloLectura && mostrarForm && asignacion && (
          <form onSubmit={crearTarea} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4 space-y-3">
            <div>
              <label htmlFor="tarea-titulo" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Título</label>
              <input id="tarea-titulo" value={titulo} onChange={e => setTitulo(e.target.value)} required maxLength={150}
                placeholder="Ej. Ensayo sobre la Revolución Industrial"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
            </div>
            <div>
              <label htmlFor="tarea-desc" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Descripción (opcional)</label>
              <textarea id="tarea-desc" value={descripcion} onChange={e => setDescripcion(e.target.value)} maxLength={1000} rows={2}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
            </div>
            <div className="max-w-xs">
              <label htmlFor="tarea-fecha" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Fecha límite</label>
              <input id="tarea-fecha" type="datetime-local" value={fechaLimite} onChange={e => setFechaLimite(e.target.value)} required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
            </div>
            <Btn disabled={guardando}>
              {guardando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
              Publicar deber
            </Btn>
          </form>
        )}

        {!asignacion && !loading && (
          <EmptyState icon={FileUp} title="Seleccione una asignación para ver o publicar deberes." />
        )}

        {asignacion && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:col-span-1">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-3">Deberes publicados</p>
              {loading && <Loader2 size={16} className="animate-spin text-gray-400" aria-hidden="true" />}
              {!loading && tareas.length === 0 && <p className="text-sm text-gray-600">Todavía no hay deberes para esta asignación.</p>}
              <ul className="space-y-1">
                {tareas.map(t => (
                  <li key={t.idTarea}>
                    <button type="button" onClick={() => setIdTareaSel(t.idTarea)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors
                        ${idTareaSel === t.idTarea ? "bg-[#EAF2FB] text-[#1F4E79] font-medium" : "hover:bg-gray-50 text-gray-700"}`}>
                      <p className="truncate">{t.titulo}</p>
                      <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                        <Clock size={11} aria-hidden="true" />
                        Vence {new Date(t.fechaLimite).toLocaleString("es-EC", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden lg:col-span-2">
              {!tareaSel ? (
                <div className="p-4"><EmptyState icon={FileUp} title="Seleccione un deber para ver las entregas." /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Entregas de {tareaSel.titulo}</caption>
                    <thead>
                      <tr className="bg-[#F5F7FA] border-b border-gray-200">
                        <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estudiante</th>
                        <th scope="col" className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                        <th scope="col" className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entregas.map((en, idx) => (
                        <tr key={en.idEntrega} className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]"}`}>
                          <td className="px-4 py-3 font-medium text-[#1A1A1A]">{en.estudiante}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge v={ESTADO_BADGE[en.estado].v}>{ESTADO_BADGE[en.estado].label}</Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {en.archivoNombreOriginal && (
                                <button type="button" onClick={() => descargar(en.idEntrega)}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-[#2E75B6] hover:underline focus:outline-none">
                                  <Download size={12} aria-hidden="true" />Ver archivo
                                </button>
                              )}
                              {!soloLectura && en.estado === "ENTREGADO" && (
                                <button type="button" onClick={() => revisar(en.idEntrega)}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-[#2E7D32] hover:underline focus:outline-none">
                                  <CheckCircle2 size={12} aria-hidden="true" />Marcar revisado
                                </button>
                              )}
                              {en.estado === "PENDIENTE" && <span className="text-xs text-gray-400">Sin entregar</span>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
