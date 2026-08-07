import { useEffect, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, Search, Shield } from "lucide-react";
import { ApiError } from "../../api/client";
import {
  auditoria as auditoriaApi,
  type RegistroCambio, type EventoSeguridad, type HistorialFilaItem,
} from "../../api/sagab";
import { EmptyState } from "../components/EmptyState";
import { Btn } from "../components/Btn";
import { TopBar } from "../components/TopBar";

type Tab = "cambios" | "eventos" | "fila";

function fmt(fecha: string) {
  return new Date(fecha).toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" });
}

function CambiosTab() {
  const [tabla, setTabla] = useState("");
  const [usuario, setUsuario] = useState("");
  const [pagina, setPagina] = useState(0);
  const [filas, setFilas] = useState<RegistroCambio[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = () => {
    setLoading(true);
    setError(null);
    auditoriaApi.cambios({ tabla: tabla || undefined, usuario: usuario || undefined, pagina })
      .then(setFilas)
      .catch(e => setError(e instanceof ApiError ? e.message : "No se pudo cargar el historial de cambios."))
      .finally(() => setLoading(false));
  };

  useEffect(cargar, [pagina]);

  return (
    <div>
      <form onSubmit={e => { e.preventDefault(); setPagina(0); cargar(); }}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4 flex items-end gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Tabla</label>
          <input value={tabla} onChange={e => setTabla(e.target.value)} placeholder="p.ej. calificacion"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Usuario</label>
          <input value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="username"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
        </div>
        <Btn type="submit" size="sm"><Search size={14} aria-hidden="true" />Filtrar</Btn>
      </form>

      {error && (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
          <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />{error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading && <div className="px-4 py-8 text-center text-sm text-gray-600"><Loader2 size={16} className="animate-spin inline-block mr-2" aria-hidden="true" />Cargando…</div>}
        {!loading && filas.length === 0 && !error && (
          <div className="p-4"><EmptyState icon={Shield} title="Sin resultados para estos filtros." /></div>
        )}
        {!loading && filas.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="bg-[#F5F7FA] border-b border-gray-200 text-[10px] font-semibold text-gray-600 uppercase tracking-widest">
                  <th className="text-left px-4 py-3">Fecha</th>
                  <th className="text-left px-4 py-3">Usuario</th>
                  <th className="text-left px-4 py-3">Operación</th>
                  <th className="text-left px-4 py-3">Tabla</th>
                  <th className="text-left px-4 py-3">Fila</th>
                  <th className="text-left px-4 py-3">Columnas modificadas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filas.map(f => (
                  <tr key={f.id_registro}>
                    <td className="px-4 py-2.5 whitespace-nowrap">{fmt(f.ejecutado_en)}</td>
                    <td className="px-4 py-2.5">{f.usuario_app ?? "—"}</td>
                    <td className="px-4 py-2.5">{f.operacion}</td>
                    <td className="px-4 py-2.5">{f.tabla}</td>
                    <td className="px-4 py-2.5">{f.id_fila}</td>
                    <td className="px-4 py-2.5 text-gray-600">{f.columnas_modificadas?.join(", ") ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 mt-3">
        <Btn variant="secondary" size="sm" onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0}>
          <ChevronLeft size={14} aria-hidden="true" />Anterior
        </Btn>
        <span className="text-xs text-gray-600">Página {pagina + 1}</span>
        <Btn variant="secondary" size="sm" onClick={() => setPagina(p => p + 1)} disabled={filas.length === 0}>
          Siguiente<ChevronRight size={14} aria-hidden="true" />
        </Btn>
      </div>
    </div>
  );
}

function EventosTab() {
  const [pagina, setPagina] = useState(0);
  const [filas, setFilas] = useState<EventoSeguridad[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    auditoriaApi.eventos(pagina)
      .then(setFilas)
      .catch(e => setError(e instanceof ApiError ? e.message : "No se pudieron cargar los eventos de seguridad."))
      .finally(() => setLoading(false));
  }, [pagina]);

  return (
    <div>
      {error && (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
          <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />{error}
        </div>
      )}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading && <div className="px-4 py-8 text-center text-sm text-gray-600"><Loader2 size={16} className="animate-spin inline-block mr-2" aria-hidden="true" />Cargando…</div>}
        {!loading && filas.length === 0 && !error && (
          <div className="p-4"><EmptyState icon={Shield} title="Sin eventos de seguridad en esta página." /></div>
        )}
        {!loading && filas.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-[#F5F7FA] border-b border-gray-200 text-[10px] font-semibold text-gray-600 uppercase tracking-widest">
                  <th className="text-left px-4 py-3">Fecha</th>
                  <th className="text-left px-4 py-3">Evento</th>
                  <th className="text-left px-4 py-3">Usuario</th>
                  <th className="text-left px-4 py-3">Detalle</th>
                  <th className="text-left px-4 py-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filas.map(f => (
                  <tr key={f.id_evento}>
                    <td className="px-4 py-2.5 whitespace-nowrap">{fmt(f.ejecutado_en)}</td>
                    <td className="px-4 py-2.5">{f.operacion}</td>
                    <td className="px-4 py-2.5">{f.usuario_app ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-600">{f.detalle ?? "—"}</td>
                    <td className="px-4 py-2.5">{f.ip_cliente ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 mt-3">
        <Btn variant="secondary" size="sm" onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0}>
          <ChevronLeft size={14} aria-hidden="true" />Anterior
        </Btn>
        <span className="text-xs text-gray-600">Página {pagina + 1}</span>
        <Btn variant="secondary" size="sm" onClick={() => setPagina(p => p + 1)} disabled={filas.length === 0}>
          Siguiente<ChevronRight size={14} aria-hidden="true" />
        </Btn>
      </div>
    </div>
  );
}

function HistorialFilaTab() {
  const [tabla, setTabla] = useState("");
  const [idFila, setIdFila] = useState("");
  const [filas, setFilas] = useState<HistorialFilaItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tabla.trim() || !idFila.trim()) return;
    setLoading(true);
    setError(null);
    auditoriaApi.historialFila(tabla.trim(), idFila.trim())
      .then(setFilas)
      .catch(e2 => setError(e2 instanceof ApiError ? e2.message : "No se pudo cargar la trazabilidad de esta fila."))
      .finally(() => setLoading(false));
  };

  return (
    <div>
      <form onSubmit={buscar} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4 flex items-end gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Tabla</label>
          <input value={tabla} onChange={e => setTabla(e.target.value)} placeholder="p.ej. calificacion" required
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">ID de fila</label>
          <input value={idFila} onChange={e => setIdFila(e.target.value)} placeholder="p.ej. 42" required
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
        </div>
        <Btn type="submit" size="sm" disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Search size={14} aria-hidden="true" />}
          Buscar trazabilidad
        </Btn>
      </form>

      {error && (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
          <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />{error}
        </div>
      )}

      {filas !== null && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {filas.length === 0 && !error && (
            <div className="p-4"><EmptyState icon={Shield} title="No hay cambios registrados para esa tabla y fila." /></div>
          )}
          {filas.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {filas.map((f, i) => (
                <li key={i} className="px-4 py-3">
                  <div className="flex items-center gap-2 text-sm mb-1">
                    <span className="font-medium text-[#1A1A1A]">{f.operacion}</span>
                    <span className="text-gray-500">· {fmt(f.ejecutado_en)}</span>
                    <span className="text-gray-500">· {f.usuario_app ?? "—"}</span>
                  </div>
                  {f.columnas_modificadas && f.columnas_modificadas.length > 0 && (
                    <p className="text-xs text-gray-600">Columnas: {f.columnas_modificadas.join(", ")}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function AuditoriaView() {
  const [tab, setTab] = useState<Tab>("cambios");

  return (
    <div>
      <TopBar title="Auditoría" subtitle="Historial de cambios, eventos de seguridad y trazabilidad por fila" />
      <div className="p-6">
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5 w-fit mb-4" role="tablist" aria-label="Sección de auditoría">
          {([
            ["cambios", "Historial de cambios"],
            ["eventos", "Eventos de seguridad"],
            ["fila", "Trazabilidad por fila"],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all
                focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E75B6]/40
                ${tab === id ? "bg-[#1F4E79] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "cambios" && <CambiosTab />}
        {tab === "eventos" && <EventosTab />}
        {tab === "fila" && <HistorialFilaTab />}
      </div>
    </div>
  );
}
