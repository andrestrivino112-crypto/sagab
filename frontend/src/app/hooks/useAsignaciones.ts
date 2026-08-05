import { useEffect, useState } from "react";
import { asignaciones as asignacionesApi, type AsignacionOpcion } from "../../api/sagab";

/**
 * Carga las asignaciones (materia+paralelo+período) del docente autenticado y preselecciona
 * la primera. Mismo patrón repetido antes en GradesView y AttendanceView.
 */
export function useAsignaciones() {
  const [opciones, setOpciones] = useState<AsignacionOpcion[]>([]);
  const [idAsignacion, setIdAsignacion] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    asignacionesApi.mias().then(lista => {
      setOpciones(lista);
      if (lista.length > 0) setIdAsignacion(lista[0].idAsignacion);
    }).catch(() => setError("No se pudieron cargar sus asignaciones."));
  }, []);

  const asignacion = opciones.find(a => a.idAsignacion === idAsignacion);

  return { opciones, idAsignacion, setIdAsignacion, asignacion, error };
}
