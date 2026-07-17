import { AlertCircle } from "lucide-react";
import { cloneElement, isValidElement, useId, type ReactElement } from "react";

export function FormField({ label, error, hint, required = true, children }: {
  label: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  const fieldId = `field-${useId()}`;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  // El control real siempre es el primer hijo (p. ej. un <datalist> puede ir después, como en Paralelo).
  const items = Array.isArray(children) ? children : [children];
  const [control, ...rest] = items;
  const controlWithId = isValidElement(control)
    ? cloneElement(control as ReactElement<Record<string, unknown>>, {
        id: fieldId,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        "aria-required": required || undefined,
      })
    : control;

  return (
    <div>
      <label htmlFor={fieldId} className="form-label">{label}{required && <span className="text-danger" aria-hidden="true"> *</span>}</label>
      {controlWithId}
      {rest}
      {error
        ? <div id={errorId} role="alert" className="invalid-feedback d-block"><AlertCircle size={12} className="me-1" style={{ verticalAlign: "-1px" }} aria-hidden="true" />{error}</div>
        : hint ? <div id={hintId} className="form-text">{hint}</div> : null}
    </div>
  );
}
