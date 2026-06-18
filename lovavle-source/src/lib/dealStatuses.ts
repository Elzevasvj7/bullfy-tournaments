import { FileEdit, Send, Clock, Settings, XCircle } from "lucide-react";

export const DEAL_STATUSES = [
  { value: "draft", label: "Borrador", icon: FileEdit, variant: "secondary" as const },
  { value: "submitted", label: "Enviado", icon: Send, variant: "outline" as const },
  { value: "en_proceso", label: "En Proceso", icon: Clock, variant: "outline" as const },
  { value: "configurado", label: "Configurado", icon: Settings, variant: "default" as const },
  { value: "rechazado", label: "Rechazado", icon: XCircle, variant: "destructive" as const },
] as const;

export const STATUS_MAP: Record<string, { label: string; icon: typeof Settings; variant: "default" | "secondary" | "outline" | "destructive" }> = Object.fromEntries(
  DEAL_STATUSES.map((s) => [s.value, { label: s.label, icon: s.icon, variant: s.variant }])
);

export const getStatusConfig = (status: string) =>
  STATUS_MAP[status] || { label: status, icon: Clock, variant: "outline" as const };
