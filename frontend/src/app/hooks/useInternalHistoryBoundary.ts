import { useEffect } from "react";

const BOUNDARY = "sagabHistoryBoundary";
const GUARD = "sagabHistoryGuard";

/**
 * Conserva una entrada centinela al principio del historial autenticado. Las navegaciones
 * normales siguen siendo entradas reales de React Router, pero al llegar al límite la flecha
 * Atrás permanece dentro de SAGAB en lugar de volver al login o abandonar la aplicación.
 */
export function useInternalHistoryBoundary(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const state = window.history.state ?? {};
    if (!state[BOUNDARY] && !state[GUARD]) {
      window.history.replaceState({ ...state, [BOUNDARY]: true }, "", window.location.href);
      window.history.pushState(
        { ...state, idx: typeof state.idx === "number" ? state.idx + 1 : 1, [GUARD]: true },
        "",
        window.location.href,
      );
    }

    const keepInside = (event: PopStateEvent) => {
      if (!event.state?.[BOUNDARY]) return;
      const current = window.history.state ?? {};
      window.history.pushState(
        { ...current, idx: typeof current.idx === "number" ? current.idx + 1 : 1, [GUARD]: true },
        "",
        window.location.href,
      );
    };

    window.addEventListener("popstate", keepInside);
    return () => window.removeEventListener("popstate", keepInside);
  }, [active]);
}
