import { useState } from "react";
import { AlertCircle, Eye, EyeOff, GraduationCap, Loader2 } from "lucide-react";
import { login as apiLogin, type Sesion } from "../../api/auth";
import { ApiError } from "../../api/client";
import { Btn } from "../components/Btn";

export function LoginScreen({ onLogin }: { onLogin: (s: Sesion) => void }) {
  const [usuario, setUsuario] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [uFocus, setUFocus] = useState(false);
  const [pFocus, setPFocus] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !pass) { setError("Ingrese su usuario y contraseña."); return; }
    setLoading(true);
    setError(null);
    try {
      const sesion = await apiLogin(usuario.trim(), pass);
      onLogin(sesion);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor. Intente nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-4" style={{ fontFamily:"'Inter', sans-serif" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1F4E79] rounded-2xl mb-4 shadow-lg">
            <GraduationCap size={32} className="text-white" />
          </div>
          <h1 className="text-[28px] font-bold text-[#1A1A1A] tracking-tight">SAGAB</h1>
          <p className="text-sm text-gray-500 mt-1">Sistema Avanzado de Gestión Académica Bellini</p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm border border-[rgba(31,78,121,0.12)] p-8">
          <h2 className="text-[20px] font-semibold text-[#1A1A1A] mb-6">Iniciar sesión</h2>

          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* User */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Usuario</label>
            <input type="text" value={usuario} onChange={e => setUsuario(e.target.value)}
              onFocus={() => setUFocus(true)} onBlur={() => setUFocus(false)}
              placeholder="Ingrese su usuario" autoComplete="username"
              className={`w-full px-3 py-2.5 rounded-lg border text-sm bg-white transition-all outline-none
                ${uFocus ? "border-[#2E75B6] ring-2 ring-[#2E75B6]/20" : "border-gray-300 hover:border-gray-400"}`} />
          </div>

          {/* Password */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
            <div className="relative">
              <input type={showPass ? "text" : "password"} value={pass} onChange={e => setPass(e.target.value)}
                onFocus={() => setPFocus(true)} onBlur={() => setPFocus(false)}
                placeholder="Ingrese su contraseña" autoComplete="current-password"
                className={`w-full px-3 py-2.5 pr-10 rounded-lg border text-sm bg-white transition-all outline-none
                  ${pFocus ? "border-[#2E75B6] ring-2 ring-[#2E75B6]/20" : "border-gray-300 hover:border-gray-400"}`} />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <Btn size="lg" className="w-full" disabled={loading}>
            {loading ? <><Loader2 size={16} className="animate-spin" />Ingresando…</> : "Ingresar al sistema"}
          </Btn>

          <p className="text-xs text-center text-gray-400 mt-4">
            ¿Problemas de acceso? Contacte al administrador del sistema
          </p>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          © 2026 Unidad Educativa Bellini · SAGAB v2.1.0
        </p>
      </div>
    </div>
  );
}
