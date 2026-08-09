import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, Download, FileUp, Loader2, Paperclip, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { ApiError } from "../../api/client";
import {
  tareas as tareasApi,
  type AdjuntoTareaResponse, type TareaResponse, type EntregaResponse,
} from "../../api/sagab";
import { EmptyState } from "../components/EmptyState";
import { Btn } from "../components/Btn";
import { Badge } from "../components/Badge";
import { FileUpload } from "../components/FileUpload";
import { Modal } from "../components/Modal";
import { TopBar } from "../components/TopBar";
import { useToast } from "../components/Toast";
import { useAsignaciones } from "../hooks/useAsignaciones";

const ESTADO_BADGE: Record<EntregaResponse["estado"], { v: "success" | "warning" | "error" | "info"; label: string }> = {
  PENDIENTE: { v: "info", label: "Pendiente" },
  ENTREGADO: { v: "warning", label: "Entregado" },
  REVISADO:  { v: "success", label: "Revisado" },
};

/** Convierte un ISO (OffsetDateTime del backend) al formato local que espera <input type="datetime-local">. */
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TareasView({ soloLectura = false }: { soloLectura?: boolean }) {
  const toast = useToast();
  const {
    opciones: asignacionesOpciones, idAsignacion, setIdAsignacion, asignacion,
    error: errorAsignaciones, loading: loadingAsignaciones, recargar: recargarAsignaciones,
  } = useAsignaciones();
  const [tareas, setTareas] = useState<TareaResponse[]>([]);
  const [idTareaSel, setIdTareaSel] = useState<number | null>(null);
  const [entregas, setEntregas] = useState<EntregaResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingEntregas, setLoadingEntregas] = useState(false);
  const [loadingAdjuntos, setLoadingAdjuntos] = useState(false);
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [errorEntregas, setErrorEntregas] = useState<string | null>(null);
  const [errorAdjuntos, setErrorAdjuntos] = useState<string | null>(null);
  const [confirmacion, setConfirmacion] = useState<string | null>(null);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fechaLimite, setFechaLimite] = useState("");
  const [parcial, setParcial] = useState<1 | 2 | 3>(1);
  const [puntaje, setPuntaje] = useState("10");
  const [guardando, setGuardando] = useState(false);

  const [editando, setEditando] = useState<TareaResponse | null>(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");
  const [editFechaLimite, setEditFechaLimite] = useState("");
  const [editParcial, setEditParcial] = useState<1 | 2 | 3>(1);
  const [editPuntaje, setEditPuntaje] = useState("10");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  const [eliminando, setEliminando] = useState<TareaResponse | null>(null);
  const [borrando, setBorrando] = useState(false);

  const [adjuntos, setAdjuntos] = useState<AdjuntoTareaResponse[]>([]);
  const [nombreAdjunto, setNombreAdjunto] = useState("");
  const [archivoAdjunto, setArchivoAdjunto] = useState<File | null>(null);
  const [subiendoAdjunto, setSubiendoAdjunto] = useState(false);
  const [eliminandoAdjuntoId, setEliminandoAdjuntoId] = useState<number | null>(null);
  const [adjuntoUploadKey, setAdjuntoUploadKey] = useState(0);

  const [calificando, setCalificando] = useState<EntregaResponse | null>(null);
  const [notaInput, setNotaInput] = useState("");
  const [observacionInput, setObservacionInput] = useState("");
  const [guardandoRevision, setGuardandoRevision] = useState(false);
  const solicitudTareas = useRef(0);
  const solicitudEntregas = useRef(0);
  const solicitudAdjuntos = useRef(0);

  const limpiarCreacion = () => {
    setTitulo(""); setDescripcion(""); setFechaLimite(""); setParcial(1); setPuntaje("10"); setMostrarForm(false);
  };

  const cargarTareas = useCallback(async (idPreferida?: number) => {
    if (!asignacion) return;
    const solicitud = ++solicitudTareas.current;
    setLoading(true);
    setErrorApi(null);
    try {
      const lista = await tareasApi.porAsignacion(asignacion.idAsignacion);
      if (solicitud !== solicitudTareas.current) return;
      setTareas(lista);
      const seleccion = idPreferida != null && lista.some(t => t.idTarea === idPreferida)
        ? idPreferida : lista[0]?.idTarea ?? null;
      setIdTareaSel(seleccion);
    } catch (e) {
      if (solicitud !== solicitudTareas.current) return;
      setTareas([]);
      setIdTareaSel(null);
      setErrorApi(e instanceof ApiError ? e.message : "No se pudieron cargar los deberes.");
    } finally {
      if (solicitud === solicitudTareas.current) setLoading(false);
    }
  }, [asignacion?.idAsignacion]);

  const cargarEntregas = useCallback(async (idTarea: number) => {
    const solicitud = ++solicitudEntregas.current;
    setLoadingEntregas(true);
    setErrorEntregas(null);
    try {
      const lista = await tareasApi.entregasDeTarea(idTarea);
      if (solicitud === solicitudEntregas.current) setEntregas(lista);
    } catch (e) {
      if (solicitud !== solicitudEntregas.current) return;
      setEntregas([]);
      setErrorEntregas(e instanceof ApiError ? e.message : "No se pudieron cargar las entregas.");
    } finally {
      if (solicitud === solicitudEntregas.current) setLoadingEntregas(false);
    }
  }, []);

  const cargarAdjuntos = useCallback(async (idTarea: number) => {
    const solicitud = ++solicitudAdjuntos.current;
    setLoadingAdjuntos(true);
    setErrorAdjuntos(null);
    try {
      const lista = await tareasApi.adjuntosDeTarea(idTarea);
      if (solicitud === solicitudAdjuntos.current) setAdjuntos(lista);
    } catch (e) {
      if (solicitud !== solicitudAdjuntos.current) return;
      setAdjuntos([]);
      setErrorAdjuntos(e instanceof ApiError ? e.message : "No se pudo cargar el material de apoyo.");
    } finally {
      if (solicitud === solicitudAdjuntos.current) setLoadingAdjuntos(false);
    }
  }, []);

  useEffect(() => {
    solicitudTareas.current++;
    solicitudEntregas.current++;
    solicitudAdjuntos.current++;
    setTareas([]); setIdTareaSel(null); setEntregas([]); setAdjuntos([]);
    setLoading(false); setLoadingEntregas(false); setLoadingAdjuntos(false);
    setErrorApi(null); setErrorEntregas(null); setErrorAdjuntos(null); setConfirmacion(null);
    setMostrarForm(false); setTitulo(""); setDescripcion(""); setFechaLimite(""); setParcial(1); setPuntaje("10");
    setEditando(null); setEditTitulo(""); setEditDescripcion(""); setEditFechaLimite(""); setEditParcial(1); setEditPuntaje("10");
    setEliminando(null); setCalificando(null); setNotaInput(""); setObservacionInput("");
    setNombreAdjunto(""); setArchivoAdjunto(null); setAdjuntoUploadKey(k => k + 1);
    if (asignacion) void cargarTareas();
    return () => {
      solicitudTareas.current++;
      solicitudEntregas.current++;
      solicitudAdjuntos.current++;
    };
  }, [asignacion?.idAsignacion, cargarTareas]);

  useEffect(() => {
    solicitudEntregas.current++;
    solicitudAdjuntos.current++;
    setEntregas([]); setAdjuntos([]);
    setLoadingEntregas(false); setLoadingAdjuntos(false);
    setErrorEntregas(null); setErrorAdjuntos(null);
    setEditando(null); setEditTitulo(""); setEditDescripcion(""); setEditFechaLimite(""); setEditParcial(1); setEditPuntaje("10");
    setEliminando(null); setCalificando(null); setNotaInput(""); setObservacionInput("");
    setNombreAdjunto(""); setArchivoAdjunto(null); setAdjuntoUploadKey(k => k + 1);
    if (idTareaSel != null) {
      void cargarEntregas(idTareaSel);
      void cargarAdjuntos(idTareaSel);
    }
    return () => {
      solicitudEntregas.current++;
      solicitudAdjuntos.current++;
    };
  }, [idTareaSel, cargarEntregas, cargarAdjuntos]);

  const crearTarea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asignacion || !titulo.trim() || !fechaLimite) return;
    const puntajeNum = Number(puntaje);
    if (!Number.isFinite(puntajeNum) || puntajeNum < 0.01) {
      toast.error("El puntaje debe ser un número mayor que cero.");
      return;
    }
    const fechaLimiteMs = new Date(fechaLimite).getTime();
    if (!Number.isFinite(fechaLimiteMs) || fechaLimiteMs <= Date.now()) {
      toast.error("La fecha límite debe ser futura.");
      return;
    }
    setGuardando(true);
    try {
      const creada = await tareasApi.crear(asignacion.idAsignacion, titulo.trim(), descripcion.trim() || undefined,
        new Date(fechaLimite).toISOString(), parcial, puntajeNum);
      toast.success("Deber publicado correctamente");
      setConfirmacion(`Deber “${creada.titulo}” publicado correctamente.`);
      limpiarCreacion();
      await cargarTareas(creada.idTarea);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo publicar el deber.");
    } finally {
      setGuardando(false);
    }
  };

  const abrirEditar = (t: TareaResponse) => {
    setEditando(t);
    setEditTitulo(t.titulo);
    setEditDescripcion(t.descripcion ?? "");
    setEditFechaLimite(toDatetimeLocalValue(t.fechaLimite));
    setEditParcial(t.parcial);
    setEditPuntaje(String(t.puntaje));
  };

  const guardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editando || !editTitulo.trim() || !editFechaLimite) return;
    const puntajeNum = Number(editPuntaje);
    if (!Number.isFinite(puntajeNum) || puntajeNum < 0.01) {
      toast.error("El puntaje debe ser un número mayor que cero.");
      return;
    }
    const fechaLimiteMs = new Date(editFechaLimite).getTime();
    if (!Number.isFinite(fechaLimiteMs) || fechaLimiteMs <= Date.now()) {
      toast.error("La fecha límite debe ser futura.");
      return;
    }
    setGuardandoEdicion(true);
    try {
      const actualizada = await tareasApi.editar(editando.idTarea, editTitulo.trim(), editDescripcion.trim() || undefined,
        new Date(editFechaLimite).toISOString(), editParcial, puntajeNum);
      toast.success("Deber actualizado correctamente");
      setConfirmacion(`Deber “${actualizada.titulo}” actualizado correctamente.`);
      setEditando(null);
      await cargarTareas(actualizada.idTarea);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo actualizar el deber.");
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const eliminarTarea = async () => {
    if (!eliminando) return;
    setBorrando(true);
    try {
      await tareasApi.eliminar(eliminando.idTarea);
      toast.success("Deber eliminado correctamente");
      const restantes = tareas.filter(t => t.idTarea !== eliminando.idTarea);
      setConfirmacion(`Deber “${eliminando.titulo}” eliminado correctamente.`);
      setEliminando(null);
      await cargarTareas(restantes[0]?.idTarea);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo eliminar el deber.");
    } finally {
      setBorrando(false);
    }
  };

  const subirAdjunto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (idTareaSel == null || !archivoAdjunto || !nombreAdjunto.trim()) return;
    setSubiendoAdjunto(true);
    try {
      await tareasApi.subirAdjunto(idTareaSel, nombreAdjunto.trim(), archivoAdjunto);
      toast.success("Material de apoyo publicado");
      setConfirmacion(`Material “${nombreAdjunto.trim()}” publicado correctamente.`);
      setNombreAdjunto(""); setArchivoAdjunto(null);
      setAdjuntoUploadKey(k => k + 1);
      await cargarAdjuntos(idTareaSel);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo publicar el material de apoyo.");
    } finally {
      setSubiendoAdjunto(false);
    }
  };

  const descargarAdjunto = async (idAdjunto: number) => {
    try {
      const { url } = await tareasApi.urlDescargaAdjunto(idAdjunto);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo generar el enlace de descarga.");
    }
  };

  const eliminarAdjunto = async (idAdjunto: number) => {
    setEliminandoAdjuntoId(idAdjunto);
    try {
      await tareasApi.eliminarAdjunto(idAdjunto);
      setConfirmacion("Material de apoyo eliminado correctamente.");
      if (idTareaSel != null) await cargarAdjuntos(idTareaSel);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo eliminar el material.");
    } finally {
      setEliminandoAdjuntoId(null);
    }
  };

  const abrirCalificar = (en: EntregaResponse) => {
    setCalificando(en);
    setNotaInput(en.nota != null ? String(en.nota) : "");
    setObservacionInput(en.observacionDocente ?? "");
  };

  const guardarRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calificando) return;
    const nota = notaInput.trim() === "" ? undefined : Number(notaInput);
    if (nota !== undefined && (Number.isNaN(nota) || nota < 1 || nota > 10)) {
      toast.error("La nota debe estar entre 1 y 10.");
      return;
    }
    setGuardandoRevision(true);
    try {
      await tareasApi.revisar(calificando.idEntrega, observacionInput.trim() || undefined, nota);
      toast.success("Entrega calificada correctamente");
      setConfirmacion(`Entrega de ${calificando.estudiante} calificada correctamente.`);
      setCalificando(null);
      setNotaInput(""); setObservacionInput("");
      if (idTareaSel != null) await cargarEntregas(idTareaSel);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo calificar la entrega.");
    } finally {
      setGuardandoRevision(false);
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
  const fechaMinima = toDatetimeLocalValue(new Date().toISOString());
  const hayMutacion = guardando || guardandoEdicion || borrando || subiendoAdjunto
    || eliminandoAdjuntoId != null || guardandoRevision;
  const errorGeneral = errorAsignaciones ?? errorApi ?? errorEntregas;

  const reintentarGeneral = () => {
    if (errorAsignaciones) {
      void recargarAsignaciones();
    } else if (errorApi) {
      void cargarTareas(idTareaSel ?? undefined);
    } else if (errorEntregas && idTareaSel != null) {
      void cargarEntregas(idTareaSel);
    }
  };

  const resumenEntregas = useMemo(() => {
    const revisadas = entregas.filter(en => en.estado === "REVISADO").length;
    const porCalificar = entregas.filter(en => en.estado === "ENTREGADO").length;
    return { total: entregas.length, entregadas: revisadas + porCalificar, porCalificar };
  }, [entregas]);

  return (
    <div>
      <TopBar title="Deberes"
        subtitle={soloLectura ? "Consulte los deberes publicados y el estado de las entregas" : "Publique tareas y revise las entregas de sus estudiantes"} />
      <div className="p-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4 flex items-end gap-4 flex-wrap">
          <div className="flex flex-col gap-1 min-w-[280px]">
            <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Asignación</label>
            <select value={idAsignacion} disabled={loadingAsignaciones || hayMutacion}
              onChange={e => setIdAsignacion(e.target.value ? Number(e.target.value) : "")}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6] bg-white">
              {loadingAsignaciones && <option value="">Cargando asignaciones…</option>}
              {!loadingAsignaciones && asignacionesOpciones.length === 0 && <option value="">Sin asignaciones</option>}
              {asignacionesOpciones.map(a => (
                <option key={a.idAsignacion} value={a.idAsignacion}>
                  {a.paralelo} · {a.materia} · {a.periodo}{a.periodoActivo ? " · Activo" : ""}{a.docente ? ` · ${a.docente}` : ""}
                </option>
              ))}
            </select>
          </div>
          {!soloLectura && (
            <Btn onClick={() => { if (mostrarForm) limpiarCreacion(); else setMostrarForm(true); }}
              disabled={!asignacion || loadingAsignaciones || hayMutacion} className="ml-auto">
              <Plus size={14} aria-hidden="true" />Nuevo deber
            </Btn>
          )}
        </div>

        {errorGeneral && (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span className="flex-1">{errorGeneral}</span>
            <Btn type="button" size="sm" variant="secondary"
              disabled={loadingAsignaciones || loading || loadingEntregas} onClick={reintentarGeneral}>
              Reintentar
            </Btn>
          </div>
        )}

        {confirmacion && (
          <div role="status" className="mb-4 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-[#2E7D32]">
            <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />{confirmacion}
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
            <div className="flex gap-3 flex-wrap">
              <div className="max-w-xs flex-1 min-w-[200px]">
                <label htmlFor="tarea-fecha" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Fecha límite</label>
                <input id="tarea-fecha" type="datetime-local" value={fechaLimite} min={fechaMinima}
                  onChange={e => setFechaLimite(e.target.value)} required
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
              </div>
              <div className="max-w-[140px]">
                <label htmlFor="tarea-parcial" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Parcial</label>
                <select id="tarea-parcial" value={parcial} onChange={e => setParcial(Number(e.target.value) as 1 | 2 | 3)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6] bg-white">
                  <option value={1}>1er parcial</option>
                  <option value={2}>2do parcial</option>
                  <option value={3}>3er parcial</option>
                </select>
              </div>
              <div className="max-w-[110px]">
                <label htmlFor="tarea-puntaje" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Puntaje</label>
                <input id="tarea-puntaje" type="number" min={0.01} step={0.01} value={puntaje}
                  onChange={e => setPuntaje(e.target.value)} required
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
              </div>
            </div>
            <Btn disabled={guardando}>
              {guardando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
              Publicar deber
            </Btn>
          </form>
        )}

        {!asignacion && !loadingAsignaciones && !loading && !errorAsignaciones && (
          <EmptyState icon={FileUp} title="Seleccione una asignación para ver o publicar deberes." />
        )}

        {asignacion && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:col-span-1">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-3">Deberes publicados</p>
              {loading && <Loader2 size={16} className="animate-spin text-gray-400" aria-hidden="true" />}
              {!loading && !errorApi && tareas.length === 0 && <p className="text-sm text-gray-600">Todavía no hay deberes para esta asignación.</p>}
              <ul className="space-y-1">
                {tareas.map(t => (
                  <li key={t.idTarea}>
                    <button type="button" disabled={hayMutacion} onClick={() => setIdTareaSel(t.idTarea)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors
                        ${idTareaSel === t.idTarea ? "bg-[#EAF2FB] text-[#1F4E79] font-medium" : "hover:bg-gray-50 text-gray-700"}
                        disabled:opacity-50 disabled:cursor-not-allowed`}>
                      <p className="truncate">{t.titulo}</p>
                      <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                        <Clock size={11} aria-hidden="true" />
                        Vence {new Date(t.fechaLimite).toLocaleString("es-EC", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                        {" · "}{t.puntaje} pts
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
                  <div className="px-4 py-3 border-b border-gray-200 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1A1A1A] truncate">{tareaSel.titulo}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {resumenEntregas.entregadas}/{resumenEntregas.total} entregados
                        {resumenEntregas.porCalificar > 0 && ` · ${resumenEntregas.porCalificar} por calificar`}
                      </p>
                    </div>
                    {!soloLectura && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button type="button" title="Editar deber" disabled={hayMutacion || loadingEntregas}
                          onClick={() => abrirEditar(tareaSel)}
                          className="p-1.5 rounded-md text-gray-500 hover:bg-[#EAF2FB] hover:text-[#1F4E79] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E75B6]/40 disabled:opacity-50 disabled:cursor-not-allowed">
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                        <button type="button" title="Eliminar deber" disabled={hayMutacion || loadingEntregas}
                          onClick={() => setEliminando(tareaSel)}
                          className="p-1.5 rounded-md text-gray-500 hover:bg-red-50 hover:text-[#C62828] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E75B6]/40 disabled:opacity-50 disabled:cursor-not-allowed">
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                  {loadingEntregas ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-600">
                      <Loader2 size={16} className="animate-spin inline-block mr-2" aria-hidden="true" />Cargando entregas…
                    </div>
                  ) : (
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
                                <button type="button" disabled={hayMutacion} onClick={() => abrirCalificar(en)}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-[#2E7D32] hover:underline focus:outline-none disabled:opacity-50">
                                  <CheckCircle2 size={12} aria-hidden="true" />Calificar
                                </button>
                              )}
                              {!soloLectura && en.estado === "REVISADO" && (
                                <button type="button" disabled={hayMutacion} onClick={() => abrirCalificar(en)}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-[#2E75B6] hover:underline focus:outline-none disabled:opacity-50">
                                  Editar calificación
                                </button>
                              )}
                              {en.estado === "REVISADO" && (
                                <span className="text-xs text-gray-600">{en.nota != null ? `Nota: ${en.nota}` : "Sin nota"}</span>
                              )}
                              {en.estado === "PENDIENTE" && <span className="text-xs text-gray-400">Sin entregar</span>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {asignacion && tareaSel && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mt-4">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-3">Material de apoyo — {tareaSel.titulo}</p>
            {!soloLectura && (
              <form onSubmit={subirAdjunto} className="flex flex-wrap items-end gap-3 mb-4">
                <div className="flex-1 min-w-[200px]">
                  <label htmlFor="adjunto-nombre" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Nombre</label>
                  <input id="adjunto-nombre" value={nombreAdjunto} onChange={e => setNombreAdjunto(e.target.value)} maxLength={150}
                    placeholder="Ej. Guía de referencia"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
                </div>
                <div className="min-w-[240px]">
                  <FileUpload key={adjuntoUploadKey}
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar,.jpg,.jpeg,.png,.webp,.gif,.mp4,.mp3" maxSizeMb={15}
                    onFileSelected={setArchivoAdjunto} disabled={subiendoAdjunto} label="Adjuntar archivo" />
                </div>
                <Btn disabled={subiendoAdjunto || !archivoAdjunto || !nombreAdjunto.trim()}>
                  {subiendoAdjunto ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Paperclip size={14} aria-hidden="true" />}
                  Publicar
                </Btn>
              </form>
            )}
            {errorAdjuntos && (
              <div role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span className="flex-1">{errorAdjuntos}</span>
                <Btn type="button" size="sm" variant="secondary" disabled={loadingAdjuntos}
                  onClick={() => { if (idTareaSel != null) void cargarAdjuntos(idTareaSel); }}>
                  Reintentar
                </Btn>
              </div>
            )}
            {loadingAdjuntos ? (
              <p className="text-sm text-gray-600"><Loader2 size={14} className="animate-spin inline-block mr-2" aria-hidden="true" />Cargando material…</p>
            ) : !errorAdjuntos && adjuntos.length === 0 ? (
              <p className="text-sm text-gray-500">No hay material de apoyo publicado para este deber.</p>
            ) : !errorAdjuntos ? (
              <ul className="divide-y divide-gray-100">
                {adjuntos.map(a => (
                  <li key={a.idAdjunto} className="py-2 flex items-center justify-between gap-3">
                    <button type="button" onClick={() => descargarAdjunto(a.idAdjunto)}
                      className="min-w-0 text-left flex items-center gap-1.5 text-sm text-[#2E75B6] hover:underline focus:outline-none">
                      <Paperclip size={13} className="flex-shrink-0" aria-hidden="true" /><span className="truncate">{a.nombre}</span>
                    </button>
                    {!soloLectura && (
                      <button type="button" disabled={eliminandoAdjuntoId === a.idAdjunto} onClick={() => eliminarAdjunto(a.idAdjunto)}
                        className="flex-shrink-0 p-1 rounded-md text-gray-400 hover:bg-red-50 hover:text-[#C62828] focus:outline-none disabled:opacity-50">
                        {eliminandoAdjuntoId === a.idAdjunto ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Trash2 size={13} aria-hidden="true" />}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </div>

      {editando && (
        <Modal title={`Editar deber — ${editando.titulo}`} onClose={() => setEditando(null)} size="md">
          <form onSubmit={guardarEdicion} className="space-y-3">
            <div>
              <label htmlFor="edit-titulo" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Título</label>
              <input id="edit-titulo" value={editTitulo} onChange={e => setEditTitulo(e.target.value)} required maxLength={150}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
            </div>
            <div>
              <label htmlFor="edit-desc" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Descripción (opcional)</label>
              <textarea id="edit-desc" value={editDescripcion} onChange={e => setEditDescripcion(e.target.value)} maxLength={1000} rows={2}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="max-w-xs flex-1 min-w-[200px]">
                <label htmlFor="edit-fecha" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Fecha límite</label>
                <input id="edit-fecha" type="datetime-local" value={editFechaLimite} min={fechaMinima}
                  onChange={e => setEditFechaLimite(e.target.value)} required
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
              </div>
              <div className="max-w-[140px]">
                <label htmlFor="edit-parcial" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Parcial</label>
                <select id="edit-parcial" value={editParcial} onChange={e => setEditParcial(Number(e.target.value) as 1 | 2 | 3)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6] bg-white">
                  <option value={1}>1er parcial</option>
                  <option value={2}>2do parcial</option>
                  <option value={3}>3er parcial</option>
                </select>
              </div>
              <div className="max-w-[110px]">
                <label htmlFor="edit-puntaje" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Puntaje</label>
                <input id="edit-puntaje" type="number" min={0.01} step={0.01} value={editPuntaje}
                  onChange={e => setEditPuntaje(e.target.value)} required
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Btn type="button" variant="secondary" onClick={() => setEditando(null)}>Cancelar</Btn>
              <Btn disabled={guardandoEdicion}>
                {guardandoEdicion ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
                Guardar cambios
              </Btn>
            </div>
          </form>
        </Modal>
      )}

      {eliminando && (
        <Modal title="Eliminar deber" onClose={() => setEliminando(null)} size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              ¿Eliminar <strong>{eliminando.titulo}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="flex items-center justify-end gap-2">
              <Btn type="button" variant="secondary" onClick={() => setEliminando(null)}>Cancelar</Btn>
              <Btn type="button" variant="danger" onClick={eliminarTarea} disabled={borrando}>
                {borrando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}
                Eliminar
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {calificando && (
        <Modal title={`Calificar entrega — ${calificando.estudiante}`} onClose={() => setCalificando(null)} size="sm">
          <form onSubmit={guardarRevision} className="space-y-3">
            <div>
              <label htmlFor="revision-nota" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">
                Nota (1.0 – 10.0, opcional)
              </label>
              <input id="revision-nota" type="number" min={1} max={10} step={0.1} value={notaInput}
                onChange={e => setNotaInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
            </div>
            <div>
              <label htmlFor="revision-obs" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">
                Observación (opcional)
              </label>
              <textarea id="revision-obs" value={observacionInput} onChange={e => setObservacionInput(e.target.value)}
                maxLength={500} rows={3}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Btn type="button" variant="secondary" onClick={() => setCalificando(null)}>Cancelar</Btn>
              <Btn disabled={guardandoRevision}>
                {guardandoRevision ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
                Guardar calificación
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
