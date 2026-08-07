import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, BookOpen, Clock3, Edit2, Eye, History, Loader2, Mail, MessageSquare,
  Plus, Search, Send, Trash2, UserRoundSearch, Users,
} from "lucide-react";
import { ApiError } from "../../api/client";
import {
  seguimientoDece as seguimientoApi,
  type EstadoSeguimientoDece, type EstudianteBusquedaDece, type HistorialSeguimientoDece,
  type MensajeSeguimientoDece, type SeguimientoDeceResponse,
} from "../../api/sagab";
import { Badge } from "../components/Badge";
import type { BadgeVariant } from "../components/Badge";
import { Btn } from "../components/Btn";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { TopBar } from "../components/TopBar";
import { useToast } from "../components/Toast";

const ESTADOS: EstadoSeguimientoDece[] = ["ACTIVO", "EN_OBSERVACION", "INTERVENCION", "RESUELTO", "ARCHIVADO"];
const ESTADO: Record<EstadoSeguimientoDece, { label: string; badge: BadgeVariant }> = {
  ACTIVO: { label: "Activo", badge: "info" },
  EN_OBSERVACION: { label: "En observación", badge: "warning" },
  INTERVENCION: { label: "Intervención", badge: "error" },
  RESUELTO: { label: "Resuelto", badge: "success" },
  ARCHIVADO: { label: "Archivado", badge: "info" },
};

const hoy = () => new Date().toISOString().slice(0, 10);
const fechaHora = (valor: string) => new Date(valor).toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" });

export function DeceSeguimientoView() {
  const toast = useToast();
  const [seguimientos, setSeguimientos] = useState<SeguimientoDeceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoSeguimientoDece | "">("");

  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [resultados, setResultados] = useState<EstudianteBusquedaDece[]>([]);
  const [buscandoEstudiantes, setBuscandoEstudiantes] = useState(false);
  const [estudianteNuevo, setEstudianteNuevo] = useState<EstudianteBusquedaDece | null>(null);

  const [seleccionado, setSeleccionado] = useState<SeguimientoDeceResponse | null>(null);
  const [historial, setHistorial] = useState<HistorialSeguimientoDece[]>([]);
  const [mensajes, setMensajes] = useState<MensajeSeguimientoDece[]>([]);

  const cargar = async (q = filtro, estado = estadoFiltro) => {
    setLoading(true); setError(null);
    try {
      setSeguimientos(await seguimientoApi.listar({ q: q.trim() || undefined, estado: estado || undefined }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudieron cargar los estudiantes en seguimiento.");
    } finally { setLoading(false); }
  };

  useEffect(() => { void cargar("", ""); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const terminoEstudiante = useMemo(() => `${nombres} ${apellidos}`.trim().replace(/\s+/g, " "), [nombres, apellidos]);
  useEffect(() => {
    if (terminoEstudiante.length < 2) { setResultados([]); return; }
    const timer = window.setTimeout(() => {
      setBuscandoEstudiantes(true);
      seguimientoApi.buscarEstudiantes(terminoEstudiante).then(setResultados)
        .catch(e => toast.error(e instanceof ApiError ? e.message : "No se pudo buscar estudiantes."))
        .finally(() => setBuscandoEstudiantes(false));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [terminoEstudiante, toast]);

  const abrirDetalle = async (s: SeguimientoDeceResponse) => {
    setSeleccionado(s); setHistorial([]); setMensajes([]);
    try {
      const [detalle, hist, msgs] = await Promise.all([
        seguimientoApi.detalle(s.idSeguimiento), seguimientoApi.historial(s.idSeguimiento), seguimientoApi.mensajes(s.idSeguimiento),
      ]);
      setSeleccionado(detalle); setHistorial(hist); setMensajes(msgs);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo cargar el expediente.");
    }
  };

  return (
    <div>
      <TopBar title="Estudiantes en seguimiento" subtitle="Consejería DECE · expedientes, evolución y comunicación personalizada" />
      <div className="space-y-5 p-6">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <span className="rounded-lg bg-[#EAF2FB] p-2 text-[#2E75B6]"><UserRoundSearch size={18} aria-hidden="true" /></span>
            <div><h2 className="font-semibold text-[#1A1A1A]">Agregar estudiante existente</h2><p className="text-xs text-gray-500">Busque por nombres y apellidos. Curso, paralelo, correo y expediente se recuperan de la base institucional.</p></div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div><label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-gray-600">Nombres</label><input value={nombres} onChange={e => setNombres(e.target.value)} placeholder="Ej. María Fernanda" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#2E75B6] focus:ring-2 focus:ring-[#2E75B6]/20" /></div>
            <div><label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-gray-600">Apellidos</label><input value={apellidos} onChange={e => setApellidos(e.target.value)} placeholder="Ej. Pérez López" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#2E75B6] focus:ring-2 focus:ring-[#2E75B6]/20" /></div>
          </div>
          {buscandoEstudiantes && <p className="mt-3 text-sm text-gray-500"><Loader2 size={14} className="mr-2 inline animate-spin" />Buscando…</p>}
          {!buscandoEstudiantes && terminoEstudiante.length >= 2 && resultados.length === 0 && <p className="mt-3 text-sm text-gray-500">No se encontraron estudiantes activos.</p>}
          {resultados.length > 0 && (
            <ul className="mt-3 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
              {resultados.map(e => <li key={e.idEstudiante} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"><div><p className="text-sm font-semibold text-[#1A1A1A]">{e.estudiante}</p><p className="text-xs text-gray-500">{e.codigo} · {e.paralelo ?? "Sin paralelo"} · {e.email ?? "Sin cuenta de estudiante"}</p></div>{e.enSeguimiento ? <Badge v="warning">Ya está en seguimiento</Badge> : <Btn size="sm" onClick={() => setEstudianteNuevo(e)}><Plus size={13} />Agregar</Btn>}</li>)}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="min-w-[240px] flex-1"><label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-gray-600">Buscar en seguimiento</label><input value={filtro} onChange={e => setFiltro(e.target.value)} onKeyDown={e => e.key === "Enter" && void cargar()} placeholder="Nombre, código o cédula" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#2E75B6]" /></div>
            <div><label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-gray-600">Estado</label><select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value as EstadoSeguimientoDece | "")} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"><option value="">Todos</option>{ESTADOS.filter(e => e !== "ARCHIVADO").map(e => <option key={e} value={e}>{ESTADO[e].label}</option>)}</select></div>
            <Btn onClick={() => void cargar()} disabled={loading}>{loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}Filtrar</Btn>
          </div>
          {error && <div role="alert" className="mb-3 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#C62828]"><AlertCircle size={15} />{error}</div>}
          {!loading && seguimientos.length === 0 ? <EmptyState icon={Users} title="No hay estudiantes con estos filtros." /> : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-gray-200 bg-[#F5F7FA]">{["Estudiante", "Curso / paralelo", "Inicio", "Estado", "Información académica", "Acción"].map(h => <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-600">{h}</th>)}</tr></thead><tbody>{seguimientos.map(s => <tr key={s.idSeguimiento} className="border-b border-gray-100 hover:bg-[#FAFBFC]"><td className="px-4 py-3"><p className="font-semibold text-[#1A1A1A]">{s.estudiante}</p><p className="text-xs text-gray-500">{s.codigo} · {s.email ?? "Sin correo"}</p></td><td className="px-4 py-3 text-gray-600">{s.paralelo ?? "Sin asignar"}</td><td className="px-4 py-3 text-gray-600">{new Date(`${s.fechaInicio}T12:00:00`).toLocaleDateString("es-EC")}</td><td className="px-4 py-3"><Badge v={ESTADO[s.estado].badge}>{ESTADO[s.estado].label}</Badge></td><td className="px-4 py-3 text-xs text-gray-600">Promedio: {s.promedioGeneral ?? "—"}<br />Ausencias injustificadas: {s.ausenciasInjustificadas}</td><td className="px-4 py-3"><button type="button" onClick={() => void abrirDetalle(s)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#2E75B6] hover:underline"><Eye size={13} />Abrir expediente</button></td></tr>)}</tbody></table></div></div>
          )}
        </section>
      </div>

      {estudianteNuevo && <NuevoSeguimientoModal estudiante={estudianteNuevo} onClose={() => setEstudianteNuevo(null)} onCreado={() => { setEstudianteNuevo(null); setNombres(""); setApellidos(""); setResultados([]); void cargar(); }} toast={toast} />}
      {seleccionado && <ExpedienteModal seguimiento={seleccionado} historial={historial} mensajes={mensajes} onClose={() => setSeleccionado(null)} onChanged={async () => { await cargar(); const detalle = await seguimientoApi.detalle(seleccionado.idSeguimiento); setSeleccionado(detalle); setHistorial(await seguimientoApi.historial(seleccionado.idSeguimiento)); }} onDeleted={() => { setSeleccionado(null); void cargar(); }} onMensajes={setMensajes} toast={toast} />}
    </div>
  );
}

function NuevoSeguimientoModal({ estudiante, onClose, onCreado, toast }: { estudiante: EstudianteBusquedaDece; onClose: () => void; onCreado: () => void; toast: ReturnType<typeof useToast> }) {
  const [fechaInicio, setFechaInicio] = useState(hoy());
  const [estado, setEstado] = useState<EstadoSeguimientoDece>("ACTIVO");
  const [observacion, setObservacion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const guardar = async () => { setGuardando(true); try { await seguimientoApi.crear({ idEstudiante: estudiante.idEstudiante, fechaInicio, estado, observacion: observacion.trim() || undefined }); toast.success("Estudiante agregado al seguimiento"); onCreado(); } catch (e) { toast.error(e instanceof ApiError ? e.message : "No se pudo crear el seguimiento."); } finally { setGuardando(false); } };
  return <Modal title="Nuevo seguimiento DECE" onClose={onClose}><div className="space-y-3"><div className="rounded-lg bg-[#F5F7FA] p-3"><p className="font-semibold">{estudiante.estudiante}</p><p className="text-xs text-gray-500">{estudiante.paralelo ?? "Sin paralelo"} · {estudiante.email ?? "Sin cuenta"}</p></div><div><label className="mb-1 block text-xs font-semibold text-gray-600">Fecha de inicio</label><input type="date" max={hoy()} value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div><div><label className="mb-1 block text-xs font-semibold text-gray-600">Estado</label><select value={estado} onChange={e => setEstado(e.target.value as EstadoSeguimientoDece)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">{ESTADOS.filter(e => e !== "ARCHIVADO").map(e => <option key={e} value={e}>{ESTADO[e].label}</option>)}</select></div><div><label className="mb-1 block text-xs font-semibold text-gray-600">Observación inicial</label><textarea rows={4} maxLength={2000} value={observacion} onChange={e => setObservacion(e.target.value)} className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div><div className="flex justify-end gap-2"><Btn variant="secondary" onClick={onClose}>Cancelar</Btn><Btn onClick={() => void guardar()} disabled={guardando || !fechaInicio}>{guardando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}Guardar</Btn></div></div></Modal>;
}

function ExpedienteModal({ seguimiento, historial, mensajes, onClose, onChanged, onDeleted, onMensajes, toast }: { seguimiento: SeguimientoDeceResponse; historial: HistorialSeguimientoDece[]; mensajes: MensajeSeguimientoDece[]; onClose: () => void; onChanged: () => Promise<void>; onDeleted: () => void; onMensajes: (m: MensajeSeguimientoDece[]) => void; toast: ReturnType<typeof useToast> }) {
  const [tab, setTab] = useState<"datos" | "historial" | "mensajes">("datos");
  const [editando, setEditando] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(seguimiento.fechaInicio);
  const [estado, setEstado] = useState(seguimiento.estado);
  const [observacion, setObservacion] = useState(seguimiento.observacion ?? "");
  const [procesando, setProcesando] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [asunto, setAsunto] = useState(""); const [cuerpo, setCuerpo] = useState("");

  useEffect(() => { setFechaInicio(seguimiento.fechaInicio); setEstado(seguimiento.estado); setObservacion(seguimiento.observacion ?? ""); }, [seguimiento]);
  const guardar = async () => { setProcesando(true); try { await seguimientoApi.editar(seguimiento.idSeguimiento, { fechaInicio, estado, observacion: observacion.trim() || undefined }); await onChanged(); setEditando(false); toast.success("Seguimiento actualizado"); } catch (e) { toast.error(e instanceof ApiError ? e.message : "No se pudo actualizar."); } finally { setProcesando(false); } };
  const eliminar = async () => { if (!confirmandoEliminar) { setConfirmandoEliminar(true); return; } setProcesando(true); try { await seguimientoApi.eliminar(seguimiento.idSeguimiento); toast.success("Seguimiento archivado y retirado del listado"); onDeleted(); } catch (e) { toast.error(e instanceof ApiError ? e.message : "No se pudo eliminar."); } finally { setProcesando(false); } };
  const enviar = async () => { if (!asunto.trim() || !cuerpo.trim()) return; setProcesando(true); try { const m = await seguimientoApi.enviarMensaje(seguimiento.idSeguimiento, asunto.trim(), cuerpo.trim()); onMensajes([m, ...mensajes]); setAsunto(""); setCuerpo(""); toast.success("Mensaje enviado al estudiante"); } catch (e) { toast.error(e instanceof ApiError ? e.message : "No se pudo enviar el mensaje."); } finally { setProcesando(false); } };

  return <Modal title={`Expediente · ${seguimiento.estudiante}`} onClose={onClose} size="xl"><div className="space-y-4"><div className="flex flex-wrap gap-1.5">{([['datos','Datos'],['historial','Historial'],['mensajes','Mensajes personalizados']] as const).map(([id,label]) => <button key={id} onClick={() => setTab(id)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === id ? 'bg-[#1F4E79] text-white' : 'bg-[#F5F7FA] text-gray-600'}`}>{label}{id === 'mensajes' && mensajes.filter(m => !m.leido).length > 0 ? ` (${mensajes.filter(m => !m.leido).length} sin leer)` : ''}</button>)}</div>
    {tab === "datos" && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Dato label="Código" valor={seguimiento.codigo} /><Dato label="Cédula" valor={seguimiento.cedula} /><Dato label="Correo" valor={seguimiento.email} /><Dato label="Nacimiento" valor={seguimiento.fechaNacimiento} /><Dato label="Curso / paralelo" valor={seguimiento.paralelo} /><Dato label="Teléfono" valor={seguimiento.telefono} /><Dato label="Tipo de sangre" valor={seguimiento.tipoSangre} /><Dato label="Contacto de emergencia" valor={seguimiento.contactoEmergencia} /></div>{seguimiento.condicionMedica && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><strong>Condición médica:</strong> {seguimiento.condicionMedica}</div>}<div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-[#EAF2FB] p-3"><BookOpen size={16} className="text-[#2E75B6]" /><p className="mt-1 text-xs text-gray-500">Promedio general</p><p className="text-xl font-bold text-[#1F4E79]">{seguimiento.promedioGeneral ?? "—"}</p></div><div className="rounded-lg bg-[#F5F7FA] p-3"><History size={16} /><p className="mt-1 text-xs text-gray-500">Calificaciones</p><p className="text-xl font-bold">{seguimiento.totalCalificaciones}</p></div><div className="rounded-lg bg-red-50 p-3"><Clock3 size={16} className="text-[#C62828]" /><p className="mt-1 text-xs text-gray-500">Ausencias injustificadas</p><p className="text-xl font-bold text-[#C62828]">{seguimiento.ausenciasInjustificadas}</p></div></div>{editando ? <div className="space-y-3 rounded-lg border border-gray-200 p-4"><div className="grid gap-3 sm:grid-cols-2"><div><label className="text-xs font-semibold">Fecha de inicio</label><input type="date" max={hoy()} value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div><div><label className="text-xs font-semibold">Estado</label><select value={estado} onChange={e => setEstado(e.target.value as EstadoSeguimientoDece)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">{ESTADOS.filter(e => e !== 'ARCHIVADO').map(e => <option key={e} value={e}>{ESTADO[e].label}</option>)}</select></div></div><textarea rows={4} maxLength={2000} value={observacion} onChange={e => setObservacion(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Observaciones de seguimiento" /><div className="flex justify-end gap-2"><Btn variant="secondary" onClick={() => setEditando(false)}>Cancelar</Btn><Btn onClick={() => void guardar()} disabled={procesando}>Guardar cambios</Btn></div></div> : <div className="rounded-lg border border-gray-200 p-3"><div className="flex justify-between gap-3"><div><Badge v={ESTADO[seguimiento.estado].badge}>{ESTADO[seguimiento.estado].label}</Badge><p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{seguimiento.observacion ?? "Sin observaciones."}</p><p className="mt-2 text-xs text-gray-500">Registrado por {seguimiento.registradoPor} · actualizado {fechaHora(seguimiento.actualizadoEn)}</p></div><button onClick={() => setEditando(true)} className="text-[#2E75B6]"><Edit2 size={16} /></button></div></div>}<div className="flex justify-end"><Btn variant="danger" onClick={() => void eliminar()} disabled={procesando}>{procesando ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}{confirmandoEliminar ? "Confirmar eliminación" : "Eliminar seguimiento"}</Btn></div></div>}
    {tab === "historial" && (historial.length === 0 ? <EmptyState icon={History} title="No hay cambios registrados." /> : <ul className="space-y-2">{historial.map(h => <li key={h.idHistorial} className="rounded-lg border border-gray-200 p-3"><div className="flex flex-wrap items-center gap-2 text-xs"><span>{h.estadoAnterior ? ESTADO[h.estadoAnterior].label : "Creación"}</span><span>→</span><Badge v={ESTADO[h.estadoNuevo].badge}>{ESTADO[h.estadoNuevo].label}</Badge><time className="ml-auto text-gray-500">{fechaHora(h.cambiadoEn)}</time></div>{h.observacion && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{h.observacion}</p>}<p className="mt-1 text-xs text-gray-500">{h.cambiadoPor}</p></li>)}</ul>)}
    {tab === "mensajes" && <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]"><div className="space-y-3 rounded-lg border border-gray-200 p-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><Mail size={15} />Nuevo mensaje al estudiante</h3>{!seguimiento.email && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">El estudiante no tiene una cuenta/correo activo; el servidor impedirá el envío.</p>}<input maxLength={150} value={asunto} onChange={e => setAsunto(e.target.value)} placeholder="Asunto" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /><textarea rows={6} maxLength={10000} value={cuerpo} onChange={e => setCuerpo(e.target.value)} placeholder="Mensaje personalizado" className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm" /><Btn onClick={() => void enviar()} disabled={procesando || !asunto.trim() || !cuerpo.trim() || !seguimiento.email}>{procesando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}Enviar</Btn></div><div><h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><MessageSquare size={15} />Historial por destinatario</h3>{mensajes.length === 0 ? <EmptyState icon={MessageSquare} title="Todavía no hay mensajes personalizados." /> : <ul className="max-h-[55vh] space-y-2 overflow-y-auto">{mensajes.map(m => <li key={m.idMensaje} className="rounded-lg border border-gray-200 p-3"><div className="flex justify-between gap-2"><p className="font-semibold text-[#1A1A1A]">{m.asunto}</p><Badge v={m.leido ? "success" : "warning"}>{m.leido ? "Leído" : "No leído"}</Badge></div><p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{m.cuerpo}</p><p className="mt-2 text-xs text-gray-500">Enviado {fechaHora(m.enviadoEn)} por {m.remitente}{m.leidoEn ? ` · leído ${fechaHora(m.leidoEn)}` : ""}</p></li>)}</ul>}</div></div>}
  </div></Modal>;
}

function Dato({ label, valor }: { label: string; valor: string | null | undefined }) {
  return <div className="rounded-lg bg-[#F8FAFC] p-3"><p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">{label}</p><p className="mt-1 text-sm font-medium text-[#1A1A1A]">{valor || "—"}</p></div>;
}
