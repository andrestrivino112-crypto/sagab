import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Mail, RefreshCw, Send, Users } from "lucide-react";
import { ApiError } from "../../api/client";
import {
  mensajes as mensajesApi, personal as personalApi, type MensajeEnviadoResponse, type PersonalResumen,
} from "../../api/sagab";
import { Btn } from "../components/Btn";
import { EmptyState } from "../components/EmptyState";
import { TopBar } from "../components/TopBar";
import { useToast } from "../components/Toast";

type Modo = "masivo" | "privado";

export function MensajesInstitucionalesView() {
  const toast = useToast();
  const [modo, setModo] = useState<Modo>("masivo");
  const [docentes, setDocentes] = useState<PersonalResumen[]>([]);
  const [historial, setHistorial] = useState<MensajeEnviadoResponse[]>([]);
  const [idDocente, setIdDocente] = useState<number | "">("");
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = () => {
    setLoading(true); setError(null);
    Promise.all([personalApi.listar(), mensajesApi.enviados()])
      .then(([personal, enviados]) => {
        setDocentes(personal.filter(p => p.rol === "DOCENTE" && p.estado === "ACTIVO"));
        setHistorial(enviados);
      })
      .catch(e => setError(e instanceof ApiError ? e.message : "No se pudo cargar la mensajería institucional."))
      .finally(() => setLoading(false));
  };
  useEffect(cargar, []);

  const docenteSeleccionado = useMemo(() => docentes.find(d => d.idUsuario === idDocente), [docentes, idDocente]);
  const enviar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (modo === "privado" && idDocente === "") return;
    setSending(true);
    try {
      await mensajesApi.enviarInstitucional({
        idDocenteUsuario: modo === "privado" ? Number(idDocente) : undefined,
        asunto: asunto.trim(), cuerpo: cuerpo.trim(),
      });
      toast.success(modo === "masivo" ? `Mensaje entregado a ${docentes.length} docente(s)` : `Mensaje enviado a ${docenteSeleccionado?.nombreCompleto}`);
      setAsunto(""); setCuerpo(""); setIdDocente("");
      setHistorial(await mensajesApi.enviados());
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "No se pudo enviar el mensaje."); }
    finally { setSending(false); }
  };

  return <div className="min-h-screen bg-[#F5F7FA]">
    <TopBar title="Mensajes institucionales" subtitle="Comunicación exclusiva de Administración con el cuerpo docente" />
    <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[0.9fr,1.1fr] lg:p-8">
      <section className="h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-2 rounded-xl bg-gray-100 p-1" role="tablist" aria-label="Tipo de mensaje">
          <button type="button" role="tab" aria-selected={modo === "masivo"} onClick={() => setModo("masivo")} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${modo === "masivo" ? "bg-white text-[#1F4E79] shadow-sm" : "text-gray-500"}`}><Users size={15} />Masivo</button>
          <button type="button" role="tab" aria-selected={modo === "privado"} onClick={() => setModo("privado")} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${modo === "privado" ? "bg-white text-[#1F4E79] shadow-sm" : "text-gray-500"}`}><Mail size={15} />Privado</button>
        </div>

        <div className="mt-4 rounded-xl border border-blue-100 bg-[#F5F9FD] p-3 text-sm text-[#1F4E79]">
          {modo === "masivo" ? <><strong>{docentes.length} docente(s)</strong> recibirán una copia individual, con estado de lectura y contador propios.</>
            : <>Seleccione un docente. Ningún otro usuario podrá ver este mensaje.</>}
        </div>

        <form onSubmit={enviar} className="mt-5 space-y-4">
          {modo === "privado" && <div><label htmlFor="msg-docente" className="mb-1 block text-xs font-semibold text-gray-600">Docente</label><select id="msg-docente" required value={idDocente} onChange={e => setIdDocente(e.target.value ? Number(e.target.value) : "")} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"><option value="">Seleccione…</option>{docentes.map(d => <option key={d.idUsuario} value={d.idUsuario}>{d.nombreCompleto} · {d.email}</option>)}</select></div>}
          <div><label htmlFor="msg-inst-asunto" className="mb-1 block text-xs font-semibold text-gray-600">Asunto</label><input id="msg-inst-asunto" required maxLength={150} value={asunto} onChange={e => setAsunto(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#2E75B6] focus:outline-none" /></div>
          <div><label htmlFor="msg-inst-cuerpo" className="mb-1 block text-xs font-semibold text-gray-600">Mensaje</label><textarea id="msg-inst-cuerpo" required maxLength={10000} rows={7} value={cuerpo} onChange={e => setCuerpo(e.target.value)} className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:border-[#2E75B6] focus:outline-none" /><p className="mt-1 text-right text-[11px] text-gray-400">{cuerpo.length}/10000</p></div>
          <Btn disabled={sending || docentes.length === 0 || (modo === "privado" && idDocente === "")} className="w-full">{sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}Enviar mensaje</Btn>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4"><div><h2 className="font-semibold text-[#1A1A1A]">Historial de envíos</h2><p className="mt-0.5 text-xs text-gray-500">Lecturas independientes por destinatario</p></div><button type="button" onClick={cargar} disabled={loading} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Actualizar"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button></div>
        {error && <div role="alert" className="m-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-[#C62828]"><AlertCircle size={15} className="mt-0.5" />{error}</div>}
        {loading ? <div className="p-8 text-center text-sm text-gray-500"><Loader2 size={17} className="mr-2 inline animate-spin" />Cargando…</div>
        : historial.length === 0 ? <div className="p-5"><EmptyState icon={Mail} title="Todavía no hay mensajes enviados." /></div>
        : <ul className="max-h-[680px] divide-y divide-gray-100 overflow-y-auto">{historial.map(m => {
          const completo = m.totalDestinatarios > 0 && m.leidos === m.totalDestinatarios;
          return <li key={m.idMensaje} className="p-4 hover:bg-gray-50"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-[#1A1A1A]">{m.asunto}</p><p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-gray-600">{m.cuerpo}</p></div><span className={`flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${completo ? "bg-green-50 text-[#2E7D32]" : "bg-amber-50 text-amber-700"}`}>{completo && <CheckCircle2 size={12} />}{m.leidos}/{m.totalDestinatarios} leídos</span></div><div className="mt-3 flex items-center justify-between text-[11px] text-gray-500"><span>{m.esCircular ? "Mensaje masivo" : "Mensaje privado"}</span><time>{new Date(m.enviadoEn).toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" })}</time></div></li>;
        })}</ul>}
      </section>
    </div>
  </div>;
}
