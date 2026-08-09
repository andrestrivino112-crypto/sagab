import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, Download, Loader2, Search, Users } from "lucide-react";
import { ApiError } from "../../api/client";
import { estudiantes as estudiantesApi, type EstudianteMatriculado } from "../../api/sagab";
import { Btn } from "../components/Btn";
import { EmptyState } from "../components/EmptyState";
import { TopBar } from "../components/TopBar";
import { useToast } from "../components/Toast";

interface Grupo {
  clave: string;
  curso: string;
  paralelo: string;
  anioLectivo: string;
  estudiantes: EstudianteMatriculado[];
}

const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
const agrupar = (lista: EstudianteMatriculado[]): Grupo[] => {
  const grupos = new Map<string, Grupo>();
  for (const estudiante of lista) {
    const clave = `${estudiante.anioLectivo}|${estudiante.curso}|${estudiante.paralelo}`;
    const grupo = grupos.get(clave) ?? { clave, curso: estudiante.curso, paralelo: estudiante.paralelo, anioLectivo: estudiante.anioLectivo, estudiantes: [] };
    grupo.estudiantes.push(estudiante); grupos.set(clave, grupo);
  }
  return [...grupos.values()].map(grupo => ({ ...grupo, estudiantes: [...grupo.estudiantes].sort((a, b) => collator.compare(a.nombreCompleto, b.nombreCompleto)) }))
    .sort((a, b) => collator.compare(`${a.curso} ${a.paralelo}`, `${b.curso} ${b.paralelo}`));
};

export function EstudiantesMatriculadosView() {
  const navigate = useNavigate();
  const toast = useToast();
  const [lista, setLista] = useState<EstudianteMatriculado[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generando, setGenerando] = useState<string | null>(null);

  const cargar = () => {
    setLoading(true); setError(null);
    estudiantesApi.matriculados().then(setLista)
      .catch(e => setError(e instanceof ApiError ? e.message : "No se pudo cargar la nómina de estudiantes."))
      .finally(() => setLoading(false));
  };
  useEffect(cargar, []);

  const gruposCompletos = useMemo(() => agrupar(lista), [lista]);
  const gruposVisibles = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase("es");
    if (!q) return gruposCompletos;
    return gruposCompletos.map(grupo => ({ ...grupo, estudiantes: grupo.estudiantes.filter(estudiante => [
      estudiante.nombreCompleto, estudiante.codigo, estudiante.curso, estudiante.paralelo, estudiante.anioLectivo,
    ].some(valor => valor.toLocaleLowerCase("es").includes(q))) })).filter(grupo => grupo.estudiantes.length > 0);
  }, [busqueda, gruposCompletos]);

  const generarPdf = async (grupoVisible: Grupo) => {
    const grupo = gruposCompletos.find(item => item.clave === grupoVisible.clave) ?? grupoVisible;
    setGenerando(grupo.clave);
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"), import("jspdf-autotable"),
      ]);
      const doc = new jsPDF();
      doc.setFontSize(15); doc.text("Unidad Educativa Particular Giovanni Bellini", 14, 18);
      doc.setFontSize(12); doc.text("Nómina de estudiantes matriculados", 14, 27);
      doc.setFontSize(10);
      doc.text(`Año lectivo: ${grupo.anioLectivo}`, 14, 36);
      doc.text(`Curso: ${grupo.curso}    Paralelo: ${grupo.paralelo}`, 14, 43);
      doc.text(`Fecha de generación: ${new Date().toLocaleDateString("es-EC")}`, 14, 50);
      doc.text(`Total de estudiantes: ${grupo.estudiantes.length}`, 14, 57);
      autoTable(doc, {
        startY: 64,
        head: [["N.º", "Código institucional", "Estudiante"]],
        body: grupo.estudiantes.map((estudiante, indice) => [indice + 1, estudiante.codigo, estudiante.nombreCompleto]),
        styles: { fontSize: 9 }, headStyles: { fillColor: [31, 78, 121] },
      });
      const nombre = `${grupo.curso}-${grupo.paralelo}-${grupo.anioLectivo}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9-]+/g, "-");
      doc.save(`nomina-${nombre}.pdf`);
      toast.success("PDF generado correctamente");
    } catch {
      toast.error("No se pudo generar el PDF de la nómina.");
    } finally { setGenerando(null); }
  };

  const totalVisible = gruposVisibles.reduce((total, grupo) => total + grupo.estudiantes.length, 0);
  return <div>
    <TopBar title="Estudiantes matriculados" subtitle="Nómina del periodo académico activo" />
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={() => navigate("/dashboard")} className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-[#2E75B6] hover:underline"><ArrowLeft size={16} />Volver al Inicio de Secretaría</button>
        {!loading && <span className="text-sm text-gray-500">{totalVisible} de {lista.length} estudiante(s)</span>}
      </div>
      <label className="relative block"><span className="sr-only">Buscar estudiantes matriculados</span><Search size={17} className="absolute left-3 top-3 text-gray-400" /><input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre, código, curso o paralelo" className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm focus:border-[#2E75B6] focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/20" /></label>
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#C62828]"><span className="flex items-start gap-2"><AlertCircle size={16} className="mt-0.5" />{error}</span><Btn type="button" size="sm" variant="secondary" onClick={cargar}>Reintentar</Btn></div>}
      {loading ? <div role="status" className="rounded-xl border border-gray-200 bg-white py-20 text-center text-sm text-gray-500"><Loader2 size={18} className="mr-2 inline animate-spin" />Cargando estudiantes…</div>
        : !error && gruposVisibles.length === 0 ? <div className="rounded-xl border border-gray-200 bg-white p-8"><EmptyState icon={Users} title={lista.length === 0 ? "No hay estudiantes matriculados" : "No hay coincidencias"} description={lista.length === 0 ? "No existen estudiantes activos en el periodo académico vigente." : "Pruebe con otro nombre, código, curso o paralelo."} /></div>
        : <div className="space-y-5">{gruposVisibles.map(grupo => <section key={grupo.clave} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"><header className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-[#1A1A1A]">{grupo.curso} · Paralelo {grupo.paralelo}</h2><p className="text-xs text-gray-500">Año lectivo {grupo.anioLectivo} · {grupo.estudiantes.length} estudiante(s){busqueda ? " encontrados" : ""}</p></div><Btn type="button" size="sm" variant="secondary" disabled={generando === grupo.clave} onClick={() => void generarPdf(grupo)}>{generando === grupo.clave ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}Descargar PDF</Btn></header><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="text-[11px] uppercase tracking-wide text-gray-500"><tr><th className="w-16 px-4 py-2">N.º</th><th className="px-4 py-2">Código institucional</th><th className="px-4 py-2">Nombre completo</th></tr></thead><tbody className="divide-y divide-gray-100">{grupo.estudiantes.map((estudiante, indice) => <tr key={estudiante.idEstudiante} className="hover:bg-gray-50"><td className="px-4 py-3 text-gray-500">{indice + 1}</td><td className="px-4 py-3 font-medium text-[#1F4E79]">{estudiante.codigo}</td><td className="px-4 py-3 font-medium text-gray-800">{estudiante.nombreCompleto}</td></tr>)}</tbody></table></div></section>)}</div>}
    </div>
  </div>;
}
