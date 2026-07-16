export type BtnVariant = "primary" | "secondary" | "danger" | "ghost";
export type BtnSize = "sm" | "md" | "lg";

export function Btn({ children, onClick, disabled = false, variant = "primary", size = "md", className = "" }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  variant?: BtnVariant; size?: BtnSize; className?: string;
}) {
  const base = "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer";
  const sizes: Record<BtnSize, string> = { sm:"px-3 py-1.5 text-xs", md:"px-4 py-2 text-sm", lg:"px-6 py-2.5 text-base" };
  const variants: Record<BtnVariant, string> = {
    primary:   disabled ? "bg-[#A8C4DE] text-white cursor-not-allowed" : "bg-[#1F4E79] text-white hover:bg-[#163A5A] active:bg-[#0F2840] focus:ring-[#2E75B6]",
    secondary: "bg-[#EAF2FB] text-[#1F4E79] hover:bg-[#D0E4F5] border border-[#2E75B6]/25 focus:ring-[#2E75B6]",
    danger:    "bg-[#C62828] text-white hover:bg-[#A31F1F] focus:ring-red-400",
    ghost:     "bg-transparent text-[#1F4E79] hover:bg-[#EAF2FB] focus:ring-[#2E75B6]",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}
