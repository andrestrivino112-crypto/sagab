import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle, ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Clock,
  KeyRound, Loader2, RefreshCw, Search, ShieldCheck, UserCheck, Users, UserX,
} from "lucide-react";
import type { RolSistema } from "../../api/auth";
import { ApiError } from "../../api/client";
import {
  superAdmin as superAdminApi,
  type EstadoCuentaEditable,
  type EstadoCuentaSistema,
  type PaginaUsuariosSistema,
  type UsuarioCuentaSistema,
} from "../../api/sagab";
import { Badge, type BadgeVariant } from "../components/Badge";
import { Btn } from "../components/Btn";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { ROL_LABEL } from "../components/Sidebar";
import { TopBar } from "../components/TopBar";
import { useToast } from "../components/Toast";

type Seccion = "recuperar" | "cuentas";
type AccionConfirmada =
  | { tipo: "restablecer"; usuario: UsuarioCuentaSistema }
  | { tipo: "estado"; usuario: UsuarioCuentaSistema; estado: EstadoCuentaEditable };

const TAMANO_PAGINA = 20;
const LIMITE_BUSQUEDA = 10;

const ROLES: { valor: RolSistema; etiqueta: string }[] = [
  { valor: "SUPER_ADMIN", etiqueta: "Superadministrador" },
  { valor: "ADMIN", etiqueta: "Administrador" },
  { valor: "DOCENTE", etiqueta: "Docente" },
  { valor: "DECE", etiqueta: "Consejería DECE" },
  { valor: "ESTUDIANTE", etiqueta: "Estudiante" },
  { valor: "REPRESENTANTE", etiqueta: "Representante" },
  { valor: "AUDITOR", etiqueta: "Auditor" },
];

const ESTADO: Record<EstadoCuentaSistema, { etiqueta: string; badge: BadgeVariant }> = {
  ACTIVO: { etiqueta: "Activo", badge: "success" },
  INACTIVO: { etiqueta: "Inactivo", badge: "error" },
  BLOQUEADO: { etiqueta: "Bloqueado", badge: "warning" },
};

const mensajeError = (error: unknown, respaldo: string) =>
  error instanceof ApiError ? error.message : respaldo;

const fechaHora = (valor: string | null) => {
  if (!valor) return "Nunca";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "No disponible";
  return fecha.toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" });
};

const nombreUsuario = (usuario: UsuarioCuentaSistema) => usuario.username ?? "Sin usuario";

function RolesCuenta({ roles }: { roles: RolSistema[] }) {
  return <div className="flex flex-wrap gap-1">
    {roles.map(rol => <Badge key={rol} v={rol === "SUPER_ADMIN" ? "warning" : "info"}>{ROL_LABEL[rol]}</Badge>)}
  </div>;
}

function EstadoCuenta({ estado }: { estado: EstadoCuentaSistema }) {
  return <Badge v={ESTADO[estado].badge}>{ESTADO[estado].etiqueta}</Badge>;
}

function ResumenCuenta({ usuario }: { usuario: UsuarioCuentaSistema }) {
  return <div className="rounded-xl border border-gray-200 bg-[#F8FAFC] p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold text-[#1A1A1A]">{usuario.nombreCompleto}</p>
        <p className="mt-0.5 text-sm text-gray-500">{nombreUsuario(usuario)} · {usuario.email ?? "Sin correo registrado"}</p>
      </div>
      <EstadoCuenta estado={usuario.estado} />
    </div>
    <div className="mt-3"><RolesCuenta roles={usuario.roles} /></div>
  </div>;
}

function AccionesCuenta({ usuario, onRestablecer, onEstado }: {
  usuario: UsuarioCuentaSistema;
  onRestablecer: (usuario: UsuarioCuentaSistema) => void;
  onEstado: (usuario: UsuarioCuentaSistema, estado: EstadoCuentaEditable) => void;
}) {
  const sinCedula = !usuario.cedulaEnmascarada;
  const restablecimientoDeshabilitado = usuario.esCuentaActual || sinCedula;
  return <div className="flex flex-wrap items-center justify-end gap-2">
    <button type="button" disabled={restablecimientoDeshabilitado} onClick={() => onRestablecer(usuario)}
      title={usuario.esCuentaActual ? "Utilice el cambio normal de contraseña para su propia cuenta" : sinCedula ? "La cuenta no tiene una cédula registrada" : undefined}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#2E75B6]/25 bg-[#EAF2FB] px-3 py-1.5 text-xs font-semibold text-[#1F4E79] transition hover:bg-[#D0E4F5] disabled:cursor-not-allowed disabled:opacity-45">
      <KeyRound size={13} aria-hidden="true" />Restablecer
    </button>
    {usuario.estado === "ACTIVO" && <button type="button" disabled={usuario.esCuentaActual} onClick={() => onEstado(usuario, "INACTIVO")}
      title={usuario.esCuentaActual ? "No puede deshabilitar su propia cuenta" : undefined}
      className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-[#C62828] transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-45">
      <UserX size={13} aria-hidden="true" />Deshabilitar
    </button>}
    {usuario.estado === "INACTIVO" && <button type="button" disabled={usuario.esCuentaActual} onClick={() => onEstado(usuario, "ACTIVO")}
      className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-semibold text-[#2E7D32] transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-45">
      <UserCheck size={13} aria-hidden="true" />Habilitar
    </button>}
    {usuario.estado === "BLOQUEADO" && <span className="text-[11px] text-amber-700">Bloqueo automático</span>}
  </div>;
}

export function GestionCuentasView() {
  const navigate = useNavigate();
  const toast = useToast();
  const [seccion, setSeccion] = useState<Seccion>("recuperar");
  const [accion, setAccion] = useState<AccionConfirmada | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [revision, setRevision] = useState(0);

  const actualizarDatos = () => setRevision(valor => valor + 1);

  const ejecutarAccion = async () => {
    if (!accion) return;
    setProcesando(true);
    try {
      if (accion.tipo === "restablecer") {
        await superAdminApi.restablecerClave(accion.usuario.idUsuario);
        toast.success("La contraseña temporal fue restablecida a la cédula registrada. El usuario deberá cambiarla al iniciar sesión.");
      } else {
        await superAdminApi.cambiarEstado(accion.usuario.idUsuario, accion.estado);
        toast.success(accion.estado === "ACTIVO"
          ? "La cuenta fue habilitada correctamente."
          : "La cuenta fue deshabilitada correctamente.");
      }
      setAccion(null);
      actualizarDatos();
    } catch (error) {
      toast.error(mensajeError(error, accion.tipo === "restablecer"
        ? "No se pudo restablecer la contraseña."
        : "No se pudo cambiar el estado de la cuenta."));
    } finally {
      setProcesando(false);
    }
  };

  return <div>
    <TopBar title="Gestión de cuentas" subtitle="Administración segura de accesos al sistema" />
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={() => navigate("/dashboard")}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-[#2E75B6] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E75B6]/40">
          <ArrowLeft size={16} aria-hidden="true" />Volver al Inicio de Secretaría
        </button>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#EAF2FB] px-3 py-1 text-xs font-semibold text-[#1F4E79]">
          <ShieldCheck size={13} aria-hidden="true" />Acceso exclusivo de Superadministración
        </span>
      </div>

      <div className="flex w-full max-w-xl rounded-xl bg-gray-200/70 p-1" role="tablist" aria-label="Secciones de gestión de cuentas">
        {([
          ["recuperar", "Recuperar contraseña", KeyRound],
          ["cuentas", "Cuentas del sistema", Users],
        ] as const).map(([id, etiqueta, Icono]) => <button key={id} type="button" role="tab" aria-selected={seccion === id}
          onClick={() => setSeccion(id)} className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${seccion === id ? "bg-white text-[#1F4E79] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          <Icono size={15} className="flex-shrink-0" aria-hidden="true" /><span className="truncate">{etiqueta}</span>
        </button>)}
      </div>

      {seccion === "recuperar"
        ? <RecuperarClave revision={revision} onRestablecer={usuario => setAccion({ tipo: "restablecer", usuario })} />
        : <CuentasSistema revision={revision} onActualizar={actualizarDatos}
            onRestablecer={usuario => setAccion({ tipo: "restablecer", usuario })}
            onEstado={(usuario, estado) => setAccion({ tipo: "estado", usuario, estado })} />}
    </div>

    {accion && <ConfirmarAccion accion={accion} procesando={procesando}
      onClose={() => { if (!procesando) setAccion(null); }} onConfirmar={() => void ejecutarAccion()} />}
  </div>;
}

function RecuperarClave({ revision, onRestablecer }: {
  revision: number;
  onRestablecer: (usuario: UsuarioCuentaSistema) => void;
}) {
  const [termino, setTermino] = useState("");
  const [resultados, setResultados] = useState<UsuarioCuentaSistema[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [consultado, setConsultado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = termino.trim().replace(/\s+/g, " ");
    if (q.length < 2) {
      setResultados([]); setBuscando(false); setConsultado(false); setError(null);
      return;
    }
    let vigente = true;
    const timer = window.setTimeout(() => {
      setBuscando(true); setError(null);
      superAdminApi.usuarios({ q, page: 0, size: LIMITE_BUSQUEDA })
        .then(respuesta => { if (vigente) { setResultados(respuesta.contenido); setConsultado(true); } })
        .catch(e => { if (vigente) { setResultados([]); setConsultado(true); setError(mensajeError(e, "No se pudo buscar la cuenta.")); } })
        .finally(() => { if (vigente) setBuscando(false); });
    }, 350);
    return () => { vigente = false; window.clearTimeout(timer); };
  }, [termino, revision]);

  return <section aria-labelledby="recuperar-titulo" className="space-y-4">
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="rounded-lg bg-[#EAF2FB] p-2 text-[#2E75B6]"><Search size={18} aria-hidden="true" /></span>
        <div><h2 id="recuperar-titulo" className="font-semibold text-[#1A1A1A]">Localizar una cuenta</h2><p className="mt-0.5 text-sm text-gray-500">Busque por nombres y apellidos en cualquier orden, usuario, correo o cédula. Seleccione siempre la cuenta correcta.</p></div>
      </div>
      <label htmlFor="buscar-cuenta-recuperar" className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-gray-600">Nombre, apellido u otro identificador</label>
      <div className="relative">
        <Search size={17} className="absolute left-3 top-3 text-gray-400" aria-hidden="true" />
        <input id="buscar-cuenta-recuperar" value={termino} onChange={e => setTermino(e.target.value)} maxLength={100}
          placeholder="Ej. María Pérez" autoComplete="off"
          className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-sm outline-none focus:border-[#2E75B6] focus:ring-2 focus:ring-[#2E75B6]/20" />
        {buscando && <Loader2 size={17} className="absolute right-3 top-3 animate-spin text-[#2E75B6]" aria-label="Buscando" />}
      </div>
      <p className="mt-1.5 text-xs text-gray-500">Escriba al menos 2 caracteres. Se muestran como máximo {LIMITE_BUSQUEDA} coincidencias.</p>
    </div>

    {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#C62828]"><AlertCircle size={16} className="mt-0.5 flex-shrink-0" />{error}</div>}
    {!buscando && !error && consultado && resultados.length === 0 && <EmptyState icon={Users} title="No se encontraron cuentas" description="Revise los datos escritos o pruebe con otro criterio." />}
    {resultados.length > 0 && <div className="grid grid-cols-1 gap-3 xl:grid-cols-2" aria-live="polite">
      {resultados.map(usuario => <article key={usuario.idUsuario} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><h3 className="font-semibold text-[#1A1A1A]">{usuario.nombreCompleto}</h3><p className="text-sm text-gray-500">{nombreUsuario(usuario)}</p></div>
          <EstadoCuenta estado={usuario.estado} />
        </div>
        <div className="mt-3"><RolesCuenta roles={usuario.roles} /></div>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-gray-500">Correo</dt><dd className="break-all text-gray-700">{usuario.email ?? "Sin correo"}</dd></div>
          <div><dt className="text-xs text-gray-500">Cédula registrada</dt><dd className="text-gray-700">{usuario.cedulaEnmascarada ?? "No registrada"}</dd></div>
        </dl>
        {usuario.esCuentaActual && <p className="mt-3 text-xs font-medium text-amber-700">Esta es su cuenta. Use el cambio normal de contraseña.</p>}
        {!usuario.cedulaEnmascarada && <p className="mt-3 text-xs text-[#C62828]">Esta cuenta no tiene una cédula registrada. No se puede generar la contraseña temporal.</p>}
        <div className="mt-4 flex justify-end"><Btn type="button" size="sm" disabled={usuario.esCuentaActual || !usuario.cedulaEnmascarada} onClick={() => onRestablecer(usuario)}><KeyRound size={14} />Restablecer contraseña</Btn></div>
      </article>)}
    </div>}
  </section>;
}

function CuentasSistema({ revision, onActualizar, onRestablecer, onEstado }: {
  revision: number;
  onActualizar: () => void;
  onRestablecer: (usuario: UsuarioCuentaSistema) => void;
  onEstado: (usuario: UsuarioCuentaSistema, estado: EstadoCuentaEditable) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [consulta, setConsulta] = useState("");
  const [rol, setRol] = useState<RolSistema | "">("");
  const [estado, setEstado] = useState<EstadoCuentaSistema | "">("");
  const [pagina, setPagina] = useState(0);
  const [datos, setDatos] = useState<PaginaUsuariosSistema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setConsulta(busqueda.trim().replace(/\s+/g, " "));
      setPagina(0);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [busqueda]);

  useEffect(() => {
    let vigente = true;
    setLoading(true); setError(null);
    superAdminApi.usuarios({
      q: consulta || undefined,
      rol: rol || undefined,
      estado: estado || undefined,
      page: pagina,
      size: TAMANO_PAGINA,
    }).then(respuesta => {
      if (!vigente) return;
      if (pagina > 0 && respuesta.contenido.length === 0) {
        setPagina(Math.max(0, respuesta.totalPaginas - 1));
      } else {
        setDatos(respuesta);
      }
    }).catch(e => {
      if (vigente) setError(mensajeError(e, "No se pudo cargar el listado de cuentas."));
    }).finally(() => { if (vigente) setLoading(false); });
    return () => { vigente = false; };
  }, [consulta, estado, pagina, revision, rol]);

  const contenido = datos?.contenido ?? [];
  const totalPaginas = datos?.totalPaginas ?? 0;

  return <section aria-labelledby="cuentas-titulo" className="space-y-4">
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div><h2 id="cuentas-titulo" className="font-semibold text-[#1A1A1A]">Cuentas del sistema</h2><p className="mt-0.5 text-sm text-gray-500">Listado paginado y ordenado por nombre. Los filtros se procesan en el servidor.</p></div>
        <Btn type="button" size="sm" variant="secondary" disabled={loading} onClick={onActualizar}><RefreshCw size={14} className={loading ? "animate-spin" : ""} />Actualizar</Btn>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_220px_190px]">
        <div><label htmlFor="buscar-cuentas" className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-gray-600">Buscar</label><div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-gray-400" /><input id="buscar-cuentas" value={busqueda} onChange={e => setBusqueda(e.target.value)} maxLength={100} placeholder="Nombre, usuario, correo o cédula" className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#2E75B6] focus:ring-2 focus:ring-[#2E75B6]/20" /></div></div>
        <div><label htmlFor="filtro-rol" className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-gray-600">Rol</label><select id="filtro-rol" value={rol} onChange={e => { setRol(e.target.value as RolSistema | ""); setPagina(0); }} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#2E75B6]"><option value="">Todos los roles</option>{ROLES.map(item => <option key={item.valor} value={item.valor}>{item.etiqueta}</option>)}</select></div>
        <div><label htmlFor="filtro-estado" className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-gray-600">Estado</label><select id="filtro-estado" value={estado} onChange={e => { setEstado(e.target.value as EstadoCuentaSistema | ""); setPagina(0); }} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#2E75B6]"><option value="">Todos los estados</option><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option><option value="BLOQUEADO">Bloqueado</option></select></div>
      </div>
    </div>

    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#C62828]"><span className="flex items-start gap-2"><AlertCircle size={16} className="mt-0.5 flex-shrink-0" />{error}</span><Btn type="button" size="sm" variant="secondary" onClick={onActualizar}>Reintentar</Btn></div>}
    {loading && !datos && <div role="status" className="rounded-xl border border-gray-200 bg-white py-20 text-center text-sm text-gray-500"><Loader2 size={18} className="mr-2 inline animate-spin" />Cargando cuentas…</div>}
    {!loading && !error && contenido.length === 0 && <EmptyState icon={Users} title="No hay cuentas con estos filtros" description="Cambie la búsqueda, el rol o el estado seleccionado." />}

    {contenido.length > 0 && <div className="rounded-xl border border-gray-200 bg-white shadow-sm" aria-busy={loading}>
      {loading && <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2 text-xs text-gray-500"><Loader2 size={13} className="animate-spin" />Actualizando listado…</div>}
      <div className="divide-y divide-gray-100 lg:hidden">
        {contenido.map(usuario => <article key={usuario.idUsuario} className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="font-semibold text-[#1A1A1A]">{usuario.nombreCompleto}</p><p className="text-xs text-gray-500">{nombreUsuario(usuario)} · {usuario.email ?? "Sin correo"}</p></div><EstadoCuenta estado={usuario.estado} /></div>
          <RolesCuenta roles={usuario.roles} />
          <dl className="grid grid-cols-2 gap-2 text-xs"><div><dt className="text-gray-500">Último acceso</dt><dd className="text-gray-700">{fechaHora(usuario.ultimoAcceso)}</dd></div><div><dt className="text-gray-500">Cédula</dt><dd className="text-gray-700">{usuario.cedulaEnmascarada ?? "No registrada"}</dd></div></dl>
          <div className="flex flex-wrap items-center justify-between gap-2"><span className={`text-xs font-medium ${usuario.debeCambiarClave ? "text-amber-700" : "text-green-700"}`}>{usuario.debeCambiarClave ? "Cambio de clave pendiente" : "Clave actualizada"}</span>{usuario.esCuentaActual && <Badge v="info">Cuenta actual</Badge>}</div>
          <AccionesCuenta usuario={usuario} onRestablecer={onRestablecer} onEstado={onEstado} />
        </article>)}
      </div>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="border-b border-gray-200 bg-[#F5F7FA] text-[10px] font-semibold uppercase tracking-widest text-gray-600"><tr><th className="px-4 py-3">Cuenta</th><th className="px-4 py-3">Rol</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Último acceso</th><th className="px-4 py-3">Creación</th><th className="px-4 py-3">Seguridad</th><th className="px-4 py-3 text-right">Acciones</th></tr></thead>
          <tbody className="divide-y divide-gray-100">{contenido.map(usuario => <tr key={usuario.idUsuario} className="hover:bg-gray-50"><td className="px-4 py-3"><p className="font-semibold text-[#1A1A1A]">{usuario.nombreCompleto}</p><p className="text-xs text-gray-500">{nombreUsuario(usuario)} · {usuario.email ?? "Sin correo"}</p><p className="mt-1 text-[11px] text-gray-400">Cédula: {usuario.cedulaEnmascarada ?? "no registrada"}</p></td><td className="px-4 py-3"><RolesCuenta roles={usuario.roles} /></td><td className="px-4 py-3"><div className="space-y-1"><EstadoCuenta estado={usuario.estado} />{usuario.esCuentaActual && <div><Badge v="info">Cuenta actual</Badge></div>}</div></td><td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{fechaHora(usuario.ultimoAcceso)}</td><td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{fechaHora(usuario.creadoEn)}</td><td className="px-4 py-3">{usuario.debeCambiarClave ? <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700"><Clock size={13} />Cambio pendiente</span> : <span className="inline-flex items-center gap-1 text-xs font-medium text-[#2E7D32]"><CheckCircle2 size={13} />Clave actualizada</span>}</td><td className="px-4 py-3"><AccionesCuenta usuario={usuario} onRestablecer={onRestablecer} onEstado={onEstado} /></td></tr>)}</tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-gray-200 bg-[#F8FAFC] px-4 py-3 text-xs text-gray-600 sm:flex-row sm:items-center sm:justify-between">
        <span>{datos?.totalElementos ?? 0} cuenta(s) · Página {(datos?.pagina ?? pagina) + 1} de {Math.max(1, totalPaginas)}</span>
        <div className="flex items-center gap-2"><Btn type="button" variant="secondary" size="sm" disabled={loading || pagina === 0} onClick={() => setPagina(valor => Math.max(0, valor - 1))}><ChevronLeft size={14} />Anterior</Btn><Btn type="button" variant="secondary" size="sm" disabled={loading || totalPaginas === 0 || pagina + 1 >= totalPaginas} onClick={() => setPagina(valor => valor + 1)}>Siguiente<ChevronRight size={14} /></Btn></div>
      </div>
    </div>}
  </section>;
}

function ConfirmarAccion({ accion, procesando, onClose, onConfirmar }: {
  accion: AccionConfirmada;
  procesando: boolean;
  onClose: () => void;
  onConfirmar: () => void;
}) {
  const esRestablecimiento = accion.tipo === "restablecer";
  const habilitar = accion.tipo === "estado" && accion.estado === "ACTIVO";
  const titulo = esRestablecimiento ? "Restablecer contraseña" : habilitar ? "Habilitar cuenta" : "Deshabilitar cuenta";
  const sinCedula = esRestablecimiento && !accion.usuario.cedulaEnmascarada;
  const bloqueadaPorCuentaPropia = accion.usuario.esCuentaActual;

  return <Modal title={titulo} onClose={onClose} size="md">
    <div className="space-y-4">
      <ResumenCuenta usuario={accion.usuario} />
      {esRestablecimiento ? <>
        {sinCedula
          ? <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#C62828]"><AlertCircle size={16} className="mt-0.5 flex-shrink-0" />Esta cuenta no tiene una cédula registrada. No se puede generar la contraseña temporal.</div>
          : <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p>La contraseña temporal se establecerá usando la cédula registrada y el usuario deberá cambiarla al iniciar sesión.</p><p className="mt-2 font-semibold">Las sesiones y tokens existentes serán cerrados.</p></div>}
      </> : <div className={`rounded-lg border p-3 text-sm ${habilitar ? "border-green-200 bg-green-50 text-green-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
        {habilitar
          ? "La cuenta recuperará el acceso con su contraseña vigente. Los intentos fallidos y bloqueos temporales serán limpiados."
          : "La cuenta no podrá iniciar sesión y sus sesiones y tokens existentes serán cerrados."}
      </div>}
      {bloqueadaPorCuentaPropia && <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#C62828]"><AlertCircle size={16} className="mt-0.5 flex-shrink-0" />No puede ejecutar esta acción sobre su propia cuenta desde este módulo.</div>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Btn type="button" variant="secondary" disabled={procesando} onClick={onClose}>Cancelar</Btn>
        <Btn type="button" variant={!esRestablecimiento && !habilitar ? "danger" : "primary"}
          disabled={procesando || sinCedula || bloqueadaPorCuentaPropia} onClick={onConfirmar}>
          {procesando ? <Loader2 size={14} className="animate-spin" /> : esRestablecimiento ? <KeyRound size={14} /> : habilitar ? <UserCheck size={14} /> : <UserX size={14} />}
          {esRestablecimiento ? "Confirmar restablecimiento" : habilitar ? "Confirmar habilitación" : "Confirmar deshabilitación"}
        </Btn>
      </div>
    </div>
  </Modal>;
}
