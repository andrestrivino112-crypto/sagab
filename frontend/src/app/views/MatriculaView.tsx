import { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle, Clock, Info, Loader2, Save } from "lucide-react";
import { ApiError } from "../../api/client";
import { paralelos as paralelosApi, matriculas as matriculasApi, type ParaleloOpcion, type MatriculaRequest } from "../../api/sagab";
import { DateField } from "../components/DateField";
import { FormField } from "../components/FormField";
import { TopBar } from "../components/TopBar";
import { useToast } from "../components/Toast";
// Bootstrap solo lo usa este formulario: se importa aquí (no en index.css global)
// para que el code-splitting de MatriculaView lo cargue únicamente cuando se navega a esta vista.
import "../../styles/forms-scoped.css";

// ── Datos y validación ──────────────────────────────────────────────────────
interface MatriculaData {
  nombres: string;
  apellidos: string;
  cedula: string;
  fechaNacimiento: string;
  genero: string;
  idParalelo: number | "";
  institucionProcedencia: string;
  direccion: string;
  telefonoEstudiante: string;
  tipoSangre: string;
  condicionMedica: string;
  representanteNombres: string;
  representanteApellidos: string;
  representanteCedula: string;
  parentesco: string;
  representanteEmail: string;
  representanteTelefono: string;
  contactoEmergencia: string;
  documentos: string[];
}

const MATRICULA_EMPTY: MatriculaData = {
  nombres: "", apellidos: "", cedula: "", fechaNacimiento: "", genero: "",
  idParalelo: "", institucionProcedencia: "",
  direccion: "", telefonoEstudiante: "", tipoSangre: "", condicionMedica: "",
  representanteNombres: "", representanteApellidos: "", representanteCedula: "", parentesco: "",
  representanteEmail: "", representanteTelefono: "", contactoEmergencia: "",
  documentos: [],
};

const GENEROS = [{ v: "M", l: "Masculino" }, { v: "F", l: "Femenino" }, { v: "O", l: "Otro" }];
const TIPOS_SANGRE = ["A+","A-","B+","B-","AB+","AB-","O+","O-"];
const PARENTESCOS = ["Padre", "Madre", "Tutor legal", "Otro"];
const NIVEL_EDAD: Record<string, [number, number]> = {
  "1° BGU": [14, 16],
  "2° BGU": [15, 17],
  "3° BGU": [16, 18],
};
const DOCUMENTOS_REQUERIDOS = [
  { id: "cedula_est", label: "Copia de cédula del estudiante" },
  { id: "partida",    label: "Partida de nacimiento" },
  { id: "foto",       label: "Foto tamaño carnet" },
  { id: "conducta",   label: "Certificado de conducta" },
];

const RE_NOMBRE   = /^[A-Za-zÁÉÍÓÚÑÜáéíóúñü ]{3,60}$/;
const RE_EMAIL    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_TELEFONO = /^(09\d{8}|0[2-7]\d{7})$/;

function isValidCedulaEc(cedula: string): boolean {
  if (!/^\d{10}$/.test(cedula)) return false;
  const d = cedula.split("").map(Number);
  const provincia = parseInt(cedula.slice(0, 2), 10);
  if (provincia < 1 || provincia > 24) return false;
  if (d[2] > 6) return false;
  const coef = [2,1,2,1,2,1,2,1,2];
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let v = d[i] * coef[i];
    if (v >= 10) v -= 9;
    suma += v;
  }
  const verificador = (10 - (suma % 10)) % 10;
  return verificador === d[9];
}

function calcEdad(fecha: string): number | null {
  if (!fecha) return null;
  const nac = new Date(fecha);
  if (isNaN(nac.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

function fieldErrors(f: MatriculaData): Partial<Record<keyof MatriculaData, string>> {
  const e: Partial<Record<keyof MatriculaData, string>> = {};
  if (!RE_NOMBRE.test(f.nombres.trim()))    e.nombres = "Ingrese un nombre válido (mín. 3 letras)";
  if (!RE_NOMBRE.test(f.apellidos.trim()))  e.apellidos = "Ingrese un apellido válido (mín. 3 letras)";
  if (!isValidCedulaEc(f.cedula))           e.cedula = "Cédula ecuatoriana inválida (10 dígitos)";
  if (!f.fechaNacimiento) {
    e.fechaNacimiento = "Campo requerido";
  } else {
    const edad = calcEdad(f.fechaNacimiento);
    if (edad === null || new Date(f.fechaNacimiento) > new Date()) e.fechaNacimiento = "Fecha inválida";
    else if (edad < 3 || edad > 20) e.fechaNacimiento = "Edad fuera de rango permitido (3–20 años)";
  }
  if (!f.genero)   e.genero = "Seleccione una opción";
  if (!f.idParalelo) e.idParalelo = "Seleccione una opción";
  if (f.direccion.trim().length < 8) e.direccion = "Ingrese la dirección completa (mín. 8 caracteres)";
  if (f.telefonoEstudiante && !RE_TELEFONO.test(f.telefonoEstudiante)) e.telefonoEstudiante = "Teléfono inválido (Ecuador)";
  if (!RE_NOMBRE.test(f.representanteNombres.trim())) e.representanteNombres = "Ingrese un nombre válido (mín. 3 letras)";
  if (!RE_NOMBRE.test(f.representanteApellidos.trim())) e.representanteApellidos = "Ingrese un apellido válido (mín. 3 letras)";
  if (!isValidCedulaEc(f.representanteCedula)) e.representanteCedula = "Cédula ecuatoriana inválida (10 dígitos)";
  if (!f.parentesco) e.parentesco = "Seleccione una opción";
  if (!RE_EMAIL.test(f.representanteEmail)) e.representanteEmail = "Correo electrónico inválido";
  if (!RE_TELEFONO.test(f.representanteTelefono)) e.representanteTelefono = "Teléfono inválido (Ecuador)";
  if (f.contactoEmergencia.trim().length < 5 || !/\d{7,}/.test(f.contactoEmergencia)) e.contactoEmergencia = "Incluya nombre y un teléfono de contacto";
  if (f.documentos.length !== DOCUMENTOS_REQUERIDOS.length) {
    e.documentos = "Debe confirmar la entrega de todos los documentos para matricular";
  }
  return e;
}

interface Alerta { msg: string; tipo: "error" | "warning" | "info"; }

function businessAlerts(f: MatriculaData, nivelSeleccionado?: string): Alerta[] {
  const alerts: Alerta[] = [];
  const edad = calcEdad(f.fechaNacimiento);
  if (edad !== null && nivelSeleccionado && NIVEL_EDAD[nivelSeleccionado]) {
    const [min, max] = NIVEL_EDAD[nivelSeleccionado];
    if (edad < min || edad > max) {
      alerts.push({ msg: `La edad del estudiante (${edad} años) no es la típica para ${nivelSeleccionado} (${min}–${max} años).`, tipo: "warning" });
    }
  }
  if (f.cedula && f.representanteCedula && f.cedula === f.representanteCedula) {
    alerts.push({ msg: "La cédula del estudiante y la del representante no pueden ser iguales.", tipo: "error" });
  }
  if (f.condicionMedica.trim()) {
    alerts.push({ msg: `Estudiante con condición médica registrada: "${f.condicionMedica.trim()}". Notificar a docentes.`, tipo: "info" });
  }
  return alerts;
}

type FieldKey = keyof MatriculaData;

// ── Vista ────────────────────────────────────────────────────────────────────
export function MatriculaView() {
  const toast = useToast();
  const [form, setForm] = useState<MatriculaData>(MATRICULA_EMPTY);
  const [touchedFields, setTouchedFields] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ codigo: string; usuarioEstudiante: string; usuarioRepresentante: string; representanteNuevo: boolean } | null>(null);
  const [paralelosOpciones, setParalelosOpciones] = useState<ParaleloOpcion[]>([]);
  const [paraleloTexto, setParaleloTexto] = useState("");

  useEffect(() => {
    paralelosApi.listar().then(setParalelosOpciones).catch(() => setParalelosOpciones([]));
  }, []);

  const set = <K extends FieldKey>(key: K, value: MatriculaData[K]) => {
    setForm(p => ({ ...p, [key]: value }));
    setTouchedFields(p => ({ ...p, [key]: true }));
    setSaved(null);
  };

  const toggleDocumento = (id: string) => {
    setForm(p => ({
      ...p,
      documentos: p.documentos.includes(id) ? p.documentos.filter(d => d !== id) : [...p.documentos, id],
    }));
    setTouchedFields(p => ({ ...p, documentos: true }));
    setSaved(null);
  };

  const paraleloSeleccionado = paralelosOpciones.find(p => p.id === form.idParalelo);
  const errors = fieldErrors(form);
  const alerts = businessAlerts(form, paraleloSeleccionado?.nivel);
  const allOk = Object.keys(errors).length === 0;

  // Feedback instantáneo: en cuanto el usuario interactúa con un campo, ya se marca válido (visto azul) o inválido (rojo)
  const cls = (key: FieldKey, base: string) => {
    if (!touchedFields[key]) return base;
    if (errors[key]) return `${base} is-invalid`;
    const v = form[key];
    const filled = Array.isArray(v) ? v.length > 0 : String(v).trim().length > 0;
    return filled ? `${base} is-valid` : base;
  };
  const err = (key: FieldKey) => touchedFields[key] ? errors[key] : undefined;

  const submit = async () => {
    setAttempted(true);
    const allKeys = Object.keys(MATRICULA_EMPTY) as FieldKey[];
    setTouchedFields(Object.fromEntries(allKeys.map(k => [k, true])) as Partial<Record<FieldKey, boolean>>);
    if (!allOk || !paraleloSeleccionado) return;

    setSaving(true);
    const req: MatriculaRequest = {
      estudianteNombres: form.nombres.trim(),
      estudianteApellidos: form.apellidos.trim(),
      estudianteCedula: form.cedula,
      fechaNacimiento: form.fechaNacimiento,
      genero: form.genero,
      nivel: paraleloSeleccionado.nivel,
      seccion: paraleloSeleccionado.seccion,
      anioLectivo: paraleloSeleccionado.anioLectivo,
      institucionProcedencia: form.institucionProcedencia || undefined,
      direccion: form.direccion.trim(),
      telefonoEstudiante: form.telefonoEstudiante || undefined,
      tipoSangre: form.tipoSangre || undefined,
      condicionMedica: form.condicionMedica || undefined,
      representanteNombres: form.representanteNombres.trim(),
      representanteApellidos: form.representanteApellidos.trim(),
      representanteCedula: form.representanteCedula,
      parentesco: form.parentesco,
      representanteEmail: form.representanteEmail.trim().toLowerCase(),
      representanteTelefono: form.representanteTelefono,
      contactoEmergencia: form.contactoEmergencia.trim(),
      documentos: form.documentos,
    };
    try {
      const resp = await matriculasApi.crear(req);
      setSaved({
        codigo: resp.codigo, usuarioEstudiante: resp.usuarioEstudiante,
        usuarioRepresentante: resp.usuarioRepresentante, representanteNuevo: resp.representanteNuevo,
      });
      toast.success(`Matrícula registrada correctamente · código ${resp.codigo}`);
      toast.success(`Usuario creado correctamente: ${resp.usuarioEstudiante}`);
      setForm(MATRICULA_EMPTY);
      setTouchedFields({});
      setParaleloTexto("");
      setAttempted(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo registrar la matrícula. Intente nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  const docsOk = form.documentos.length === DOCUMENTOS_REQUERIDOS.length;

  return (
    <div className="matricula-form">
      <style>{`
        .matricula-form .form-control.is-valid,
        .matricula-form .form-select.is-valid {
          border-color: #2E75B6;
          box-shadow: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Cpath fill='%232E75B6' d='M2.3 6.73L.6 4.53c-.39-.51-.28-1.24.24-1.62.51-.38 1.24-.28 1.62.24l.9 1.15L6.4 1.4c.4-.5 1.12-.58 1.62-.18.5.4.58 1.13.18 1.63L3.6 6.6c-.4.5-1.1.53-1.3.13z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-size: 1rem 1rem;
        }
        .matricula-form .form-control.is-valid {
          background-position: right .75rem center;
          padding-right: 2.5rem;
        }
        .matricula-form .form-select.is-valid {
          background-position: right 2rem center;
          padding-right: 3.25rem;
        }
        .matricula-form .form-control.is-valid:focus,
        .matricula-form .form-select.is-valid:focus {
          border-color: #2E75B6;
          box-shadow: 0 0 0 .25rem rgba(46,117,182,.25);
        }
        .matricula-form .form-control.is-invalid,
        .matricula-form .form-select.is-invalid {
          border-width: 2px;
          background-color: #FDECEC;
        }
        .matricula-form .form-control.is-invalid:focus,
        .matricula-form .form-select.is-invalid:focus {
          box-shadow: 0 0 0 .25rem rgba(198,40,40,.25);
        }
        .matricula-form .invalid-feedback { font-weight: 600; }
        .matricula-form .form-label { font-weight: 500; color: #33414F; }
        .matricula-form .card-header { font-weight: 600; color: #1A1A1A; }
        .matricula-form .docs-box.is-valid { border-color: #2E75B6 !important; background: #EAF2FB; }
        .matricula-form .docs-box.is-invalid { border-color: #C62828 !important; border-width: 2px; background: #FDECEC; }
        .matricula-form .rdp { --rdp-accent-color: #2E75B6; --rdp-background-color: #EAF2FB; margin: 0; }
      `}</style>

      <TopBar title="Matrícula de Estudiante" subtitle="Formulario de inscripción · registra al estudiante y, si es nuevo, la cuenta de su representante" />
      <div className="p-4" style={{ maxWidth: 560 }}>

        {/* Alertas de negocio (no dependen de un solo campo) */}
        {alerts.length > 0 && (
          <div className="mb-3">
            {alerts.map((a, i) => (
              <div key={i} className={`alert d-flex align-items-start gap-2 py-2 mb-2 ${
                a.tipo === "error" ? "alert-danger" : a.tipo === "warning" ? "alert-warning" : "alert-info"}`} role="alert">
                {a.tipo === "error"   && <AlertTriangle size={16} className="flex-shrink-0 mt-1" aria-hidden="true" />}
                {a.tipo === "warning" && <Clock         size={16} className="flex-shrink-0 mt-1" aria-hidden="true" />}
                {a.tipo === "info"    && <Info          size={16} className="flex-shrink-0 mt-1" aria-hidden="true" />}
                <span className="small mb-0">{a.msg}</span>
              </div>
            ))}
          </div>
        )}

        {/* 1. Datos del estudiante — un campo por fila */}
        <div className="card shadow-sm mb-3">
          <h2 className="card-header bg-white h6 mb-0">Datos del estudiante</h2>
          <div className="card-body d-flex flex-column gap-3">
            <FormField label="Nombres" error={err("nombres")}>
              <input className={cls("nombres", "form-control")} value={form.nombres} onChange={e => set("nombres", e.target.value)} placeholder="Ej. Alejandra Nicole" autoComplete="given-name" maxLength={80} />
            </FormField>
            <FormField label="Apellidos" error={err("apellidos")}>
              <input className={cls("apellidos", "form-control")} value={form.apellidos} onChange={e => set("apellidos", e.target.value)} placeholder="Ej. Morales Vega" autoComplete="family-name" maxLength={80} />
            </FormField>
            <FormField label="Cédula de identidad" error={err("cedula")} hint={!touchedFields.cedula ? "10 dígitos, cédula ecuatoriana" : undefined}>
              <input className={cls("cedula", "form-control")} value={form.cedula} onChange={e => set("cedula", e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="1712345678" inputMode="numeric" maxLength={10} />
            </FormField>
            <FormField label="Fecha de nacimiento" error={err("fechaNacimiento")}>
              <DateField value={form.fechaNacimiento} onChange={v => set("fechaNacimiento", v)}
                className={cls("fechaNacimiento", "form-control")} maxDate={new Date()} />
            </FormField>
            <FormField label="Género" error={err("genero")}>
              <select className={cls("genero", "form-select")} value={form.genero} onChange={e => set("genero", e.target.value)}>
                <option value="">No registra</option>
                {GENEROS.map(g => <option key={g.v} value={g.v}>{g.l}</option>)}
              </select>
            </FormField>
            <FormField label="Paralelo a matricular" error={err("idParalelo")} hint={paralelosOpciones.length === 0 ? "Cargando paralelos…" : "Escriba para buscar (autocompletado)"}>
              <input list="paralelos-datalist" className={cls("idParalelo", "form-control")}
                value={paraleloSeleccionado ? `${paraleloSeleccionado.etiqueta} · ${paraleloSeleccionado.anioLectivo}` : paraleloTexto}
                onChange={e => {
                  const val = e.target.value;
                  setParaleloTexto(val);
                  const match = paralelosOpciones.find(p => `${p.etiqueta} · ${p.anioLectivo}` === val);
                  set("idParalelo", match ? match.id : "");
                }}
                placeholder="Ej. 2° BGU · 2025-2026" autoComplete="off" />
              <datalist id="paralelos-datalist">
                {paralelosOpciones.map(p => <option key={p.id} value={`${p.etiqueta} · ${p.anioLectivo}`} />)}
              </datalist>
            </FormField>
            <FormField label="Dirección domiciliaria" error={err("direccion")}>
              <input className={cls("direccion", "form-control")} value={form.direccion} onChange={e => set("direccion", e.target.value)} placeholder="Calle, número, sector" autoComplete="street-address" maxLength={150} />
            </FormField>
            <FormField label="Teléfono del estudiante" error={err("telefonoEstudiante")} required={false} hint={!touchedFields.telefonoEstudiante ? "Opcional · Ej. 0991234567" : undefined}>
              <input className={cls("telefonoEstudiante", "form-control")} value={form.telefonoEstudiante} onChange={e => set("telefonoEstudiante", e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="09XXXXXXXX" inputMode="numeric" maxLength={10} />
            </FormField>
          </div>
        </div>

        {/* 2. Salud */}
        <div className="card shadow-sm mb-3">
          <h2 className="card-header bg-white h6 mb-0">Información de salud</h2>
          <div className="card-body d-flex flex-column gap-3">
            <FormField label="Tipo de sangre" required={false}>
              <select className={cls("tipoSangre", "form-select")} value={form.tipoSangre} onChange={e => set("tipoSangre", e.target.value)}>
                <option value="">Seleccione…</option>
                {TIPOS_SANGRE.map(t => <option key={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Alergias / condición médica" required={false}>
              <textarea className={cls("condicionMedica", "form-control")} value={form.condicionMedica} onChange={e => set("condicionMedica", e.target.value)} placeholder="Ninguna, si no aplica" rows={2} maxLength={500} />
            </FormField>
          </div>
        </div>

        {/* 3. Representante legal y contacto */}
        <div className="card shadow-sm mb-3">
          <h2 className="card-header bg-white h6 mb-0">Representante legal y contacto</h2>
          <div className="card-body d-flex flex-column gap-3">
            <FormField label="Nombres del representante" error={err("representanteNombres")}>
              <input className={cls("representanteNombres", "form-control")} value={form.representanteNombres} onChange={e => set("representanteNombres", e.target.value)} placeholder="Ej. Ana María" autoComplete="given-name" maxLength={80} />
            </FormField>
            <FormField label="Apellidos del representante" error={err("representanteApellidos")}>
              <input className={cls("representanteApellidos", "form-control")} value={form.representanteApellidos} onChange={e => set("representanteApellidos", e.target.value)} placeholder="Ej. Morales Vega" autoComplete="family-name" maxLength={80} />
            </FormField>
            <FormField label="Cédula del representante" error={err("representanteCedula")} hint={!touchedFields.representanteCedula ? "10 dígitos, cédula ecuatoriana" : undefined}>
              <input className={cls("representanteCedula", "form-control")} value={form.representanteCedula} onChange={e => set("representanteCedula", e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="1712345678" inputMode="numeric" maxLength={10} />
            </FormField>
            <FormField label="Parentesco" error={err("parentesco")}>
              <select className={cls("parentesco", "form-select")} value={form.parentesco} onChange={e => set("parentesco", e.target.value)}>
                <option value="">Seleccione…</option>
                {PARENTESCOS.map(p => <option key={p}>{p}</option>)}
              </select>
            </FormField>
            <FormField label="Correo electrónico" error={err("representanteEmail")} hint={!touchedFields.representanteEmail ? "Ej. nombre@correo.com" : undefined}>
              <input type="email" className={cls("representanteEmail", "form-control")} value={form.representanteEmail} onChange={e => set("representanteEmail", e.target.value)} placeholder="correo@ejemplo.com" autoComplete="email" />
            </FormField>
            <FormField label="Teléfono del representante" error={err("representanteTelefono")} hint={!touchedFields.representanteTelefono ? "Ej. 0991234567" : undefined}>
              <input className={cls("representanteTelefono", "form-control")} value={form.representanteTelefono} onChange={e => set("representanteTelefono", e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="09XXXXXXXX" inputMode="numeric" maxLength={10} />
            </FormField>
            <FormField label="Contacto de emergencia" error={err("contactoEmergencia")} hint={!touchedFields.contactoEmergencia ? "Nombre y teléfono de contacto" : undefined}>
              <input className={cls("contactoEmergencia", "form-control")} value={form.contactoEmergencia} onChange={e => set("contactoEmergencia", e.target.value)} placeholder="Ej. María Pérez 0991234567" maxLength={150} />
            </FormField>
          </div>
        </div>

        {/* 4. Procedencia y documentos */}
        <div className="card shadow-sm mb-3">
          <h2 className="card-header bg-white h6 mb-0">Procedencia y documentos</h2>
          <div className="card-body d-flex flex-column gap-3">
            <FormField label="Institución de procedencia" required={false}>
              <input className={cls("institucionProcedencia", "form-control")} value={form.institucionProcedencia} onChange={e => set("institucionProcedencia", e.target.value)} placeholder="Nombre de la institución anterior" maxLength={150} />
            </FormField>
            <div>
              <label className="form-label">Documentos entregados <span className="text-danger">*</span></label>
              <div className={`docs-box border rounded p-2 ${touchedFields.documentos ? (docsOk ? "is-valid" : "is-invalid") : ""}`}>
                {DOCUMENTOS_REQUERIDOS.map(doc => (
                  <div className="form-check" key={doc.id}>
                    <input className="form-check-input" type="checkbox" id={`doc-${doc.id}`}
                      checked={form.documentos.includes(doc.id)} onChange={() => toggleDocumento(doc.id)} />
                    <label className="form-check-label" htmlFor={`doc-${doc.id}`}>{doc.label}</label>
                  </div>
                ))}
              </div>
              {touchedFields.documentos && (
                docsOk
                  ? <div className="form-text text-primary fw-semibold"><CheckCircle size={12} className="me-1" style={{ verticalAlign: "-1px" }} />Documentación completa</div>
                  : <div role="alert" className="invalid-feedback d-block"><AlertCircle size={12} className="me-1" style={{ verticalAlign: "-1px" }} aria-hidden="true" />{errors.documentos}</div>
              )}
            </div>
          </div>
        </div>

        {/* Resultado y envío */}
        {saved && (
          <div role="status" className="alert alert-success d-flex align-items-start gap-2 mb-3">
            <CheckCircle size={18} className="flex-shrink-0 mt-1" aria-hidden="true" />
            <div>
              <p className="mb-1 fw-semibold">Matrícula registrada correctamente · código {saved.codigo}</p>
              <p className="mb-1 small">Usuario del estudiante (Portal Familiar): <strong>{saved.usuarioEstudiante}</strong> · contraseña inicial: su número de cédula (deberá cambiarla al ingresar por primera vez).</p>
              {saved.representanteNuevo ? (
                <p className="mb-0 small">
                  Se creó una cuenta nueva para el representante. Usuario: <strong>{saved.usuarioRepresentante}</strong>. La contraseña inicial corresponde a la cédula registrada y deberá cambiarse al ingresar por primera vez.
                </p>
              ) : (
                <p className="mb-0 small">El representante ya tenía una cuenta (usuario <strong>{saved.usuarioRepresentante}</strong>) y fue vinculado a este estudiante.</p>
              )}
            </div>
          </div>
        )}
        <div className="d-flex align-items-center justify-content-end gap-3 pb-4">
          <button type="button" disabled={saving}
            className={`btn ${attempted && !allOk ? "btn-danger" : "btn-primary"} d-flex align-items-center gap-2`} onClick={submit}>
            {saving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
            {saving ? "Registrando…" : attempted && !allOk ? "Corrija los campos marcados" : "Registrar matrícula"}
          </button>
        </div>
      </div>
    </div>
  );
}
