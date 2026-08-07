import { useEffect, useState } from "react";
import { AlertCircle, BookOpen, CheckCircle2, Loader2, Pencil, Search, Trash2, UserPlus, Users, X } from "lucide-react";
import { ApiError } from "../../api/client";
import {
  asignaciones as asignacionesApi, personal as personalApi, type AsignacionCatalogos,
  type AsignacionOpcion, type PersonalResponse, type PersonalResumen, type RolPersonal,
} from "../../api/sagab";
import { Badge, type BadgeVariant } from "../components/Badge";
import { Btn } from "../components/Btn";
import { EmptyState } from "../components/EmptyState";
import { TopBar } from "../components/TopBar";
import { useToast } from "../components/Toast";

const ROLES: { v: RolPersonal; l: string }[] = [
  { v: "DOCENTE", l: "Docente" },
  { v: "DECE", l: "Consejería DECE" },
  { v: "AUDITOR", l: "Auditor" },
];

const ROL_BADGE: Record<string, BadgeVariant> = { DOCENTE: "info", DECE: "warning", AUDITOR: "success" };

const VACIO = { nombres: "", apellidos: "", cedula: "", email: "", telefono: "", rol: "DOCENTE" as RolPersonal, tituloDocente: "" };

export function PersonalView() {
  const toast = useToast();
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [creado, setCreado] = useState<PersonalResponse | null>(null);

  const [lista, setLista] = useState<PersonalResumen[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorApi, setErrorApi] = useState<string | null>(null);

  const cargar = () => {
    setLoading(true);
    setErrorApi(null);
    personalApi.listar()
      .then(setLista)
      .catch(e => setErrorApi(e instanceof ApiError ? e.message : "No se pudo cargar el personal registrado."))
      .finally(() => setLoading(false));
  };

  useEffect(cargar, []);

  const set = <K extends keyof typeof VACIO>(campo: K, valor: (typeof VACIO)[K]) =>
    setForm(p => ({ ...p, [campo]: valor }));

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setCreado(null);
    try {
      const resp = await personalApi.crear({
        nombres: form.nombres.trim(),
        apellidos: form.apellidos.trim(),
        cedula: form.cedula,
        email: form.email.trim(),
        telefono: form.telefono.trim() || undefined,
        rol: form.rol,
        tituloDocente: form.rol === "DOCENTE" ? (form.tituloDocente.trim() || undefined) : undefined,
      });
      setCreado(resp);
      toast.success("Cuenta creada correctamente");
      setForm(VACIO);
      cargar();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo crear la cuenta.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div>
      <TopBar title="Personal" subtitle="Administrar cuentas docentes y sus asignaciones académicas" />
      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <form onSubmit={crear} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">Nueva cuenta</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="p-nombres" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Nombres</label>
                <input id="p-nombres" value={form.nombres} onChange={e => set("nombres", e.target.value)} required minLength={3} maxLength={80}
                  placeholder="Ej. Paola Andrea"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
              </div>
              <div>
                <label htmlFor="p-apellidos" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Apellidos</label>
                <input id="p-apellidos" value={form.apellidos} onChange={e => set("apellidos", e.target.value)} required minLength={3} maxLength={80}
                  placeholder="Ej. Vintimilla Ruiz"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="p-cedula" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Cédula</label>
                <input id="p-cedula" value={form.cedula} onChange={e => set("cedula", e.target.value.replace(/\D/g, "").slice(0, 10))}
                  required inputMode="numeric" maxLength={10} placeholder="1712345678"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
              </div>
              <div>
                <label htmlFor="p-telefono" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Teléfono (opcional)</label>
                <input id="p-telefono" value={form.telefono} onChange={e => set("telefono", e.target.value.replace(/\D/g, "").slice(0, 10))}
                  inputMode="numeric" maxLength={10} placeholder="0991234567"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
              </div>
            </div>

            <div>
              <label htmlFor="p-email" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Correo institucional</label>
              <input id="p-email" type="email" value={form.email} onChange={e => set("email", e.target.value)} required maxLength={120}
                placeholder="nombre@bellini.edu.ec"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
            </div>

            <div>
              <label htmlFor="p-rol" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Rol</label>
              <select id="p-rol" value={form.rol} onChange={e => set("rol", e.target.value as RolPersonal)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6] bg-white">
                {ROLES.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
              </select>
            </div>

            {form.rol === "DOCENTE" && (
              <div>
                <label htmlFor="p-titulo" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Título (opcional)</label>
                <input id="p-titulo" value={form.tituloDocente} onChange={e => set("tituloDocente", e.target.value)} maxLength={80}
                  placeholder="Ej. Lcda. en Educación"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#2E75B6]/30 focus:border-[#2E75B6]" />
              </div>
            )}

            <Btn disabled={guardando}>
              {guardando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <UserPlus size={14} aria-hidden="true" />}
              Crear cuenta
            </Btn>
          </form>

          {creado && (
            <div role="status" className="mt-4 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-3 text-sm text-[#2E7D32]">
              <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold mb-1">Cuenta creada — {creado.nombreCompleto} ({creado.rol})</p>
                <p>Usuario: <strong>{creado.username}</strong> · contraseña temporal: <strong>{creado.claveTemporal}</strong></p>
                <p className="text-xs text-[#2E7D32]/80 mt-1">Anote esta contraseña ahora: no se vuelve a mostrar. Deberá cambiarla al ingresar por primera vez.</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-fit">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest px-4 pt-4 pb-2">Personal registrado</p>
          {errorApi && (
            <div role="alert" className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#C62828]">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />{errorApi}
            </div>
          )}
          {loading && <div className="px-4 pb-4 text-sm text-gray-600"><Loader2 size={16} className="animate-spin inline-block mr-2" aria-hidden="true" />Cargando…</div>}
          {!loading && lista.length === 0 && !errorApi && (
            <div className="px-4 pb-4"><EmptyState icon={Users} title="Todavía no hay cuentas de docentes, DECE o auditoría." /></div>
          )}
          {!loading && lista.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {lista.map(p => (
                <li key={p.idUsuario} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1A1A1A] truncate">{p.nombreCompleto}</p>
                    <p className="text-[11px] text-gray-500 truncate">{p.username} · {p.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge v={ROL_BADGE[p.rol] ?? "info"}>{p.rol}</Badge>
                    {p.estado !== "ACTIVO" && <Badge v="error">{p.estado}</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="px-6 pb-8"><AsignacionesPanel /></div>
    </div>
  );
}

const ASIGNACION_VACIA = { idDocente: "" as number | "", idsMaterias: [] as number[], idParalelo: "" as number | "", idPeriodo: "" as number | "" };

function AsignacionesPanel() {
  const toast = useToast();
  const [catalogos, setCatalogos] = useState<AsignacionCatalogos | null>(null);
  const [lista, setLista] = useState<AsignacionOpcion[]>([]);
  const [form, setForm] = useState(ASIGNACION_VACIA);
  const [editing, setEditing] = useState<AsignacionOpcion | null>(null);
  const [query, setQuery] = useState("");
  const [filtroDocente, setFiltroDocente] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mensajeError = (valor: unknown, respaldo: string) =>
    valor instanceof ApiError ? valor.message : respaldo;

  const cargar = async () => {
    setLoading(true); setError(null);
    const [catalogosResult, asignacionesResult] = await Promise.allSettled([
      asignacionesApi.catalogos(), asignacionesApi.mias(),
    ]);

    const errores: string[] = [];
    if (catalogosResult.status === "fulfilled") {
      const c = catalogosResult.value;
      setCatalogos(c);
      const activo = c.periodos.find(p => p.activo) ?? c.periodos[0];
      setForm(prev => prev.idPeriodo === "" && activo ? { ...prev, idPeriodo: activo.idPeriodo } : prev);
    } else {
      setCatalogos(null);
      errores.push(`Catálogos: ${mensajeError(catalogosResult.reason, "no se pudieron cargar docentes, materias, cursos y períodos")}`);
    }

    if (asignacionesResult.status === "fulfilled") {
      setLista(asignacionesResult.value);
    } else {
      errores.push(`Listado: ${mensajeError(asignacionesResult.reason, "no se pudieron cargar las asignaciones existentes")}`);
    }
    setError(errores.length > 0 ? errores.join(" · ") : null);
    setLoading(false);
  };
  useEffect(() => { void cargar(); }, []);

  const periodo = catalogos?.periodos.find(p => p.idPeriodo === form.idPeriodo);
  const paralelos = catalogos?.paralelos.filter(p => !periodo || p.anioLectivo === periodo.anioLectivo) ?? [];
  const filtered = lista.filter(a => {
    const text = `${a.docente} ${a.materia} ${a.paralelo} ${a.periodo}`.toLowerCase();
    return text.includes(query.toLowerCase())
      && (!filtroDocente || a.idDocente === Number(filtroDocente))
      && (!filtroPeriodo || a.idPeriodo === Number(filtroPeriodo));
  });

  const reset = () => {
    const activo = catalogos?.periodos.find(p => p.activo) ?? catalogos?.periodos[0];
    setEditing(null); setForm({ ...ASIGNACION_VACIA, idPeriodo: activo?.idPeriodo ?? "" });
  };
  const toggleMateria = (id: number) => setForm(p => ({ ...p, idsMaterias: p.idsMaterias.includes(id) ? p.idsMaterias.filter(x => x !== id) : [...p.idsMaterias, id] }));
  const guardar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.idDocente === "" || form.idParalelo === "" || form.idPeriodo === "" || form.idsMaterias.length === 0) return;
    setSaving(true); setError(null);
    try {
      if (editing) {
        await asignacionesApi.editar(editing.idAsignacion, {
          idDocente: Number(form.idDocente), idMateria: form.idsMaterias[0],
          idParalelo: Number(form.idParalelo), idPeriodo: Number(form.idPeriodo),
        });
        toast.success("Asignación actualizada");
      } else {
        await asignacionesApi.crear({
          idDocente: Number(form.idDocente), idsMaterias: form.idsMaterias,
          idParalelo: Number(form.idParalelo), idPeriodo: Number(form.idPeriodo),
        });
        toast.success(`${form.idsMaterias.length} asignación(es) creada(s)`);
      }
      reset(); setLista(await asignacionesApi.mias());
    } catch (e) {
      const detalle = mensajeError(e, "No se pudo guardar la asignación.");
      setError(detalle);
      toast.error(detalle);
    }
    finally { setSaving(false); }
  };
  const editar = (a: AsignacionOpcion) => {
    setEditing(a); setForm({ idDocente: a.idDocente, idsMaterias: [a.idMateria], idParalelo: a.idParalelo, idPeriodo: a.idPeriodo });
    document.getElementById("asignacion-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const eliminar = async (a: AsignacionOpcion) => {
    if (!window.confirm(`¿Eliminar la asignación de ${a.materia} · ${a.paralelo}?`)) return;
    try { await asignacionesApi.eliminar(a.idAsignacion); setLista(await asignacionesApi.mias()); toast.success("Asignación eliminada"); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "No se puede eliminar: la asignación tiene información académica relacionada."); }
  };

  return <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
    <div className="border-b border-gray-100 px-5 py-4"><div className="flex items-center gap-2"><BookOpen size={18} className="text-[#2E75B6]" /><h2 className="font-semibold text-[#1A1A1A]">Asignación de materias</h2></div><p className="mt-1 text-xs text-gray-500">Una misma persona puede dictar varias materias. Estas asignaciones alimentan Notas, Asistencia, Recursos, Reportes y Mensajes.</p></div>
    {error && <div role="alert" className="m-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-[#C62828]"><span className="flex min-w-0 items-start gap-2"><AlertCircle size={15} className="mt-0.5 flex-shrink-0" />{error}</span><Btn type="button" variant="secondary" size="sm" onClick={() => void cargar()} disabled={loading}>Reintentar</Btn></div>}
    {loading ? <div className="p-8 text-center text-sm text-gray-500"><Loader2 size={16} className="mr-2 inline animate-spin" />Cargando estructura académica…</div> : catalogos && <div className="grid gap-0 xl:grid-cols-[0.8fr,1.2fr]">
      <form id="asignacion-form" onSubmit={guardar} className="space-y-4 border-b border-gray-100 p-5 xl:border-b-0 xl:border-r">
        <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{editing ? "Editar asignación" : "Nueva asignación"}</p>{editing && <button type="button" onClick={reset} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"><X size={13} />Cancelar edición</button>}</div>
        <div><label htmlFor="asg-docente" className="mb-1 block text-xs font-semibold text-gray-600">Docente</label><select id="asg-docente" required value={form.idDocente} onChange={e => setForm({ ...form, idDocente: e.target.value ? Number(e.target.value) : "" })} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"><option value="">Seleccione…</option>{catalogos.docentes.map(d => <option key={d.idDocente} value={d.idDocente}>{d.nombre} · {d.email}</option>)}</select></div>
        <div className="grid gap-3 sm:grid-cols-2"><div><label htmlFor="asg-periodo" className="mb-1 block text-xs font-semibold text-gray-600">Período</label><select id="asg-periodo" required value={form.idPeriodo} onChange={e => setForm({ ...form, idPeriodo: e.target.value ? Number(e.target.value) : "", idParalelo: "" })} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"><option value="">Seleccione…</option>{catalogos.periodos.map(p => <option key={p.idPeriodo} value={p.idPeriodo}>{p.etiqueta}{p.activo ? " · Activo" : ""}</option>)}</select></div><div><label htmlFor="asg-paralelo" className="mb-1 block text-xs font-semibold text-gray-600">Curso y paralelo</label><select id="asg-paralelo" required value={form.idParalelo} onChange={e => setForm({ ...form, idParalelo: e.target.value ? Number(e.target.value) : "" })} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"><option value="">Seleccione…</option>{paralelos.map(p => <option key={p.idParalelo} value={p.idParalelo}>{p.etiqueta}</option>)}</select></div></div>
        <fieldset><legend className="mb-2 text-xs font-semibold text-gray-600">Materia{editing ? "" : "s (puede seleccionar varias)"}</legend><div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">{catalogos.materias.map(m => <label key={m.idMateria} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[#EAF2FB]"><input type={editing ? "radio" : "checkbox"} name={editing ? "materia" : undefined} checked={form.idsMaterias.includes(m.idMateria)} onChange={() => editing ? setForm({ ...form, idsMaterias: [m.idMateria] }) : toggleMateria(m.idMateria)} /> <span>{m.nombre}</span><span className="ml-auto text-[10px] text-gray-400">{m.codigo}</span></label>)}</div></fieldset>
        <Btn disabled={saving || form.idsMaterias.length === 0}>{saving ? <Loader2 size={14} className="animate-spin" /> : editing ? <Pencil size={14} /> : <CheckCircle2 size={14} />}{editing ? "Guardar cambios" : `Crear ${form.idsMaterias.length || ""} asignación(es)`}</Btn>
      </form>

      <div className="min-w-0 p-5">
        <div className="grid gap-2 sm:grid-cols-[1fr,auto,auto]"><label className="relative"><span className="sr-only">Buscar asignación</span><Search size={15} className="absolute left-3 top-2.5 text-gray-400" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar docente, materia o curso" className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm" /></label><select aria-label="Filtrar por docente" value={filtroDocente} onChange={e => setFiltroDocente(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"><option value="">Todos los docentes</option>{catalogos.docentes.map(d => <option key={d.idDocente} value={d.idDocente}>{d.nombre}</option>)}</select><select aria-label="Filtrar por período" value={filtroPeriodo} onChange={e => setFiltroPeriodo(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"><option value="">Todos los períodos</option>{catalogos.periodos.map(p => <option key={p.idPeriodo} value={p.idPeriodo}>{p.etiqueta}</option>)}</select></div>
        <p className="my-3 text-xs text-gray-500">{filtered.length} de {lista.length} asignaciones</p>
        {filtered.length === 0 ? <EmptyState icon={BookOpen} title="No hay asignaciones para los filtros seleccionados." /> : <div className="overflow-x-auto rounded-xl border border-gray-200"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500"><tr><th className="px-3 py-2">Docente</th><th className="px-3 py-2">Materia</th><th className="px-3 py-2">Curso / paralelo</th><th className="px-3 py-2">Período</th><th className="px-3 py-2 text-right">Acciones</th></tr></thead><tbody className="divide-y divide-gray-100">{filtered.map(a => <tr key={a.idAsignacion} className="hover:bg-gray-50"><td className="px-3 py-3 font-medium text-gray-800">{a.docente}</td><td className="px-3 py-3">{a.materia}</td><td className="px-3 py-3">{a.paralelo}</td><td className="px-3 py-3"><span className={a.periodoActivo ? "font-medium text-[#2E7D32]" : "text-gray-500"}>{a.periodo}</span></td><td className="px-3 py-3"><div className="flex justify-end gap-1"><button type="button" onClick={() => editar(a)} aria-label={`Editar ${a.materia}`} className="rounded-lg p-2 text-[#2E75B6] hover:bg-[#EAF2FB]"><Pencil size={15} /></button><button type="button" onClick={() => void eliminar(a)} aria-label={`Eliminar ${a.materia}`} className="rounded-lg p-2 text-[#C62828] hover:bg-red-50"><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div>}
      </div>
    </div>}
  </section>;
}
