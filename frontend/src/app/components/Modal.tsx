import { useEffect, useId } from "react";
import { X } from "lucide-react";

/**
 * Overlay de diálogo compartido — mismo patrón que ya se repetía a mano en TareasView
 * ("Calificar entrega") y FinancialView ("Nueva obligación"): fixed inset-0 + fondo oscuro +
 * panel blanco centrado. Nuevos modales deberían usar este componente en vez de duplicarlo.
 */
export function Modal({ title, onClose, size = "md", children }: {
  title: string; onClose: () => void; size?: "sm" | "md" | "lg" | "xl"; children: React.ReactNode;
}) {
  const titleId = useId();
  const maxWidth = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-2xl", xl: "max-w-5xl" }[size];

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className={`bg-white rounded-xl shadow-lg w-full ${maxWidth} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 id={titleId} className="text-sm font-semibold text-[#1A1A1A]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar"
            className="text-gray-400 hover:text-gray-600 focus:outline-none">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
