import { AlertCircle } from "lucide-react";

export function FormField({ label, error, hint, required = true, children }: {
  label: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="form-label">{label}{required && <span className="text-danger"> *</span>}</label>
      {children}
      {error
        ? <div className="invalid-feedback d-block"><AlertCircle size={12} className="me-1" style={{ verticalAlign: "-1px" }} />{error}</div>
        : hint ? <div className="form-text">{hint}</div> : null}
    </div>
  );
}
