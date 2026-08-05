import { useEffect, useState } from "react";

/**
 * Repite el patrón de búsqueda con debounce usado en GradesView (búsqueda de estudiante)
 * y FinancialView (búsqueda de estudiante para el estado de cuenta): espera a que el
 * usuario deje de escribir antes de llamar a la API, y descarta resultados obsoletos.
 */
export function useDebouncedSearch<T>(
  query: string,
  buscar: (q: string) => Promise<T[]>,
  { delay = 300, minLength = 2 }: { delay?: number; minLength?: number } = {},
): T[] {
  const [resultados, setResultados] = useState<T[]>([]);

  useEffect(() => {
    if (query.trim().length < minLength) { setResultados([]); return; }
    let vigente = true;
    const t = setTimeout(() => {
      buscar(query.trim())
        .then(r => { if (vigente) setResultados(r); })
        .catch(() => { if (vigente) setResultados([]); });
    }, delay);
    return () => { vigente = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return resultados;
}
