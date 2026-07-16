export type BadgeVariant = "success" | "warning" | "error" | "info";

export function Badge({ v, children }: { v: BadgeVariant; children: React.ReactNode }) {
  const cls = {
    success: "bg-green-100 text-green-800 border-green-200",
    warning: "bg-amber-100 text-amber-800 border-amber-200",
    error:   "bg-red-100 text-[#C62828] border-red-200",
    info:    "bg-blue-100 text-blue-800 border-blue-200",
  }[v];
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${cls}`}>{children}</span>;
}
