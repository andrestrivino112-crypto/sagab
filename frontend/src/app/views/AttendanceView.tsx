import { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle, Clock, Loader2, Save, UserPlus, Users } from "lucide-react";
import { ApiError } from "../../api/client";
import {
  estudiantes as estudiantesApi, asistencia as asistenciaApi,
  type EstudianteResumen, type EstadoAsistencia,
} from "../../api/sagab";
import { EmptyState } from "../components/EmptyState";
import { Badge } from "../components/Badge";
import { Btn } from "../components/Btn";
import { TopBar } from "../components/TopBar";
import { useToast } from "../components/Toast";
import { useAsignaciones } from "../hooks/useAsignaciones";
import { initials } from "../helpers";
import type { AttendanceStatus, Screen } from "../types";

function AttToggle({ status, onChange, studentName }: { status: AttendanceStatus; onChange: (s: AttendanceStatus) => void; studentName: string }) {
  const opts: { id: AttendanceStatus; short: string; title: string }[] = [
    { id:"present",     short:"P",  title:"Presente" },
    { id:"justified",   short:"AJ", title:"Ausente justificada" },
    { id:"unjustified", short:"AI", title:"Ausente injustificada" },
  ];
  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5" role="group" aria-label={`Estado de asistencia de ${studentName}`}>
      {opts.map(o => (
        <button key={o.id} type="button" title={o.title} aria-label={o.title} aria-pressed={status === o.id} onClick={() => onChange(o.id)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E75B6]/50
            ${status === o.id
              ? o.id === "present"     ? "bg-[#2E7D32] text-white shadow-sm"
              : o.id === "justified"   ? "bg-amber-500 text-white shadow-sm"
              :                          "bg-[#C62828] text-white shadow-sm"
              : "text-gray-500 hover:text-gray-700"}`}>
          {o.short}
        </button>
      ))}
    </div>
  );
}

const ATT_STATUS_TO_API: Record<AttendanceStatus, EstadoAsistencia> = {
  present: "PRESENTE", justified: "AUSENCIA_JUSTIFICADA", unjustified: "AUSENCIA_INJUSTIFICADA",
};

export function AttendanceView({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const toast = useToast();
  const { opciones: asignacionesOpciones, idAsignacion, setIdAsignacion, asignacion, error: errorAsignaciones } = useAsignaciones();
  const [roster, setRoster] = useState<EstudianteResumen[]>([]);
  const [estado, setEstado] = useState<Record<number, AttendanceStatus>>({});
  const [consecutivas, setConsecutivas] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorApi, setErrorApi] = useState<string | null>(null);

  useEffect(() => {
    if (!asignacion) { setRoster([]); return; }
    setLoading(true);
    setErrorApi(null);
    Promise.all([
      estudiantesApi.porParalelo(asignacion.idParalelo),
      asistenciaApi.consecutivasPorParalelo(asignacion.idParalelo),
    ]).then(([lista, cons]) => {
      setRoster(lista);
      setConsecutivas(cons);
      setEstado(Object.fromEntries(lista.map(e => [e.id, "present" as AttendanceStatus])));
    }).catch(() => setErrorApi("No se pudieron cargar los estudiantes de esta asignación."))
      .finally(() => setLoading(false));
  }, [asignacion?.idParalelo]);

  const update = (id: number, s: AttendanceStatus) => {
    setEstado(p => ({ ...p, [id]: s }));
  };

  const counts = {
    present:     Object.values(estado).filter(s => s === "present").length,
    justified:   Object.values(estado).filter(s => s === "justified").length,
    unjustified: Object.values(estado).filter(s => s === "unjustified").length,
  };

  const guardar = async () => {
    if (!asignacion || roster.length === 0) return;
    setSaving(true);
    try {
      await asistenciaApi.registrar(asignacion.idParalelo, roster.map(e => ({
        idEstudiante: e.id,
        estado: ATT_STATUS_TO_API[estado[e.id] ?? "present"],
      })));
      toast.success("Asistencia guardada correctamente");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo guardar la asistencia.");
    } finally {
      setSaving(false);
    }
  };

  const hoy = new Date().toLocaleDateString("es-EC", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div>
      <TopBar title="Registro de Asistencia" subtitle={hoy.charAt(0).toUpperCase() + hoy.slice(1)} />
      <div className="p-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4 flex items-center gap-4 flex-wrap">
          <div className="flex flex-col gap-1 min-w-[280px]">
            <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Asignación</label>
            <select value={idAsignacion} onChange={e => setIdAsignacion(e.target.value ? Number(e.target.value) : "")}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6] bg-white">
              {asignacionesOpciones.length === 0 && <option value="">Sin asignaciones</option>}
              {asignacionesOpciones.map(a => (
                <option key={a.idAsignacion} value={a.idAsignacion}>{a.paralelo} · {a.materia}</option>
              ))}
            </select>
          </div>
          {roster.length > 0 && (
            <div className="flex items-center gap-2.5 ml-4">
              <Badge v="success"><CheckCircle size={11} aria-hidden="true" />{counts.present} Presentes</Badge>
              <Badge v="warning"><Clock size={11} aria-hidden="true" />{counts.justified} A. Justificada</Badge>
              <Badge v="error"><AlertTriangle size={11} aria-hidden="true" />{counts.unjustified} A. Injustificada</Badge>
            </div>
          )}
          <div className="ml-auto flex items-center gap-3">
            <Btn onClick={guardar} disabled={saving || roster.length === 0}>
              {saving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
              {saving ? "Guardando…" : "Guardar asistencia"}
            </Btn>
          </div>
        </div>

        {(errorApi || errorAsignaciones) && (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />{errorApi ?? errorAsignaciones}
          </div>
        )}

        {!asignacion && !loading && asignacionesOpciones.length === 0 && !errorApi && !errorAsignaciones && (
          <EmptyState icon={Users} title="No tiene asignaciones de materias registradas todavía." />
        )}

        {asignacion && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading && (
            <div className="px-4 py-8 text-center text-sm text-gray-600">
              <Loader2 size={16} className="animate-spin inline-block mr-2" aria-hidden="true" />Cargando…
            </div>
          )}
          {!loading && roster.length === 0 && (
            <div className="p-4">
              <EmptyState icon={UserPlus} title="No existen estudiantes matriculados en esta asignación."
                action={{ label: "Ir a Matrículas", onClick: () => onNavigate("matricula") }} />
            </div>
          )}
          {!loading && roster.length > 0 && (
          <>
          <div className="overflow-x-auto">
          <div className="grid grid-cols-[40px_1fr_200px_180px] gap-4 px-4 py-3 bg-[#F5F7FA] border-b border-gray-200 text-[10px] font-semibold text-gray-600 uppercase tracking-widest items-center min-w-[600px]">
            <span>#</span><span>Estudiante</span><span>Ausencias acum.</span><span>Estado hoy</span>
          </div>
          <ul className="divide-y divide-gray-100 min-w-[600px]">
            {roster.map((e, idx) => {
              const cons = consecutivas[e.id] ?? 0;
              const alert = cons >= 3;
              const s = estado[e.id] ?? "present";
              return (
                <li key={e.id}
                  className={`grid grid-cols-[40px_1fr_200px_180px] gap-4 items-center px-4 py-3.5 transition-colors
                    ${alert ? "bg-red-50/40" : idx % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]"} hover:bg-[#EAF2FB]/20`}>
                  <span className="text-gray-600 text-xs">{idx+1}</span>
                  <div className="flex items-center gap-2.5">
                    <div aria-hidden="true" className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                      ${alert ? "bg-red-100 text-[#C62828]" : "bg-[#EAF2FB] text-[#1F4E79]"}`}>
                      {initials(e.nombreCompleto)}
                    </div>
                    <span className="text-sm font-medium text-[#1A1A1A]">{e.nombreCompleto}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-mono ${alert ? "text-[#C62828] font-bold" : "text-gray-500"}`}>
                      {cons} {cons === 1 ? "día" : "días"}
                    </span>
                    {alert && <Badge v="error"><AlertTriangle size={11} aria-hidden="true" />{cons}+ consecutivas</Badge>}
                  </div>
                  <AttToggle status={s} onChange={v => update(e.id, v)} studentName={e.nombreCompleto} />
                </li>
              );
            })}
          </ul>
          </div>
          <div className="px-4 py-3 bg-[#F5F7FA] border-t border-gray-200 text-xs text-gray-600">
            {roster.length} estudiantes · {asignacion.paralelo} · P = Presente · AJ = Ausente justificada · AI = Ausente injustificada
          </div>
          </>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
