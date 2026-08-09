import { useEffect, useRef, useState } from "react";
import { AlertCircle, BookOpen, CheckCircle2, Download, ExternalLink, FileDown, FileText, Link2, Loader2, Save, Search, Send, UserPlus } from "lucide-react";
import { ApiError } from "../../api/client";
import {
  estudiantes as estudiantesApi, calificaciones as calificacionesApi, recursosAcademicos as recursosApi,
  type AsignacionOpcion, type EstudianteConParalelo, type NotaBusquedaResponse,
  type RecursoAcademicoResponse, type TipoRecursoAcademico,
} from "../../api/sagab";
import { EmptyState } from "../components/EmptyState";
import { Btn } from "../components/Btn";
import { FileUpload } from "../components/FileUpload";
import { MaterialSemanalPanel } from "../components/MaterialSemanalPanel";
import { TopBar } from "../components/TopBar";
import { useToast } from "../components/Toast";
import { useAsignaciones } from "../hooks/useAsignaciones";
import { useDebouncedSearch } from "../hooks/useDebouncedSearch";
import { calcAvg, isComplete, isValid } from "../helpers";
import type { Screen } from "../types";
import { esRolAdministrativo, type RolSistema } from "../../api/auth";

interface NotaRow { idEstudiante: number; nombre: string; tarea: string; clase: string; examen: string; }
type NotaSortKey = "nombre" | "promedio";
const FILAS_POR_PAGINA = 15;
const ACCEPT_RECURSOS = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar,.jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm,.avi,.mp3,.m4a,.wav,.ogg,.txt,.csv";

function tamanoArchivo(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function GradesView({ onNavigate, rol }: { onNavigate: (s: Screen) => void; rol: RolSistema }) {
  const toast = useToast();
  const [modo, setModo] = useState<"ingreso" | "consulta" | "recursos">("ingreso");
  const puedeVerRecursos = !esRolAdministrativo(rol);
  const modosDisponibles = puedeVerRecursos
    ? (["ingreso", "consulta", "recursos"] as const)
    : (["ingreso", "consulta"] as const);
  const { opciones: asignacionesOpciones, idAsignacion, setIdAsignacion, asignacion, error: errorAsignaciones } = useAsignaciones();
  const [parcial, setParcial] = useState(1);
  const [rows, setRows] = useState<NotaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorApi, setErrorApi] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<{ campo: NotaSortKey; asc: boolean }>({ campo: "nombre", asc: true });
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    if (!asignacion) {
      setRows([]);
      setLoading(false);
      setErrorApi(null);
      return;
    }
    let vigente = true;
    setRows([]);
    setLoading(true);
    setErrorApi(null);
    void Promise.allSettled([
      estudiantesApi.porParalelo(asignacion.idParalelo),
      calificacionesApi.porAsignacion(asignacion.idAsignacion, parcial),
    ]).then(([rosterResult, notasResult]) => {
      if (!vigente) return;
      const notas = notasResult.status === "fulfilled" ? notasResult.value : [];
      const roster = rosterResult.status === "fulfilled"
        ? rosterResult.value
        : notas.map(n => ({ id: n.idEstudiante, nombreCompleto: n.estudiante }));
      setRows(roster.map(e => {
        const n = notas.find(x => x.idEstudiante === e.id);
        return {
          idEstudiante: e.id, nombre: e.nombreCompleto,
          tarea: n ? String(n.notaTarea) : "", clase: n ? String(n.notaClase) : "", examen: n ? String(n.notaExamen) : "",
        };
      }));
      const errores = [
        rosterResult.status === "rejected" ? "No se pudo cargar la nómina de estudiantes." : null,
        notasResult.status === "rejected" ? "No se pudieron cargar las notas existentes; puede continuar viendo la nómina." : null,
      ].filter((mensaje): mensaje is string => mensaje != null);
      setErrorApi(errores.length > 0 ? errores.join(" ") : null);
    }).finally(() => { if (vigente) setLoading(false); });
    return () => { vigente = false; };
  }, [asignacion?.idAsignacion, asignacion?.idParalelo, parcial]);

  useEffect(() => { setPagina(1); }, [busqueda, idAsignacion, parcial]);

  const update = (idEstudiante: number, f: "tarea"|"clase"|"examen", v: string) => {
    setRows(p => p.map(r => r.idEstudiante === idEstudiante ? {...r,[f]:v} : r));
  };

  const completas = rows.filter(r => isComplete(r.tarea) && isComplete(r.clase) && isComplete(r.examen));
  const allOk = rows.length > 0 && completas.length === rows.length;

  const guardar = async () => {
    if (!asignacion || completas.length === 0) return;
    setSaving(true);
    try {
      await calificacionesApi.registrarMasivo(asignacion.idAsignacion, parcial, completas.map(r => ({
        idEstudiante: r.idEstudiante,
        notaTarea: parseFloat(r.tarea), notaClase: parseFloat(r.clase), notaExamen: parseFloat(r.examen),
      })));
      toast.success(`${completas.length} calificación${completas.length === 1 ? "" : "es"} guardada${completas.length === 1 ? "" : "s"} correctamente`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudieron guardar las calificaciones.");
    } finally {
      setSaving(false);
    }
  };

  const filas = rows
    .filter(r => r.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))
    .sort((a, b) => {
      const dir = orden.asc ? 1 : -1;
      if (orden.campo === "nombre") return a.nombre.localeCompare(b.nombre) * dir;
      const pa = calcAvg(a.tarea, a.clase, a.examen) ?? -1;
      const pb = calcAvg(b.tarea, b.clase, b.examen) ?? -1;
      return (pa - pb) * dir;
    });
  const totalPaginas = Math.max(1, Math.ceil(filas.length / FILAS_POR_PAGINA));
  const filasPagina = filas.slice((pagina - 1) * FILAS_POR_PAGINA, pagina * FILAS_POR_PAGINA);

  const ordenarPor = (campo: NotaSortKey) =>
    setOrden(o => o.campo === campo ? { campo, asc: !o.asc } : { campo, asc: true });

  return (
    <div>
      <TopBar title="Calificaciones" subtitle="Escala 0.0–10.0 · Aprobación ≥ 7.0" />
      <div className="p-6">
        {/* Modo */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5 w-fit mb-4" role="tablist" aria-label="Modo de calificaciones">
          {modosDisponibles.map(m => (
            <button key={m} type="button" role="tab" aria-selected={modo === m} onClick={() => setModo(m)}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all
                focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E75B6]/40
                ${modo === m ? "bg-[#1F4E79] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {m === "ingreso" ? "Ingreso de notas" : m === "consulta" ? "Búsqueda avanzada" : "Recursos"}
            </button>
          ))}
        </div>

        {modo === "ingreso" && <>
        {/* Controls */}
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
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Parcial</label>
            <select value={parcial} onChange={e => setParcial(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6] bg-white">
              {[1,2,3].map(p => <option key={p} value={p}>Parcial {p}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 min-w-[220px]">
            <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Buscar estudiante</label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Nombre…"
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Btn onClick={guardar} disabled={saving || completas.length === 0}>
              {saving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
              {saving
                ? "Guardando…"
                : completas.length === 0
                  ? "Complete al menos un estudiante"
                  : allOk
                    ? "Guardar calificaciones"
                    : `Guardar ${completas.length} de ${rows.length} completas`}
            </Btn>
          </div>
        </div>

        {(errorApi || errorAsignaciones) && (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />{errorApi ?? errorAsignaciones}
          </div>
        )}

        {!asignacion && !loading && asignacionesOpciones.length === 0 && !errorApi && !errorAsignaciones && (
          <EmptyState icon={BookOpen} title="No tiene asignaciones de materias registradas todavía." />
        )}

        {/* Table */}
        {asignacion && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Calificaciones de {asignacion.paralelo} · {asignacion.materia}, parcial {parcial}</caption>
            <thead>
              <tr className="bg-[#F5F7FA] border-b border-gray-200">
                <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-8">#</th>
                <th scope="col" aria-sort={orden.campo === "nombre" ? (orden.asc ? "ascending" : "descending") : "none"}
                  className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  <button type="button" onClick={() => ordenarPor("nombre")}
                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E75B6]/40 rounded">
                    Estudiante {orden.campo === "nombre" && (orden.asc ? "▲" : "▼")}
                  </button>
                </th>
                {(["Tarea","Clase","Examen"] as const).map((h, i) => (
                  <th key={h} scope="col" className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h} <span className="font-normal text-gray-600 normal-case">{["(20%)","(20%)","(60%)"][i]}</span>
                  </th>
                ))}
                <th scope="col" aria-sort={orden.campo === "promedio" ? (orden.asc ? "ascending" : "descending") : "none"}
                  className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  <button type="button" onClick={() => ordenarPor("promedio")}
                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E75B6]/40 rounded">
                    Promedio {orden.campo === "promedio" && (orden.asc ? "▲" : "▼")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-600">
                  <Loader2 size={16} className="animate-spin inline-block mr-2" aria-hidden="true" />Cargando…
                </td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-4">
                  <EmptyState icon={UserPlus} title="No existen estudiantes matriculados en esta asignación."
                    action={{ label: "Ir a Matrículas", onClick: () => onNavigate("matricula") }} />
                </td></tr>
              )}
              {!loading && rows.length > 0 && filas.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-4">
                  <EmptyState icon={Search} title="Ningún estudiante coincide con la búsqueda." />
                </td></tr>
              )}
              {!loading && filasPagina.map((row) => {
                const idx = rows.findIndex(r => r.idEstudiante === row.idEstudiante);
                const avg = calcAvg(row.tarea, row.clase, row.examen);
                return (
                  <tr key={row.idEstudiante}
                    className={`border-b border-gray-100 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]"} hover:bg-[#EAF2FB]/25`}>
                    <td className="px-4 py-3 text-gray-600 text-xs">{idx+1}</td>
                    <td className="px-4 py-3 font-medium text-[#1A1A1A] text-sm whitespace-nowrap">{row.nombre}</td>
                    {(["tarea","clase","examen"] as const).map(f => {
                      const val = row[f];
                      const invalid = val !== "" && !isValid(val);
                      const errId = `nota-error-${row.idEstudiante}-${f}`;
                      const campoLabel = { tarea: "Tarea", clase: "Clase", examen: "Examen" }[f];
                      return (
                        <td key={f} className="px-4 py-2">
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-1">
                              <input type="number" min="0" max="10" step="0.5" value={val}
                                aria-label={`${campoLabel} de ${row.nombre}`}
                                aria-invalid={invalid || undefined}
                                aria-describedby={invalid ? errId : undefined}
                                onChange={e => update(row.idEstudiante, f, e.target.value)}
                                className={`w-20 text-center px-2 py-1.5 rounded-lg border text-sm font-mono outline-none transition-all
                                  ${invalid
                                    ? "border-[#C62828] bg-red-50 text-[#C62828] ring-1 ring-[#C62828]/25"
                                    : "border-gray-300 focus:border-[#2E75B6] focus:ring-2 focus:ring-[#2E75B6]/20"}`} />
                              {invalid && <AlertCircle size={14} className="text-[#C62828] flex-shrink-0" aria-hidden="true" />}
                            </div>
                            {invalid && <p id={errId} role="alert" className="text-[10px] text-[#C62828]">Valor: 0–10</p>}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center">
                      {avg !== null
                        ? <span className={`inline-flex items-center justify-center w-14 h-7 rounded-lg text-sm font-bold
                            ${avg < 7 ? "bg-red-100 text-[#C62828]" : avg >= 9 ? "bg-green-100 text-[#2E7D32]" : "bg-[#EAF2FB] text-[#1F4E79]"}`}>
                            {avg}
                          </span>
                        : <span className="text-gray-600">—</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <div className="px-4 py-3 bg-[#F5F7FA] border-t border-gray-200 flex items-center justify-between text-xs text-gray-600 flex-wrap gap-2">
            <span>{filas.length} de {rows.length} estudiantes · {asignacion.paralelo} · {asignacion.materia} · {asignacion.periodo}</span>
            {totalPaginas > 1 && (
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Página anterior" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}
                  className="px-2 py-1 rounded border border-gray-300 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E75B6]/40"><span aria-hidden="true">‹</span></button>
                <span aria-live="polite">Página {pagina} de {totalPaginas}</span>
                <button type="button" aria-label="Página siguiente" disabled={pagina >= totalPaginas} onClick={() => setPagina(p => p + 1)}
                  className="px-2 py-1 rounded border border-gray-300 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E75B6]/40"><span aria-hidden="true">›</span></button>
              </div>
            )}
            <span>Promedio = Tarea×0.2 + Clase×0.2 + Examen×0.6</span>
          </div>
        </div>
        )}
        </>}

        {modo === "consulta" && (
          <BusquedaCalificaciones asignaciones={asignacionesOpciones} toast={toast} />
        )}

        {puedeVerRecursos && modo === "recursos" && <>
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
          </div>
          {!asignacion && asignacionesOpciones.length === 0 && (
            <EmptyState icon={BookOpen} title="No tiene asignaciones de materias registradas todavía." />
          )}
          {asignacion && <RecursosAcademicosTab idAsignacion={asignacion.idAsignacion} toast={toast} />}
        </>}
      </div>
    </div>
  );
}

// ── Recursos académicos (sílabo, formatos, link de clase) de una asignación ─
function RecursosAcademicosTab({ idAsignacion, toast }: { idAsignacion: number; toast: ReturnType<typeof useToast> }) {
  const [recursos, setRecursos] = useState<RecursoAcademicoResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmacion, setConfirmacion] = useState<string | null>(null);
  const cargaActual = useRef(0);
  const asignacionActual = useRef(idAsignacion);
  asignacionActual.current = idAsignacion;

  const [tipoArchivo, setTipoArchivo] = useState<Exclude<TipoRecursoAcademico, "LINK_CLASE">>("SILABO");
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);

  const [nombreLink, setNombreLink] = useState("");
  const [urlLink, setUrlLink] = useState("");
  const [publicandoLink, setPublicandoLink] = useState(false);

  const cargar = async (): Promise<boolean> => {
    const numeroCarga = ++cargaActual.current;
    setLoading(true);
    setError(null);
    try {
      const lista = await recursosApi.porAsignacion(idAsignacion);
      if (numeroCarga !== cargaActual.current) return false;
      setRecursos(lista);
      return true;
    } catch (e) {
      if (numeroCarga !== cargaActual.current) return false;
      setError(e instanceof ApiError ? e.message : "No se pudieron cargar los recursos de esta asignación.");
      return false;
    } finally {
      if (numeroCarga === cargaActual.current) setLoading(false);
    }
  };

  useEffect(() => {
    ++cargaActual.current;
    setRecursos([]);
    setError(null);
    setConfirmacion(null);
    setTipoArchivo("SILABO");
    setNombreArchivo("");
    setArchivo(null);
    setNombreLink("");
    setUrlLink("");
    void cargar();
    return () => { ++cargaActual.current; };
  }, [idAsignacion]);

  const refrescarTrasGuardar = async (asignacionObjetivo: number, mensaje: string) => {
    const actualizado = await cargar();
    if (!actualizado && asignacionActual.current === asignacionObjetivo) toast.error(mensaje);
  };

  const subirArchivo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archivo || !nombreArchivo.trim()) return;
    setSubiendoArchivo(true);
    try {
      const asignacionObjetivo = idAsignacion;
      const nombreGuardado = nombreArchivo.trim();
      const publicado = await recursosApi.subirArchivo(asignacionObjetivo, tipoArchivo, nombreGuardado, archivo);
      if (asignacionActual.current !== asignacionObjetivo) return;
      setRecursos(prev => [publicado, ...prev.filter(r => r.idRecurso !== publicado.idRecurso)]);
      toast.success("Recurso publicado correctamente");
      setConfirmacion(`“${nombreGuardado}” quedó publicado correctamente.`);
      setNombreArchivo(""); setArchivo(null);
      await refrescarTrasGuardar(asignacionObjetivo,
        "El recurso se publicó, pero no se pudo actualizar el listado. No vuelva a publicarlo; reintente la carga.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo publicar el recurso.");
    } finally {
      setSubiendoArchivo(false);
    }
  };

  const publicarLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreLink.trim() || !urlLink.trim()) return;
    setPublicandoLink(true);
    try {
      const asignacionObjetivo = idAsignacion;
      const nombreGuardado = nombreLink.trim();
      const publicado = await recursosApi.crearLink(asignacionObjetivo, nombreGuardado, urlLink.trim());
      if (asignacionActual.current !== asignacionObjetivo) return;
      setRecursos(prev => [publicado, ...prev.filter(r => r.idRecurso !== publicado.idRecurso)]);
      toast.success("Link de clase publicado correctamente");
      setConfirmacion(`“${nombreGuardado}” quedó publicado correctamente.`);
      setNombreLink(""); setUrlLink("");
      await refrescarTrasGuardar(asignacionObjetivo,
        "El enlace se publicó, pero no se pudo actualizar el listado. No vuelva a publicarlo; reintente la carga.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo publicar el link.");
    } finally {
      setPublicandoLink(false);
    }
  };

  const descargar = async (idRecurso: number) => {
    try {
      const { url } = await recursosApi.urlDescarga(idRecurso);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo generar el enlace de descarga.");
    }
  };

  return (
    <div className="space-y-6">
    {confirmacion && (
      <div role="status" className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-[#2E7D32]">
        <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />{confirmacion}
      </div>
    )}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-4">
        <form onSubmit={subirArchivo} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">Publicar recurso académico</p>
          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="recurso-tipo" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Tipo</label>
              <select id="recurso-tipo" value={tipoArchivo} onChange={e => setTipoArchivo(e.target.value as typeof tipoArchivo)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6] bg-white">
                <option value="SILABO">Sílabo</option>
                <option value="FORMATO">Formato</option>
              </select>
            </div>
            <div className="flex-1">
              <label htmlFor="recurso-nombre" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Nombre</label>
              <input id="recurso-nombre" value={nombreArchivo} onChange={e => setNombreArchivo(e.target.value)} required maxLength={150}
                placeholder="Ej. Sílabo 2026"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
            </div>
          </div>
          <FileUpload accept={ACCEPT_RECURSOS} maxSizeMb={100} value={archivo} onFileSelected={setArchivo}
            disabled={subiendoArchivo} label="PDF, Office, imagen, video, audio, ZIP/RAR, TXT o CSV (máx. 100 MB)" />
          <Btn disabled={subiendoArchivo || !archivo || !nombreArchivo.trim()}>
            {subiendoArchivo ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
            Publicar
          </Btn>
        </form>

        <form onSubmit={publicarLink} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">Publicar link de clase virtual</p>
          <div>
            <label htmlFor="link-nombre" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Nombre</label>
            <input id="link-nombre" value={nombreLink} onChange={e => setNombreLink(e.target.value)} required maxLength={150}
              placeholder="Ej. Clase virtual — Zoom"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
          </div>
          <div>
            <label htmlFor="link-url" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">URL</label>
            <input id="link-url" type="url" value={urlLink} onChange={e => setUrlLink(e.target.value)} required
              placeholder="https://…"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
          </div>
          <Btn disabled={publicandoLink || !nombreLink.trim() || !urlLink.trim()}>
            {publicandoLink ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Link2 size={14} aria-hidden="true" />}
            Publicar link
          </Btn>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest px-4 pt-4 pb-2">Recursos publicados</p>
        {error && (
          <div role="alert" className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />{error}
          </div>
        )}
        {loading && <div className="px-4 pb-4 text-sm text-gray-600"><Loader2 size={16} className="animate-spin inline-block mr-2" aria-hidden="true" />Cargando…</div>}
        {!loading && recursos.filter(r => r.tipo !== "MATERIAL").length === 0 && !error && (
          <div className="px-4 pb-4"><EmptyState icon={FileText} title="Todavía no hay recursos publicados para esta asignación." /></div>
        )}
        {!loading && recursos.some(r => r.tipo !== "MATERIAL") && (
          <ul className="divide-y divide-gray-100">
            {recursos.filter(r => r.tipo !== "MATERIAL").map(r => (
              <li key={r.idRecurso} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1A1A1A] truncate">{r.nombre}</p>
                  <p className="text-[11px] text-gray-500">
                    {r.tipo === "SILABO" ? "Sílabo" : r.tipo === "FORMATO" ? "Formato" : "Link de clase"}
                    {" · "}{new Date(r.creadoEn).toLocaleDateString("es-EC", { day:"2-digit", month:"short", year:"numeric" })}
                  </p>
                  <p className="text-[11px] text-gray-500">{r.materia} · {r.paralelo} · {r.docente}</p>
                  {r.tipo !== "LINK_CLASE" && (
                    <p className="text-[11px] text-gray-500 truncate">{r.archivoNombreOriginal ?? r.nombre} · {r.archivoMimeType ?? "Tipo no disponible"} · {tamanoArchivo(r.archivoTamanoBytes)}</p>
                  )}
                </div>
                {r.tipo === "LINK_CLASE" && r.urlExterna ? (
                  <a href={r.urlExterna} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#2E75B6] hover:underline flex-shrink-0">
                    <ExternalLink size={12} aria-hidden="true" />Abrir
                  </a>
                ) : (
                  <button type="button" onClick={() => descargar(r.idRecurso)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#2E75B6] hover:underline flex-shrink-0 focus:outline-none">
                    <Download size={12} aria-hidden="true" />Descargar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>

    <div>
      <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-3">Material de la semana</p>
      <MaterialSemanalPanel idAsignacion={idAsignacion} materiales={recursos.filter(r => r.tipo === "MATERIAL")}
        onChanged={cargar} toast={toast} />
    </div>
    </div>
  );
}

// ── Búsqueda avanzada (estudiante, curso, materia, parcial) ────────────────
function BusquedaCalificaciones({ asignaciones, toast }: {
  asignaciones: AsignacionOpcion[]; toast: ReturnType<typeof useToast>;
}) {
  const dedupe = (items: { id: number; label: string }[]): { id: number; label: string }[] => {
    const seen = new Map<number, string>();
    items.forEach(i => { if (!seen.has(i.id)) seen.set(i.id, i.label); });
    return Array.from(seen, ([id, label]) => ({ id, label }));
  };
  const paralelosOp = dedupe(asignaciones.map(a => ({ id: a.idParalelo, label: a.paralelo })));
  const materiasOp = dedupe(asignaciones.map(a => ({ id: a.idMateria, label: a.materia })));

  const [idParalelo, setIdParalelo] = useState<number | "">("");
  const [idMateria, setIdMateria] = useState<number | "">("");
  const [parcial, setParcial] = useState<number | "">("");
  const [queryEstudiante, setQueryEstudiante] = useState("");
  const [estudianteSel, setEstudianteSel] = useState<EstudianteConParalelo | null>(null);
  const resultadosEstudianteApi = useDebouncedSearch(queryEstudiante, estudiantesApi.buscar);
  const resultadosEstudiante = estudianteSel ? [] : resultadosEstudianteApi;

  const [resultados, setResultados] = useState<NotaBusquedaResponse[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscado, setBuscado] = useState(false);
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null);
  const [orden, setOrden] = useState<{ campo: "estudiante" | "promedio"; asc: boolean }>({ campo: "estudiante", asc: true });
  const [pagina, setPagina] = useState(1);

  const buscar = async () => {
    setBuscando(true);
    setBuscado(true);
    try {
      const r = await calificacionesApi.buscar({
        idEstudiante: estudianteSel?.id,
        idParalelo: idParalelo || undefined,
        idMateria: idMateria || undefined,
        parcial: parcial || undefined,
      });
      setResultados(r);
      setPagina(1);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo completar la búsqueda.");
    } finally {
      setBuscando(false);
    }
  };

  const [generandoPapeletaId, setGenerandoPapeletaId] = useState<number | null>(null);

  const generarPapeleta = async (r: NotaBusquedaResponse) => {
    setGenerandoPapeletaId(r.idCalificacion);
    try {
      const blob = await calificacionesApi.papeleta(r.idEstudiante);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `papeleta-${r.estudiante.replace(/\s+/g, "-").toLowerCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo generar la papeleta.");
    } finally {
      setGenerandoPapeletaId(null);
    }
  };

  const eliminar = async (idCalificacion: number) => {
    if (confirmandoId !== idCalificacion) {
      setConfirmandoId(idCalificacion);
      setTimeout(() => setConfirmandoId(p => p === idCalificacion ? null : p), 4000);
      return;
    }
    try {
      await calificacionesApi.eliminar(idCalificacion);
      setResultados(p => p.filter(r => r.idCalificacion !== idCalificacion));
      toast.success("Calificación eliminada correctamente");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo eliminar la calificación.");
    } finally {
      setConfirmandoId(null);
    }
  };

  const filas = [...resultados].sort((a, b) => {
    const dir = orden.asc ? 1 : -1;
    if (orden.campo === "estudiante") return a.estudiante.localeCompare(b.estudiante) * dir;
    return (a.promedio - b.promedio) * dir;
  });
  const totalPaginas = Math.max(1, Math.ceil(filas.length / FILAS_POR_PAGINA));
  const filasPagina = filas.slice((pagina - 1) * FILAS_POR_PAGINA, pagina * FILAS_POR_PAGINA);
  const ordenarPor = (campo: "estudiante" | "promedio") =>
    setOrden(o => o.campo === campo ? { campo, asc: !o.asc } : { campo, asc: true });

  const selectCls = "border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6] bg-white";

  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
          <div className="flex flex-col gap-1 relative">
            <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Estudiante</label>
            <input value={estudianteSel ? estudianteSel.nombreCompleto : queryEstudiante}
              onChange={e => { setEstudianteSel(null); setQueryEstudiante(e.target.value); }}
              placeholder="Buscar por nombre…" className={selectCls} />
            {resultadosEstudiante.length > 0 && !estudianteSel && (
              <ul className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {resultadosEstudiante.map(r => (
                  <li key={r.id}>
                    <button onClick={() => setEstudianteSel(r)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#EAF2FB]">{r.nombreCompleto}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Curso</label>
            <select value={idParalelo} onChange={e => setIdParalelo(e.target.value ? Number(e.target.value) : "")} className={selectCls}>
              <option value="">Todos</option>
              {paralelosOp.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Materia</label>
            <select value={idMateria} onChange={e => setIdMateria(e.target.value ? Number(e.target.value) : "")} className={selectCls}>
              <option value="">Todas</option>
              {materiasOp.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Parcial</label>
            <select value={parcial} onChange={e => setParcial(e.target.value ? Number(e.target.value) : "")} className={selectCls}>
              <option value="">Todos</option>
              {[1,2,3].map(p => <option key={p} value={p}>Parcial {p}</option>)}
            </select>
          </div>
          <Btn onClick={buscar} disabled={buscando}>
            {buscando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Search size={14} aria-hidden="true" />}
            Buscar
          </Btn>
        </div>
      </div>

      {!buscando && buscado && filas.length === 0 && (
        <EmptyState icon={Search} title="No existen calificaciones para los filtros seleccionados." />
      )}
      {!buscado && (
        <EmptyState icon={Search} title="Defina al menos un filtro y presione Buscar." />
      )}

      {filas.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Resultados de búsqueda avanzada de calificaciones</caption>
            <thead>
              <tr className="bg-[#F5F7FA] border-b border-gray-200">
                <th scope="col" aria-sort={orden.campo === "estudiante" ? (orden.asc ? "ascending" : "descending") : "none"}
                  className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  <button type="button" onClick={() => ordenarPor("estudiante")}
                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E75B6]/40 rounded">
                    Estudiante {orden.campo === "estudiante" && (orden.asc ? "▲" : "▼")}
                  </button>
                </th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Curso</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Materia</th>
                <th scope="col" className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Parcial</th>
                <th scope="col" aria-sort={orden.campo === "promedio" ? (orden.asc ? "ascending" : "descending") : "none"}
                  className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  <button type="button" onClick={() => ordenarPor("promedio")}
                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E75B6]/40 rounded">
                    Promedio {orden.campo === "promedio" && (orden.asc ? "▲" : "▼")}
                  </button>
                </th>
                <th scope="col" className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filasPagina.map((r, idx) => (
                <tr key={r.idCalificacion} className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]"}`}>
                  <td className="px-4 py-3 font-medium text-[#1A1A1A] whitespace-nowrap">{r.estudiante}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.curso}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.materia}</td>
                  <td className="px-4 py-3 text-center">{r.parcial}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center justify-center w-14 h-7 rounded-lg text-sm font-bold
                      ${r.enRiesgo ? "bg-red-100 text-[#C62828]" : "bg-[#EAF2FB] text-[#1F4E79]"}`}>{r.promedio}</span>
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-2">
                      <button type="button" onClick={() => generarPapeleta(r)} disabled={generandoPapeletaId === r.idCalificacion}
                        aria-label={`Generar papeleta de ${r.estudiante}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#2E75B6] hover:underline focus:outline-none disabled:opacity-50">
                        {generandoPapeletaId === r.idCalificacion
                          ? <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                          : <FileDown size={12} aria-hidden="true" />}
                        Generar Papeleta
                      </button>
                      <button type="button" onClick={() => eliminar(r.idCalificacion)}
                        aria-label={confirmandoId === r.idCalificacion ? `Confirmar eliminación de la calificación de ${r.estudiante}` : `Eliminar calificación de ${r.estudiante}`}
                        aria-live="polite"
                        className={`text-xs font-medium px-2 py-1 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C62828]/40
                          ${confirmandoId === r.idCalificacion ? "bg-[#C62828] text-white" : "text-[#C62828] hover:bg-red-50"}`}>
                        {confirmandoId === r.idCalificacion ? "¿Confirmar?" : "Eliminar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {totalPaginas > 1 && (
            <div className="px-4 py-3 bg-[#F5F7FA] border-t border-gray-200 flex items-center justify-end gap-2 text-xs text-gray-600">
              <button type="button" aria-label="Página anterior" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}
                className="px-2 py-1 rounded border border-gray-300 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E75B6]/40"><span aria-hidden="true">‹</span></button>
              <span aria-live="polite">Página {pagina} de {totalPaginas}</span>
              <button type="button" aria-label="Página siguiente" disabled={pagina >= totalPaginas} onClick={() => setPagina(p => p + 1)}
                className="px-2 py-1 rounded border border-gray-300 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E75B6]/40"><span aria-hidden="true">›</span></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
