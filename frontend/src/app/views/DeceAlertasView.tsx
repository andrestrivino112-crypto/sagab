import { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, Users } from "lucide-react";
import { ApiError } from "../../api/client";
import {
  estudiantes as estudiantesApi, asistencia as asistenciaApi, paralelos as paralelosApi,
  type EstudianteResumen, type ParaleloOpcion,
} from "../../api/sagab";
import { EmptyState } from "../components/EmptyState";
import { Badge } from "../components/Badge";
import { TopBar } from "../components/TopBar";

const UMBRAL_ALERTA = 3;

export function DeceAlertasView() {
  const [opciones, setOpciones] = useState<ParaleloOpcion[]>([]);
  const [idParalelo, setIdParalelo] = useState<number | "">("");
  const [roster, setRoster] = useState<EstudianteResumen[]>([]);
  const [consecutivas, setConsecutivas] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [errorParalelos, setErrorParalelos] = useState<string | null>(null);

  useEffect(() => {
    paralelosApi.listar()
      .then(lista => {
        setOpciones(lista);
        if (lista.length > 0) setIdParalelo(lista[0].id);
      })
      .catch(e => setErrorParalelos(e instanceof ApiError ? e.message : "No se pudieron cargar los paralelos."));
  }, []);

  useEffect(() => {
    if (idParalelo === "") { setRoster([]); return; }
    setLoading(true);
    setErrorApi(null);
    Promise.all([
      estudiantesApi.porParalelo(idParalelo),
      asistenciaApi.consecutivasPorParalelo(idParalelo),
    ]).then(([lista, cons]) => {
      setRoster(lista);
      setConsecutivas(cons);
    }).catch(e => setErrorApi(e instanceof ApiError ? e.message : "No se pudieron cargar las ausencias de este paralelo."))
      .finally(() => setLoading(false));
  }, [idParalelo]);

  const conAlerta = roster
    .map(e => ({ ...e, consecutivas: consecutivas[e.id] ?? 0 }))
    .filter(e => e.consecutivas >= UMBRAL_ALERTA)
    .sort((a, b) => b.consecutivas - a.consecutivas);

  return (
    <div>
      <TopBar title="Alertas de Asistencia" subtitle="Ausencias injustificadas consecutivas por paralelo (Consejería DECE)" />
      <div className="p-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4 flex items-center gap-4 flex-wrap">
          <div className="flex flex-col gap-1 min-w-[280px]">
            <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Paralelo</label>
            <select value={idParalelo} onChange={e => setIdParalelo(e.target.value ? Number(e.target.value) : "")}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6] bg-white">
              {opciones.length === 0 && <option value="">Sin paralelos</option>}
              {opciones.map(p => (
                <option key={p.id} value={p.id}>{p.etiqueta}</option>
              ))}
            </select>
          </div>
          {roster.length > 0 && (
            <div className="ml-4">
              <Badge v={conAlerta.length > 0 ? "error" : "success"}>
                <AlertTriangle size={11} aria-hidden="true" />
                {conAlerta.length} con {UMBRAL_ALERTA}+ ausencias injustificadas consecutivas
              </Badge>
            </div>
          )}
        </div>

        {(errorApi || errorParalelos) && (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />{errorApi ?? errorParalelos}
          </div>
        )}

        {idParalelo === "" && !errorParalelos && (
          <EmptyState icon={Users} title="No hay paralelos disponibles todavía." />
        )}

        {idParalelo !== "" && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {loading && (
              <div className="px-4 py-8 text-center text-sm text-gray-600">
                <Loader2 size={16} className="animate-spin inline-block mr-2" aria-hidden="true" />Cargando…
              </div>
            )}
            {!loading && roster.length === 0 && !errorApi && (
              <div className="p-4">
                <EmptyState icon={Users} title="No existen estudiantes matriculados en este paralelo." />
              </div>
            )}
            {!loading && roster.length > 0 && conAlerta.length === 0 && (
              <div className="p-4">
                <EmptyState icon={CheckCircle2}
                  title="Sin alertas activas en este paralelo."
                  description={`Ningún estudiante acumula ${UMBRAL_ALERTA} o más ausencias injustificadas consecutivas.`} />
              </div>
            )}
            {!loading && conAlerta.length > 0 && (
              <>
                <div className="grid grid-cols-[1fr_200px] gap-4 px-4 py-3 bg-[#F5F7FA] border-b border-gray-200 text-[10px] font-semibold text-gray-600 uppercase tracking-widest items-center">
                  <span>Estudiante</span><span>Ausencias consecutivas</span>
                </div>
                <ul className="divide-y divide-gray-100">
                  {conAlerta.map(e => (
                    <li key={e.id} className="grid grid-cols-[1fr_200px] gap-4 px-4 py-3 items-center">
                      <span className="text-sm text-[#1A1A1A] font-medium">{e.nombreCompleto}</span>
                      <Badge v="error"><AlertTriangle size={11} aria-hidden="true" />{e.consecutivas} días</Badge>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
