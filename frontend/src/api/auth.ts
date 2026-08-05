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

export async function cambiarClave(claveActual: string, claveNueva: string): Promise<void> {
  await api<void>("/api/auth/cambiar-clave", {
    method: "POST",
    body: { claveActual, claveNueva },
  });
}
