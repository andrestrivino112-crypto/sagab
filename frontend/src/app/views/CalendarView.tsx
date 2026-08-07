import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import type { RolSistema } from "../../api/auth";
import { Btn } from "../components/Btn";
import { EmptyState } from "../components/EmptyState";
import { TopBar } from "../components/TopBar";

type TipoEvento = "institucional" | "reunión" | "evaluación" | "feriado";

type CalendarioItem = {
  id: string;
  title: string;
  date: string;
  type: TipoEvento;
  notes?: string;
  createdBy: string;
  source: "local" | "holiday";
};

type HolidayItem = {
  name: string;
  localName?: string;
  date: string;
};

const STORAGE_KEY = "sagab:calendar-events-v1";

function formatDateKey(date: Date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateKey(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("es-EC", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(parseDateKey(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short" }).format(parseDateKey(value));
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("es-EC", { month: "long", year: "numeric" }).format(date);
}

function typeLabel(type: TipoEvento) {
  switch (type) {
    case "feriado": return "Feriado";
    case "reunión": return "Reunión";
    case "evaluación": return "Evaluación";
    default: return "Institucional";
  }
}

function typeClass(type: TipoEvento) {
  switch (type) {
    case "feriado": return "bg-[#FDE7E7] text-[#A61B1B]";
    case "reunión": return "bg-[#EAF2FB] text-[#1F4E79]";
    case "evaluación": return "bg-[#FFF3D6] text-[#8A5A00]";
    default: return "bg-[#E8F7ED] text-[#0F5C3A]";
  }
}

export function CalendarView({ rol }: { rol: RolSistema }) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date()));
  const [events, setEvents] = useState<CalendarioItem[]>([]);
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", date: selectedDate, notes: "", type: "institucional" as TipoEvento });

  const canManage = rol === "ADMIN" || rol === "DOCENTE";

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CalendarioItem[];
        setEvents(parsed);
      }
    } catch {
      // Si el almacenamiento no está disponible, se mantiene la vista en memoria.
    }
  }, []);

  useEffect(() => {
    const loadHolidays = async () => {
      setLoadingHolidays(true);
      try {
        const year = currentMonth.getFullYear();
        const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/EC`);
        if (!res.ok) throw new Error("No disponible");
        const data = (await res.json()) as Array<{ name?: string; localName?: string; date?: string }>;
        const monthItems = data
          .filter(item => item.date && item.date.startsWith(`${year}-${`${currentMonth.getMonth() + 1}`.padStart(2, "0")}`))
          .map(item => ({ name: item.name ?? "Feriado", localName: item.localName, date: item.date ?? "" }))
          .filter(item => item.date);
        setHolidays(monthItems);
      } catch {
        setHolidays([]);
      } finally {
        setLoadingHolidays(false);
      }
    };

    void loadHolidays();
  }, [currentMonth]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarioItem[]>();
    const allItems: CalendarioItem[] = [
      ...events.map(item => ({ ...item, source: item.source as "local" | "holiday" })),
      ...holidays.map(item => ({
        id: `holiday-${item.date}`,
        title: item.localName ?? item.name,
        date: item.date,
        type: "feriado" as const,
        notes: "Feriado oficial del calendario ecuatoriano",
        createdBy: "Sistema",
        source: "holiday" as const,
      })),
    ];

    allItems.forEach(item => {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    });

    return map;
  }, [events, holidays]);

  const selectedItems = useMemo(() => (itemsByDate.get(selectedDate) ?? []).sort((a, b) => a.title.localeCompare(b.title)), [itemsByDate, selectedDate]);

  const openNewEvent = () => {
    setEditingId(null);
    setDraft({ title: "", date: selectedDate, notes: "", type: "institucional" });
    setFormOpen(true);
  };

  const openEditEvent = (item: CalendarioItem) => {
    setEditingId(item.id);
    setDraft({ title: item.title, date: item.date, notes: item.notes ?? "", type: item.type });
    setFormOpen(true);
  };

  const saveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) return;

    const nextItem: CalendarioItem = {
      id: editingId ?? `local-${Date.now()}`,
      title: draft.title.trim(),
      date: draft.date,
      type: draft.type,
      notes: draft.notes.trim(),
      createdBy: "Institución",
      source: "local",
    };

    const nextEvents = editingId
      ? events.map(item => (item.id === editingId ? nextItem : item))
      : [...events, nextItem];

    setEvents(nextEvents);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEvents));
    setFormOpen(false);
    setEditingId(null);
  };

  const removeEvent = (id: string) => {
    const nextEvents = events.filter(item => item.id !== id);
    setEvents(nextEvents);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEvents));
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const firstWeekday = (monthStart.getDay() + 6) % 7;
  const daysInMonth = monthEnd.getDate();
  const cells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => {
    const dayIndex = index - firstWeekday + 1;
    if (dayIndex < 1 || dayIndex > daysInMonth) return null;
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayIndex);
    const key = formatDateKey(date);
    const dayItems = (itemsByDate.get(key) ?? []).slice(0, 3);
    return { date, key, dayItems };
  }).filter(Boolean) as Array<{ date: Date; key: string; dayItems: CalendarioItem[] }>;

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <TopBar title="Calendario institucional" subtitle="Agenda compartida para administración, docentes y DECE" />
      <div className="p-6 lg:p-8 space-y-6">
        <div className="grid gap-6 xl:grid-cols-[1.7fr,0.9fr]">
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#2E75B6]">Vista mensual</p>
                <h2 className="text-xl font-semibold text-[#1A1A1A]">{monthLabel(currentMonth)}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                  className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-100" aria-label="Mes anterior">
                  <ChevronLeft size={18} />
                </button>
                <button type="button" onClick={() => setCurrentMonth(new Date())}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
                  Hoy
                </button>
                <button type="button" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                  className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-100" aria-label="Mes siguiente">
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              {['lun','mar','mié','jue','vie','sáb','dom'].map(day => <div key={day}>{day}</div>)}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {cells.map(cell => {
                const isSelected = selectedDate === cell.key;
                const isToday = formatDateKey(new Date()) === cell.key;
                return (
                  <button key={cell.key} type="button" onClick={() => setSelectedDate(cell.key)}
                    className={`min-h-[112px] rounded-xl border p-2 text-left transition ${isSelected ? "border-[#2E75B6] bg-[#EAF2FB]" : "border-gray-200 bg-white hover:border-[#2E75B6]/40"}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold ${isToday ? "text-[#2E75B6]" : "text-gray-700"}`}>{cell.date.getDate()}</span>
                      {cell.dayItems.length > 0 && <span className="text-[10px] font-medium text-gray-500">{cell.dayItems.length}</span>}
                    </div>
                    <div className="mt-2 space-y-1">
                      {cell.dayItems.map(item => (
                        <div key={item.id} className={`truncate rounded px-2 py-1 text-[11px] font-medium ${typeClass(item.type)}`}>
                          {item.title}
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#2E75B6]">Detalle del día</p>
                  <h3 className="mt-1 text-lg font-semibold text-[#1A1A1A]">{formatLongDate(selectedDate)}</h3>
                </div>
                {canManage && (
                  <Btn type="button" variant="secondary" size="sm" onClick={openNewEvent}>
                    <Plus size={15} />Añadir
                  </Btn>
                )}
              </div>

              {selectedItems.length === 0 ? (
                <div className="mt-4">
                  <EmptyState icon={CalendarDays} title="Sin eventos para este día" description="Puede añadir una actividad institucional o una reunión." />
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {selectedItems.map(item => (
                    <div key={item.id} className="rounded-xl border border-gray-200 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[#1A1A1A]">{item.title}</p>
                          <p className="mt-1 text-xs text-gray-500">{typeLabel(item.type)} · {item.createdBy}</p>
                        </div>
                        {canManage && item.source === "local" && (
                          <div className="flex gap-2">
                            <button type="button" onClick={() => openEditEvent(item)} className="rounded-lg p-1.5 text-[#2E75B6] hover:bg-[#EAF2FB]" aria-label={`Editar ${item.title}`}>
                              <Pencil size={15} />
                            </button>
                            <button type="button" onClick={() => removeEvent(item.id)} className="rounded-lg p-1.5 text-[#C62828] hover:bg-[#FDE7E7]" aria-label={`Eliminar ${item.title}`}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </div>
                      {item.notes && <p className="mt-2 text-sm text-gray-600">{item.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-[#2E75B6]" />
                <h3 className="text-sm font-semibold text-[#1A1A1A]">Feriados automáticos</h3>
              </div>
              <p className="mt-2 text-sm text-gray-600">Se cargan desde la referencia pública de feriados de Ecuador para el mes visible.</p>
              {loadingHolidays ? (
                <p className="mt-3 text-sm text-gray-500">Cargando feriados…</p>
              ) : holidays.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">No se pudieron cargar feriados en este momento.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm text-gray-700">
                  {holidays.map(item => (
                    <li key={item.date} className="rounded-lg border border-gray-200 px-3 py-2">
                      <div className="font-medium">{item.localName ?? item.name}</div>
                      <div className="text-xs text-gray-500">{formatShortDate(item.date)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4 py-8">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#2E75B6]">{editingId ? "Editar evento" : "Nuevo evento"}</p>
                <h3 className="text-lg font-semibold text-[#1A1A1A]">{editingId ? "Actualice la actividad institucional" : "Agregue una actividad compartida"}</h3>
              </div>
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">✕</button>
            </div>

            <form className="mt-4 space-y-4" onSubmit={saveEvent}>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="title">Título</label>
                <input id="title" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#2E75B6]" required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="date">Fecha</label>
                  <input id="date" type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#2E75B6]" required />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="type">Tipo</label>
                  <select id="type" value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value as TipoEvento })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#2E75B6]">
                    <option value="institucional">Institucional</option>
                    <option value="reunión">Reunión</option>
                    <option value="evaluación">Evaluación</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="notes">Detalle</label>
                <textarea id="notes" rows={4} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#2E75B6]" />
              </div>
              <div className="flex justify-end gap-2">
                <Btn type="button" variant="secondary" onClick={() => setFormOpen(false)}>Cancelar</Btn>
                <Btn type="submit">Guardar</Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
