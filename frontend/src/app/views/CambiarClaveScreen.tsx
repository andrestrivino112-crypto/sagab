import { useState } from "react";
import { AlertCircle, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { cambiarClave } from "../../api/auth";
import { ApiError } from "../../api/client";
import { Btn } from "../components/Btn";

/**
 * Pantalla obligatoria tras el primer login (o cuando un admin resetea la clave de alguien):
 * el backend marca debeCambiarClave=true y el usuario no puede continuar sin cambiarla
 * (la contraseña inicial suele ser predecible: la cédula del estudiante, una clave temporal, etc.).
 */
export function CambiarClaveScreen({ nombre, onCompletado, onLogout }: {
  nombre: string; onCompletado: () => void; onLogout: () => void;
}) {
  const [claveActual, setClaveActual] = useState("");
  const [claveNueva, setClaveNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (claveNueva.length < 8) { setError("La nueva contraseña debe tener al menos 8 caracteres."); return; }
    if (claveNueva !== confirmacion) { setError("Las contraseñas no coinciden."); return; }
    if (claveNueva === claveActual) { setError("La nueva contraseña debe ser distinta de la actual."); return; }
    setLoading(true);
    setError(null);
    try {
      await cambiarClave(claveActual, claveNueva);
      onCompletado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor. Intente nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-4" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1F4E79] rounded-2xl mb-4 shadow-lg">
            <KeyRound size={32} className="text-white" aria-hidden="true" />
          </div>
          <h1 className="text-[22px] font-bold text-[#1A1A1A] tracking-tight">Cambio de contraseña obligatorio</h1>
          <p className="text-sm text-gray-500 mt-1">Hola {nombre}, por seguridad debe establecer una nueva contraseña antes de continuar.</p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm border border-[rgba(31,78,121,0.12)] p-8">
          {error && (
            <div role="alert" className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="clave-actual" className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña actual</label>
            <input id="clave-actual" type={mostrar ? "text" : "password"} value={claveActual}
              onChange={e => setClaveActual(e.target.value)} autoComplete="current-password"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm bg-white outline-none focus:border-[#2E75B6] focus:ring-2 focus:ring-[#2E75B6]/20" />
          </div>

          <div className="mb-4">
            <label htmlFor="clave-nueva" className="block text-sm font-medium text-gray-700 mb-1.5">Nueva contraseña</label>
            <div className="relative">
              <input id="clave-nueva" type={mostrar ? "text" : "password"} value={claveNueva}
                onChange={e => setClaveNueva(e.target.value)} autoComplete="new-password" minLength={8}
                aria-describedby="clave-nueva-ayuda"
                className="w-full px-3 py-2.5 pr-10 rounded-lg border border-gray-300 text-sm bg-white outline-none focus:border-[#2E75B6] focus:ring-2 focus:ring-[#2E75B6]/20" />
              <button type="button" onClick={() => setMostrar(!mostrar)}
                aria-label={mostrar ? "Ocultar contraseñas" : "Mostrar contraseñas"} aria-pressed={mostrar}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/40 transition-colors">
                {mostrar ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
            <p id="clave-nueva-ayuda" className="text-xs text-gray-500 mt-1">Mínimo 8 caracteres.</p>
          </div>

          <div className="mb-6">
            <label htmlFor="clave-confirmar" className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar nueva contraseña</label>
            <input id="clave-confirmar" type={mostrar ? "text" : "password"} value={confirmacion}
              onChange={e => setConfirmacion(e.target.value)} autoComplete="new-password"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm bg-white outline-none focus:border-[#2E75B6] focus:ring-2 focus:ring-[#2E75B6]/20" />
          </div>

          <Btn size="lg" className="w-full" disabled={loading}>
            {loading ? <><Loader2 size={16} className="animate-spin" aria-hidden="true" />Guardando…</> : "Guardar y continuar"}
          </Btn>

          <button type="button" onClick={onLogout}
            className="w-full text-center text-xs text-gray-500 hover:text-gray-700 mt-4 cursor-pointer">
            Cerrar sesión
          </button>
        </form>
      </div>
    </main>
  );
}
