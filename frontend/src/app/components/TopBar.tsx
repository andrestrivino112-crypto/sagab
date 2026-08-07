import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bell } from "lucide-react";
import { mensajes, type MensajeResponse } from "../../api/sagab";

export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const [noLeidos, setNoLeidos] = useState<MensajeResponse[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [detalle, setDetalle] = useState<MensajeResponse | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const cargar = () => {
    mensajes.mias().then(lista => setNoLeidos(lista.filter(m => !m.leido))).catch(() => { /* silencioso: no bloquear la UI por esto */ });
  };

  useEffect(cargar, []);

  useEffect(() => {
    window.addEventListener("sagab:mensajes-actualizados", cargar);
    return () => window.removeEventListener("sagab:mensajes-actualizados", cargar);
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const onClickFuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, [abierto]);

  const marcarLeido = async (id: number) => {
    setNoLeidos(prev => prev.filter(m => m.idMensaje !== id));
    try {
      await mensajes.marcarLeido(id);
      window.dispatchEvent(new CustomEvent("sagab:mensajes-actualizados"));
    } catch {
      cargar(); // si falló en el servidor, recuperamos el estado real
    }
  };

  const abrirMensaje = (mensaje: MensajeResponse) => {
    setDetalle(mensaje);
    void marcarLeido(mensaje.idMensaje);
  };

  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold text-[#1A1A1A] leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="relative" ref={ref}>
        <button type="button" aria-label={noLeidos.length > 0 ? `Notificaciones (${noLeidos.length} sin leer)` : "Notificaciones"}
          aria-expanded={abierto} onClick={() => setAbierto(v => !v)}
          className="relative w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E75B6]/40 transition-colors">
          <Bell size={18} aria-hidden="true" />
          {noLeidos.length > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-semibold text-white bg-[#C62828] rounded-full ring-2 ring-white" aria-hidden="true">
              {noLeidos.length > 9 ? "9+" : noLeidos.length}
            </span>
          )}
        </button>

        {abierto && (
          <div role="menu" className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-20">
            {detalle ? (
              <div className="px-4 py-2">
                <button type="button" onClick={() => setDetalle(null)} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-[#2E75B6] hover:underline">
                  <ArrowLeft size={12} aria-hidden="true" />Volver
                </button>
                <p className="text-sm font-semibold text-[#1A1A1A]">{detalle.asunto}</p>
                <p className="mt-0.5 text-xs text-gray-500">De: {detalle.remitente}</p>
                <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-gray-700">{detalle.cuerpo}</p>
              </div>
            ) : <><p className="px-4 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Mensajes sin leer</p>
            {noLeidos.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-500">No tiene mensajes sin leer.</p>
            ) : (
              noLeidos.map(m => (
                <button key={m.idMensaje} type="button" onClick={() => abrirMensaje(m)}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#EAF2FB] transition-colors cursor-pointer">
                  <p className="text-sm font-medium text-[#1A1A1A] truncate">{m.asunto}</p>
                  <p className="text-xs text-gray-500 truncate">{m.remitente}</p>
                </button>
              ))
            )}</>}
          </div>
        )}
      </div>
    </div>
  );
}
