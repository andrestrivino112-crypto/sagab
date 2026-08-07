import {
  BookOpen, Users, DollarSign, Home, LogOut,
  GraduationCap, ChevronRight, Smartphone, UserPlus, FileUp, AlertTriangle, History, IdCard, CalendarDays,
} from "lucide-react";
import type { RolSistema } from "../../api/auth";
import type { Screen } from "../types";
import { initials } from "../helpers";

export const NAV = [
  { id:"dashboard"    as Screen, label:"Inicio",             icon: Home },
  { id:"matricula"    as Screen, label:"Matrícula",          icon: UserPlus },
  { id:"grades"       as Screen, label:"Académico",           icon: BookOpen },
  { id:"attendance"   as Screen, label:"Asistencia",          icon: Users },
  { id:"calendar"      as Screen, label:"Calendario",          icon: CalendarDays },
  { id:"deceAlertas"  as Screen, label:"Alertas de Asistencia", icon: AlertTriangle },
  { id:"tareas"       as Screen, label:"Deberes",             icon: FileUp },
  { id:"financial"    as Screen, label:"Financiero",          icon: DollarSign },
  { id:"personal"     as Screen, label:"Personal",            icon: IdCard },
  { id:"auditoria"    as Screen, label:"Auditoría",           icon: History },
  { id:"parent"       as Screen, label:"Portal Familiar",     icon: Smartphone },
];

/** Qué módulos ve cada rol — el docente no debe ver Matrícula ni Financiero. */
export const NAV_POR_ROL: Record<RolSistema, Screen[]> = {
  ADMIN:         ["dashboard", "matricula", "grades", "attendance", "calendar", "tareas", "financial", "personal", "parent"],
  DOCENTE:       ["dashboard", "grades", "attendance", "calendar", "tareas"],
  DECE:          ["dashboard", "calendar", "deceAlertas"],
  AUDITOR:       ["dashboard", "auditoria"],
  REPRESENTANTE: [],
  // El estudiante usa el Portal Familiar (mismo componente que el representante, viendo sus
  // propios datos) en vez del layout con Sidebar — ver App.tsx.
  ESTUDIANTE:    [],
};

export const ROL_LABEL: Record<RolSistema, string> = {
  ADMIN: "Administrador", DOCENTE: "Docente", REPRESENTANTE: "Representante",
  AUDITOR: "Auditor", DECE: "Consejería DECE", ESTUDIANTE: "Estudiante",
};

export function Sidebar({ active, onNav, onLogout, nav, nombre, rolLabel }: {
  active: Screen; onNav: (s: Screen) => void; onLogout: () => void;
  nav: typeof NAV; nombre: string; rolLabel: string;
}) {
  return (
    <aside className="w-[232px] flex-shrink-0 bg-[#1F4E79] flex flex-col h-screen overflow-y-auto">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
            <GraduationCap size={20} className="text-white" aria-hidden="true" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">SAGAB</p>
            <p className="text-white/50 text-xs mt-0.5">Inst. Bellini</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4" aria-label="Navegación principal">
        <p className="text-white/40 text-[10px] font-semibold uppercase tracking-[0.12em] px-3 mb-2">Módulos</p>
        <ul className="space-y-0.5">
          {nav.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button onClick={() => onNav(id)} aria-current={active === id ? "page" : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1F4E79]
                  ${active === id ? "bg-white/15 text-white" : "text-white/65 hover:bg-white/8 hover:text-white"}`}>
                <Icon size={17} className="flex-shrink-0" aria-hidden="true" />
                {label}
                {active === id && <ChevronRight size={13} className="ml-auto opacity-50" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* User */}
      <div className="px-2 py-3 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0" aria-hidden="true">
            {initials(nombre)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{nombre}</p>
            <p className="text-white/45 text-[11px] truncate">{rolLabel}</p>
          </div>
        </div>
        <button onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white text-sm transition-all
            focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1F4E79]">
          <LogOut size={15} aria-hidden="true" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
