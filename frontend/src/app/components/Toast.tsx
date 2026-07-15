import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CheckCircle, AlertTriangle, Info } from "lucide-react";

type ToastVariant = "success" | "error" | "info";
interface ToastItem { id: number; variant: ToastVariant; message: string; }

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastVariant, React.ElementType> = { success: CheckCircle, error: AlertTriangle, info: Info };
const DURACION_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback((variant: ToastVariant, message: string) => {
    const id = nextId.current++;
    setToasts(prev => [...prev, { id, variant, message }]);
    window.setTimeout(() => dismiss(id), DURACION_MS);
  }, [dismiss]);

  const value: ToastContextValue = {
    success: message => push("success", message),
    error: message => push("error", message),
    info: message => push("info", message),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map(t => {
          const Icon = ICONS[t.variant];
          return (
            <div key={t.id} className={`toast toast--${t.variant}`} role="alert">
              <div className="toast-body">
                <Icon size={16} className="flex-shrink-0" />
                <span>{t.message}</span>
              </div>
              <button type="button" className="btn-close" aria-label="Cerrar" onClick={() => dismiss(t.id)}>×</button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}
