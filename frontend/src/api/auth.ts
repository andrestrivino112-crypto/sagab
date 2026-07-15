import { api, tokenStore } from "./client";

export type RolSistema = "ADMIN" | "DOCENTE" | "REPRESENTANTE" | "AUDITOR" | "DECE";

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
