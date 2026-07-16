import { AlertTriangle } from "lucide-react";

export function KpiCard({ label, value, sub, icon: Icon, accent = "blue", alert = false }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: "blue"|"green"|"red"|"amber"; alert?: boolean;
}) {
  const styles = {
    blue:  { border:"border-l-[#2E75B6]", bg:"bg-[#EAF2FB]", icon:"text-[#2E75B6]" },
    green: { border:"border-l-[#2E7D32]", bg:"bg-green-50",  icon:"text-[#2E7D32]" },
    red:   { border:"border-l-[#C62828]", bg:"bg-red-50",    icon:"text-[#C62828]" },
    amber: { border:"border-l-amber-500", bg:"bg-amber-50",  icon:"text-amber-600" },
  }[accent];
  return (
    <div className={`bg-white rounded-xl border-l-4 ${styles.border} shadow-sm p-5 flex items-start gap-4`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${styles.bg}`}>
        <Icon size={20} className={styles.icon} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
        <p className={`text-2xl font-bold ${alert ? "text-[#C62828]" : "text-[#1A1A1A]"}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {alert && <AlertTriangle size={15} className="text-[#C62828] flex-shrink-0 mt-1" />}
    </div>
  );
}
