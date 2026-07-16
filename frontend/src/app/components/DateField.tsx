import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

/** Selector de fecha con calendario (react-day-picker) sobre un input de solo lectura. */
export function DateField({ value, onChange, className, maxDate }: {
  value: string; onChange: (v: string) => void; className: string; maxDate?: Date;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
      <input readOnly value={formateada} onClick={() => setOpen(o => !o)}
        placeholder="Seleccione una fecha" className={className + " bg-white"} style={{ cursor: "pointer" }} />
      {open && (
        <div className="position-absolute bg-white border rounded shadow-sm p-2" style={{ zIndex: 30, top: "100%" }}>
          <DayPicker mode="single" selected={seleccionada} captionLayout="dropdown-buttons"
            defaultMonth={seleccionada ?? maxDate} fromYear={1990} toYear={(maxDate ?? new Date()).getFullYear()}
            disabled={maxDate ? { after: maxDate } : undefined}
            onSelect={d => { if (d) { onChange(d.toISOString().slice(0, 10)); setOpen(false); } }} />
        </div>
      )}
    </div>
  );
}
