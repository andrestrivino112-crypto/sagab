import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const leer = ruta => readFileSync(new URL(`../${ruta}`, import.meta.url), "utf8");
const auth = leer("src/api/auth.ts");
const api = leer("src/api/sagab.ts");
const app = leer("src/app/App.tsx");
const sidebar = leer("src/app/components/Sidebar.tsx");
const vista = leer("src/app/views/GestionCuentasView.tsx");

test("SUPER_ADMIN forma parte del contrato de sesión", () => {
  assert.match(auth, /RolSistema\s*=\s*"SUPER_ADMIN"/);
  assert.match(auth, /rol === "ADMIN" \|\| rol === "SUPER_ADMIN"/);
});

test("rota el token después del cambio obligatorio", () => {
  assert.match(auth, /api<\{ accessToken: string \}>\("\/api\/auth\/cambiar-clave"/);
  assert.match(auth, /tokenStore\.set\(respuesta\.accessToken\)/);
});

test("el menú exclusivo existe solo en SUPER_ADMIN", () => {
  const lineaSuper = sidebar.match(/SUPER_ADMIN:\s*\[[^\]]+\]/)?.[0] ?? "";
  const lineaAdmin = sidebar.match(/\n\s*ADMIN:\s*\[[^\]]+\]/)?.[0] ?? "";
  assert.match(lineaSuper, /"gestion-cuentas"/);
  assert.doesNotMatch(lineaAdmin, /"gestion-cuentas"/);
  assert.doesNotMatch(lineaSuper, /"tareas"|"parent"/);
});

test("reutiliza el dashboard administrativo y protege la ruta", () => {
  assert.match(app, /esRolAdministrativo\(rolPrincipal\) \? <AdminDashboard/);
  assert.match(app, /path="\/gestion-cuentas" element=\{conPermiso\("gestion-cuentas"/);
});

test("la API usa página segura y endpoints de escritura acotados", () => {
  assert.match(api, /interface PaginaUsuariosSistema/);
  assert.match(api, /\/api\/super-admin\/usuarios\?\$\{q\}/);
  assert.match(api, /restablecer-clave`, \{ method: "POST" \}/);
  assert.match(api, /\/estado`, \{\s*method: "PATCH"/);
});

test("la recuperación usa debounce, límite y selección manual", () => {
  assert.match(vista, /LIMITE_BUSQUEDA = 10/);
  assert.match(vista, /window\.setTimeout\(\(\) => \{/);
  assert.match(vista, /onRestablecer\(usuario\)/);
});

test("el listado ofrece filtros, paginación y actualización", () => {
  assert.match(vista, /filtro-rol/);
  assert.match(vista, /filtro-estado/);
  assert.match(vista, />Anterior</);
  assert.match(vista, />Siguiente/);
  assert.match(vista, />Actualizar</);
});

test("las acciones requieren modal y confirman antes del toast", () => {
  assert.match(vista, /<Modal title=\{titulo\}/);
  assert.match(vista, /await superAdminApi\.restablecerClave/);
  assert.match(vista, /await superAdminApi\.cambiarEstado/);
  assert.match(vista, /Confirmar restablecimiento/);
});

test("la vista incluye carga, error, vacío y regreso interno", () => {
  assert.match(vista, /role="status"/);
  assert.match(vista, /role="alert"/);
  assert.match(vista, /<EmptyState/);
  assert.match(vista, /navigate\("\/dashboard"\)/);
});

test("ningún contrato frontend devuelve una clave temporal", () => {
  assert.doesNotMatch(api, /claveTemporal/);
  assert.doesNotMatch(leer("src/app/views/PersonalView.tsx"), /\.claveTemporal/);
  assert.doesNotMatch(leer("src/app/views/MatriculaView.tsx"), /\.claveTemporal/);
});
