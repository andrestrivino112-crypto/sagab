import { useEffect, useState } from "react";
import { logout as apiLogout, type Sesion, type RolSistema } from "../api/auth";
import { NAV, NAV_POR_ROL, ROL_LABEL, Sidebar } from "./components/Sidebar";
import { LoginScreen } from "./views/LoginScreen";
import { DashboardView } from "./views/DashboardView";
import { GradesView } from "./views/GradesView";
import { AttendanceView } from "./views/AttendanceView";
import { MatriculaView } from "./views/MatriculaView";
import { FinancialView } from "./views/FinancialView";
import { ParentPortal } from "./views/ParentPortal";
import type { Screen } from "./types";

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
      </main>
    </div>
  );
}
