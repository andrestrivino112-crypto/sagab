import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { logout as apiLogout, recuperarSesion, type Sesion, type RolSistema } from "../api/auth";
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
const DeceAlertasView = lazy(() => import("./views/DeceAlertasView").then(m => ({ default: m.DeceAlertasView })));
const AuditoriaView = lazy(() => import("./views/AuditoriaView").then(m => ({ default: m.AuditoriaView })));
const PersonalView = lazy(() => import("./views/PersonalView").then(m => ({ default: m.PersonalView })));
const CalendarView = lazy(() => import("./views/CalendarView").then(m => ({ default: m.CalendarView })));

function ViewFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center p-12" role="status" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2E75B6] border-t-transparent" aria-hidden="true" />
    </div>
  );
}

/** A dónde aterriza cada rol justo después de iniciar sesión (o al recargar en "/"). */
const pantallaInicial = (rol: RolSistema): string =>
  rol === "REPRESENTANTE" || rol === "ESTUDIANTE" ? "/parent" : "/dashboard";

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  const logout = () => {
    apiLogout();
    setSesion(null);
    navigate("/", { replace: true });
  };

  // Recupera la sesión desde el token guardado (sessionStorage) al arrancar la app — sin esto,
  // recargar la página o abrir un enlace interno directo mandaba al login aunque el token
  // siguiera siendo válido.
  useEffect(() => {
    recuperarSesion().then(s => {
      setSesion(s);
      // Solo redirige si venimos de la raíz (login/recarga en "/"): si el usuario recargó en
      // una pantalla concreta (p. ej. "/grades"), debe quedarse ahí, no volver siempre al inicio.
      if (s && (location.pathname === "/" || location.pathname === "")) {
        navigate(pantallaInicial(s.roles[0]), { replace: true });
      }
    }).finally(() => setBootstrapping(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si el token expira o el backend responde 401, client.ts dispara este evento.
  useEffect(() => {
    const onExpirada = () => setSesion(null);
    window.addEventListener("sagab:sesion-expirada", onExpirada);
    return () => window.removeEventListener("sagab:sesion-expirada", onExpirada);
  }, []);

  if (bootstrapping) {
    return <ViewFallback />;
  }

  if (!sesion) {
    return (
      <LoginScreen onLogin={s => {
        setSesion(s);
        navigate(pantallaInicial(s.roles[0]), { replace: true });
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
        <Routes>
          <Route path="*" element={<ParentPortal onLogout={logout} nombre={sesion.nombre} rol={rolPrincipal} />} />
        </Routes>
      </Suspense>
    );
  }

  const nav = NAV.filter(item => NAV_POR_ROL[rolPrincipal].includes(item.id));
  const permitido = (s: Screen) => NAV_POR_ROL[rolPrincipal].includes(s);
  // Screen y el segmento de ruta coinciden 1 a 1 (ver types.ts) — el mismo valor sirve para
  // resaltar el ítem activo del Sidebar y para navegar (history.pushState real vía react-router).
  const irA = (s: Screen) => navigate(`/${s}`);
  const activo = location.pathname.slice(1) as Screen;

  const conPermiso = (s: Screen, elemento: React.ReactNode) =>
    permitido(s) ? elemento : <Navigate to="/dashboard" replace />;

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily:"'Inter', sans-serif" }}>
      <Sidebar active={activo} onNav={irA} onLogout={logout}
        nav={nav} nombre={sesion.nombre} rolLabel={ROL_LABEL[rolPrincipal]} />
      <main className="flex-1 overflow-y-auto bg-[#F5F7FA]">
        <Suspense fallback={<ViewFallback />}>
          <Routes>
            <Route path="/" element={<Navigate to={pantallaInicial(rolPrincipal)} replace />} />
            <Route path="/dashboard" element={<DashboardView rol={rolPrincipal} />} />
            <Route path="/matricula" element={conPermiso("matricula", <MatriculaView />)} />
            <Route path="/grades" element={conPermiso("grades", <GradesView onNavigate={irA} />)} />
            <Route path="/attendance" element={conPermiso("attendance", <AttendanceView onNavigate={irA} />)} />
            <Route path="/calendar" element={conPermiso("calendar", <CalendarView rol={rolPrincipal} />)} />
            <Route path="/deceAlertas" element={conPermiso("deceAlertas", <DeceAlertasView />)} />
            <Route path="/tareas" element={conPermiso("tareas", <TareasView soloLectura={rolPrincipal !== "DOCENTE"} />)} />
            <Route path="/financial" element={conPermiso("financial", <FinancialView />)} />
            <Route path="/personal" element={conPermiso("personal", <PersonalView />)} />
            <Route path="/auditoria" element={conPermiso("auditoria", <AuditoriaView />)} />
            <Route path="/parent" element={conPermiso("parent", <ParentPortal onLogout={logout} embed nombre={sesion.nombre} />)} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
