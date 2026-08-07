import { api, tokenStore } from "./client";

export type RolSistema = "ADMIN" | "DOCENTE" | "REPRESENTANTE" | "AUDITOR" | "DECE" | "ESTUDIANTE";

export interface Sesion {
  accessToken: string;
  nombre: string;
  roles: RolSistema[];
  debeCambiarClave: boolean;
}

export async function login(usuario: string, password: string): Promise<Sesion> {
  const s = await api<Sesion>("/api/auth/login", {
    method: "POST",
    body: { usuario, password },
  });
  tokenStore.set(s.accessToken);
  return s;
}

export function logout() {
  tokenStore.clear();
}

/**
 * Reconstruye la sesión a partir del token ya guardado en sessionStorage — se llama al arrancar
 * la app (recarga de página, o al abrir el enlace directo a una ruta) para no forzar un nuevo
 * login mientras el token siga siendo válido. Si no hay token, o el backend lo rechaza (expiró),
 * devuelve null; client.ts ya se encarga de limpiar el token guardado en ese caso.
 */
export async function recuperarSesion(): Promise<Sesion | null> {
  const token = tokenStore.get();
  if (!token) return null;
  try {
    const info = await api<Omit<Sesion, "accessToken">>("/api/auth/me");
    return { accessToken: token, ...info };
  } catch {
    return null;
  }
}

export async function cambiarClave(claveActual: string, claveNueva: string): Promise<void> {
  await api<void>("/api/auth/cambiar-clave", {
    method: "POST",
    body: { claveActual, claveNueva },
  });
}
