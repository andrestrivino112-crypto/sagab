import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Loader2, Mail, MailOpen, Megaphone, Plus, Send, X } from "lucide-react";
import { ApiError } from "../../api/client";
import type { RolSistema } from "../../api/auth";
import {
  estudiantes as estudiantesApi, mensajes as mensajesApi, paralelos as paralelosApi,
  type EstudianteConParalelo, type EstudianteResumen, type GrupoDestinatario, type MensajeEnviadoResponse,
  type MensajeResponse, type ParaleloOpcion,
} from "../../api/sagab";
import { Badge } from "./Badge";
import { Btn } from "./Btn";
import { EmptyState } from "./EmptyState";
import { Modal } from "./Modal";
import { useToast } from "./Toast";
import { useDebouncedSearch } from "../hooks/useDebouncedSearch";

type Tab = "no_leidos" | "leidos" | "enviados";

const GRUPO_LABEL: Record<GrupoDestinatario, string> = {
  ESTUDIANTES: "Estudiante(s) específico(s)",
  TODO_CURSO: "Todo un curso",
  TODO_PARALELO: "Todo un paralelo",
  TODOS_REPRESENTANTES: "Todos los representantes",
  TODOS_DOCENTES: "Todos los profesores",
  TODO_COLEGIO: "Todo el colegio",
};

function fecha(iso: string) {
  return new Date(iso).toLocaleString("es-EC", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function MensajesDrilldown({ onClose, rol }: { onClose: () => void; rol: RolSistema }) {
  const toast = useToast();
  const [mensajes, setMensajes] = useState<MensajeResponse[]>([]);
  const [enviados, setEnviados] = useState<MensajeEnviadoResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("no_leidos");
  const [componiendo, setComponiendo] = useState(false);

  useEffect(() => {
    Promise.all([mensajesApi.mias(), mensajesApi.enviados().catch(() => [])])
      .then(([m, e]) => { setMensajes(m); setEnviados(e); })
      .catch(err => setErrorApi(err instanceof ApiError ? err.message : "No se pudieron cargar los mensajes."))
      .finally(() => setLoading(false));
  }, []);

  const noLeidos = useMemo(() => mensajes.filter(m => !m.leido), [mensajes]);
  const leidos = useMemo(() => mensajes.filter(m => m.leido), [mensajes]);

  const marcarLeido = async (idMensaje: number) => {
    try {
      await mensajesApi.marcarLeido(idMensaje);
      setMensajes(prev => prev.map(m => m.idMensaje === idMensaje ? { ...m, leido: true } : m));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo marcar como leído.");
    }
  };

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: "no_leidos", label: "No leídos", count: noLeidos.length },
    { id: "leidos", label: "Leídos", count: leidos.length },
    { id: "enviados", label: "Enviados", count: enviados.length },
  ];

  return (
    <Modal title="Mensajes" onClose={onClose} size="lg">
      <div className="space-y-4">
        {errorApi && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />{errorApi}
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-600">
            <Loader2 size={16} className="animate-spin inline-block mr-2" aria-hidden="true" />Cargando…
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Bandeja de mensajes">
                {TABS.map(t => (
                  <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
                      tab === t.id ? "bg-[#1F4E79] text-white" : "bg-[#F5F7FA] text-gray-600 hover:bg-[#EAF2FB]"}`}>
                    {t.label}
                    {t.count > 0 && (
                      <span className={`text-[10px] font-semibold rounded-full px-1.5 ${tab === t.id ? "bg-white/20" : "bg-white text-gray-700"}`}>
                        {t.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <Btn size="sm" onClick={() => setComponiendo(true)}>
                <Plus size={13} aria-hidden="true" />Nuevo mensaje
              </Btn>
            </div>

            {tab === "no_leidos" && (
              noLeidos.length === 0 ? <EmptyState icon={MailOpen} title="No hay mensajes pendientes." /> : (
                <ul className="space-y-2 max-h-[55vh] overflow-y-auto">
                  {noLeidos.map(m => (
                    <li key={m.idMensaje} className="rounded-xl border border-red-200 bg-red-50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#1A1A1A] flex items-center gap-1.5">
                            {m.esCircular && <Megaphone size={12} className="text-gray-500 flex-shrink-0" aria-hidden="true" />}{m.asunto}
                          </p>
                          <p className="text-xs text-gray-600 mt-0.5">De: {m.remitente} · {fecha(m.enviadoEn)}</p>
                          <p className="text-xs text-gray-700 mt-1.5">{m.cuerpo}</p>
                        </div>
                        <button type="button" onClick={() => marcarLeido(m.idMensaje)} title="Marcar como leído"
                          className="flex-shrink-0 p-1.5 rounded-md text-[#2E75B6] hover:bg-white focus:outline-none">
                          <Check size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )
            )}

            {tab === "leidos" && (
              leidos.length === 0 ? <EmptyState icon={Mail} title="No hay mensajes leídos todavía." /> : (
                <ul className="space-y-2 max-h-[55vh] overflow-y-auto">
                  {leidos.map(m => (
                    <li key={m.idMensaje} className="rounded-xl border border-gray-100 p-3">
                      <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                        {m.esCircular && <Megaphone size={12} className="text-gray-400 flex-shrink-0" aria-hidden="true" />}{m.asunto}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">De: {m.remitente} · {fecha(m.enviadoEn)}</p>
                      <p className="text-xs text-gray-600 mt-1.5">{m.cuerpo}</p>
                    </li>
                  ))}
                </ul>
              )
            )}

            {tab === "enviados" && (
              enviados.length === 0 ? <EmptyState icon={Send} title="No has enviado mensajes." /> : (
                <ul className="space-y-2 max-h-[55vh] overflow-y-auto">
                  {enviados.map(m => (
                    <li key={m.idMensaje} className="rounded-xl border border-gray-100 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-[#1A1A1A] flex items-center gap-1.5">
                          {m.esCircular && <Megaphone size={12} className="text-gray-400 flex-shrink-0" aria-hidden="true" />}{m.asunto}
                        </p>
                        <Badge v={m.leidos === m.totalDestinatarios ? "success" : "info"}>
                          {m.leidos}/{m.totalDestinatarios} leído{m.totalDestinatarios === 1 ? "" : "s"}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{fecha(m.enviadoEn)}</p>
                      <p className="text-xs text-gray-600 mt-1.5">{m.cuerpo}</p>
                    </li>
                  ))}
                </ul>
              )
            )}
          </>
        )}
      </div>

      {componiendo && (
        <ComponerMensajeModal
          rol={rol}
          onClose={() => setComponiendo(false)}
          onEnviado={() => {
            setComponiendo(false);
            setTab("enviados");
            mensajesApi.enviados().then(setEnviados).catch(() => {});
          }}
          toast={toast}
        />
      )}
    </Modal>
  );
}

/**
 * Compone y envía un mensaje. Un DOCENTE solo puede dirigirse a estudiantes: el formulario le
 * exige elegir primero el curso y luego el paralelo, y solo entonces muestra la lista de
 * estudiantes de ese paralelo (no puede mezclar estudiantes de otros cursos). ADMIN conserva el
 * selector completo (estudiantes, curso, paralelo, representantes, profesores o todo el colegio).
 */
function ComponerMensajeModal({ rol, onClose, onEnviado, toast }: {
  rol: RolSistema; onClose: () => void; onEnviado: () => void; toast: ReturnType<typeof useToast>;
}) {
  const esDocente = rol === "DOCENTE";

  const [grupo, setGrupo] = useState<GrupoDestinatario>("ESTUDIANTES");
  const [query, setQuery] = useState("");
  const resultados = useDebouncedSearch(query, estudiantesApi.buscar);
  const [seleccionados, setSeleccionados] = useState<EstudianteResumen[]>([]);
  const [paralelosDisponibles, setParalelosDisponibles] = useState<ParaleloOpcion[]>([]);
  const [idParalelo, setIdParalelo] = useState<number | "">("");
  const [curso, setCurso] = useState("");
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const [estudiantesDelParalelo, setEstudiantesDelParalelo] = useState<EstudianteResumen[]>([]);
  const [cargandoEstudiantes, setCargandoEstudiantes] = useState(false);

  useEffect(() => { paralelosApi.listar().then(setParalelosDisponibles).catch(() => {}); }, []);
  const cursos = useMemo(() => [...new Set(paralelosDisponibles.map(p => p.nivel))], [paralelosDisponibles]);
  const paralelosDelCurso = useMemo(
    () => (curso ? paralelosDisponibles.filter(p => p.nivel === curso) : []),
    [paralelosDisponibles, curso]);

  // Flujo del docente: Curso -> Paralelo -> lista de estudiantes de ese paralelo (no de otros).
  useEffect(() => {
    if (!esDocente || idParalelo === "") { setEstudiantesDelParalelo([]); return; }
    setCargandoEstudiantes(true);
    setSeleccionados([]);
    estudiantesApi.porParalelo(idParalelo)
      .then(setEstudiantesDelParalelo)
      .catch(() => toast.error("No se pudo cargar la lista de estudiantes del paralelo."))
      .finally(() => setCargandoEstudiantes(false));
  }, [esDocente, idParalelo, toast]);

  const toggleEstudianteParalelo = (e: EstudianteResumen) => {
    setSeleccionados(prev => prev.some(s => s.id === e.id) ? prev.filter(s => s.id !== e.id) : [...prev, e]);
  };

  const todosSeleccionados = estudiantesDelParalelo.length > 0 && seleccionados.length === estudiantesDelParalelo.length;
  const alternarTodos = () => setSeleccionados(todosSeleccionados ? [] : estudiantesDelParalelo);

  const agregarEstudiante = (e: EstudianteConParalelo) => {
    if (!seleccionados.some(s => s.id === e.id)) setSeleccionados(prev => [...prev, e]);
    setQuery("");
  };

  const listo = esDocente
    ? asunto.trim() && cuerpo.trim() && seleccionados.length > 0
    : asunto.trim() && cuerpo.trim() && (
        grupo === "ESTUDIANTES" ? seleccionados.length > 0 :
        grupo === "TODO_PARALELO" ? idParalelo !== "" :
        grupo === "TODO_CURSO" ? curso !== "" : true
      );

  const enviar = async () => {
    if (!listo) return;
    setEnviando(true);
    try {
      await mensajesApi.enviarBroadcast(esDocente ? {
        grupo: "ESTUDIANTES", asunto: asunto.trim(), cuerpo: cuerpo.trim(),
        idsEstudiantes: seleccionados.map(s => s.id),
      } : {
        grupo, asunto: asunto.trim(), cuerpo: cuerpo.trim(),
        idsEstudiantes: grupo === "ESTUDIANTES" ? seleccionados.map(s => s.id) : undefined,
        idParalelo: grupo === "TODO_PARALELO" && idParalelo !== "" ? idParalelo : undefined,
        curso: grupo === "TODO_CURSO" ? curso : undefined,
      });
      toast.success("Mensaje enviado correctamente");
      onEnviado();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo enviar el mensaje.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal title="Nuevo mensaje" onClose={onClose} size="md">
      <div className="space-y-3">
        {esDocente ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="msg-curso-docente" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Curso</label>
                <select id="msg-curso-docente" value={curso}
                  onChange={e => { setCurso(e.target.value); setIdParalelo(""); }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6] bg-white">
                  <option value="">Seleccione…</option>
                  {cursos.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="msg-paralelo-docente" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Paralelo</label>
                <select id="msg-paralelo-docente" value={idParalelo} disabled={!curso}
                  onChange={e => setIdParalelo(e.target.value ? Number(e.target.value) : "")}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6] bg-white disabled:bg-gray-50 disabled:text-gray-400">
                  <option value="">Seleccione…</option>
                  {paralelosDelCurso.map(p => <option key={p.id} value={p.id}>{p.seccion}</option>)}
                </select>
              </div>
            </div>

            {idParalelo !== "" && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Estudiantes del paralelo</label>
                  {estudiantesDelParalelo.length > 0 && (
                    <button type="button" onClick={alternarTodos} className="text-[11px] font-medium text-[#2E75B6] hover:underline">
                      {todosSeleccionados ? "Quitar todos" : "Seleccionar todos"}
                    </button>
                  )}
                </div>
                {cargandoEstudiantes ? (
                  <div className="py-4 text-center text-sm text-gray-500">
                    <Loader2 size={14} className="animate-spin inline-block mr-2" aria-hidden="true" />Cargando…
                  </div>
                ) : estudiantesDelParalelo.length === 0 ? (
                  <p className="text-sm text-gray-500 py-2">Este paralelo no tiene estudiantes matriculados.</p>
                ) : (
                  <ul className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-gray-100">
                    {estudiantesDelParalelo.map(e => {
                      const marcado = seleccionados.some(s => s.id === e.id);
                      return (
                        <li key={e.id}>
                          <label className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-[#EAF2FB] cursor-pointer">
                            <input type="checkbox" checked={marcado} onChange={() => toggleEstudianteParalelo(e)}
                              className="rounded border-gray-300 text-[#2E75B6] focus:ring-[#2E75B6]/30" />
                            {e.nombreCompleto}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {seleccionados.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1.5">{seleccionados.length} estudiante(s) seleccionado(s)</p>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <label htmlFor="msg-grupo" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Enviar a</label>
              <select id="msg-grupo" value={grupo} onChange={e => setGrupo(e.target.value as GrupoDestinatario)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6] bg-white">
                {(Object.keys(GRUPO_LABEL) as GrupoDestinatario[]).map(g => <option key={g} value={g}>{GRUPO_LABEL[g]}</option>)}
              </select>
            </div>

            {grupo === "ESTUDIANTES" && (
              <div>
                <label htmlFor="msg-estudiante" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Buscar estudiante(s)</label>
                <div className="relative">
                  <input id="msg-estudiante" value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="Nombre, apellido o cédula"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
                  {resultados.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {resultados.map(r => (
                        <li key={r.id}>
                          <button type="button" onClick={() => agregarEstudiante(r)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-[#EAF2FB]">{r.nombreCompleto}</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {seleccionados.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {seleccionados.map(s => (
                      <span key={s.id} className="inline-flex items-center gap-1 bg-[#EAF2FB] text-[#1F4E79] text-xs font-medium px-2 py-1 rounded-full">
                        {s.nombreCompleto}
                        <button type="button" onClick={() => setSeleccionados(prev => prev.filter(x => x.id !== s.id))} aria-label={`Quitar ${s.nombreCompleto}`}>
                          <X size={11} aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {grupo === "TODO_CURSO" && (
              <div>
                <label htmlFor="msg-curso" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Curso</label>
                <select id="msg-curso" value={curso} onChange={e => setCurso(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6] bg-white">
                  <option value="">Seleccione…</option>
                  {cursos.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            {grupo === "TODO_PARALELO" && (
              <div>
                <label htmlFor="msg-paralelo" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Paralelo</label>
                <select id="msg-paralelo" value={idParalelo} onChange={e => setIdParalelo(e.target.value ? Number(e.target.value) : "")}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6] bg-white">
                  <option value="">Seleccione…</option>
                  {paralelosDisponibles.map(p => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
                </select>
              </div>
            )}
          </>
        )}

        <div>
          <label htmlFor="msg-asunto" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Asunto</label>
          <input id="msg-asunto" value={asunto} onChange={e => setAsunto(e.target.value)} maxLength={150}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
        </div>
        <div>
          <label htmlFor="msg-cuerpo" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Mensaje</label>
          <textarea id="msg-cuerpo" value={cuerpo} onChange={e => setCuerpo(e.target.value)} rows={4}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6] resize-none" />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Btn type="button" variant="secondary" onClick={onClose}>Cancelar</Btn>
          <Btn type="button" onClick={enviar} disabled={!listo || enviando}>
            {enviando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
            Enviar
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
