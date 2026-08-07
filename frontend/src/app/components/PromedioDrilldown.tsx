import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AlertCircle, FileDown, Loader2 } from "lucide-react";
import { ApiError } from "../../api/client";
import { dashboard as dashboardApi, type PromedioAgrupado, type PromedioDetalle, type TendenciaAnual } from "../../api/sagab";
import { EmptyState } from "./EmptyState";
import { Btn } from "./Btn";
import { Modal } from "./Modal";
import { barColor } from "../helpers";

type Dimension = "porCurso" | "porParalelo" | "porMateria" | "porAnioLectivo";

const TABS: { id: Dimension; label: string }[] = [
  { id: "porCurso", label: "Por curso" },
  { id: "porParalelo", label: "Por paralelo" },
  { id: "porMateria", label: "Por materia" },
  { id: "porAnioLectivo", label: "Tendencia por año" },
];

const PIE_COLORS = ["#2E75B6", "#2E7D32", "#C62828", "#E4A11B", "#7C4DFF", "#00897B", "#D81B60", "#5D4037"];

export function PromedioDrilldown({ onClose }: { onClose: () => void }) {
  const [detalle, setDetalle] = useState<PromedioDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [tab, setTab] = useState<Dimension>("porCurso");

  useEffect(() => {
    dashboardApi.promedio()
      .then(setDetalle)
      .catch(e => setErrorApi(e instanceof ApiError ? e.message : "No se pudo cargar el detalle de promedios."))
      .finally(() => setLoading(false));
  }, []);

  const esTendencia = tab === "porAnioLectivo";
  const tendencia: TendenciaAnual[] = detalle?.porAnioLectivo ?? [];
  const filas: PromedioAgrupado[] = esTendencia ? [] : (detalle?.[tab] ?? []);

  const totalCalificaciones = useMemo(() => filas.reduce((s, f) => s + f.totalCalificaciones, 0), [filas]);

  /** Agrupa la tendencia (ya ordenada por año desc desde el backend) por año lectivo,
   * preservando el orden — cada año lista sus cursos/paralelos con el promedio obtenido. */
  const tendenciaPorAnio = useMemo(() => {
    const mapa = new Map<string, TendenciaAnual[]>();
    tendencia.forEach(t => {
      const lista = mapa.get(t.anioLectivo) ?? [];
      lista.push(t);
      mapa.set(t.anioLectivo, lista);
    });
    return [...mapa.entries()];
  }, [tendencia]);

  const exportarPdf = async () => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"), import("jspdf-autotable"),
    ]);
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Promedio institucional", 14, 15);
    doc.setFontSize(9);
    const etiquetaTab = TABS.find(t => t.id === tab)?.label ?? "";
    doc.text(`${etiquetaTab} — generado el ${new Date().toLocaleDateString("es-EC")}`, 14, 21);
    if (detalle?.promedioInstitucional != null) {
      doc.text(`Promedio institucional general: ${detalle.promedioInstitucional.toFixed(2)}`, 14, 27);
    }
    autoTable(doc, esTendencia ? {
      startY: 32,
      head: [["Año lectivo", "Curso", "Paralelo", "Promedio", "Calificaciones"]],
      body: tendencia.map(t => [t.anioLectivo, t.curso, t.paralelo, t.promedio.toFixed(2), String(t.totalCalificaciones)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [31, 78, 121] },
    } : {
      startY: 32,
      head: [["Grupo", "Promedio", "Calificaciones"]],
      body: filas.map(f => [f.etiqueta, f.promedio.toFixed(2), String(f.totalCalificaciones)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [31, 78, 121] },
    });
    doc.save(`promedio-institucional-${tab}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const hayDatos = esTendencia ? tendencia.length > 0 : filas.length > 0;

  return (
    <Modal title="Promedio institucional" onClose={onClose} size="xl">
      <div className="space-y-4">
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

        {!loading && detalle && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Dimensión del promedio">
                {TABS.map(t => (
                  <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      tab === t.id ? "bg-[#1F4E79] text-white" : "bg-[#F5F7FA] text-gray-600 hover:bg-[#EAF2FB]"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <Btn variant="secondary" size="sm" onClick={exportarPdf} disabled={!hayDatos}>
                <FileDown size={13} aria-hidden="true" />Exportar PDF
              </Btn>
            </div>

            {detalle.promedioInstitucional != null && (
              <p className="text-xs text-gray-600">
                Promedio institucional general: <span className="font-semibold text-[#1A1A1A]">{detalle.promedioInstitucional.toFixed(2)}</span>
              </p>
            )}

            {!hayDatos && (
              <EmptyState icon={AlertCircle} title="No hay calificaciones para esta agrupación." />
            )}

            {esTendencia && hayDatos && (
              <div className="space-y-3">
                {tendenciaPorAnio.map(([anio, filasAnio]) => (
                  <div key={anio} className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm font-semibold text-[#1A1A1A] mb-3">{anio}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {filasAnio.map(f => (
                        <div key={`${f.curso}-${f.paralelo}`}
                          className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-[#FAFBFC] px-3 py-2">
                          <span className="text-sm text-gray-700">{f.curso} {f.paralelo}</span>
                          <span className="text-sm font-mono font-semibold" style={{ color: barColor(f.promedio) }}>
                            {f.promedio.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!esTendencia && hayDatos && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-3">Gráfico de barras</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={filas} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" vertical={false} />
                      <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false}
                        angle={-20} textAnchor="end" height={50} interval={0} />
                      <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: number) => v.toFixed(2)} cursor={{ fill: "#F5F7FA" }} />
                      <Bar dataKey="promedio" radius={[4, 4, 0, 0]}>
                        {filas.map((f, i) => <Cell key={i} fill={barColor(f.promedio)} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-3">
                    Gráfico circular — participación en el total de calificaciones
                  </p>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={filas} dataKey="totalCalificaciones" nameKey="etiqueta" cx="50%" cy="50%" outerRadius={80}
                        label={f => `${f.etiqueta} (${((f.totalCalificaciones / totalCalificaciones) * 100).toFixed(0)}%)`}>
                        {filas.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => `${v} calificaciones`} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {!esTendencia && filas.length > 0 && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F5F7FA]">
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Grupo</th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Promedio</th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Calificaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((f, idx) => (
                        <tr key={f.etiqueta} className={`border-t border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]"}`}>
                          <td className="px-4 py-2.5 font-medium text-[#1A1A1A]">{f.etiqueta}</td>
                          <td className="px-4 py-2.5 text-right font-mono" style={{ color: barColor(f.promedio) }}>{f.promedio.toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-right text-gray-600">{f.totalCalificaciones}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
