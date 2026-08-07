import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, AlertTriangle, ArrowLeft, BookOpen, CheckCircle2, Clock, Download, ExternalLink, File, FileArchive,
  FileSpreadsheet, FileText, FileUp as FileUpIcon, Film, Image as ImageIcon, Link2, Loader2, Music, Search, Send, Video,
} from "lucide-react";
import { ApiError } from "../../api/client";
import {
  materias as materiasApi, recursosAcademicos as recursosApi, tareas as tareasApi,
  type AdjuntoTareaResponse, type MateriaEstudianteResponse, type RecursoAcademicoResponse, type EntregaResponse,
} from "../../api/sagab";
import { EmptyState } from "../components/EmptyState";
import { Badge, type BadgeVariant } from "../components/Badge";
import { Btn } from "../components/Btn";
import { FileUpload } from "../components/FileUpload";
import { useToast } from "../components/Toast";

type Vista = "grid" | "detalle" | "entrega";
type Pestaña = "info" | 1 | 2 | 3;

const ESTADO_INFO: Record<string, { v: BadgeVariant; label: string }> = {
  PENDIENTE: { v: "info", label: "Pendiente" },
  ENTREGADO: { v: "warning", label: "Entregado" },
  REVISADO: { v: "success", label: "Revisado" },
  ATRASADO: { v: "error", label: "Atrasado" },
};

/** "Atrasado" es solo una variante visual (no un estado de base de datos): sigue PENDIENTE pero ya venció. */
function estadoVisual(e: EntregaResponse): string {
  return e.estado === "PENDIENTE" && new Date(e.fechaLimite) < new Date() ? "ATRASADO" : e.estado;
}

const ICONO_RECURSO: Record<string, React.ElementType> = {
  SILABO: FileText, FORMATO: FileUpIcon, LINK_CLASE: Video,
};
const LABEL_RECURSO: Record<string, string> = {
  SILABO: "Sílabo", FORMATO: "Formatos de presentación", LINK_CLASE: "Link de conexión",
};

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleString("es-EC", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Tiempo restante o transcurrido respecto a una fecha límite, en texto legible. */
function tiempoRelativo(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const futuro = diffMs >= 0;
  const horas = Math.abs(diffMs) / 3_600_000;
  const valor = horas < 24 ? `${Math.max(1, Math.round(horas))} h` : `${Math.round(horas / 24)} d`;
  return futuro ? `Faltan ${valor}` : `Hace ${valor}`;
}

export function MisMateriasView({ idEstudiante }: { idEstudiante: number }) {
  const toast = useToast();
  const [vista, setVista] = useState<Vista>("grid");
  const [materiasList, setMateriasList] = useState<MateriaEstudianteResponse[]>([]);
  const [entregas, setEntregas] = useState<EntregaResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const [materiaSel, setMateriaSel] = useState<MateriaEstudianteResponse | null>(null);
  const [pestaña, setPestaña] = useState<Pestaña>("info");
  const [entregaSel, setEntregaSel] = useState<EntregaResponse | null>(null);

  const cargar = () => {
    setLoading(true);
    setErrorApi(null);
    Promise.all([materiasApi.porEstudiante(idEstudiante), tareasApi.misEntregas(idEstudiante)])
      .then(([m, e]) => { setMateriasList(m); setEntregas(e); })
      .catch(err => setErrorApi(err instanceof ApiError ? err.message : "No se pudo cargar la información académica."))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(cargar, [idEstudiante]);

  const materiasFiltradas = useMemo(
    () => materiasList.filter(m => m.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())),
    [materiasList, busqueda]);

  const entregasDeLaMateria = useMemo(
    () => (materiaSel ? entregas.filter(e => e.materia === materiaSel.nombre) : []),
    [entregas, materiaSel]);

  const abrirMateria = (m: MateriaEstudianteResponse) => { setMateriaSel(m); setPestaña("info"); setVista("detalle"); };
  const volverAlGrid = () => { setVista("grid"); setMateriaSel(null); };
  const abrirEntrega = (e: EntregaResponse) => { setEntregaSel(e); setVista("entrega"); };
  const volverAlDetalle = (entregaActualizada?: EntregaResponse) => {
    if (entregaActualizada) {
      setEntregas(prev => prev.map(e => e.idEntrega === entregaActualizada.idEntrega ? entregaActualizada : e));
    }
    setVista("detalle");
    setEntregaSel(null);
  };

  if (loading) {
    return <div className="text-center text-sm text-gray-600 py-8"><Loader2 size={16} className="animate-spin inline-block mr-2" aria-hidden="true" />Cargando…</div>;
  }
  if (errorApi) {
    return (
      <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
        <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />{errorApi}
      </div>
    );
  }

  if (vista === "entrega" && entregaSel) {
    return <DetalleEntrega entrega={entregaSel} idEstudiante={idEstudiante} toast={toast} onVolver={volverAlDetalle} />;
  }

  if (vista === "detalle" && materiaSel) {
    return (
      <DetalleMateria materia={materiaSel} entregas={entregasDeLaMateria} idEstudiante={idEstudiante}
        pestaña={pestaña} setPestaña={setPestaña} onVolver={volverAlGrid} onAbrirEntrega={abrirEntrega} toast={toast} />
    );
  }

  // ── Grid de materias ──────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar materia por nombre"
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
      </div>

      {materiasList.length === 0 ? (
        <EmptyState icon={BookOpen} title="Sin materias registradas para el período académico vigente." />
      ) : materiasFiltradas.length === 0 ? (
        <EmptyState icon={Search} title="Ninguna materia coincide con la búsqueda." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {materiasFiltradas.map(m => (
            <button key={m.idAsignacion} type="button" onClick={() => abrirMateria(m)}
              className="text-left bg-white rounded-2xl border border-gray-200 shadow-sm p-4 hover:border-[#2E75B6]/40 hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E75B6]/40">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{m.codigo}{m.area ? ` · ${m.area}` : ""}</p>
              <p className="text-sm font-semibold text-[#1A1A1A] mt-1 leading-snug">{m.nombre}</p>
              <p className="text-xs text-gray-600 mt-1.5">{m.docente}</p>
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-gray-600 mb-1">
                  <span>Avance de deberes</span><span className="font-semibold">{m.porcentajeAvance}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#2E75B6]" style={{ width: `${m.porcentajeAvance}%`, transition: "width 0.4s ease" }} />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Detalle de materia: pestañas Información Académica / Parcial 1-2-3 ──
function DetalleMateria({ materia, entregas, idEstudiante, pestaña, setPestaña, onVolver, onAbrirEntrega, toast }: {
  materia: MateriaEstudianteResponse; entregas: EntregaResponse[]; idEstudiante: number;
  pestaña: Pestaña; setPestaña: (p: Pestaña) => void; onVolver: () => void;
  onAbrirEntrega: (e: EntregaResponse) => void; toast: ReturnType<typeof useToast>;
}) {
  const pestañas: { id: Pestaña; label: string }[] = [
    { id: "info", label: "Información Académica" },
    { id: 1, label: "Primer Parcial" },
    { id: 2, label: "Segundo Parcial" },
    { id: 3, label: "Tercer Parcial" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <button type="button" onClick={onVolver}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2E75B6] hover:underline focus:outline-none mb-2">
          <ArrowLeft size={13} aria-hidden="true" />Volver a mis materias
        </button>
        <h2 className="text-lg font-semibold text-[#1A1A1A]">{materia.nombre}</h2>
        <p className="text-xs text-gray-600">{materia.codigo} · {materia.docente}</p>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-gray-200" role="tablist" aria-label="Detalle de la materia">
        {pestañas.map(p => (
          <button key={p.id} type="button" role="tab" aria-selected={pestaña === p.id} onClick={() => setPestaña(p.id)}
            className={`px-3.5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E75B6]/40
              ${pestaña === p.id ? "border-[#2E75B6] text-[#1F4E79]" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {p.label}
          </button>
        ))}
      </div>

      {pestaña === "info"
        ? <InformacionAcademica idAsignacion={materia.idAsignacion} idEstudiante={idEstudiante} toast={toast} />
        : <ListaDeberesParcial entregas={entregas.filter(e => e.parcial === pestaña)} onAbrir={onAbrirEntrega} />}
    </div>
  );
}

function InformacionAcademica({ idAsignacion, idEstudiante, toast }: {
  idAsignacion: number; idEstudiante: number; toast: ReturnType<typeof useToast>;
}) {
  const [recursos, setRecursos] = useState<RecursoAcademicoResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRecursos(null);
    setError(null);
    recursosApi.porAsignacion(idAsignacion, idEstudiante)
      .then(setRecursos)
      .catch(e => setError(e instanceof ApiError ? e.message : "No se pudo cargar la información académica."));
  }, [idAsignacion, idEstudiante]);

  const descargar = async (idRecurso: number) => {
    try {
      const { url } = await recursosApi.urlDescarga(idRecurso, idEstudiante);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo abrir el archivo.");
    }
  };

  if (error) {
    return (
      <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
        <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />{error}
      </div>
    );
  }
  if (recursos === null) {
    return <div className="text-center text-sm text-gray-600 py-6"><Loader2 size={15} className="animate-spin inline-block mr-2" aria-hidden="true" />Cargando…</div>;
  }

  const grupos = (["SILABO", "FORMATO", "LINK_CLASE"] as const).map(tipo => ({
    tipo, label: LABEL_RECURSO[tipo], Icon: ICONO_RECURSO[tipo],
    items: recursos.filter(r => r.tipo === tipo),
  }));
  const materiales = recursos.filter(r => r.tipo === "MATERIAL");

  return (
    <div className="space-y-5">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {grupos.map(g => (
        <div key={g.tipo} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <g.Icon size={15} className="text-[#2E75B6]" aria-hidden="true" />
            <p className="text-sm font-semibold text-[#1A1A1A]">{g.label}</p>
          </div>
          {g.items.length === 0 ? (
            <p className="text-xs text-gray-500">Aún no publicado por el docente.</p>
          ) : (
            <ul className="space-y-2">
              {g.items.map(r => (
                <li key={r.idRecurso}>
                  {r.tipo === "LINK_CLASE" ? (
                    <a href={r.urlExterna ?? undefined} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-[#2E75B6] hover:underline">
                      <Link2 size={13} aria-hidden="true" /><span className="truncate">{r.nombre}</span>
                    </a>
                  ) : (
                    <button type="button" onClick={() => descargar(r.idRecurso)}
                      className="w-full text-left flex items-center gap-1.5 text-sm text-[#2E75B6] hover:underline focus:outline-none">
                      <FileText size={13} className="flex-shrink-0" aria-hidden="true" /><span className="truncate">{r.nombre}</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>

    {materiales.length > 0 && <MaterialSemanalLectura materiales={materiales} idEstudiante={idEstudiante} toast={toast} />}
    </div>
  );
}

function iconoDeMime(mime: string | null): React.ElementType {
  if (!mime) return Link2;
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.startsWith("video/")) return Film;
  if (mime.startsWith("audio/")) return Music;
  if (mime.includes("spreadsheet") || mime.includes("excel")) return FileSpreadsheet;
  if (mime.includes("zip") || mime.includes("rar")) return FileArchive;
  if (mime.includes("pdf") || mime.includes("word") || mime.includes("presentation")) return FileText;
  return File;
}

/** Material de clase organizado por semana — solo lectura (ver/descargar), lado del estudiante. */
function MaterialSemanalLectura({ materiales, idEstudiante, toast }: {
  materiales: RecursoAcademicoResponse[]; idEstudiante: number; toast: ReturnType<typeof useToast>;
}) {
  const porSemana = useMemo(() => {
    const grupos = new Map<number | "sin-semana", RecursoAcademicoResponse[]>();
    for (const m of materiales) {
      const clave = m.semana ?? "sin-semana";
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave)!.push(m);
    }
    return [...grupos.entries()].sort((a, b) => {
      if (a[0] === "sin-semana") return 1;
      if (b[0] === "sin-semana") return -1;
      return (a[0] as number) - (b[0] as number);
    });
  }, [materiales]);

  const abrir = async (r: RecursoAcademicoResponse) => {
    if (r.tipo === "LINK_CLASE" && r.urlExterna) {
      window.open(r.urlExterna, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const { url } = await recursosApi.urlDescarga(r.idRecurso, idEstudiante);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo abrir el archivo.");
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[#1A1A1A]">Material de clase</p>
      {porSemana.map(([clave, items]) => (
        <div key={clave} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs font-semibold text-[#1F4E79] mb-2">{clave === "sin-semana" ? "Sin semana asignada" : `Semana ${clave}`}</p>
          <ul className="space-y-2">
            {items.map(r => {
              const Icono = iconoDeMime(r.archivoMimeType);
              return (
                <li key={r.idRecurso}>
                  <button type="button" onClick={() => abrir(r)}
                    className="w-full text-left flex items-start gap-2 text-sm text-[#2E75B6] hover:underline focus:outline-none">
                    {r.tipo === "LINK_CLASE" ? <ExternalLink size={13} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
                      : <Icono size={13} className="flex-shrink-0 mt-0.5" aria-hidden="true" />}
                    <span className="min-w-0">
                      <span className="block truncate">{r.nombre}</span>
                      {r.descripcion && <span className="block text-xs text-gray-500 no-underline">{r.descripcion}</span>}
                    </span>
                    {r.tipo !== "LINK_CLASE" && <Download size={12} className="flex-shrink-0 mt-1 text-gray-400" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ListaDeberesParcial({ entregas, onAbrir }: { entregas: EntregaResponse[]; onAbrir: (e: EntregaResponse) => void }) {
  if (entregas.length === 0) {
    return <EmptyState icon={FileUpIcon} title="Sin deberes publicados en este parcial." />;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {entregas.map(e => {
        const info = ESTADO_INFO[estadoVisual(e)];
        return (
          <button key={e.idEntrega} type="button" onClick={() => onAbrir(e)}
            className="text-left bg-white rounded-2xl border border-gray-200 shadow-sm p-4 hover:border-[#2E75B6]/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E75B6]/40">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-sm font-semibold text-[#1A1A1A]">{e.tituloTarea}</p>
              <Badge v={info.v}>{info.label}</Badge>
            </div>
            <p className="text-[11px] text-gray-500 flex items-center gap-1">
              <Clock size={11} aria-hidden="true" />Vence {fmtFecha(e.fechaLimite)}
            </p>
            {e.estado === "REVISADO" && e.nota != null && (
              <p className="text-xs font-semibold text-[#2E7D32] mt-2">Nota: {e.nota}/10</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Detalle de una entrega ───────────────────────────────────────────────
function DetalleEntrega({ entrega, idEstudiante, toast, onVolver }: {
  entrega: EntregaResponse; idEstudiante: number; toast: ReturnType<typeof useToast>;
  onVolver: (entregaActualizada?: EntregaResponse) => void;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [entregaActual, setEntregaActual] = useState(entrega);
  const [adjuntos, setAdjuntos] = useState<AdjuntoTareaResponse[]>([]);

  const estado = estadoVisual(entregaActual);
  const info = ESTADO_INFO[estado];
  // La fecha límite cierra tanto la primera entrega como cualquier edición posterior — ya
  // entregado o no, después de este momento la entrega queda fija.
  const pasadoLimite = new Date(entregaActual.fechaLimite) < new Date();

  useEffect(() => {
    tareasApi.adjuntosDeTarea(entregaActual.idTarea, idEstudiante).then(setAdjuntos).catch(() => setAdjuntos([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entregaActual.idTarea]);

  const enviar = async () => {
    if (!archivo) return;
    setEnviando(true);
    try {
      const actualizada = await tareasApi.subirEntrega(entregaActual.idTarea, idEstudiante, archivo);
      toast.success(entregaActual.estado === "PENDIENTE" ? "Deber entregado correctamente" : "Entrega actualizada correctamente");
      setEntregaActual(actualizada);
      setArchivo(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo subir el archivo.");
    } finally {
      setEnviando(false);
    }
  };

  const descargar = async () => {
    try {
      const { url } = await tareasApi.urlDescarga(entregaActual.idEntrega);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo generar el enlace de descarga.");
    }
  };

  const descargarAdjunto = async (idAdjunto: number) => {
    try {
      const { url } = await tareasApi.urlDescargaAdjunto(idAdjunto, idEstudiante);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo generar el enlace de descarga.");
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <button type="button" onClick={() => onVolver(entregaActual)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2E75B6] hover:underline focus:outline-none">
        <ArrowLeft size={13} aria-hidden="true" />Volver a la materia
      </button>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{entregaActual.materia} · {entregaActual.curso}</p>
        <div className="flex items-start justify-between gap-2 mt-0.5">
          <h2 className="text-lg font-semibold text-[#1A1A1A]">{entregaActual.tituloTarea}</h2>
          <span className="text-xs font-semibold text-gray-500 flex-shrink-0 mt-1">{entregaActual.puntaje} pts</span>
        </div>

        {adjuntos.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Material de apoyo</p>
            <ul className="space-y-1.5">
              {adjuntos.map(a => (
                <li key={a.idAdjunto}>
                  <button type="button" onClick={() => descargarAdjunto(a.idAdjunto)}
                    className="flex items-center gap-1.5 text-sm text-[#2E75B6] hover:underline focus:outline-none">
                    <FileText size={13} className="flex-shrink-0" aria-hidden="true" /><span className="truncate">{a.nombre}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Estado de la entrega</p>
          <div className="flex items-center gap-2 mb-1">
            <Badge v={info.v}>{info.label}</Badge>
            <span className="text-xs text-gray-500">
              {entregaActual.fechaEntrega ? `Entregado ${fmtFecha(entregaActual.fechaEntrega)}` : `Vence ${fmtFecha(entregaActual.fechaLimite)} · ${tiempoRelativo(entregaActual.fechaLimite)}`}
            </span>
          </div>

          {entregaActual.archivoNombreOriginal && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
              <FileText size={14} className="text-gray-500 flex-shrink-0" aria-hidden="true" />
              <span className="flex-1 truncate text-[#1A1A1A]">{entregaActual.archivoNombreOriginal}</span>
              <button type="button" onClick={descargar}
                className="flex-shrink-0 text-xs font-medium text-[#2E75B6] hover:underline focus:outline-none">
                Descargar
              </button>
            </div>
          )}

          {pasadoLimite ? (
            entregaActual.estado === "PENDIENTE" && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
                <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                La fecha límite ya pasó. Contacte al docente si necesita entregar de todas formas.
              </div>
            )
          ) : (
            <div className="mt-3 space-y-2">
              {entregaActual.estado !== "PENDIENTE" && (
                <p className="text-xs text-gray-500">Puede reemplazar el archivo mientras no haya vencido la fecha límite.</p>
              )}
              <FileUpload accept=".pdf,.doc,.docx,.zip,.jpg,.jpeg,.png,.webp" maxSizeMb={15}
                onFileSelected={setArchivo} disabled={enviando}
                label={entregaActual.estado === "PENDIENTE" ? "Adjuntar tarea (PDF, Word, imagen o ZIP)" : "Reemplazar archivo (PDF, Word, imagen o ZIP)"} />
              <Btn size="sm" onClick={enviar} disabled={!archivo || enviando} className="w-full">
                {enviando ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Send size={13} aria-hidden="true" />}
                {entregaActual.estado === "PENDIENTE" ? "Entregar" : "Editar entrega"}
              </Btn>
            </div>
          )}
        </div>

        {entregaActual.estado === "REVISADO" && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Retroalimentación</p>
            {entregaActual.nota != null && (
              <p className="text-sm font-semibold text-[#2E7D32] flex items-center gap-1.5 mb-1.5">
                <CheckCircle2 size={14} aria-hidden="true" />Nota: {entregaActual.nota}/10
              </p>
            )}
            {entregaActual.observacionDocente ? (
              <p className="text-sm text-gray-700 italic">"{entregaActual.observacionDocente}"</p>
            ) : (
              <p className="text-sm text-gray-500">El docente no dejó ningún comentario.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
