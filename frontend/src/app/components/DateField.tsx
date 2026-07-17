import { useEffect, useId, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

type DateFieldProps = {
  value: string; onChange: (v: string) => void; className: string; maxDate?: Date;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className" | "type" | "readOnly">;

/** Selector de fecha con calendario (react-day-picker) sobre un input de solo lectura. */
export function DateField({ value, onChange, className, maxDate, id, ...rest }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popupId = `datefield-popup-${useId()}`;

  useEffect(() => {
    const onClickFuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, []);

  const seleccionada = value ? new Date(`${value}T00:00:00`) : undefined;
  const formateada = seleccionada ? seleccionada.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";

  return (
    <div className="position-relative" ref={ref}>
      <input {...rest} id={id} readOnly value={formateada}
        role="combobox" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? popupId : undefined}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(o => !o); }
          else if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Seleccione una fecha" className={className + " bg-white"} style={{ cursor: "pointer" }} />
      {open && (
        <div id={popupId} role="dialog" aria-label="Calendario"
          className="position-absolute bg-white border rounded shadow-sm p-2" style={{ zIndex: 30, top: "100%" }}>
          <DayPicker mode="single" selected={seleccionada} captionLayout="dropdown-buttons"
            defaultMonth={seleccionada ?? maxDate} fromYear={1990} toYear={(maxDate ?? new Date()).getFullYear()}
            disabled={maxDate ? { after: maxDate } : undefined}
            onSelect={d => { if (d) { onChange(d.toISOString().slice(0, 10)); setOpen(false); } }} />
        </div>
      )}
    </div>
  );
}
