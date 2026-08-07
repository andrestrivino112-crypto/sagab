import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle, BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight, Clock,
  Copy, ExternalLink, FileText, Flag, GraduationCap, Loader2, MapPin, Pencil,
  Plus, RefreshCw, Trash2, Users, XCircle,
} from "lucide-react";
import type { RolSistema } from "../../api/auth";
import { ApiError, api } from "../../api/client";
import {
  calendario as calendarioApi, type CalendarioItemResponse, type CategoriaEventoCalendario,
  type EstadoEventoCalendario, type GuardarEventoCalendario,
} from "../../api/sagab";
import { Btn } from "../components/Btn";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { TopBar } from "../components/TopBar";
import { useToast } from "../components/Toast";

type Vista = "month" | "week" | "day";
type Draft = {
  titulo: string; descripcion: string; inicio: string; fin: string; lugar: string;
  categoria: CategoriaEventoCalendario; color: string; estado: EstadoEventoCalendario;
  publicarEn: string; adjuntoNombre: string; adjuntoUrl: string;
};

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const ESTADOS: { value: EstadoEventoCalendario; label: string }[] = [
  { value: "BORRADOR", label: "Borrador" }, { value: "PUBLICADO", label: "Publicado" },
  { value: "OCULTO", label: "Oculto" }, { value: "PROGRAMADO", label: "Programado" },
  { value: "CANCELADO", label: "Cancelado" },
];
const CATEGORIAS: { value: CategoriaEventoCalendario; label: string }[] = [
  { value: "INSTITUCIONAL", label: "Institucional" }, { value: "ACADEMICO", label: "Académico" },
  { value: "REUNION", label: "Reunión" }, { value: "CAPACITACION", label: "Capacitación" },
  { value: "EVALUACION", label: "Evaluación" }, { value: "DEPORTIVO", label: "Deportivo" },
  { value: "CULTURAL", label: "Cultural" }, { value: "OTRO", label: "Otro" },
];
const COLORES = ["#2E75B6", "#2E7D32", "#7B1FA2", "#C62828", "#EF6C00", "#00838F", "#455A64"];

function dateKey(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseKey(key: string) { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d); }
function addDays(date: Date, days: number) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function startWeek(date: Date) { const d = new Date(date); d.setHours(0, 0, 0, 0); return addDays(d, -((d.getDay() + 6) % 7)); }
function endWeek(date: Date) { const d = addDays(startWeek(date), 6); d.setHours(23, 59, 59, 999); return d; }
function startMonthGrid(date: Date) { return startWeek(new Date(date.getFullYear(), date.getMonth(), 1)); }
function endMonthGrid(date: Date) { return endWeek(new Date(date.getFullYear(), date.getMonth() + 1, 0)); }
function dateRange(start: Date, end: Date) {
  const result: Date[] = [];
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) result.push(d);
  return result;
}
function localInput(value: string) {
  const d = new Date(value);
  return `${dateKey(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function defaultDraft(key: string): Draft {
  return {
    titulo: "", descripcion: "", inicio: `${key}T08:00`, fin: `${key}T09:00`, lugar: "",
    categoria: "INSTITUCIONAL", color: "#2E75B6", estado: "BORRADOR", publicarEn: "",
    adjuntoNombre: "", adjuntoUrl: "",
  };
}
function fromItem(item: CalendarioItemResponse): Draft {
  const externo = item.adjuntos.find(a => a.idAdjunto == null);
  return {
    titulo: item.titulo, descripcion: item.descripcion ?? "", inicio: localInput(item.inicio), fin: localInput(item.fin),
    lugar: item.lugar ?? "", categoria: item.categoria as CategoriaEventoCalendario, color: item.color,
    estado: item.estado as EstadoEventoCalendario, publicarEn: item.publicarEn ? localInput(item.publicarEn) : "",
    adjuntoNombre: externo?.nombre ?? "", adjuntoUrl: externo?.url ?? "",
  };
}
function requestFrom(draft: Draft): GuardarEventoCalendario {
  return {
    titulo: draft.titulo.trim(), descripcion: draft.descripcion.trim() || undefined,
    inicio: new Date(draft.inicio).toISOString(), fin: new Date(draft.fin).toISOString(),
    lugar: draft.lugar.trim() || undefined, categoria: draft.categoria, color: draft.color, estado: draft.estado,
    publicarEn: draft.estado === "PROGRAMADO" && draft.publicarEn ? new Date(draft.publicarEn).toISOString() : undefined,
    adjuntoNombre: draft.adjuntoNombre.trim() || undefined, adjuntoUrl: draft.adjuntoUrl.trim() || undefined,
  };
}
function labelTipo(item: CalendarioItemResponse) {
  return ({ INSTITUCIONAL: item.categoria, FERIADO: "Feriado", FECHA_IMPORTANTE: "Fecha importante", TAREA: "Tarea", RECURSO: "Recurso" } as const)[item.tipo];
}
function IconoTipo({ tipo, size = 15 }: { tipo: CalendarioItemResponse["tipo"]; size?: number }) {
  const Icon = tipo === "FERIADO" ? Flag : tipo === "FECHA_IMPORTANTE" ? GraduationCap
    : tipo === "TAREA" ? BookOpen : tipo === "RECURSO" ? FileText : CalendarDays;
  return <Icon size={size} aria-hidden="true" />;
}

export function CalendarView({ rol, embed = false, onOpenRelated }: {
  rol: RolSistema; embed?: boolean; onOpenRelated?: (item: CalendarioItemResponse) => void;
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const storageKey = `sagab:calendar-ui:${rol}`;
  const saved = (() => { try { return JSON.parse(sessionStorage.getItem(storageKey) ?? "{}") as { vista?: Vista; fecha?: string }; } catch { return {}; } })();
  const [vista, setVista] = useState<Vista>(saved.vista ?? "month");
  const [anchor, setAnchor] = useState(() => saved.fecha ? parseKey(saved.fecha) : new Date());
  const [selected, setSelected] = useState(() => dateKey(saved.fecha ? parseKey(saved.fecha) : new Date()));
  const [items, setItems] = useState<CalendarioItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<CalendarioItemResponse | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(() => defaultDraft(selected));
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const canManage = rol === "ADMIN";

  const range = useMemo(() => {
    if (vista === "month") return { start: startMonthGrid(anchor), end: endMonthGrid(anchor) };
    if (vista === "week") return { start: startWeek(anchor), end: endWeek(anchor) };
    return { start: parseKey(dateKey(anchor)), end: parseKey(dateKey(anchor)) };
  }, [anchor, vista]);

  const cargar = useCallback(async (initial = false) => {
    if (initial) setLoading(true); else setRefreshing(true);
    setError(null);
    try { setItems(await calendarioApi.listar(dateKey(range.start), dateKey(range.end))); }
    catch (e) { setError(e instanceof ApiError ? e.message : "No se pudo cargar el calendario."); }
    finally { setLoading(false); setRefreshing(false); }
  }, [range.end.getTime(), range.start.getTime()]);

  useEffect(() => { void cargar(true); }, [cargar]);
  useEffect(() => {
    const id = window.setInterval(() => void cargar(false), 30000);
    const focus = () => void cargar(false);
    window.addEventListener("focus", focus);
    return () => { window.clearInterval(id); window.removeEventListener("focus", focus); };
  }, [cargar]);
  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify({ vista, fecha: dateKey(anchor) }));
  }, [anchor, storageKey, vista]);

  const itemsOn = useCallback((key: string) => items.filter(item => dateKey(item.inicio) <= key && dateKey(item.fin) >= key), [items]);
  const cells = useMemo(() => dateRange(range.start, range.end), [range.end.getTime(), range.start.getTime()]);
  const title = vista === "month"
    ? new Intl.DateTimeFormat("es-EC", { month: "long", year: "numeric" }).format(anchor)
    : vista === "week" ? `${new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short" }).format(range.start)} – ${new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short", year: "numeric" }).format(range.end)}`
      : new Intl.DateTimeFormat("es-EC", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(anchor);

  const move = (delta: number) => {
    const d = new Date(anchor);
    if (vista === "month") d.setMonth(d.getMonth() + delta);
    else d.setDate(d.getDate() + delta * (vista === "week" ? 7 : 1));
    setAnchor(d); setSelected(dateKey(d));
  };
  const goDate = (key: string) => { const d = parseKey(key); setAnchor(d); setSelected(key); };
  const openNew = () => { setEditingId(null); setDraft(defaultDraft(selected)); setFiles([]); setFormOpen(true); };
  const openEdit = (item: CalendarioItemResponse) => {
    if (item.idEvento == null) return;
    setEditingId(item.idEvento); setDraft(fromItem(item)); setFiles([]); setDetail(null); setFormOpen(true);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true);
    let idPersistido = editingId;
    try {
      const req = requestFrom(draft);
      const guardado = editingId == null
        ? await calendarioApi.crear(req)
        : await calendarioApi.editar(editingId, req);
      idPersistido = guardado.idEvento;
      if (guardado.idEvento != null) {
        for (const file of files) {
          await calendarioApi.subirAdjunto(guardado.idEvento, file);
          setFiles(current => current.filter(item => item !== file));
        }
      }
      toast.success(editingId == null ? "Evento creado" : "Evento actualizado");
      setFiles([]);
      setFormOpen(false); await cargar(false);
    } catch (e) {
      if (editingId == null && idPersistido != null) setEditingId(idPersistido);
      toast.error(idPersistido != null && files.length > 0
        ? `El evento quedó guardado, pero faltó cargar un adjunto: ${e instanceof ApiError ? e.message : "error de almacenamiento"}`
        : e instanceof ApiError ? e.message : "No se pudo guardar el evento.");
      await cargar(false);
    }
    finally { setSaving(false); }
  };
  const changeStatus = async (item: CalendarioItemResponse, estado: EstadoEventoCalendario) => {
    if (item.idEvento == null) return;
    try {
      const d = fromItem(item); d.estado = estado;
      if (estado === "PROGRAMADO" && !d.publicarEn) d.publicarEn = localInput(new Date().toISOString());
      await calendarioApi.editar(item.idEvento, requestFrom(d));
      setDetail(null); await cargar(false); toast.success(`Evento ${estado.toLowerCase()}`);
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "No se pudo cambiar el estado."); }
  };
  const duplicate = async (item: CalendarioItemResponse) => {
    if (item.idEvento == null) return;
    try { await calendarioApi.duplicar(item.idEvento); setDetail(null); await cargar(false); toast.success("Evento duplicado como borrador"); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "No se pudo duplicar."); }
  };
  const remove = async (item: CalendarioItemResponse) => {
    if (item.idEvento == null || !window.confirm(`¿Eliminar definitivamente “${item.titulo}”?`)) return;
    try { await calendarioApi.eliminar(item.idEvento); setDetail(null); await cargar(false); toast.success("Evento eliminado"); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "No se pudo eliminar."); }
  };
  const removeAttachment = async (idAdjunto: number) => {
    if (!window.confirm("¿Eliminar este archivo adjunto?")) return;
    try {
      await calendarioApi.eliminarAdjunto(idAdjunto);
      setDetail(current => current ? { ...current, adjuntos: current.adjuntos.filter(a => a.idAdjunto !== idAdjunto) } : null);
      await cargar(false);
      toast.success("Adjunto eliminado");
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "No se pudo eliminar el adjunto."); }
  };
  const openAttachment = async (url: string) => {
    try {
      const destination = url.startsWith("/api/") ? (await api<{ url: string }>(url)).url : url;
      window.open(destination, "_blank", "noopener,noreferrer");
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "No se pudo abrir el archivo."); }
  };
  const openRelated = (item: CalendarioItemResponse) => {
    setDetail(null);
    if (onOpenRelated) onOpenRelated(item);
    else if (item.rutaRelacionada) navigate(item.rutaRelacionada);
  };

  const content = (
    <div className={embed ? "space-y-5" : "p-4 sm:p-6 lg:p-8 space-y-5"}>
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => move(-1)} aria-label="Período anterior" className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"><ChevronLeft size={18} /></button>
            <button type="button" title="Volver al mes actual" onClick={() => { const d = new Date(); setAnchor(d); setSelected(dateKey(d)); setVista("month"); }} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Mes</button>
            <button type="button" onClick={() => move(1)} aria-label="Período siguiente" className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"><ChevronRight size={18} /></button>
            <h2 className="ml-1 text-lg font-semibold capitalize text-[#1A1A1A]">{title}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="calendar-jump">Cambiar fecha</label>
            <input id="calendar-jump" type="date" value={selected} onChange={e => goDate(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <div className="flex rounded-lg bg-gray-100 p-1" role="tablist" aria-label="Vista del calendario">
              {([['month','Mes'],['week','Semana'],['day','Día']] as [Vista,string][]).map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={vista === id} onClick={() => setVista(id)} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${vista === id ? "bg-white text-[#1F4E79] shadow-sm" : "text-gray-500 hover:text-gray-800"}`}>{label}</button>
              ))}
            </div>
            <button type="button" onClick={() => void cargar(false)} disabled={refreshing} aria-label="Actualizar calendario" className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-50"><RefreshCw size={17} className={refreshing ? "animate-spin" : ""} /></button>
            {canManage && <Btn type="button" onClick={openNew}><Plus size={15} />Nuevo evento</Btn>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-600">
          {[["#2E75B6","Institucional"],["#C62828","Feriados"],["#8A5A00","Fechas importantes"],["#7B1FA2","Tareas"],["#00838F","Recursos"]]
            .filter(([, label]) => label !== "Tareas" || rol === "ESTUDIANTE")
            .map(([color,label]) => <span key={label} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}
          <span className="ml-auto text-gray-400">Sincronización automática cada 30 s</span>
        </div>
      </section>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#C62828]"><AlertCircle size={16} className="mt-0.5" />{error}</div>}
      {loading ? <div className="flex justify-center rounded-2xl border border-gray-200 bg-white py-20 text-sm text-gray-500"><Loader2 size={18} className="mr-2 animate-spin" />Cargando agenda…</div>
      : vista === "month" ? (
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm animate-in fade-in duration-300">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">{DIAS.map(d => <div key={d} className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500">{d}</div>)}</div>
          <div className="grid grid-cols-7" role="grid">
            {cells.map(day => {
              const key = dateKey(day); const dayItems = itemsOn(key); const inMonth = day.getMonth() === anchor.getMonth();
              return <button key={key} type="button" role="gridcell" onClick={() => { goDate(key); setVista("day"); }} className={`min-h-24 border-b border-r border-gray-100 p-1.5 text-left align-top transition hover:bg-[#F5F9FD] sm:min-h-32 sm:p-2 ${!inMonth ? "bg-gray-50/70 text-gray-400" : ""} ${selected === key ? "ring-2 ring-inset ring-[#2E75B6]" : ""}`}>
                <span className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${key === dateKey(new Date()) ? "bg-[#1F4E79] text-white" : ""}`}>{day.getDate()}</span>
                <span className="space-y-1">{dayItems.slice(0, 3).map(item => <span key={item.id} className="flex w-full items-center gap-1 rounded px-1.5 py-1 text-[10px] font-medium text-white shadow-sm" style={{ backgroundColor: item.estado === "CANCELADO" ? "#78909C" : item.color }}><IconoTipo tipo={item.tipo} size={10} /><span className={`truncate ${item.estado === "CANCELADO" ? "line-through" : ""}`}>{item.titulo}</span></span>)}</span>
                {dayItems.length > 3 && <span className="mt-1 block text-[10px] font-medium text-[#2E75B6]">+{dayItems.length - 3} más</span>}
              </button>;
            })}
          </div>
        </section>
      ) : vista === "week" ? (
        <section className="grid gap-3 md:grid-cols-7 animate-in fade-in duration-300">
          {cells.map(day => { const key = dateKey(day); return <div key={key} className={`min-h-48 rounded-xl border bg-white p-3 shadow-sm ${key === dateKey(new Date()) ? "border-[#2E75B6]" : "border-gray-200"}`}>
            <button type="button" onClick={() => { goDate(key); setVista("day"); }} className="mb-3 w-full text-left"><span className="block text-[10px] font-semibold uppercase text-gray-500">{new Intl.DateTimeFormat("es-EC", { weekday: "short" }).format(day)}</span><span className="text-xl font-bold text-[#1A1A1A]">{day.getDate()}</span></button>
            <EventList items={itemsOn(key)} onOpen={setDetail} compact />
          </div>; })}
        </section>
      ) : (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 animate-in fade-in duration-300">
          <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#2E75B6]">Agenda del día</p><h3 className="mt-1 text-lg font-semibold capitalize text-[#1A1A1A]">{title}</h3></div><span className="rounded-full bg-[#EAF2FB] px-3 py-1 text-xs font-semibold text-[#1F4E79]">{itemsOn(selected).length} evento(s)</span></div>
          <EventList items={itemsOn(selected)} onOpen={setDetail} />
        </section>
      )}
    </div>
  );

  return <div className={embed ? "" : "min-h-screen bg-[#F5F7FA]"}>
    {!embed && <TopBar title="Calendario institucional" subtitle="Eventos, feriados y fechas académicas en una sola agenda" />}
    {content}

    {detail && <Modal title={detail.titulo} onClose={() => setDetail(null)} size="md">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ backgroundColor: detail.color }}><IconoTipo tipo={detail.tipo} />{labelTipo(detail)}</span><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">{detail.estado}</span></div>
        {detail.descripcion && <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{detail.descripcion}</p>}
        <dl className="grid gap-3 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-gray-500">Fecha y hora</dt><dd className="mt-1 flex items-start gap-1.5 font-medium text-gray-800"><Clock size={14} className="mt-0.5" />{new Date(detail.inicio).toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" })}{detail.fin !== detail.inicio && <> – {new Date(detail.fin).toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" })}</>}</dd></div>
          {detail.lugar && <div><dt className="text-xs text-gray-500">Lugar</dt><dd className="mt-1 flex items-center gap-1.5 font-medium text-gray-800"><MapPin size={14} />{detail.lugar}</dd></div>}
          {detail.materia && <div><dt className="text-xs text-gray-500">Materia</dt><dd className="mt-1 font-medium text-gray-800">{detail.materia}</dd></div>}
          {detail.docente && <div><dt className="text-xs text-gray-500">Docente</dt><dd className="mt-1 flex items-center gap-1.5 font-medium text-gray-800"><Users size={14} />{detail.docente}</dd></div>}
          <div><dt className="text-xs text-gray-500">Publicado por</dt><dd className="mt-1 font-medium text-gray-800">{detail.creador}</dd></div>
        </dl>
        {detail.adjuntos.length > 0 && <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Archivos relacionados</p><div className="space-y-2">{detail.adjuntos.map(a => <div key={a.url} className="flex items-center gap-1"><button type="button" onClick={() => void openAttachment(a.url)} className="flex min-w-0 flex-1 items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left text-sm text-[#1F4E79] hover:bg-[#EAF2FB]"><span className="flex min-w-0 items-center gap-2"><FileText size={15} className="flex-shrink-0" /><span className="truncate">{a.nombre}</span></span><ExternalLink size={14} className="flex-shrink-0" /></button>{canManage && a.idAdjunto != null && <button type="button" onClick={() => void removeAttachment(a.idAdjunto!)} aria-label={`Eliminar ${a.nombre}`} className="rounded-lg p-2 text-[#C62828] hover:bg-red-50"><Trash2 size={15} /></button>}</div>)}</div></div>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">
          {detail.rutaRelacionada && <Btn type="button" onClick={() => openRelated(detail)}><ExternalLink size={14} />Abrir {detail.tipo === "TAREA" ? "deber" : "recurso"}</Btn>}
          {canManage && detail.idEvento != null && <>
            <Btn type="button" variant="secondary" onClick={() => openEdit(detail)}><Pencil size={14} />Editar</Btn>
            <Btn type="button" variant="secondary" onClick={() => void duplicate(detail)}><Copy size={14} />Duplicar</Btn>
            {detail.estado !== "PUBLICADO" && <Btn type="button" variant="secondary" onClick={() => void changeStatus(detail, "PUBLICADO")}><Check size={14} />Publicar</Btn>}
            {detail.estado !== "OCULTO" && <Btn type="button" variant="secondary" onClick={() => void changeStatus(detail, "OCULTO")}><XCircle size={14} />Ocultar</Btn>}
            {detail.estado !== "CANCELADO" && <Btn type="button" variant="secondary" onClick={() => void changeStatus(detail, "CANCELADO")}><XCircle size={14} />Cancelar evento</Btn>}
            <Btn type="button" variant="danger" onClick={() => void remove(detail)}><Trash2 size={14} />Eliminar</Btn>
          </>}
        </div>
      </div>
    </Modal>}

    {formOpen && <Modal title={editingId == null ? "Nuevo evento institucional" : "Editar evento institucional"} onClose={() => !saving && setFormOpen(false)} size="lg">
      <form onSubmit={save} className="space-y-4">
        <div><label htmlFor="cal-title" className="mb-1 block text-xs font-semibold text-gray-600">Título</label><input id="cal-title" required maxLength={150} value={draft.titulo} onChange={e => setDraft({ ...draft, titulo: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#2E75B6] focus:outline-none" /></div>
        <div><label htmlFor="cal-desc" className="mb-1 block text-xs font-semibold text-gray-600">Descripción</label><textarea id="cal-desc" maxLength={2000} rows={3} value={draft.descripcion} onChange={e => setDraft({ ...draft, descripcion: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#2E75B6] focus:outline-none" /></div>
        <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="cal-start" className="mb-1 block text-xs font-semibold text-gray-600">Inicio</label><input id="cal-start" type="datetime-local" required value={draft.inicio} onChange={e => setDraft({ ...draft, inicio: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div><div><label htmlFor="cal-end" className="mb-1 block text-xs font-semibold text-gray-600">Fin</label><input id="cal-end" type="datetime-local" required min={draft.inicio} value={draft.fin} onChange={e => setDraft({ ...draft, fin: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div></div>
        <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="cal-category" className="mb-1 block text-xs font-semibold text-gray-600">Categoría</label><select id="cal-category" value={draft.categoria} onChange={e => setDraft({ ...draft, categoria: e.target.value as CategoriaEventoCalendario })} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">{CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div><div><label htmlFor="cal-place" className="mb-1 block text-xs font-semibold text-gray-600">Lugar</label><input id="cal-place" maxLength={180} value={draft.lugar} onChange={e => setDraft({ ...draft, lugar: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div></div>
        <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="cal-state" className="mb-1 block text-xs font-semibold text-gray-600">Estado</label><select id="cal-state" value={draft.estado} onChange={e => setDraft({ ...draft, estado: e.target.value as EstadoEventoCalendario })} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">{ESTADOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div><div><span className="mb-1 block text-xs font-semibold text-gray-600">Color</span><div className="flex h-[38px] items-center gap-2">{COLORES.map(color => <button key={color} type="button" onClick={() => setDraft({ ...draft, color })} aria-label={`Color ${color}`} className={`h-7 w-7 rounded-full ring-offset-2 ${draft.color === color ? "ring-2 ring-gray-500" : ""}`} style={{ backgroundColor: color }} />)}</div></div></div>
        {draft.estado === "PROGRAMADO" && <div><label htmlFor="cal-publish" className="mb-1 block text-xs font-semibold text-gray-600">Publicar automáticamente el</label><input id="cal-publish" type="datetime-local" required value={draft.publicarEn} onChange={e => setDraft({ ...draft, publicarEn: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>}
        <div className="rounded-xl border border-gray-200 p-3"><p className="mb-3 text-xs font-semibold text-gray-600">Archivos adjuntos (opcional)</p><label className="block rounded-lg border border-dashed border-gray-300 p-3 text-center text-xs text-gray-600 hover:bg-gray-50"><span>Seleccionar hasta 10 archivos</span><input type="file" multiple className="sr-only" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar,.jpg,.jpeg,.png,.webp,.gif,.mp4,.mp3" onChange={e => { const next = Array.from(e.target.files ?? []); if (next.length > 10) toast.error("Puede seleccionar como máximo 10 archivos"); else setFiles(next); e.currentTarget.value = ""; }} /></label>{files.length > 0 && <ul className="mt-2 space-y-1 text-xs text-gray-600">{files.map((file, index) => <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded bg-gray-50 px-2 py-1"><span className="truncate">{file.name}</span><button type="button" onClick={() => setFiles(current => current.filter((_, i) => i !== index))} aria-label={`Quitar ${file.name}`} className="text-[#C62828]"><XCircle size={14} /></button></li>)}</ul>}<p className="mb-2 mt-4 text-[11px] font-medium text-gray-500">También puede enlazar un archivo externo</p><div className="grid gap-3 sm:grid-cols-2"><input aria-label="Nombre del adjunto externo" placeholder="Nombre del enlace" maxLength={255} value={draft.adjuntoNombre} onChange={e => setDraft({ ...draft, adjuntoNombre: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" /><input aria-label="URL del adjunto externo" type="url" placeholder="https://…" maxLength={500} value={draft.adjuntoUrl} onChange={e => setDraft({ ...draft, adjuntoUrl: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div></div>
        <div className="flex justify-end gap-2"><Btn type="button" variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Btn><Btn type="submit" disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}Guardar</Btn></div>
      </form>
    </Modal>}
  </div>;
}

function EventList({ items, onOpen, compact = false }: { items: CalendarioItemResponse[]; onOpen: (item: CalendarioItemResponse) => void; compact?: boolean }) {
  if (items.length === 0) return <EmptyState icon={CalendarDays} title="No hay actividades para esta fecha." />;
  return <div className="space-y-2">{items.map(item => <button key={item.id} type="button" onClick={() => onOpen(item)} className={`w-full rounded-xl border border-gray-100 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${compact ? "p-2" : "p-4"}`} style={{ borderLeft: `4px solid ${item.estado === "CANCELADO" ? "#78909C" : item.color}` }}>
    <div className="flex items-start gap-2"><span className="mt-0.5" style={{ color: item.color }}><IconoTipo tipo={item.tipo} /></span><div className="min-w-0 flex-1"><p className={`font-semibold text-[#1A1A1A] ${compact ? "truncate text-xs" : "text-sm"} ${item.estado === "CANCELADO" ? "line-through text-gray-500" : ""}`}>{item.titulo}</p><p className="mt-1 text-[11px] text-gray-500">{new Date(item.inicio).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })} · {labelTipo(item)}</p>{!compact && item.descripcion && <p className="mt-2 line-clamp-2 text-xs text-gray-600">{item.descripcion}</p>}</div></div>
  </button>)}</div>;
}
