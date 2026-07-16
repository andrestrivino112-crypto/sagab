import { Bell } from "lucide-react";

export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold text-[#1A1A1A] leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <button className="relative w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
        <Bell size={18} />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#C62828] rounded-full ring-2 ring-white" />
      </button>
    </div>
  );
}
