import type { LucideIcon } from "lucide-react";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export function EmptyState({ icon: Icon, title, description, action }: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 flex flex-col items-center justify-center text-center gap-2">
      <div className="w-12 h-12 rounded-full bg-[#EAF2FB] flex items-center justify-center mb-1">
        <Icon size={22} className="text-[#2E75B6]" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-[#1A1A1A]">{title}</p>
      {description && <p className="text-sm text-gray-600 max-w-sm">{description}</p>}
      {action && (
        <button onClick={action.onClick}
          className="mt-3 inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2E75B6] cursor-pointer
            px-4 py-2 text-sm bg-[#EAF2FB] text-[#1F4E79] hover:bg-[#D0E4F5] border border-[#2E75B6]/25">
          {action.label}
        </button>
      )}
    </div>
  );
}
