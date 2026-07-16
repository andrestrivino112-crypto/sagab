import { CheckCircle, Clock, AlertTriangle, Info, type LucideIcon } from "lucide-react";
import type { BadgeVariant } from "./components/Badge";
import type { ObligacionResponse } from "../api/sagab";
import type { PaymentStatus } from "./types";

export const PAYMENT_CFG: Record<PaymentStatus, { label: string; badge: BadgeVariant; icon: LucideIcon; row: string }> = {
  paid:      { label:"Pagado",    badge:"success", icon: CheckCircle,   row:"" },
  pending:   { label:"Pendiente", badge:"warning", icon: Clock,         row:"" },
  overdue:   { label:"Vencido",   badge:"error",   icon: AlertTriangle, row:"bg-red-50/40" },
  cancelled: { label:"Anulado",   badge:"info",    icon: Info,          row:"" },
};

export const ESTADO_TO_STATUS: Record<ObligacionResponse["estado"], PaymentStatus> = {
  PAGADO: "paid", PENDIENTE: "pending", VENCIDO: "overdue", ANULADO: "cancelled",
};
