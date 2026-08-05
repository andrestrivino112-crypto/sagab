import { lazy, Suspense, useEffect, useState } from "react";
import { logout as apiLogout, type Sesion, type RolSistema } from "../api/auth";
import { NAV, NAV_POR_ROL, ROL_LABEL, Sidebar } from "./components/Sidebar";
import { LoginScreen } from "./views/LoginScreen";
import { CambiarClaveScreen } from "./views/CambiarClaveScreen";
import type { Screen } from "./types";

// Cada vista es su propio chunk: solo se descarga la que el usuario visita.
const DashboardView = lazy(() => import("./views/DashboardView").then(m => ({ default: m.DashboardView })));
const GradesView = lazy(() => import("./views/GradesView").then(m => ({ default: m.GradesView })));
const AttendanceView = lazy(() => import("./views/AttendanceView").then(m => ({ default: m.AttendanceView })));
const MatriculaView = lazy(() => import("./views/MatriculaView").then(m => ({ default: m.MatriculaView })));
const FinancialView = lazy(() => import("./views/FinancialView").then(m => ({ default: m.FinancialView })));
const ParentPortal = lazy(() => import("./views/ParentPortal").then(m => ({ default: m.ParentPortal })));
const TareasView = lazy(() => import("./views/TareasView").then(m => ({ default: m.TareasView })));

function ViewFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center p-12" role="status" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2E75B6] border-t-transparent" aria-hidden="true" />
    </div>
  );
}

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
        setScreen(s.roles[0] === "REPRESENTANTE" || s.roles[0] === "ESTUDIANTE" ? "parent" : "dashboard");
      }} />
    );
  }

  if (sesion.debeCambiarClave) {
    return (
      <CambiarClaveScreen
        nombre={sesion.nombre}
        onLogout={logout}
        onCompletado={() => setSesion({ ...sesion, debeCambiarClave: false })}
      />
    );
  }

  const rolPrincipal: RolSistema = sesion.roles[0];

  if (rolPrincipal === "REPRESENTANTE" || rolPrincipal === "ESTUDIANTE") {
    return (
      <Suspense fallback={<ViewFallback />}>
        <ParentPortal onLogout={logout} nombre={sesion.nombre} rol={rolPrincipal} />
      </Suspense>
    );
  }

  const nav = NAV.filter(item => NAV_POR_ROL[rolPrincipal].includes(item.id));
  const permitido = (s: Screen) => NAV_POR_ROL[rolPrincipal].includes(s);

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily:"'Inter', sans-serif" }}>
      <Sidebar active={screen} onNav={setScreen} onLogout={logout}
        nav={nav} nombre={sesion.nombre} rolLabel={ROL_LABEL[rolPrincipal]} />
      <main className="flex-1 overflow-y-auto bg-[#F5F7FA]">
        <Suspense fallback={<ViewFallback />}>
          {screen === "dashboard"  && <DashboardView />}
          {screen === "matricula"  && permitido("matricula")  && <MatriculaView />}
          {screen === "grades"     && permitido("grades")     && <GradesView onNavigate={setScreen} />}
          {screen === "attendance" && permitido("attendance") && <AttendanceView onNavigate={setScreen} />}
          {screen === "tareas"     && permitido("tareas")     && <TareasView soloLectura={rolPrincipal !== "DOCENTE"} />}
          {screen === "financial"  && permitido("financial")  && <FinancialView />}
          {screen === "parent"     && permitido("parent")     && <ParentPortal onLogout={logout} embed nombre={sesion.nombre} />}
        </Suspense>
      </main>
    </div>
  );
}
