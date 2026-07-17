// ============================================================================
// SAGAB — Cliente HTTP central
// Adjunta el JWT a cada petición y gestiona expiración de sesión.
// ============================================================================

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

const TOKEN_KEY = "sagab_token";

export const tokenStore = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (t: string) => sessionStorage.setItem(TOKEN_KEY, t),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = tokenStore.get();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && token) {
    // Había una sesión activa (se envió token) y el backend la rechazó: sí expiró/es inválida.
    tokenStore.clear();
    window.dispatchEvent(new Event("sagab:sesion-expirada"));
    throw new ApiError(401, "Sesión expirada. Inicie sesión nuevamente.");
  }

  if (!res.ok) {
    let mensaje = `Error ${res.status}`;
    try {
      const data = await res.json();
      mensaje = data.mensaje ?? mensaje;
    } catch { /* respuesta sin cuerpo JSON */ }
    throw new ApiError(res.status, mensaje);
  }

  return res.status === 204 ? (undefined as T) : res.json();
}
