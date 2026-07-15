import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  BookOpen, Users, DollarSign, MessageSquare, Home, LogOut, Bell,
  AlertTriangle, CheckCircle, Clock, FileText, Eye, EyeOff,
  GraduationCap, ChevronRight, TrendingUp, AlertCircle, Save,
  Smartphone, UserPlus, Info, Loader2, BarChart3, Receipt, Search,
} from "lucide-react";
import { login as apiLogin, logout as apiLogout, type Sesion, type RolSistema } from "../api/auth";
import { ApiError } from "../api/client";
import {
  paralelos as paralelosApi, asignaciones as asignacionesApi, estudiantes as estudiantesApi,
  matriculas as matriculasApi, calificaciones as calificacionesApi,
  asistencia as asistenciaApi, dashboard as dashboardApi, finanzas as finanzasApi, mensajes as mensajesApi,
  type ParaleloOpcion, type AsignacionOpcion, type MatriculaRequest, type EstudianteResumen,
  type ResumenDashboard, type ObligacionResponse, type EstudianteConParalelo, type EstadoAsistencia,
  type NotaEstudianteResponse, type AsistenciaRegistro, type MensajeResponse,
} from "../api/sagab";
import { EmptyState } from "./components/EmptyState";

// ── Types ──────────────────────────────────────────────────────────────────
type Screen = "login" | "dashboard" | "grades" | "attendance" | "parent" | "financial" | "validation" | "matricula";
type AttendanceStatus = "present" | "justified" | "unjustified";
type PaymentStatus = "paid" | "pending" | "overdue" | "cancelled";

// ── Helpers ────────────────────────────────────────────────────────────────
function calcAvg(t: string, c: string, e: string): number | null {
  const [tv, cv, ev] = [parseFloat(t), parseFloat(c), parseFloat(e)];
  if ([tv,cv,ev].some(isNaN)) return null;
  if ([tv,cv,ev].some(v => v < 1 || v > 10)) return null;
  return Math.round((tv * 0.2 + cv * 0.2 + ev * 0.6) * 100) / 100;
}
function isValid(v: string) { if (!v) return true; const n = parseFloat(v); return !isNaN(n) && n >= 1 && n <= 10; }
function isComplete(v: string) { if (!v) return false; const n = parseFloat(v); return !isNaN(n) && n >= 1 && n <= 10; }
function initials(name: string) { return name.split(" ").map(n => n[0]).slice(0,2).join(""); }
function barColor(v: number) { return v >= 8 ? "#2E7D32" : v < 7 ? "#C62828" : "#2E75B6"; }

// ── Shared Components ──────────────────────────────────────────────────────
type BadgeVariant = "success" | "warning" | "error" | "info";
function Badge({ v, children }: { v: BadgeVariant; children: React.ReactNode }) {
  const cls = {
    success: "bg-green-100 text-green-800 border-green-200",
    warning: "bg-amber-100 text-amber-800 border-amber-200",
    error:   "bg-red-100 text-[#C62828] border-red-200",
    info:    "bg-blue-100 text-blue-800 border-blue-200",
  }[v];
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${cls}`}>{children}</span>;
}

type BtnVariant = "primary" | "secondary" | "danger" | "ghost";
type BtnSize = "sm" | "md" | "lg";
function Btn({ children, onClick, disabled = false, variant = "primary", size = "md", className = "" }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  variant?: BtnVariant; size?: BtnSize; className?: string;
}) {
  const base = "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer";
  const sizes: Record<BtnSize, string> = { sm:"px-3 py-1.5 text-xs", md:"px-4 py-2 text-sm", lg:"px-6 py-2.5 text-base" };
  const variants: Record<BtnVariant, string> = {
    primary:   disabled ? "bg-[#A8C4DE] text-white cursor-not-allowed" : "bg-[#1F4E79] text-white hover:bg-[#163A5A] active:bg-[#0F2840] focus:ring-[#2E75B6]",
    secondary: "bg-[#EAF2FB] text-[#1F4E79] hover:bg-[#D0E4F5] border border-[#2E75B6]/25 focus:ring-[#2E75B6]",
    danger:    "bg-[#C62828] text-white hover:bg-[#A31F1F] focus:ring-red-400",
    ghost:     "bg-transparent text-[#1F4E79] hover:bg-[#EAF2FB] focus:ring-[#2E75B6]",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold text-[#1A1A1A] leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <button className="relative w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
        <Bell size={18} />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#C62828] rounded-full ring-2 ring-white" />
      </button>
    </div>
  );
}

function KpiCard({ label, value, sub, icon: Icon, accent = "blue", alert = false }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: "blue"|"green"|"red"|"amber"; alert?: boolean;
}) {
  const styles = {
    blue:  { border:"border-l-[#2E75B6]", bg:"bg-[#EAF2FB]", icon:"text-[#2E75B6]" },
    green: { border:"border-l-[#2E7D32]", bg:"bg-green-50",  icon:"text-[#2E7D32]" },
    red:   { border:"border-l-[#C62828]", bg:"bg-red-50",    icon:"text-[#C62828]" },
    amber: { border:"border-l-amber-500", bg:"bg-amber-50",  icon:"text-amber-600" },
  }[accent];
  return (
    <div className={`bg-white rounded-xl border-l-4 ${styles.border} shadow-sm p-5 flex items-start gap-4`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${styles.bg}`}>
        <Icon size={20} className={styles.icon} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
        <p className={`text-2xl font-bold ${alert ? "text-[#C62828]" : "text-[#1A1A1A]"}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {alert && <AlertTriangle size={15} className="text-[#C62828] flex-shrink-0 mt-1" />}
    </div>
  );
}

// ── Login ──────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (s: Sesion) => void }) {
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

// ── Sidebar ────────────────────────────────────────────────────────────────
const NAV = [
  { id:"dashboard"  as Screen, label:"Inicio",          icon: Home },
  { id:"matricula"  as Screen, label:"Matrícula",       icon: UserPlus },
  { id:"grades"     as Screen, label:"Académico",        icon: BookOpen },
  { id:"attendance" as Screen, label:"Asistencia",       icon: Users },
  { id:"financial"  as Screen, label:"Financiero",       icon: DollarSign },
  { id:"parent"     as Screen, label:"Portal Familiar",  icon: Smartphone },
  { id:"validation" as Screen, label:"Componentes UI",   icon: FileText },
];

/** Qué módulos ve cada rol — el docente no debe ver Matrícula ni Financiero. */
const NAV_POR_ROL: Record<RolSistema, Screen[]> = {
  ADMIN:         ["dashboard", "matricula", "grades", "attendance", "financial", "parent", "validation"],
  DOCENTE:       ["dashboard", "grades", "attendance"],
  DECE:          ["dashboard", "attendance"],
  AUDITOR:       ["dashboard"],
  REPRESENTANTE: [],
};

const ROL_LABEL: Record<RolSistema, string> = {
  ADMIN: "Administrador", DOCENTE: "Docente", REPRESENTANTE: "Representante",
  AUDITOR: "Auditor", DECE: "Consejería DECE",
};

function Sidebar({ active, onNav, onLogout, nav, nombre, rolLabel }: {
  active: Screen; onNav: (s: Screen) => void; onLogout: () => void;
  nav: typeof NAV; nombre: string; rolLabel: string;
}) {
  return (
    <aside className="w-[232px] flex-shrink-0 bg-[#1F4E79] flex flex-col h-screen overflow-y-auto">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
            <GraduationCap size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">SAGAB</p>
            <p className="text-white/50 text-xs mt-0.5">Inst. Bellini</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4">
        <p className="text-white/40 text-[10px] font-semibold uppercase tracking-[0.12em] px-3 mb-2">Módulos</p>
        <ul className="space-y-0.5">
          {nav.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button onClick={() => onNav(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${active === id ? "bg-white/15 text-white" : "text-white/65 hover:bg-white/8 hover:text-white"}`}>
                <Icon size={17} className="flex-shrink-0" />
                {label}
                {active === id && <ChevronRight size={13} className="ml-auto opacity-50" />}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* User */}
      <div className="px-2 py-3 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
            {initials(nombre)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{nombre}</p>
            <p className="text-white/45 text-[11px] truncate">{rolLabel}</p>
          </div>
        </div>
        <button onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white text-sm transition-all">
          <LogOut size={15} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-gray-700">{label}</p>
      <p className="text-[#1F4E79]">Promedio: <strong>{payload[0].value}</strong></p>
    </div>
  );
};

function DashboardView() {
  const [resumen, setResumen] = useState<ResumenDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorApi, setErrorApi] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    dashboardApi.resumen()
      .then(setResumen)
      .catch(e => setErrorApi(e instanceof ApiError ? e.message : "No se pudieron cargar los indicadores."))
      .finally(() => setLoading(false));
  }, []);

  const rendimiento = resumen?.rendimientoPorParalelo ?? [];

  return (
    <div>
      <TopBar title="Panel de Control" subtitle="Resumen institucional" />
      <div className="p-6 space-y-6">
        {errorApi && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />{errorApi}
          </div>
        )}

        {/* KPIs */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Indicadores del día</p>
          <div className="grid grid-cols-4 gap-4">
            <KpiCard label="Estudiantes en mora" value={loading ? "…" : (resumen?.estudiantesEnMora ?? 0)}
              icon={AlertTriangle} accent="red" alert={!loading && (resumen?.estudiantesEnMora ?? 0) > 0} />
            <KpiCard label="Promedio institucional"
              value={loading ? "…" : (resumen?.promedioInstitucional != null ? resumen.promedioInstitucional.toFixed(1) : "--")}
              icon={TrendingUp} accent="blue" />
            <KpiCard label="Ausencias hoy" value={loading ? "…" : (resumen?.ausenciasHoy ?? 0)} icon={Users} accent="amber" />
            <KpiCard label="Mensajes pendientes" value={loading ? "…" : (resumen?.mensajesPendientes ?? 0)} icon={MessageSquare} accent="blue" />
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-[#1A1A1A]">Rendimiento por paralelo</h2>
              <p className="text-sm text-gray-400">Promedio general</p>
            </div>
            {rendimiento.length > 0 && (
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#2E7D32] inline-block" /> ≥ 8.0</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#2E75B6] inline-block" /> 7.0 – 7.9</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#C62828] inline-block" /> &lt; 7.0</span>
              </div>
            )}
          </div>
          {!loading && rendimiento.length === 0 ? (
            <EmptyState icon={BarChart3} title="No existen calificaciones registradas para graficar." />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={rendimiento} margin={{ top:0, right:0, left:-15, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" vertical={false} />
                <XAxis dataKey="paralelo" tick={{ fontSize:12, fill:"#64748B" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0,10]} ticks={[0,2,4,6,7,8,10]} tick={{ fontSize:12, fill:"#64748B" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill:"#F5F7FA" }} />
                <Bar dataKey="promedio" radius={[4,4,0,0]}>
                  {rendimiento.map((d, i) => <Cell key={i} fill={barColor(d.promedio)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Activity & Alerts */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">Alertas recientes</h3>
            <EmptyState icon={AlertTriangle} title="Aún no hay alertas recientes." />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">Actividad reciente</h3>
            <EmptyState icon={Clock} title="Aún no hay actividad reciente." />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Grades ─────────────────────────────────────────────────────────────────
interface NotaRow { idEstudiante: number; nombre: string; tarea: string; clase: string; examen: string; }

function GradesView({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [asignacionesOpciones, setAsignacionesOpciones] = useState<AsignacionOpcion[]>([]);
  const [idAsignacion, setIdAsignacion] = useState<number | "">("");
  const [parcial, setParcial] = useState(1);
  const [rows, setRows] = useState<NotaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorApi, setErrorApi] = useState<string | null>(null);

  useEffect(() => {
    asignacionesApi.mias().then(lista => {
      setAsignacionesOpciones(lista);
      if (lista.length > 0) setIdAsignacion(lista[0].idAsignacion);
    }).catch(() => setErrorApi("No se pudieron cargar sus asignaciones."));
  }, []);

  const asignacion = asignacionesOpciones.find(a => a.idAsignacion === idAsignacion);

  useEffect(() => {
    if (!asignacion) { setRows([]); return; }
    setLoading(true);
    setErrorApi(null);
    Promise.all([
      estudiantesApi.porParalelo(asignacion.idParalelo),
      calificacionesApi.porAsignacion(asignacion.idAsignacion, parcial),
    ]).then(([roster, notas]) => {
      setRows(roster.map(e => {
        const n = notas.find(x => x.idEstudiante === e.id);
        return {
          idEstudiante: e.id, nombre: e.nombreCompleto,
          tarea: n ? String(n.notaTarea) : "", clase: n ? String(n.notaClase) : "", examen: n ? String(n.notaExamen) : "",
        };
      }));
    }).catch(() => setErrorApi("No se pudieron cargar los estudiantes o las notas de esta asignación."))
      .finally(() => setLoading(false));
  }, [asignacion?.idAsignacion, asignacion?.idParalelo, parcial]);

  const update = (idEstudiante: number, f: "tarea"|"clase"|"examen", v: string) => {
    setRows(p => p.map(r => r.idEstudiante === idEstudiante ? {...r,[f]:v} : r));
    setSaved(false);
  };

  const completas = rows.filter(r => isComplete(r.tarea) && isComplete(r.clase) && isComplete(r.examen));
  const allOk = rows.length > 0 && completas.length === rows.length;

  const guardar = async () => {
    if (!asignacion || completas.length === 0) return;
    setSaving(true);
    setErrorApi(null);
    try {
      await calificacionesApi.registrarMasivo(asignacion.idAsignacion, parcial, completas.map(r => ({
        idEstudiante: r.idEstudiante,
        notaTarea: parseFloat(r.tarea), notaClase: parseFloat(r.clase), notaExamen: parseFloat(r.examen),
      })));
      setSaved(true);
    } catch (e) {
      setErrorApi(e instanceof ApiError ? e.message : "No se pudieron guardar las calificaciones.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <TopBar title="Ingreso de Calificaciones" subtitle="Tabla editable · Escala 1.0–10.0 · Aprobación ≥ 7.0" />
      <div className="p-6">
        {/* Controls */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4 flex items-end gap-4 flex-wrap">
          <div className="flex flex-col gap-1 min-w-[280px]">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Asignación</label>
            <select value={idAsignacion} onChange={e => setIdAsignacion(e.target.value ? Number(e.target.value) : "")}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6] bg-white">
              {asignacionesOpciones.length === 0 && <option value="">Sin asignaciones</option>}
              {asignacionesOpciones.map(a => (
                <option key={a.idAsignacion} value={a.idAsignacion}>
                  {a.paralelo} · {a.materia} · {a.periodo}{a.docente ? ` · ${a.docente}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Parcial</label>
            <select value={parcial} onChange={e => { setParcial(Number(e.target.value)); setSaved(false); }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6] bg-white">
              {[1,2,3].map(p => <option key={p} value={p}>Parcial {p}</option>)}
            </select>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {saved && <span className="text-sm text-[#2E7D32] font-medium flex items-center gap-1.5"><CheckCircle size={15} />Guardado correctamente</span>}
            <Btn onClick={guardar} disabled={!allOk || saving || completas.length === 0}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Guardando…" : allOk ? "Guardar calificaciones" : "Completar todos los campos"}
            </Btn>
          </div>
        </div>

        {errorApi && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />{errorApi}
          </div>
        )}

        {!asignacion && !loading && asignacionesOpciones.length === 0 && !errorApi && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-sm text-gray-400">
            No tiene asignaciones de materias registradas todavía.
          </div>
        )}

        {/* Table */}
        {asignacion && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F5F7FA] border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-8">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estudiante</th>
                {(["Tarea","Clase","Examen"] as const).map((h, i) => (
                  <th key={h} className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h} <span className="font-normal text-gray-400 normal-case">{["(20%)","(20%)","(60%)"][i]}</span>
                  </th>
                ))}
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Promedio</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                  <Loader2 size={16} className="animate-spin inline-block mr-2" />Cargando…
                </td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-4">
                  <EmptyState icon={UserPlus} title="No existen estudiantes matriculados en esta asignación."
                    action={{ label: "Ir a Matrículas", onClick: () => onNavigate("matricula") }} />
                </td></tr>
              )}
              {!loading && rows.map((row, idx) => {
                const avg = calcAvg(row.tarea, row.clase, row.examen);
                return (
                  <tr key={row.idEstudiante}
                    className={`border-b border-gray-100 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]"} hover:bg-[#EAF2FB]/25`}>
                    <td className="px-4 py-3 text-gray-400 text-xs">{idx+1}</td>
                    <td className="px-4 py-3 font-medium text-[#1A1A1A] text-sm">{row.nombre}</td>
                    {(["tarea","clase","examen"] as const).map(f => {
                      const val = row[f];
                      const invalid = val !== "" && !isValid(val);
                      return (
                        <td key={f} className="px-4 py-2">
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-1">
                              <input type="number" min="1" max="10" step="0.5" value={val}
                                onChange={e => update(row.idEstudiante, f, e.target.value)}
                                className={`w-20 text-center px-2 py-1.5 rounded-lg border text-sm font-mono outline-none transition-all
                                  ${invalid
                                    ? "border-[#C62828] bg-red-50 text-[#C62828] ring-1 ring-[#C62828]/25"
                                    : "border-gray-300 focus:border-[#2E75B6] focus:ring-2 focus:ring-[#2E75B6]/20"}`} />
                              {invalid && <AlertCircle size={14} className="text-[#C62828] flex-shrink-0" />}
                            </div>
                            {invalid && <p className="text-[10px] text-[#C62828]">Valor: 1–10</p>}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center">
                      {avg !== null
                        ? <span className={`inline-flex items-center justify-center w-14 h-7 rounded-lg text-sm font-bold
                            ${avg < 7 ? "bg-red-100 text-[#C62828]" : avg >= 9 ? "bg-green-100 text-[#2E7D32]" : "bg-[#EAF2FB] text-[#1F4E79]"}`}>
                            {avg}
                          </span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 bg-[#F5F7FA] border-t border-gray-200 flex justify-between text-xs text-gray-400">
            <span>{rows.length} estudiantes · {asignacion.paralelo} · {asignacion.materia} · {asignacion.periodo}</span>
            <span>Promedio = Tarea×0.2 + Clase×0.2 + Examen×0.6</span>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

// ── Attendance ─────────────────────────────────────────────────────────────
function AttToggle({ status, onChange }: { status: AttendanceStatus; onChange: (s: AttendanceStatus) => void }) {
  const opts: { id: AttendanceStatus; short: string; title: string }[] = [
    { id:"present",     short:"P",  title:"Presente" },
    { id:"justified",   short:"AJ", title:"Ausente justificada" },
    { id:"unjustified", short:"AI", title:"Ausente injustificada" },
  ];
  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
      {opts.map(o => (
        <button key={o.id} title={o.title} onClick={() => onChange(o.id)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all
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

function AttendanceView({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [asignacionesOpciones, setAsignacionesOpciones] = useState<AsignacionOpcion[]>([]);
  const [idAsignacion, setIdAsignacion] = useState<number | "">("");
  const [roster, setRoster] = useState<EstudianteResumen[]>([]);
  const [estado, setEstado] = useState<Record<number, AttendanceStatus>>({});
  const [consecutivas, setConsecutivas] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorApi, setErrorApi] = useState<string | null>(null);

  useEffect(() => {
    asignacionesApi.mias().then(lista => {
      setAsignacionesOpciones(lista);
      if (lista.length > 0) setIdAsignacion(lista[0].idAsignacion);
    }).catch(() => setErrorApi("No se pudieron cargar sus asignaciones."));
  }, []);

  const asignacion = asignacionesOpciones.find(a => a.idAsignacion === idAsignacion);

  useEffect(() => {
    if (!asignacion) { setRoster([]); return; }
    setLoading(true);
    setErrorApi(null);
    setSaved(false);
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
    setSaved(false);
  };

  const counts = {
    present:     Object.values(estado).filter(s => s === "present").length,
    justified:   Object.values(estado).filter(s => s === "justified").length,
    unjustified: Object.values(estado).filter(s => s === "unjustified").length,
  };

  const guardar = async () => {
    if (!asignacion || roster.length === 0) return;
    setSaving(true);
    setErrorApi(null);
    try {
      await asistenciaApi.registrar(asignacion.idParalelo, roster.map(e => ({
        idEstudiante: e.id,
        estado: ATT_STATUS_TO_API[estado[e.id] ?? "present"],
      })));
      setSaved(true);
    } catch (e) {
      setErrorApi(e instanceof ApiError ? e.message : "No se pudo guardar la asistencia.");
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
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Asignación</label>
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
              <Badge v="success"><CheckCircle size={11} />{counts.present} Presentes</Badge>
              <Badge v="warning"><Clock size={11} />{counts.justified} A. Justificada</Badge>
              <Badge v="error"><AlertTriangle size={11} />{counts.unjustified} A. Injustificada</Badge>
            </div>
          )}
          <div className="ml-auto flex items-center gap-3">
            {saved && <span className="text-sm text-[#2E7D32] font-medium flex items-center gap-1.5"><CheckCircle size={15} />Guardado</span>}
            <Btn onClick={guardar} disabled={saving || roster.length === 0}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Guardando…" : "Guardar asistencia"}
            </Btn>
          </div>
        </div>

        {errorApi && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />{errorApi}
          </div>
        )}

        {!asignacion && !loading && asignacionesOpciones.length === 0 && !errorApi && (
          <EmptyState icon={Users} title="No tiene asignaciones de materias registradas todavía." />
        )}

        {asignacion && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              <Loader2 size={16} className="animate-spin inline-block mr-2" />Cargando…
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
          <div className="grid grid-cols-[40px_1fr_200px_180px] gap-4 px-4 py-3 bg-[#F5F7FA] border-b border-gray-200 text-[10px] font-semibold text-gray-400 uppercase tracking-widest items-center">
            <span>#</span><span>Estudiante</span><span>Ausencias acum.</span><span>Estado hoy</span>
          </div>
          <ul className="divide-y divide-gray-100">
            {roster.map((e, idx) => {
              const cons = consecutivas[e.id] ?? 0;
              const alert = cons >= 3;
              const s = estado[e.id] ?? "present";
              return (
                <li key={e.id}
                  className={`grid grid-cols-[40px_1fr_200px_180px] gap-4 items-center px-4 py-3.5 transition-colors
                    ${alert ? "bg-red-50/40" : idx % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]"} hover:bg-[#EAF2FB]/20`}>
                  <span className="text-gray-400 text-xs">{idx+1}</span>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                      ${alert ? "bg-red-100 text-[#C62828]" : "bg-[#EAF2FB] text-[#1F4E79]"}`}>
                      {initials(e.nombreCompleto)}
                    </div>
                    <span className="text-sm font-medium text-[#1A1A1A]">{e.nombreCompleto}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-mono ${alert ? "text-[#C62828] font-bold" : "text-gray-500"}`}>
                      {cons} {cons === 1 ? "día" : "días"}
                    </span>
                    {alert && <Badge v="error"><AlertTriangle size={11} />{cons}+ consecutivas</Badge>}
                  </div>
                  <AttToggle status={s} onChange={v => update(e.id, v)} />
                </li>
              );
            })}
          </ul>
          <div className="px-4 py-3 bg-[#F5F7FA] border-t border-gray-200 text-xs text-gray-400">
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

// ── Matrícula (formulario de 20 campos con validación lógica) ─────────────
interface MatriculaData {
  nombres: string;
  apellidos: string;
  cedula: string;
  fechaNacimiento: string;
  genero: string;
  idParalelo: number | "";
  institucionProcedencia: string;
  direccion: string;
  telefonoEstudiante: string;
  tipoSangre: string;
  condicionMedica: string;
  representanteNombres: string;
  representanteApellidos: string;
  representanteCedula: string;
  parentesco: string;
  representanteEmail: string;
  representanteTelefono: string;
  contactoEmergencia: string;
  documentos: string[];
}

const MATRICULA_EMPTY: MatriculaData = {
  nombres: "", apellidos: "", cedula: "", fechaNacimiento: "", genero: "",
  idParalelo: "", institucionProcedencia: "",
  direccion: "", telefonoEstudiante: "", tipoSangre: "", condicionMedica: "",
  representanteNombres: "", representanteApellidos: "", representanteCedula: "", parentesco: "",
  representanteEmail: "", representanteTelefono: "", contactoEmergencia: "",
  documentos: [],
};

const GENEROS = [{ v: "M", l: "Masculino" }, { v: "F", l: "Femenino" }];
const TIPOS_SANGRE = ["A+","A-","B+","B-","AB+","AB-","O+","O-","No registra"];
const PARENTESCOS = ["Padre", "Madre", "Tutor legal", "Otro"];
const NIVEL_EDAD: Record<string, [number, number]> = {
  "1° BGU": [14, 16],
  "2° BGU": [15, 17],
  "3° BGU": [16, 18],
};
const DOCUMENTOS_REQUERIDOS = [
  { id: "cedula_est", label: "Copia de cédula del estudiante" },
  { id: "partida",    label: "Partida de nacimiento" },
  { id: "foto",       label: "Foto tamaño carnet" },
  { id: "conducta",   label: "Certificado de conducta" },
];

const RE_NOMBRE   = /^[A-Za-zÁÉÍÓÚÑÜáéíóúñü ]{3,60}$/;
const RE_EMAIL    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_TELEFONO = /^(09\d{8}|0[2-7]\d{7})$/;

function isValidCedulaEc(cedula: string): boolean {
  if (!/^\d{10}$/.test(cedula)) return false;
  const d = cedula.split("").map(Number);
  const provincia = parseInt(cedula.slice(0, 2), 10);
  if (provincia < 1 || provincia > 24) return false;
  if (d[2] > 6) return false;
  const coef = [2,1,2,1,2,1,2,1,2];
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let v = d[i] * coef[i];
    if (v >= 10) v -= 9;
    suma += v;
  }
  const verificador = (10 - (suma % 10)) % 10;
  return verificador === d[9];
}

function calcEdad(fecha: string): number | null {
  if (!fecha) return null;
  const nac = new Date(fecha);
  if (isNaN(nac.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

function fieldErrors(f: MatriculaData): Partial<Record<keyof MatriculaData, string>> {
  const e: Partial<Record<keyof MatriculaData, string>> = {};
  if (!RE_NOMBRE.test(f.nombres.trim()))    e.nombres = "Ingrese un nombre válido (mín. 3 letras)";
  if (!RE_NOMBRE.test(f.apellidos.trim()))  e.apellidos = "Ingrese un apellido válido (mín. 3 letras)";
  if (!isValidCedulaEc(f.cedula))           e.cedula = "Cédula ecuatoriana inválida (10 dígitos)";
  if (!f.fechaNacimiento) {
    e.fechaNacimiento = "Campo requerido";
  } else {
    const edad = calcEdad(f.fechaNacimiento);
    if (edad === null || new Date(f.fechaNacimiento) > new Date()) e.fechaNacimiento = "Fecha inválida";
    else if (edad < 3 || edad > 20) e.fechaNacimiento = "Edad fuera de rango permitido (3–20 años)";
  }
  if (!f.genero)   e.genero = "Seleccione una opción";
  if (!f.idParalelo) e.idParalelo = "Seleccione una opción";
  if (f.direccion.trim().length < 8) e.direccion = "Ingrese la dirección completa (mín. 8 caracteres)";
  if (f.telefonoEstudiante && !RE_TELEFONO.test(f.telefonoEstudiante)) e.telefonoEstudiante = "Teléfono inválido (Ecuador)";
  if (!RE_NOMBRE.test(f.representanteNombres.trim())) e.representanteNombres = "Ingrese un nombre válido (mín. 3 letras)";
  if (!RE_NOMBRE.test(f.representanteApellidos.trim())) e.representanteApellidos = "Ingrese un apellido válido (mín. 3 letras)";
  if (!isValidCedulaEc(f.representanteCedula)) e.representanteCedula = "Cédula ecuatoriana inválida (10 dígitos)";
  if (!f.parentesco) e.parentesco = "Seleccione una opción";
  if (!RE_EMAIL.test(f.representanteEmail)) e.representanteEmail = "Correo electrónico inválido";
  if (!RE_TELEFONO.test(f.representanteTelefono)) e.representanteTelefono = "Teléfono inválido (Ecuador)";
  if (f.contactoEmergencia.trim().length < 5 || !/\d{7,}/.test(f.contactoEmergencia)) e.contactoEmergencia = "Incluya nombre y un teléfono de contacto";
  if (f.documentos.length < DOCUMENTOS_REQUERIDOS.length) e.documentos = "Faltan documentos por adjuntar";
  return e;
}

interface Alerta { msg: string; tipo: "error" | "warning" | "info"; }

function businessAlerts(f: MatriculaData, nivelSeleccionado?: string): Alerta[] {
  const alerts: Alerta[] = [];
  const edad = calcEdad(f.fechaNacimiento);
  if (edad !== null && nivelSeleccionado && NIVEL_EDAD[nivelSeleccionado]) {
    const [min, max] = NIVEL_EDAD[nivelSeleccionado];
    if (edad < min || edad > max) {
      alerts.push({ msg: `La edad del estudiante (${edad} años) no es la típica para ${nivelSeleccionado} (${min}–${max} años).`, tipo: "warning" });
    }
  }
  if (f.cedula && f.representanteCedula && f.cedula === f.representanteCedula) {
    alerts.push({ msg: "La cédula del estudiante y la del representante no pueden ser iguales.", tipo: "error" });
  }
  if (f.condicionMedica.trim()) {
    alerts.push({ msg: `Estudiante con condición médica registrada: "${f.condicionMedica.trim()}". Notificar a docentes.`, tipo: "info" });
  }
  const faltantes = DOCUMENTOS_REQUERIDOS.length - f.documentos.length;
  if (faltantes > 0) {
    alerts.push({ msg: `Documentación incompleta: falta${faltantes > 1 ? "n" : ""} ${faltantes} documento${faltantes > 1 ? "s" : ""}.`, tipo: "warning" });
  }
  return alerts;
}

type FieldKey = keyof MatriculaData;

function FormField({ label, error, hint, required = true, children }: {
  label: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="col-md-6">
      <label className="form-label">{label}{required && <span className="text-danger"> *</span>}</label>
      {children}
      {error
        ? <div className="invalid-feedback d-block"><AlertCircle size={12} className="me-1" style={{ verticalAlign: "-1px" }} />{error}</div>
        : hint ? <div className="form-text">{hint}</div> : null}
    </div>
  );
}

function MatriculaView() {
  const [form, setForm] = useState<MatriculaData>(MATRICULA_EMPTY);
  const [touchedFields, setTouchedFields] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ codigo: string; claveTemporal: string | null } | null>(null);
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [paralelosOpciones, setParalelosOpciones] = useState<ParaleloOpcion[]>([]);

  useEffect(() => {
    paralelosApi.listar().then(setParalelosOpciones).catch(() => setParalelosOpciones([]));
  }, []);

  const set = <K extends FieldKey>(key: K, value: MatriculaData[K]) => {
    setForm(p => ({ ...p, [key]: value }));
    setTouchedFields(p => ({ ...p, [key]: true }));
    setSaved(null);
  };

  const toggleDocumento = (id: string) => {
    setForm(p => ({
      ...p,
      documentos: p.documentos.includes(id) ? p.documentos.filter(d => d !== id) : [...p.documentos, id],
    }));
    setTouchedFields(p => ({ ...p, documentos: true }));
    setSaved(null);
  };

  const paraleloSeleccionado = paralelosOpciones.find(p => p.id === form.idParalelo);
  const errors = fieldErrors(form);
  const alerts = businessAlerts(form, paraleloSeleccionado?.nivel);
  const allOk = Object.keys(errors).length === 0;

  // Feedback instantáneo: en cuanto el usuario interactúa con un campo, ya se marca válido (visto azul) o inválido (rojo)
  const cls = (key: FieldKey, base: string) => {
    if (!touchedFields[key]) return base;
    if (errors[key]) return `${base} is-invalid`;
    const v = form[key];
    const filled = Array.isArray(v) ? v.length > 0 : String(v).trim().length > 0;
    return filled ? `${base} is-valid` : base;
  };
  const err = (key: FieldKey) => touchedFields[key] ? errors[key] : undefined;

  const submit = async () => {
    setAttempted(true);
    const allKeys = Object.keys(MATRICULA_EMPTY) as FieldKey[];
    setTouchedFields(Object.fromEntries(allKeys.map(k => [k, true])) as Partial<Record<FieldKey, boolean>>);
    if (!allOk || !paraleloSeleccionado) return;

    setSaving(true);
    setErrorApi(null);
    const req: MatriculaRequest = {
      estudianteNombres: form.nombres.trim(),
      estudianteApellidos: form.apellidos.trim(),
      estudianteCedula: form.cedula,
      fechaNacimiento: form.fechaNacimiento,
      genero: form.genero,
      nivel: paraleloSeleccionado.nivel,
      seccion: paraleloSeleccionado.seccion,
      anioLectivo: paraleloSeleccionado.anioLectivo,
      institucionProcedencia: form.institucionProcedencia || undefined,
      direccion: form.direccion.trim(),
      telefonoEstudiante: form.telefonoEstudiante || undefined,
      tipoSangre: form.tipoSangre || undefined,
      condicionMedica: form.condicionMedica || undefined,
      representanteNombres: form.representanteNombres.trim(),
      representanteApellidos: form.representanteApellidos.trim(),
      representanteCedula: form.representanteCedula,
      parentesco: form.parentesco,
      representanteEmail: form.representanteEmail.trim().toLowerCase(),
      representanteTelefono: form.representanteTelefono,
      contactoEmergencia: form.contactoEmergencia.trim(),
      documentos: form.documentos,
    };
    try {
      const resp = await matriculasApi.crear(req);
      setSaved({ codigo: resp.codigo, claveTemporal: resp.claveTemporal });
      setForm(MATRICULA_EMPTY);
      setTouchedFields({});
      setAttempted(false);
    } catch (e) {
      setErrorApi(e instanceof ApiError ? e.message : "No se pudo registrar la matrícula. Intente nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  const docsOk = form.documentos.length === DOCUMENTOS_REQUERIDOS.length;

  return (
    <div className="matricula-form">
      <style>{`
        .matricula-form .form-control.is-valid,
        .matricula-form .form-select.is-valid {
          border-color: #2E75B6;
          box-shadow: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Cpath fill='%232E75B6' d='M2.3 6.73L.6 4.53c-.39-.51-.28-1.24.24-1.62.51-.38 1.24-.28 1.62.24l.9 1.15L6.4 1.4c.4-.5 1.12-.58 1.62-.18.5.4.58 1.13.18 1.63L3.6 6.6c-.4.5-1.1.53-1.3.13z'/%3E%3C/svg%3E");
        }
        .matricula-form .form-control.is-valid:focus,
        .matricula-form .form-select.is-valid:focus {
          border-color: #2E75B6;
          box-shadow: 0 0 0 .25rem rgba(46,117,182,.25);
        }
        .matricula-form .form-control.is-invalid,
        .matricula-form .form-select.is-invalid {
          border-width: 2px;
          background-color: #FDECEC;
        }
        .matricula-form .form-control.is-invalid:focus,
        .matricula-form .form-select.is-invalid:focus {
          box-shadow: 0 0 0 .25rem rgba(198,40,40,.25);
        }
        .matricula-form .invalid-feedback { font-weight: 600; }
        .matricula-form .form-label { font-weight: 500; color: #33414F; }
        .matricula-form .card-header { font-weight: 600; color: #1A1A1A; }
        .matricula-form .docs-box.is-valid { border-color: #2E75B6 !important; background: #EAF2FB; }
        .matricula-form .docs-box.is-invalid { border-color: #C62828 !important; border-width: 2px; background: #FDECEC; }
      `}</style>

      <TopBar title="Matrícula de Estudiante" subtitle="Formulario de inscripción · registra al estudiante y, si es nuevo, la cuenta de su representante" />
      <div className="p-4" style={{ maxWidth: 1040 }}>

        {/* Alertas de negocio (no dependen de un solo campo) */}
        {alerts.length > 0 && (
          <div className="mb-3">
            {alerts.map((a, i) => (
              <div key={i} className={`alert d-flex align-items-start gap-2 py-2 mb-2 ${
                a.tipo === "error" ? "alert-danger" : a.tipo === "warning" ? "alert-warning" : "alert-info"}`} role="alert">
                {a.tipo === "error"   && <AlertTriangle size={16} className="flex-shrink-0 mt-1" />}
                {a.tipo === "warning" && <Clock         size={16} className="flex-shrink-0 mt-1" />}
                {a.tipo === "info"    && <Info          size={16} className="flex-shrink-0 mt-1" />}
                <span className="small mb-0">{a.msg}</span>
              </div>
            ))}
          </div>
        )}

        {/* 1. Datos del estudiante (8 campos) */}
        <div className="card shadow-sm mb-3">
          <div className="card-header bg-white">Datos del estudiante</div>
          <div className="card-body row g-3">
            <FormField label="Nombres" error={err("nombres")}>
              <input className={cls("nombres", "form-control")} value={form.nombres} onChange={e => set("nombres", e.target.value)} placeholder="Ej. Alejandra Nicole" autoComplete="given-name" />
            </FormField>
            <FormField label="Apellidos" error={err("apellidos")}>
              <input className={cls("apellidos", "form-control")} value={form.apellidos} onChange={e => set("apellidos", e.target.value)} placeholder="Ej. Morales Vega" autoComplete="family-name" />
            </FormField>
            <FormField label="Cédula de identidad" error={err("cedula")} hint={!touchedFields.cedula ? "10 dígitos, cédula ecuatoriana" : undefined}>
              <input className={cls("cedula", "form-control")} value={form.cedula} onChange={e => set("cedula", e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="1712345678" inputMode="numeric" maxLength={10} />
            </FormField>
            <FormField label="Fecha de nacimiento" error={err("fechaNacimiento")}>
              <input type="date" className={cls("fechaNacimiento", "form-control")} value={form.fechaNacimiento} onChange={e => set("fechaNacimiento", e.target.value)} />
            </FormField>
            <FormField label="Género" error={err("genero")}>
              <select className={cls("genero", "form-select")} value={form.genero} onChange={e => set("genero", e.target.value)}>
                <option value="">Seleccione…</option>
                {GENEROS.map(g => <option key={g.v} value={g.v}>{g.l}</option>)}
              </select>
            </FormField>
            <FormField label="Paralelo a matricular" error={err("idParalelo")} hint={paralelosOpciones.length === 0 ? "Cargando paralelos…" : undefined}>
              <select className={cls("idParalelo", "form-select")} value={form.idParalelo}
                onChange={e => set("idParalelo", e.target.value ? Number(e.target.value) : "")}>
                <option value="">Seleccione…</option>
                {paralelosOpciones.map(p => <option key={p.id} value={p.id}>{p.etiqueta} · {p.anioLectivo}</option>)}
              </select>
            </FormField>
            <FormField label="Dirección domiciliaria" error={err("direccion")}>
              <input className={cls("direccion", "form-control")} value={form.direccion} onChange={e => set("direccion", e.target.value)} placeholder="Calle, número, sector" autoComplete="street-address" />
            </FormField>
            <FormField label="Teléfono del estudiante" error={err("telefonoEstudiante")} required={false} hint={!touchedFields.telefonoEstudiante ? "Opcional · Ej. 0991234567" : undefined}>
              <input className={cls("telefonoEstudiante", "form-control")} value={form.telefonoEstudiante} onChange={e => set("telefonoEstudiante", e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="09XXXXXXXX" inputMode="numeric" maxLength={10} />
            </FormField>
          </div>
        </div>

        {/* 2. Salud (2 campos) */}
        <div className="card shadow-sm mb-3">
          <div className="card-header bg-white">Información de salud</div>
          <div className="card-body row g-3">
            <FormField label="Tipo de sangre" required={false}>
              <select className={cls("tipoSangre", "form-select")} value={form.tipoSangre} onChange={e => set("tipoSangre", e.target.value)}>
                <option value="">Seleccione…</option>
                {TIPOS_SANGRE.map(t => <option key={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Alergias / condición médica" required={false}>
              <textarea className={cls("condicionMedica", "form-control")} value={form.condicionMedica} onChange={e => set("condicionMedica", e.target.value)} placeholder="Ninguna, si no aplica" rows={1} />
            </FormField>
          </div>
        </div>

        {/* 3. Representante legal y contacto (7 campos) */}
        <div className="card shadow-sm mb-3">
          <div className="card-header bg-white">Representante legal y contacto</div>
          <div className="card-body row g-3">
            <FormField label="Nombres del representante" error={err("representanteNombres")}>
              <input className={cls("representanteNombres", "form-control")} value={form.representanteNombres} onChange={e => set("representanteNombres", e.target.value)} placeholder="Ej. Ana María" autoComplete="given-name" />
            </FormField>
            <FormField label="Apellidos del representante" error={err("representanteApellidos")}>
              <input className={cls("representanteApellidos", "form-control")} value={form.representanteApellidos} onChange={e => set("representanteApellidos", e.target.value)} placeholder="Ej. Morales Vega" autoComplete="family-name" />
            </FormField>
            <FormField label="Cédula del representante" error={err("representanteCedula")} hint={!touchedFields.representanteCedula ? "10 dígitos, cédula ecuatoriana" : undefined}>
              <input className={cls("representanteCedula", "form-control")} value={form.representanteCedula} onChange={e => set("representanteCedula", e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="1712345678" inputMode="numeric" maxLength={10} />
            </FormField>
            <FormField label="Parentesco" error={err("parentesco")}>
              <select className={cls("parentesco", "form-select")} value={form.parentesco} onChange={e => set("parentesco", e.target.value)}>
                <option value="">Seleccione…</option>
                {PARENTESCOS.map(p => <option key={p}>{p}</option>)}
              </select>
            </FormField>
            <FormField label="Correo electrónico" error={err("representanteEmail")} hint={!touchedFields.representanteEmail ? "Ej. nombre@correo.com" : undefined}>
              <input type="email" className={cls("representanteEmail", "form-control")} value={form.representanteEmail} onChange={e => set("representanteEmail", e.target.value)} placeholder="correo@ejemplo.com" autoComplete="email" />
            </FormField>
            <FormField label="Teléfono del representante" error={err("representanteTelefono")} hint={!touchedFields.representanteTelefono ? "Ej. 0991234567" : undefined}>
              <input className={cls("representanteTelefono", "form-control")} value={form.representanteTelefono} onChange={e => set("representanteTelefono", e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="09XXXXXXXX" inputMode="numeric" maxLength={10} />
            </FormField>
            <FormField label="Contacto de emergencia" error={err("contactoEmergencia")} hint={!touchedFields.contactoEmergencia ? "Nombre y teléfono de contacto" : undefined}>
              <input className={cls("contactoEmergencia", "form-control")} value={form.contactoEmergencia} onChange={e => set("contactoEmergencia", e.target.value)} placeholder="Ej. María Pérez 0991234567" />
            </FormField>
          </div>
        </div>

        {/* 4. Procedencia y documentos (2 campos) */}
        <div className="card shadow-sm mb-3">
          <div className="card-header bg-white">Procedencia y documentos</div>
          <div className="card-body row g-3">
            <FormField label="Institución de procedencia" required={false}>
              <input className={cls("institucionProcedencia", "form-control")} value={form.institucionProcedencia} onChange={e => set("institucionProcedencia", e.target.value)} placeholder="Nombre de la institución anterior" />
            </FormField>
            <div className="col-md-6">
              <label className="form-label">Documentos entregados <span className="text-danger">*</span></label>
              <div className={`docs-box border rounded p-2 ${touchedFields.documentos ? (docsOk ? "is-valid" : "is-invalid") : ""}`}>
                {DOCUMENTOS_REQUERIDOS.map(doc => (
                  <div className="form-check" key={doc.id}>
                    <input className="form-check-input" type="checkbox" id={`doc-${doc.id}`}
                      checked={form.documentos.includes(doc.id)} onChange={() => toggleDocumento(doc.id)} />
                    <label className="form-check-label" htmlFor={`doc-${doc.id}`}>{doc.label}</label>
                  </div>
                ))}
              </div>
              {touchedFields.documentos && (
                docsOk
                  ? <div className="form-text text-primary fw-semibold"><CheckCircle size={12} className="me-1" style={{ verticalAlign: "-1px" }} />Documentación completa</div>
                  : <div className="invalid-feedback d-block"><AlertCircle size={12} className="me-1" style={{ verticalAlign: "-1px" }} />{errors.documentos}</div>
              )}
            </div>
          </div>
        </div>

        {/* Resultado y envío */}
        {saved && (
          <div className="alert alert-success d-flex align-items-start gap-2 mb-3">
            <CheckCircle size={18} className="flex-shrink-0 mt-1" />
            <div>
              <p className="mb-1 fw-semibold">Matrícula registrada correctamente · código {saved.codigo}</p>
              {saved.claveTemporal ? (
                <p className="mb-0 small">
                  Se creó una cuenta nueva para el representante. Contraseña temporal: <strong>{saved.claveTemporal}</strong> (deberá cambiarla al ingresar por primera vez).
                </p>
              ) : (
                <p className="mb-0 small">El representante ya tenía una cuenta y fue vinculado a este estudiante.</p>
              )}
            </div>
          </div>
        )}
        {errorApi && (
          <div className="alert alert-danger d-flex align-items-start gap-2 mb-3">
            <AlertTriangle size={16} className="flex-shrink-0 mt-1" />
            <span className="small">{errorApi}</span>
          </div>
        )}
        <div className="d-flex align-items-center justify-content-end gap-3 pb-4">
          <button type="button" disabled={saving}
            className={`btn ${attempted && !allOk ? "btn-danger" : "btn-primary"} d-flex align-items-center gap-2`} onClick={submit}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Registrando…" : attempted && !allOk ? "Corrija los campos marcados" : "Registrar matrícula"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Financial ──────────────────────────────────────────────────────────────
const PAYMENT_CFG: Record<PaymentStatus, { label:string; badge: BadgeVariant; icon: React.ElementType; row:string }> = {
  paid:      { label:"Pagado",    badge:"success", icon: CheckCircle,   row:"" },
  pending:   { label:"Pendiente", badge:"warning", icon: Clock,         row:"" },
  overdue:   { label:"Vencido",   badge:"error",   icon: AlertTriangle, row:"bg-red-50/40" },
  cancelled: { label:"Anulado",   badge:"info",    icon: Info,          row:"" },
};

const ESTADO_TO_STATUS: Record<ObligacionResponse["estado"], PaymentStatus> = {
  PAGADO: "paid", PENDIENTE: "pending", VENCIDO: "overdue", ANULADO: "cancelled",
};

function FinancialView() {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<EstudianteConParalelo[]>([]);
  const [estudiante, setEstudiante] = useState<EstudianteConParalelo | null>(null);
  const [obligaciones, setObligaciones] = useState<ObligacionResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagando, setPagando] = useState<number | null>(null);
  const [errorApi, setErrorApi] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) { setResultados([]); return; }
    const t = setTimeout(() => {
      estudiantesApi.buscar(query.trim()).then(setResultados).catch(() => setResultados([]));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const cargarObligaciones = (idEstudiante: number) => {
    setLoading(true);
    setErrorApi(null);
    finanzasApi.porEstudiante(idEstudiante)
      .then(setObligaciones)
      .catch(e => setErrorApi(e instanceof ApiError ? e.message : "No se pudo cargar el estado de cuenta."))
      .finally(() => setLoading(false));
  };

  const seleccionar = (e: EstudianteConParalelo) => {
    setEstudiante(e);
    setResultados([]);
    setQuery("");
    cargarObligaciones(e.id);
  };

  const registrarPago = async (o: ObligacionResponse) => {
    setPagando(o.idObligacion);
    setErrorApi(null);
    try {
      await finanzasApi.registrarPago(o.idObligacion, o.valor);
      if (estudiante) cargarObligaciones(estudiante.id);
    } catch (e) {
      setErrorApi(e instanceof ApiError ? e.message : "No se pudo registrar el pago.");
    } finally {
      setPagando(null);
    }
  };

  const totals = {
    paid:    obligaciones.filter(o => o.estado === "PAGADO").reduce((s, o) => s + o.valor, 0),
    pending: obligaciones.filter(o => o.estado === "PENDIENTE").reduce((s, o) => s + o.valor, 0),
    overdue: obligaciones.filter(o => o.estado === "VENCIDO").reduce((s, o) => s + o.valor, 0),
  };

  return (
    <div>
      <TopBar title="Estado de Cuenta"
        subtitle={estudiante ? `${estudiante.nombreCompleto}${estudiante.paralelo ? ` · ${estudiante.paralelo}` : ""}` : "Busque un estudiante"} />
      <div className="p-6 space-y-5">
        {/* Búsqueda */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Buscar estudiante</label>
          <div className="relative mt-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Nombre o apellido del estudiante"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
            {resultados.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                {resultados.map(r => (
                  <li key={r.id}>
                    <button onClick={() => seleccionar(r)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#EAF2FB] flex items-center justify-between">
                      <span className="font-medium text-[#1A1A1A]">{r.nombreCompleto}</span>
                      {r.paralelo && <span className="text-xs text-gray-400">{r.paralelo}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {errorApi && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />{errorApi}
          </div>
        )}

        {!estudiante && <EmptyState icon={Search} title="Busque un estudiante para ver su estado de cuenta." />}

        {estudiante && loading && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-sm text-gray-400">
            <Loader2 size={16} className="animate-spin inline-block mr-2" />Cargando…
          </div>
        )}

        {estudiante && !loading && obligaciones.length === 0 && (
          <EmptyState icon={Receipt} title="Este estudiante no tiene obligaciones de pago registradas." />
        )}

        {estudiante && !loading && obligaciones.length > 0 && (
        <>
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border-l-4 border-l-[#2E7D32] p-4 shadow-sm">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Total pagado</p>
            <p className="text-[28px] font-bold text-[#2E7D32] leading-none">${totals.paid.toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">{obligaciones.filter(o => o.estado === "PAGADO").length} obligaciones al día</p>
          </div>
          <div className="bg-white rounded-xl border-l-4 border-l-amber-500 p-4 shadow-sm">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Saldo pendiente</p>
            <p className="text-[28px] font-bold text-amber-600 leading-none">${totals.pending.toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">{obligaciones.filter(o => o.estado === "PENDIENTE").length} obligaciones pendientes</p>
          </div>
          <div className="bg-white rounded-xl border-l-4 border-l-[#C62828] p-4 shadow-sm">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Monto vencido</p>
            <p className="text-[28px] font-bold text-[#C62828] leading-none">${totals.overdue.toFixed(2)}</p>
            <p className="text-xs text-[#C62828] mt-1">{totals.overdue > 0 ? "Requiere atención inmediata" : "Sin vencidos"}</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-[#1A1A1A]">Detalle de obligaciones</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F5F7FA]">
                {["Rubro","Monto","Vencimiento","Fecha de pago","Estado",""].map(h => (
                  <th key={h} className={`px-5 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest ${h === "Monto" ? "text-right" : h === "" ? "" : "text-center"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {obligaciones.map((o, idx) => {
                const cfg = PAYMENT_CFG[ESTADO_TO_STATUS[o.estado]];
                const Icon = cfg.icon;
                return (
                  <tr key={o.idObligacion}
                    className={`border-t border-gray-100 transition-colors ${cfg.row || (idx % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]")} hover:bg-[#EAF2FB]/20`}>
                    <td className="px-5 py-3.5 font-medium text-[#1A1A1A]">{o.rubro}</td>
                    <td className="px-5 py-3.5 text-right font-mono font-semibold text-[#1A1A1A]">${o.valor.toFixed(2)}</td>
                    <td className="px-5 py-3.5 text-center text-gray-500 text-xs">{o.fechaVencimiento}</td>
                    <td className="px-5 py-3.5 text-center text-gray-500 text-xs">
                      {o.pago ? new Date(o.pago.fechaPago).toLocaleDateString("es-EC") : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <Badge v={cfg.badge}><Icon size={11} />{cfg.label}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      {(o.estado === "PENDIENTE" || o.estado === "VENCIDO") && (
                        <Btn variant="secondary" size="sm" disabled={pagando === o.idObligacion} onClick={() => registrarPago(o)}>
                          {pagando === o.idObligacion ? <Loader2 size={12} className="animate-spin" /> : "Registrar pago"}
                        </Btn>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

// ── Parent Portal ──────────────────────────────────────────────────────────
type ParentTab = "home" | "grades" | "attendance" | "payments";

function ParentPortal({ onLogout, embed = false, nombre = "" }: { onLogout: () => void; embed?: boolean; nombre?: string }) {
  const [tab, setTab] = useState<ParentTab>("home");
  const [hijos, setHijos] = useState<EstudianteConParalelo[]>([]);
  const [idEstudiante, setIdEstudiante] = useState<number | null>(null);
  const [notas, setNotas] = useState<NotaEstudianteResponse[]>([]);
  const [asistenciaHist, setAsistenciaHist] = useState<AsistenciaRegistro[]>([]);
  const [obligaciones, setObligaciones] = useState<ObligacionResponse[]>([]);
  const [inbox, setInbox] = useState<MensajeResponse[]>([]);
  const [loading, setLoading] = useState(!embed);
  const [errorApi, setErrorApi] = useState<string | null>(null);

  const tabs: { id: ParentTab; label: string; icon: React.ElementType }[] = [
    { id:"home",       label:"Inicio",     icon: Home },
    { id:"grades",     label:"Notas",      icon: BookOpen },
    { id:"attendance", label:"Asistencia", icon: Users },
    { id:"payments",   label:"Pagos",      icon: DollarSign },
  ];

  useEffect(() => {
    if (embed) { setLoading(false); return; }
    estudiantesApi.mios()
      .then(lista => {
        setHijos(lista);
        if (lista.length > 0) setIdEstudiante(lista[0].id);
      })
      .catch(e => setErrorApi(e instanceof ApiError ? e.message : "No se pudo cargar la información."))
      .finally(() => setLoading(false));
    mensajesApi.mias().then(setInbox).catch(() => {});
  }, [embed]);

  useEffect(() => {
    if (embed || idEstudiante == null) return;
    Promise.all([
      calificacionesApi.porEstudiante(idEstudiante),
      asistenciaApi.porEstudiante(idEstudiante),
      finanzasApi.porEstudiante(idEstudiante),
    ]).then(([n, a, o]) => { setNotas(n); setAsistenciaHist(a); setObligaciones(o); })
      .catch(e => setErrorApi(e instanceof ApiError ? e.message : "No se pudo cargar la información del estudiante."));
  }, [embed, idEstudiante]);

  const promedios = notas.map(n => n.promedio).filter((p): p is number => p != null);
  const promedioGeneral = promedios.length > 0 ? promedios.reduce((a, b) => a + b, 0) / promedios.length : null;

  const presentes = asistenciaHist.filter(a => a.estado === "PRESENTE").length;
  const justificadas = asistenciaHist.filter(a => a.estado === "AUSENCIA_JUSTIFICADA").length;
  const injustificadas = asistenciaHist.filter(a => a.estado === "AUSENCIA_INJUSTIFICADA").length;
  const totalAsistencia = asistenciaHist.length;
  const pctAsistencia = totalAsistencia > 0 ? Math.round((presentes / totalAsistencia) * 100) : null;

  const saldoPendiente = obligaciones
    .filter(o => o.estado === "PENDIENTE" || o.estado === "VENCIDO")
    .reduce((s, o) => s + o.valor, 0);
  const vencidas = obligaciones.filter(o => o.estado === "VENCIDO");

  const hijoActivo = hijos.find(h => h.id === idEstudiante) ?? null;

  return (
    <div className={embed ? "p-6" : "min-h-screen bg-[#F5F7FA] p-4 sm:p-6"} style={{ fontFamily:"'Inter', sans-serif" }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-[#1F4E79] rounded-2xl px-5 sm:px-7 pt-5 pb-5 sm:pt-6 sm:pb-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-white/60 text-xs">Buenos días,</p>
              <h1 className="text-white text-xl sm:text-2xl font-bold mt-0.5">{nombre || "Representante"}</h1>
            </div>
            <button onClick={onLogout} className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors flex-shrink-0">
              <LogOut size={16} className="text-white" />
            </button>
          </div>
          {hijos.length > 1 && (
            <select value={idEstudiante ?? ""} onChange={e => setIdEstudiante(Number(e.target.value))}
              className="mt-3 w-full sm:w-72 bg-white/10 text-white text-xs rounded-lg px-2.5 py-1.5 outline-none">
              {hijos.map(h => <option key={h.id} value={h.id} className="text-[#1A1A1A]">{h.nombreCompleto}</option>)}
            </select>
          )}

          {/* Tabs */}
          {!embed && hijoActivo && (
            <div className="flex gap-2 mt-5 overflow-x-auto">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0
                    ${tab === id ? "bg-white text-[#1F4E79]" : "text-white/70 hover:bg-white/10"}`}>
                  <Icon size={15} />{label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="mt-5 space-y-5">
          {embed && (
            <EmptyState icon={Smartphone} title="Vista previa del Portal Familiar"
              description="Inicie sesión con una cuenta de representante para ver los datos reales de un estudiante." />
          )}

          {!embed && loading && (
            <div className="text-center text-sm text-gray-400 py-8"><Loader2 size={16} className="animate-spin inline-block mr-2" />Cargando…</div>
          )}

          {!embed && !loading && errorApi && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />{errorApi}
            </div>
          )}

          {!embed && !loading && !errorApi && hijos.length === 0 && (
            <EmptyState icon={Users} title="Aún no tiene estudiantes registrados a su cargo." />
          )}

          {!embed && !loading && hijoActivo && tab === "home" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Columna principal */}
              <div className="lg:col-span-2 space-y-5">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 bg-[#EAF2FB] rounded-full flex items-center justify-center text-sm font-bold text-[#1F4E79] flex-shrink-0">
                      {initials(hijoActivo.nombreCompleto)}
                    </div>
                    <div>
                      <p className="font-semibold text-[#1A1A1A] text-sm">{hijoActivo.nombreCompleto}</p>
                      {hijoActivo.paralelo && <p className="text-xs text-gray-400">{hijoActivo.paralelo}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className={`rounded-xl p-4 border text-center ${promedioGeneral != null && promedioGeneral < 7 ? "bg-red-50 border-red-100" : "bg-gray-50 border-gray-100"}`}>
                      <p className="text-[10px] text-gray-400 mb-1">Promedio</p>
                      <p className={`text-2xl font-bold ${promedioGeneral != null && promedioGeneral < 7 ? "text-[#C62828]" : "text-[#1A1A1A]"}`}>
                        {promedioGeneral != null ? promedioGeneral.toFixed(1) : "--"}
                      </p>
                      {promedioGeneral != null && promedioGeneral < 7 && <p className="text-[10px] text-[#C62828] font-medium mt-0.5">En riesgo</p>}
                    </div>
                    <div className="bg-[#EAF2FB] rounded-xl p-4 border border-blue-100 text-center">
                      <p className="text-[10px] text-gray-400 mb-1">Asistencia</p>
                      <p className="text-2xl font-bold text-[#1F4E79]">{pctAsistencia != null ? `${pctAsistencia}%` : "--"}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Últimos 6 meses</p>
                    </div>
                    <div className={`rounded-xl p-4 border text-center ${saldoPendiente > 0 ? "bg-amber-50 border-amber-100" : "bg-gray-50 border-gray-100"}`}>
                      <p className="text-[10px] text-gray-400 mb-1">Saldo</p>
                      <p className={`text-2xl font-bold ${saldoPendiente > 0 ? "text-amber-600" : "text-[#1A1A1A]"}`}>${saldoPendiente.toFixed(0)}</p>
                      <p className={`text-[10px] font-medium mt-0.5 ${saldoPendiente > 0 ? "text-amber-600" : "text-gray-400"}`}>
                        {saldoPendiente > 0 ? "Pendiente" : "Al día"}
                      </p>
                    </div>
                  </div>
                </div>

                {promedioGeneral != null && promedioGeneral < 7 && (
                  <div className="bg-red-50 rounded-2xl border border-red-200 p-4 flex gap-3">
                    <AlertTriangle size={17} className="text-[#C62828] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-[#C62828]">Riesgo académico detectado</p>
                      <p className="text-xs text-red-700 mt-0.5 leading-relaxed">Promedio general {promedioGeneral.toFixed(1)}/10. Se recomienda refuerzo académico.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Columna lateral */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <p className="text-sm font-semibold text-[#1A1A1A] mb-3">Mensajes institucionales</p>
                  {inbox.length === 0 ? (
                    <p className="text-xs text-gray-400">Aún no tiene mensajes.</p>
                  ) : (
                    <ul className="space-y-3">
                      {inbox.slice(0, 5).map(m => (
                        <li key={m.idMensaje} className="flex items-start gap-2.5">
                          <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!m.leido ? "bg-[#2E75B6]" : "bg-transparent"}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold ${!m.leido ? "text-[#1A1A1A]" : "text-gray-500"}`}>{m.asunto}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5 truncate">{m.cuerpo}</p>
                          </div>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">
                            {new Date(m.enviadoEn).toLocaleDateString("es-EC", { day:"2-digit", month:"short" })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {!embed && !loading && hijoActivo && tab === "grades" && <>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Calificaciones por materia</p>
            {notas.length === 0 ? (
              <EmptyState icon={BookOpen} title="Sin calificaciones registradas." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {notas.map(n => (
                  <div key={n.idCalificacion} className={`bg-white rounded-2xl border p-4 shadow-sm ${n.enRiesgo ? "border-red-200" : "border-gray-200"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-[#1A1A1A]">{n.materia} <span className="text-xs font-normal text-gray-400">· Parcial {n.parcial}</span></p>
                      <span className={`text-lg font-bold ${n.enRiesgo ? "text-[#C62828]" : "text-[#2E7D32]"}`}>{n.promedio ?? "—"}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-center mb-3">
                      {[["Tarea 20%", n.notaTarea], ["Clase 20%", n.notaClase], ["Examen 60%", n.notaExamen]].map(([l, v]) => (
                        <div key={String(l)}>
                          <p className="text-gray-400 mb-0.5">{l}</p>
                          <p className="font-mono font-semibold text-gray-700">{v ?? "—"}</p>
                        </div>
                      ))}
                    </div>
                    {n.promedio != null && (
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${n.enRiesgo ? "bg-[#C62828]" : "bg-[#2E7D32]"}`}
                          style={{ width:`${(n.promedio/10)*100}%`, transition:"width 0.4s ease" }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>}

          {!embed && !loading && hijoActivo && tab === "attendance" && <>
            {totalAsistencia === 0 ? (
              <EmptyState icon={Clock} title="Sin registros de asistencia." />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 max-w-xl">
                <p className="text-sm font-semibold text-[#1A1A1A] mb-4">Resumen · Últimos 6 meses</p>
                <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                  <div><p className="text-2xl font-bold text-[#2E7D32]">{presentes}</p><p className="text-xs text-gray-400 mt-0.5">Presente</p></div>
                  <div><p className="text-2xl font-bold text-amber-500">{justificadas}</p><p className="text-xs text-gray-400 mt-0.5">A. justif.</p></div>
                  <div><p className="text-2xl font-bold text-[#C62828]">{injustificadas}</p><p className="text-xs text-gray-400 mt-0.5">A. injustif.</p></div>
                </div>
                <div className="h-2 rounded-full overflow-hidden flex bg-gray-100">
                  <div className="bg-[#2E7D32] h-full" style={{ width:`${(presentes/totalAsistencia)*100}%` }} />
                  <div className="bg-amber-400 h-full" style={{ width:`${(justificadas/totalAsistencia)*100}%` }} />
                  <div className="bg-[#C62828] h-full" style={{ width:`${(injustificadas/totalAsistencia)*100}%` }} />
                </div>
                <p className="text-xs text-center text-gray-400 mt-2">{pctAsistencia}% de asistencia</p>
              </div>
            )}
          </>}

          {!embed && !loading && hijoActivo && tab === "payments" && <>
            {obligaciones.length === 0 ? (
              <EmptyState icon={DollarSign} title="Sin obligaciones de pago registradas." />
            ) : (
              <div className="space-y-4">
                {vencidas.length > 0 && (
                  <div className="bg-red-50 rounded-2xl border border-red-200 p-3.5 flex gap-2.5">
                    <AlertTriangle size={15} className="text-[#C62828] flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 leading-relaxed">
                      Tiene <strong>{vencidas.length} {vencidas.length === 1 ? "obligación vencida" : "obligaciones vencidas"} (${vencidas.reduce((s, o) => s + o.valor, 0).toFixed(2)})</strong>. Por favor regularice su pago.
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {obligaciones.map(o => {
                    const cfg = PAYMENT_CFG[ESTADO_TO_STATUS[o.estado]];
                    const Icon = cfg.icon;
                    return (
                      <div key={o.idObligacion} className={`bg-white rounded-2xl border p-4 flex items-center justify-between ${o.estado === "VENCIDO" ? "border-red-200" : "border-gray-200"} shadow-sm`}>
                        <div>
                          <p className="text-sm font-semibold text-[#1A1A1A]">{o.rubro}</p>
                          <p className="text-xs text-gray-400">Vence: {o.fechaVencimiento}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold font-mono text-[#1A1A1A]">${o.valor.toFixed(2)}</p>
                          <Badge v={cfg.badge}><Icon size={10} />{cfg.label}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>}
        </div>
      </div>
    </div>
  );
}

// ── Validation / Components Showcase ──────────────────────────────────────
function ValidationView() {
  return (
    <div>
      <TopBar title="Guía de Componentes UI" subtitle="Sistema de diseño SAGAB · Variantes y estados" />
      <div className="p-6 space-y-6">

        {/* Buttons */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-[#1A1A1A] mb-4">Botones · Variantes y tamaños</h2>
          <div className="flex flex-wrap gap-3 items-center mb-4">
            <Btn>Ingresar al sistema</Btn>
            <Btn variant="secondary">Cancelar</Btn>
            <Btn variant="danger">Eliminar registro</Btn>
            <Btn variant="ghost">Ver más</Btn>
            <Btn disabled>Guardar (deshabilitado)</Btn>
          </div>
          <div className="flex gap-3 items-center">
            <Btn size="sm">Pequeño</Btn>
            <Btn size="md">Mediano</Btn>
            <Btn size="lg">Grande</Btn>
          </div>
        </section>

        {/* Form inputs */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-[#1A1A1A] mb-5">Campos de formulario · Estados</h2>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Default</p>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre del estudiante</label>
              <input type="text" placeholder="Ej. Alejandra Morales"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm bg-white outline-none hover:border-gray-400 transition-colors" />
              <p className="text-xs text-gray-400 mt-1.5">Ingrese el nombre completo</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#2E75B6] uppercase tracking-widest mb-3">Focused (activo)</p>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Correo institucional</label>
              <input type="email" defaultValue="ana.morales@bellini"
                className="w-full px-3 py-2.5 rounded-lg border text-sm bg-white outline-none border-[#2E75B6] ring-2 ring-[#2E75B6]/20" />
              <p className="text-xs text-[#2E75B6] mt-1.5">Borde azul + ring de enfoque (2px)</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#C62828] uppercase tracking-widest mb-3">Error (validación)</p>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Calificación</label>
              <div className="relative">
                <input type="number" defaultValue="11"
                  className="w-full px-3 py-2.5 pr-9 rounded-lg border border-[#C62828] ring-1 ring-[#C62828]/25 bg-red-50 text-[#C62828] text-sm outline-none" />
                <AlertCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C62828]" />
              </div>
              <p className="text-xs text-[#C62828] mt-1.5 flex items-center gap-1">
                <AlertCircle size={11} />El valor debe estar entre 1.0 y 10.0
              </p>
            </div>
          </div>
        </section>

        {/* Badges */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-[#1A1A1A] mb-4">Badges de estado</h2>
          <div className="flex flex-wrap gap-2.5">
            <Badge v="success"><CheckCircle size={11} />Pagado</Badge>
            <Badge v="success"><CheckCircle size={11} />Aprobado</Badge>
            <Badge v="warning"><Clock size={11} />Pendiente</Badge>
            <Badge v="warning"><Clock size={11} />Ausencia justificada</Badge>
            <Badge v="error"><AlertTriangle size={11} />Vencido</Badge>
            <Badge v="error"><AlertTriangle size={11} />En riesgo académico</Badge>
            <Badge v="info"><MessageSquare size={11} />Sin revisar</Badge>
          </div>
        </section>

        {/* Student cards */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-[#1A1A1A] mb-4">Tarjetas de estudiante · Default y En riesgo</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { name:"Alejandra Morales Vega", avg:8.4, att:96, risk:false },
              { name:"Diego Hernández Ruiz",   avg:5.2, att:78, risk:true },
            ].map((s, i) => (
              <div key={i}
                className={`rounded-xl border p-4 shadow-sm transition-all ${s.risk ? "border-red-200 bg-red-50/20" : "border-gray-200 bg-white hover:shadow-md"}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                    ${s.risk ? "bg-red-100 text-[#C62828]" : "bg-[#EAF2FB] text-[#1F4E79]"}`}>
                    {initials(s.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1A1A1A] truncate">{s.name}</p>
                    <p className="text-xs text-gray-400">2°A · 2025</p>
                  </div>
                  {s.risk && <Badge v="error"><AlertTriangle size={10} />En riesgo</Badge>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className={`rounded-lg p-3 ${s.risk ? "bg-red-100" : "bg-[#EAF2FB]"}`}>
                    <p className="text-[10px] text-gray-400">Promedio</p>
                    <p className={`text-xl font-bold ${s.risk ? "text-[#C62828]" : "text-[#1F4E79]"}`}>{s.avg}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400">Asistencia</p>
                    <p className="text-xl font-bold text-gray-700">{s.att}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Nav items */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-[#1A1A1A] mb-4">Ítems de menú lateral · Activo e Inactivo</h2>
          <div className="bg-[#1F4E79] rounded-xl p-2.5 w-48 space-y-0.5">
            {[
              { icon: Home,      label:"Inicio",     active:true },
              { icon: BookOpen,  label:"Académico",  active:false },
              { icon: Users,     label:"Asistencia", active:false },
              { icon: DollarSign,label:"Financiero", active:false },
            ].map(({ icon: Icon, label, active }, i) => (
              <div key={i}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-default
                  ${active ? "bg-white/15 text-white" : "text-white/60"}`}>
                <Icon size={16} />
                {label}
                {active && <ChevronRight size={13} className="ml-auto opacity-50" />}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────
export default function App() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [screen, setScreen] = useState<Screen>("dashboard");

  const logout = () => { apiLogout(); setSesion(null); };

  // Si el token expira o el backend responde 401, client.ts dispara este evento.
  useEffect(() => {
    const onExpirada = () => setSesion(null);
    window.addEventListener("sagab:sesion-expirada", onExpirada);
    return () => window.removeEventListener("sagab:sesion-expirada", onExpirada);
  }, []);

  if (!sesion) {
    return (
      <LoginScreen onLogin={s => {
        setSesion(s);
        setScreen(s.roles[0] === "REPRESENTANTE" ? "parent" : "dashboard");
      }} />
    );
  }

  const rolPrincipal: RolSistema = sesion.roles[0];

  if (rolPrincipal === "REPRESENTANTE") {
    return <ParentPortal onLogout={logout} nombre={sesion.nombre} />;
  }

  const nav = NAV.filter(item => NAV_POR_ROL[rolPrincipal].includes(item.id));
  const permitido = (s: Screen) => NAV_POR_ROL[rolPrincipal].includes(s);

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily:"'Inter', sans-serif" }}>
      <Sidebar active={screen} onNav={setScreen} onLogout={logout}
        nav={nav} nombre={sesion.nombre} rolLabel={ROL_LABEL[rolPrincipal]} />
      <main className="flex-1 overflow-y-auto bg-[#F5F7FA]">
        {screen === "dashboard"  && <DashboardView />}
        {screen === "matricula"  && permitido("matricula")  && <MatriculaView />}
        {screen === "grades"     && permitido("grades")     && <GradesView onNavigate={setScreen} />}
        {screen === "attendance" && permitido("attendance") && <AttendanceView onNavigate={setScreen} />}
        {screen === "financial"  && permitido("financial")  && <FinancialView />}
        {screen === "parent"     && permitido("parent")     && <ParentPortal onLogout={logout} embed nombre={sesion.nombre} />}
        {screen === "validation" && permitido("validation") && <ValidationView />}
      </main>
    </div>
  );
}
