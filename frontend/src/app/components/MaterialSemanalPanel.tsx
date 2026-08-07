import { useEffect, useMemo, useState } from "react";
import {
  Download, Edit2, ExternalLink, File, FileArchive, FileSpreadsheet, FileText,
  Film, Image as ImageIcon, Link2, Loader2, Music, Send, Trash2, Upload,
} from "lucide-react";
import { ApiError } from "../../api/client";
import { recursosAcademicos as recursosApi, type RecursoAcademicoResponse } from "../../api/sagab";
import { Btn } from "./Btn";
import { EmptyState } from "./EmptyState";
import { FileUpload } from "./FileUpload";
import { Modal } from "./Modal";
import type { useToast } from "./Toast";

const ACCEPT_MATERIAL = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar,.jpg,.jpeg,.png,.webp,.gif,.mp4,.mp3";

function iconoDe(mime: string | null): React.ElementType {
  if (!mime) return Link2;
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.startsWith("video/")) return Film;
  if (mime.startsWith("audio/")) return Music;
  if (mime.includes("spreadsheet") || mime.includes("excel")) return FileSpreadsheet;
  if (mime.includes("zip") || mime.includes("rar")) return FileArchive;
  if (mime.includes("pdf") || mime.includes("word") || mime.includes("presentation")) return FileText;
  return File;
}

function tamano(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Repositorio de material de clase organizado por semana — pestaña "Recursos" del docente. */
export function MaterialSemanalPanel({ idAsignacion, materiales, onChanged, toast }: {
  idAsignacion: number;
  materiales: RecursoAcademicoResponse[];
  onChanged: () => void;
  toast: ReturnType<typeof useToast>;
}) {
  const [semana, setSemana] = useState<number | "">("");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [modoEnlace, setModoEnlace] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [urlEnlace, setUrlEnlace] = useState("");
  const [publicando, setPublicando] = useState(false);

  const [editando, setEditando] = useState<RecursoAcademicoResponse | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");
  const [editSemana, setEditSemana] = useState<number | "">("");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  const [eliminandoId, setEliminandoId] = useState<number | null>(null);

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

  const limpiarFormulario = () => {
    setNombre(""); setDescripcion(""); setArchivo(null); setUrlEnlace("");
  };

  const publicar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || (modoEnlace ? !urlEnlace.trim() : !archivo)) return;
    setPublicando(true);
    try {
      const opciones = { descripcion: descripcion.trim() || undefined, semana: semana === "" ? undefined : semana };
      if (modoEnlace) {
        await recursosApi.crearLink(idAsignacion, nombre.trim(), urlEnlace.trim(), opciones);
      } else {
        await recursosApi.subirArchivo(idAsignacion, "MATERIAL", nombre.trim(), archivo as File, opciones);
      }
      toast.success("Material publicado correctamente");
      limpiarFormulario();
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo publicar el material.");
    } finally {
      setPublicando(false);
    }
  };

  const descargar = async (r: RecursoAcademicoResponse) => {
    if (r.tipo === "LINK_CLASE" && r.urlExterna) {
      window.open(r.urlExterna, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const { url } = await recursosApi.urlDescarga(r.idRecurso);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo generar el enlace de descarga.");
    }
  };

  const abrirEdicion = (r: RecursoAcademicoResponse) => {
    setEditando(r);
    setEditNombre(r.nombre);
    setEditDescripcion(r.descripcion ?? "");
    setEditSemana(r.semana ?? "");
  };

  const guardarEdicion = async () => {
    if (!editando || !editNombre.trim()) return;
    setGuardandoEdicion(true);
    try {
      await recursosApi.editar(editando.idRecurso, editNombre.trim(), editDescripcion.trim() || undefined,
        editSemana === "" ? undefined : editSemana);
      toast.success("Material actualizado");
      setEditando(null);
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo actualizar el material.");
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const eliminar = async (r: RecursoAcademicoResponse) => {
    setEliminandoId(r.idRecurso);
    try {
      await recursosApi.eliminar(r.idRecurso);
      toast.success("Material eliminado");
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo eliminar el material.");
    } finally {
      setEliminandoId(null);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={publicar} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">Publicar material de la semana</p>
        <div className="flex gap-3">
          <div className="w-24">
            <label htmlFor="material-semana" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Semana</label>
            <input id="material-semana" type="number" min={1} max={52} value={semana}
              onChange={e => setSemana(e.target.value ? Number(e.target.value) : "")}
              placeholder="1"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
          </div>
          <div className="flex-1">
            <label htmlFor="material-nombre" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Nombre</label>
            <input id="material-nombre" value={nombre} onChange={e => setNombre(e.target.value)} required maxLength={150}
              placeholder="Ej. Guía de ejercicios — Unidad 2"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
          </div>
        </div>
        <div>
          <label htmlFor="material-descripcion" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Descripción (opcional)</label>
          <textarea id="material-descripcion" value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2} maxLength={500}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6] resize-none" />
        </div>

        <div className="flex gap-1.5 text-xs">
          <button type="button" onClick={() => setModoEnlace(false)}
            className={`px-3 py-1.5 rounded-lg font-medium ${!modoEnlace ? "bg-[#1F4E79] text-white" : "bg-[#F5F7FA] text-gray-600"}`}>Archivo</button>
          <button type="button" onClick={() => setModoEnlace(true)}
            className={`px-3 py-1.5 rounded-lg font-medium ${modoEnlace ? "bg-[#1F4E79] text-white" : "bg-[#F5F7FA] text-gray-600"}`}>Enlace</button>
        </div>

        {modoEnlace ? (
          <input type="url" value={urlEnlace} onChange={e => setUrlEnlace(e.target.value)} required placeholder="https://…"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
        ) : (
          <FileUpload accept={ACCEPT_MATERIAL} maxSizeMb={15} onFileSelected={setArchivo} disabled={publicando}
            label="PDF, Word, PowerPoint, Excel, ZIP, RAR, imagen, video o audio" />
        )}

        <Btn disabled={publicando || !nombre.trim() || (modoEnlace ? !urlEnlace.trim() : !archivo)}>
          {publicando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
          Publicar
        </Btn>
      </form>

      {materiales.length === 0 ? (
        <EmptyState icon={Upload} title="Todavía no hay material publicado para esta materia." />
      ) : (
        <div className="space-y-4">
          {porSemana.map(([clave, items]) => (
            <div key={clave} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <p className="text-xs font-semibold text-[#1F4E79] px-4 pt-3 pb-2">
                {clave === "sin-semana" ? "Sin semana asignada" : `Semana ${clave}`}
              </p>
              <ul className="divide-y divide-gray-100">
                {items.map(r => {
                  const Icono = iconoDe(r.archivoMimeType);
                  const esImagen = r.archivoMimeType?.startsWith("image/");
                  return (
                    <li key={r.idRecurso} className="px-4 py-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#EAF2FB] flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {esImagen ? <MiniaturaImagen idRecurso={r.idRecurso} nombre={r.nombre} /> : <Icono size={18} className="text-[#2E75B6]" aria-hidden="true" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#1A1A1A] truncate">{r.nombre}</p>
                        {r.descripcion && <p className="text-xs text-gray-600 truncate">{r.descripcion}</p>}
                        <p className="text-[11px] text-gray-500">
                          {r.autor} · {new Date(r.creadoEn).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" })}
                          {r.archivoTamanoBytes ? ` · ${tamano(r.archivoTamanoBytes)}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button type="button" title={r.tipo === "LINK_CLASE" ? "Abrir" : "Descargar"} onClick={() => descargar(r)}
                          className="p-1.5 rounded-md text-gray-500 hover:bg-[#EAF2FB] hover:text-[#1F4E79] focus:outline-none">
                          {r.tipo === "LINK_CLASE" ? <ExternalLink size={14} aria-hidden="true" /> : <Download size={14} aria-hidden="true" />}
                        </button>
                        <button type="button" title="Editar" onClick={() => abrirEdicion(r)}
                          className="p-1.5 rounded-md text-gray-500 hover:bg-[#EAF2FB] hover:text-[#1F4E79] focus:outline-none">
                          <Edit2 size={14} aria-hidden="true" />
                        </button>
                        <button type="button" title="Eliminar" disabled={eliminandoId === r.idRecurso} onClick={() => eliminar(r)}
                          className="p-1.5 rounded-md text-gray-500 hover:bg-red-50 hover:text-[#C62828] focus:outline-none disabled:opacity-50">
                          {eliminandoId === r.idRecurso ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {editando && (
        <Modal title={`Editar — ${editando.nombre}`} onClose={() => setEditando(null)} size="sm">
          <div className="space-y-3">
            <div>
              <label htmlFor="edit-nombre" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Nombre</label>
              <input id="edit-nombre" value={editNombre} onChange={e => setEditNombre(e.target.value)} maxLength={150}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
            </div>
            <div>
              <label htmlFor="edit-descripcion" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Descripción</label>
              <textarea id="edit-descripcion" value={editDescripcion} onChange={e => setEditDescripcion(e.target.value)} rows={2} maxLength={500}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6] resize-none" />
            </div>
            <div className="w-24">
              <label htmlFor="edit-semana" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Semana</label>
              <input id="edit-semana" type="number" min={1} max={52} value={editSemana}
                onChange={e => setEditSemana(e.target.value ? Number(e.target.value) : "")}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Btn type="button" variant="secondary" onClick={() => setEditando(null)}>Cancelar</Btn>
              <Btn type="button" onClick={guardarEdicion} disabled={guardandoEdicion || !editNombre.trim()}>
                {guardandoEdicion ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}Guardar
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Vista previa en miniatura: pide la URL prefirmada y renderiza la imagen directamente
 * (el bucket es privado — no hay generación de thumbnails en servidor, se reutiliza la
 * misma imagen a tamaño reducido). */
function MiniaturaImagen({ idRecurso, nombre }: { idRecurso: number; nombre: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let vigente = true;
    recursosApi.urlDescarga(idRecurso).then(r => { if (vigente) setUrl(r.url); }).catch(() => {});
    return () => { vigente = false; };
  }, [idRecurso]);
  if (!url) return <ImageIcon size={18} className="text-[#2E75B6]" aria-hidden="true" />;
  return <img src={url} alt={nombre} className="w-full h-full object-cover" />;
}
