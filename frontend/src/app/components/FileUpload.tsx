import { useEffect, useRef, useState } from "react";
import { FileUp, Loader2, Paperclip, X } from "lucide-react";

/**
 * Selector de archivo con arrastrar-y-soltar. Solo hace una validación de tamaño en cliente
 * (mejor experiencia, feedback inmediato) — la validación real de tipo/tamaño/contenido la
 * hace siempre el backend (ver FileValidationService), este control nunca es la única defensa.
 */
export function FileUpload({ accept, maxSizeMb, onFileSelected, value, disabled = false, label = "Adjuntar archivo" }: {
  accept: string; maxSizeMb: number; onFileSelected: (file: File | null) => void;
  /** Si se define, el archivo queda controlado por el componente padre. Pasar null después de
   * guardar también limpia el input nativo, permitiendo seleccionar de nuevo el mismo archivo. */
  value?: File | null;
  disabled?: boolean; label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivoInterno, setArchivoInterno] = useState<File | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controlado = value !== undefined;
  const archivo = controlado ? value : archivoInterno;

  useEffect(() => {
    if (controlado && value == null) {
      if (inputRef.current) inputRef.current.value = "";
      setError(null);
    }
  }, [controlado, value]);

  const actualizar = (file: File | null) => {
    if (!controlado) setArchivoInterno(file);
    onFileSelected(file);
  };

  const aceptar = (file: File) => {
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`El archivo supera el tamaño máximo permitido (${maxSizeMb} MB).`);
      actualizar(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setError(null);
    actualizar(file);
  };

  const quitar = () => {
    actualizar(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  if (archivo) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm">
        <Paperclip size={14} className="text-gray-500 flex-shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate text-[#1A1A1A]">{archivo.name}</span>
        <span className="text-xs text-gray-500 flex-shrink-0">{(archivo.size / 1024).toFixed(0)} KB</span>
        <button type="button" onClick={quitar} disabled={disabled} aria-label="Quitar archivo"
          className="flex-shrink-0 text-gray-400 hover:text-[#C62828] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C62828]/40 rounded">
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <label
        onDragOver={e => { e.preventDefault(); setArrastrando(true); }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={e => {
          e.preventDefault(); setArrastrando(false);
          if (!disabled && e.dataTransfer.files[0]) aceptar(e.dataTransfer.files[0]);
        }}
        className={`flex items-center justify-center gap-2 rounded-lg border-2 border-dashed px-3 py-4 text-sm cursor-pointer transition-colors
          ${disabled ? "opacity-50 cursor-not-allowed border-gray-200" :
            arrastrando ? "border-[#2E75B6] bg-[#EAF2FB]" : "border-gray-300 hover:border-gray-400 text-gray-600"}`}>
        {disabled ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <FileUp size={15} aria-hidden="true" />}
        <span>{label}</span>
        <input ref={inputRef} type="file" accept={accept} disabled={disabled} className="sr-only"
          onChange={e => e.target.files?.[0] && aceptar(e.target.files[0])} />
      </label>
      {error && <p role="alert" className="text-xs text-[#C62828] mt-1">{error}</p>}
    </div>
  );
}
