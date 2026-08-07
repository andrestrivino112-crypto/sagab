import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Printer } from "lucide-react";
import { ApiError } from "../../api/client";
import {
  asignaciones as asignacionesApi, asistencia as asistenciaApi, paralelos as paralelosApi,
  type EstadoAsistencia, type ParaleloOpcion, type ReporteAusenciaResponse,
} from "../../api/sagab";
import type { RolSistema } from "../../api/auth";
import { Badge } from "./Badge";
import type { BadgeVariant } from "./Badge";
import { Btn } from "./Btn";
import { EmptyState } from "./EmptyState";
import { Modal } from "./Modal";

const ESTADO_CFG: Record<EstadoAsistencia, { v: BadgeVariant; label: string }> = {
  PRESENTE: { v: "success", label: "Presente" },
  AUSENCIA_JUSTIFICADA: { v: "warning", label: "Falta justificada" },
  AUSENCIA_INJUSTIFICADA: { v: "error", label: "Falta injustificada" },
  ATRASO: { v: "info", label: "Atraso" },
};

const hoy = () => new Date().toISOString().slice(0, 10);
const escaparHtml = (valor: unknown) => String(valor ?? "—")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
const ordenarParalelos = (a: ParaleloOpcion, b: ParaleloOpcion) =>
  a.nivel.localeCompare(b.nivel, "es", { numeric: true })
  || a.seccion.localeCompare(b.seccion, "es", { numeric: true });

export function AusenciasDrilldown({ onClose, rol }: { onClose: () => void; rol: RolSistema }) {
  const [filas, setFilas] = useState<ReporteAusenciaResponse[]>([]);
  const [paralelos, setParalelos] = useState<ParaleloOpcion[]>([]);
  const [cargandoParalelos, setCargandoParalelos] = useState(true);
  const [errorParalelos, setErrorParalelos] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorApi, setErrorApi] = useState<string | null>(null);

  const [desde, setDesde] = useState(hoy());
  const [hasta, setHasta] = useState(hoy());
  const [curso, setCurso] = useState("");
  const [idParalelo, setIdParalelo] = useState<number | "">("");

  useEffect(() => {
    let vigente = true;
    setCargandoParalelos(true);
    setErrorParalelos(null);

    const solicitud = rol !== "DOCENTE"
      ? paralelosApi.listar()
      : asignacionesApi.mias().then(asignaciones => {
          const unicos = new Map<number, ParaleloOpcion>();
          asignaciones.filter(a => a.periodoActivo).forEach(a => unicos.set(a.idParalelo, {
            id: a.idParalelo,
            nivel: a.nivel,
            seccion: a.seccion,
            anioLectivo: a.anioLectivo,
            etiqueta: a.paralelo,
          }));
          return [...unicos.values()];
        });

    solicitud
      .then(opciones => { if (vigente) setParalelos([...opciones].sort(ordenarParalelos)); })
      .catch(e => {
        if (vigente) setErrorParalelos(e instanceof ApiError ? e.message : "No se pudieron cargar los cursos asignados.");
      })
      .finally(() => { if (vigente) setCargandoParalelos(false); });

    return () => { vigente = false; };
  }, [rol]);

  const cargar = () => {
    setLoading(true);
    setErrorApi(null);
    asistenciaApi.reporte({ desde, hasta, idParalelo: idParalelo === "" ? undefined : idParalelo, curso: curso || undefined })
      .then(setFilas)
      .catch(e => setErrorApi(e instanceof ApiError ? e.message : "No se pudo cargar el reporte de ausencias."))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(cargar, []);

  const cursos = useMemo(() => [...new Set(paralelos.map(p => p.nivel))]
    .sort((a, b) => a.localeCompare(b, "es", { numeric: true })), [paralelos]);
  const paralelosDelCurso = useMemo(
    () => (curso ? paralelos.filter(p => p.nivel === curso) : []),
    [paralelos, curso]);

  const imprimir = () => {
    const ventana = window.open("", "_blank", "width=900,height=700");
    if (!ventana) return;
    const filasHtml = filas.map(f => `
      <tr>
        <td>${escaparHtml(f.estudiante)}</td><td>${escaparHtml(f.curso)}</td><td>${escaparHtml(f.paralelo)}</td>
        <td>${escaparHtml(f.fecha)}</td><td>${escaparHtml(ESTADO_CFG[f.estado].label)}</td>
        <td>${escaparHtml(f.justificacion)}</td><td>${escaparHtml(f.registradoPor)}</td>
      </tr>`).join("");
    ventana.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Reporte de ausencias</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #1A1A1A; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        p { font-size: 12px; color: #555; margin-top: 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        th { background: #F5F7FA; text-transform: uppercase; font-size: 10px; }
      </style></head><body>
      <h1>Reporte de ausencias</h1>
      <p>Periodo: ${escaparHtml(desde)} a ${escaparHtml(hasta)}${curso ? ` · Curso: ${escaparHtml(curso)}` : ""} — ${filas.length} registro(s)</p>
      <table><thead><tr><th>Estudiante</th><th>Curso</th><th>Paralelo</th><th>Fecha</th><th>Estado</th><th>Justificación</th><th>Registrado por</th></tr></thead>
      <tbody>${filasHtml}</tbody></table>
      </body></html>`);
    ventana.document.close();
    ventana.focus();
    ventana.print();
  };

  return (
    <Modal title="Ausencias" onClose={onClose} size="xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label htmlFor="aus-desde" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Desde</label>
            <input id="aus-desde" type="date" value={desde} onChange={e => setDesde(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
          </div>
          <div>
            <label htmlFor="aus-hasta" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Hasta</label>
            <input id="aus-hasta" type="date" value={hasta} onChange={e => setHasta(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
          </div>
          <div>
            <label htmlFor="aus-curso" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Curso</label>
            <select id="aus-curso" value={curso} disabled={cargandoParalelos || cursos.length === 0}
              onChange={e => { setCurso(e.target.value); setIdParalelo(""); }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6] bg-white disabled:bg-gray-50 disabled:text-gray-400">
              <option value="">{cargandoParalelos ? "Cargando…" : cursos.length === 0 ? "Sin cursos asignados" : "Todos"}</option>
              {cursos.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="aus-paralelo" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Paralelo</label>
            <select id="aus-paralelo" value={idParalelo} disabled={!curso || cargandoParalelos}
              onChange={e => setIdParalelo(e.target.value ? Number(e.target.value) : "")}
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6] bg-white disabled:bg-gray-50 disabled:text-gray-400">
              <option value="">{curso ? "Todos" : "Seleccione un curso"}</option>
              {paralelosDelCurso.map(p => <option key={p.id} value={p.id}>{p.seccion}</option>)}
            </select>
          </div>
        </div>

        {errorParalelos && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />{errorParalelos}
          </div>
        )}

        <div className="flex items-center justify-between">
          <Btn variant="secondary" size="sm" onClick={cargar} disabled={loading}>
            {loading ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : null}Filtrar
          </Btn>
          <Btn variant="secondary" size="sm" onClick={imprimir} disabled={filas.length === 0}>
            <Printer size={13} aria-hidden="true" />Imprimir reporte
          </Btn>
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

        {!loading && filas.length === 0 && !errorApi && (
          <EmptyState icon={AlertCircle} title="No hay faltas ni atrasos con estos filtros." />
        )}

        {!loading && filas.length > 0 && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-[50vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr className="bg-[#F5F7FA]">
                    {["Estudiante", "Curso", "Paralelo", "Fecha", "Estado", "Justificación", "Registrado por"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, idx) => (
                    <tr key={f.idAsistencia} className={`border-t border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]"}`}>
                      <td className="px-4 py-2.5 font-medium text-[#1A1A1A] whitespace-nowrap">{f.estudiante}</td>
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{f.curso}</td>
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{f.paralelo}</td>
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{f.fecha}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap"><Badge v={ESTADO_CFG[f.estado].v}>{ESTADO_CFG[f.estado].label}</Badge></td>
                      <td className="px-4 py-2.5 text-gray-600">{f.justificacion ?? "—"}</td>
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{f.registradoPor ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
