import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, UserPlus, Users } from "lucide-react";
import { ApiError } from "../../api/client";
import { personal as personalApi, type PersonalResponse, type PersonalResumen, type RolPersonal } from "../../api/sagab";
import { Badge, type BadgeVariant } from "../components/Badge";
import { Btn } from "../components/Btn";
import { EmptyState } from "../components/EmptyState";
import { TopBar } from "../components/TopBar";
import { useToast } from "../components/Toast";

const ROLES: { v: RolPersonal; l: string }[] = [
  { v: "DOCENTE", l: "Docente" },
  { v: "DECE", l: "Consejería DECE" },
  { v: "AUDITOR", l: "Auditor" },
];

const ROL_BADGE: Record<string, BadgeVariant> = { DOCENTE: "info", DECE: "warning", AUDITOR: "success" };

const VACIO = { nombres: "", apellidos: "", cedula: "", email: "", telefono: "", rol: "DOCENTE" as RolPersonal, tituloDocente: "" };

export function PersonalView() {
  const toast = useToast();
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [creado, setCreado] = useState<PersonalResponse | null>(null);

  const [lista, setLista] = useState<PersonalResumen[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorApi, setErrorApi] = useState<string | null>(null);

  const cargar = () => {
    setLoading(true);
    setErrorApi(null);
    personalApi.listar()
      .then(setLista)
      .catch(e => setErrorApi(e instanceof ApiError ? e.message : "No se pudo cargar el personal registrado."))
      .finally(() => setLoading(false));
  };

  useEffect(cargar, []);

  const set = <K extends keyof typeof VACIO>(campo: K, valor: (typeof VACIO)[K]) =>
    setForm(p => ({ ...p, [campo]: valor }));

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setCreado(null);
    try {
      const resp = await personalApi.crear({
        nombres: form.nombres.trim(),
        apellidos: form.apellidos.trim(),
        cedula: form.cedula,
        email: form.email.trim(),
        telefono: form.telefono.trim() || undefined,
        rol: form.rol,
        tituloDocente: form.rol === "DOCENTE" ? (form.tituloDocente.trim() || undefined) : undefined,
      });
      setCreado(resp);
      toast.success("Cuenta creada correctamente");
      setForm(VACIO);
      cargar();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo crear la cuenta.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div>
      <TopBar title="Personal" subtitle="Crear cuentas de docentes, Consejería DECE y Auditoría" />
      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <form onSubmit={crear} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">Nueva cuenta</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="p-nombres" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Nombres</label>
                <input id="p-nombres" value={form.nombres} onChange={e => set("nombres", e.target.value)} required minLength={3} maxLength={80}
                  placeholder="Ej. Paola Andrea"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
              </div>
              <div>
                <label htmlFor="p-apellidos" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Apellidos</label>
                <input id="p-apellidos" value={form.apellidos} onChange={e => set("apellidos", e.target.value)} required minLength={3} maxLength={80}
                  placeholder="Ej. Vintimilla Ruiz"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="p-cedula" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Cédula</label>
                <input id="p-cedula" value={form.cedula} onChange={e => set("cedula", e.target.value.replace(/\D/g, "").slice(0, 10))}
                  required inputMode="numeric" maxLength={10} placeholder="1712345678"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
              </div>
              <div>
                <label htmlFor="p-telefono" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Teléfono (opcional)</label>
                <input id="p-telefono" value={form.telefono} onChange={e => set("telefono", e.target.value.replace(/\D/g, "").slice(0, 10))}
                  inputMode="numeric" maxLength={10} placeholder="0991234567"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
              </div>
            </div>

            <div>
              <label htmlFor="p-email" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Correo institucional</label>
              <input id="p-email" type="email" value={form.email} onChange={e => set("email", e.target.value)} required maxLength={120}
                placeholder="nombre@bellini.edu.ec"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
            </div>

            <div>
              <label htmlFor="p-rol" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Rol</label>
              <select id="p-rol" value={form.rol} onChange={e => set("rol", e.target.value as RolPersonal)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6] bg-white">
                {ROLES.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
              </select>
            </div>

            {form.rol === "DOCENTE" && (
              <div>
                <label htmlFor="p-titulo" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Título (opcional)</label>
                <input id="p-titulo" value={form.tituloDocente} onChange={e => set("tituloDocente", e.target.value)} maxLength={80}
                  placeholder="Ej. Lcda. en Educación"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
              </div>
            )}

            <Btn disabled={guardando}>
              {guardando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <UserPlus size={14} aria-hidden="true" />}
              Crear cuenta
            </Btn>
          </form>

          {creado && (
            <div role="status" className="mt-4 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-3 text-sm text-[#2E7D32]">
              <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold mb-1">Cuenta creada — {creado.nombreCompleto} ({creado.rol})</p>
                <p>Usuario: <strong>{creado.username}</strong> · contraseña temporal: <strong>{creado.claveTemporal}</strong></p>
                <p className="text-xs text-[#2E7D32]/80 mt-1">Anote esta contraseña ahora: no se vuelve a mostrar. Deberá cambiarla al ingresar por primera vez.</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-fit">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest px-4 pt-4 pb-2">Personal registrado</p>
          {errorApi && (
            <div role="alert" className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />{errorApi}
            </div>
          )}
          {loading && <div className="px-4 pb-4 text-sm text-gray-600"><Loader2 size={16} className="animate-spin inline-block mr-2" aria-hidden="true" />Cargando…</div>}
          {!loading && lista.length === 0 && !errorApi && (
            <div className="px-4 pb-4"><EmptyState icon={Users} title="Todavía no hay cuentas de docentes, DECE o auditoría." /></div>
          )}
          {!loading && lista.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {lista.map(p => (
                <li key={p.idUsuario} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1A1A1A] truncate">{p.nombreCompleto}</p>
                    <p className="text-[11px] text-gray-500 truncate">{p.username} · {p.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge v={ROL_BADGE[p.rol] ?? "info"}>{p.rol}</Badge>
                    {p.estado !== "ACTIVO" && <Badge v="error">{p.estado}</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
