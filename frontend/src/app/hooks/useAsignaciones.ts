import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { asignaciones as asignacionesApi, type AsignacionOpcion } from "../../api/sagab";

/**
 * Carga las asignaciones (materia+paralelo+período) del docente autenticado y preselecciona
 * la del período activo (o la primera si no hay ninguna activa).
 */
export function useAsignaciones() {
  const [opciones, setOpciones] = useState<AsignacionOpcion[]>([]);
  const [idAsignacion, setIdAsignacion] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const solicitudActual = useRef(0);

  const recargar = useCallback(async () => {
    const solicitud = ++solicitudActual.current;
    setLoading(true);
    setError(null);
    try {
      const lista = await asignacionesApi.mias();
      if (solicitud !== solicitudActual.current) return;
      setOpciones(lista);
      setIdAsignacion(actual => {
        if (actual !== "" && lista.some(a => a.idAsignacion === actual)) return actual;
        return lista.find(a => a.periodoActivo)?.idAsignacion ?? lista[0]?.idAsignacion ?? "";
      });
    } catch (e) {
      if (solicitud !== solicitudActual.current) return;
      setOpciones([]);
      setIdAsignacion("");
      setError(e instanceof ApiError ? e.message : "No se pudieron cargar sus asignaciones.");
    } finally {
      if (solicitud === solicitudActual.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void recargar();
    return () => { solicitudActual.current++; };
  }, [recargar]);

  const asignacion = opciones.find(a => a.idAsignacion === idAsignacion);

  return { opciones, idAsignacion, setIdAsignacion, asignacion, error, loading, recargar };
}
