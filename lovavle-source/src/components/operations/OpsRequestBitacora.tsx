import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock, User, FileText, Calendar, Timer } from "lucide-react";

interface OpsRequest {
  id: string;
  ib_id: string;
  description: string;
  status: string;
  created_by: string;
  assigned_to: string | null;
  taken_by: string | null;
  created_at: string;
  taken_at: string | null;
  completed_at: string | null;
  notes: string | null;
  ibs: { nombre_ib: string; nombre_bd: string; modelo_negocio: string } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: OpsRequest;
  profilesMap: Map<string, string>;
  opsUsersMap: Map<string, string>;
}

const formatDuration = (from: string, to: string): string => {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h ${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const OpsRequestBitacora = ({ open, onOpenChange, request: r, profilesMap, opsUsersMap }: Props) => {
  const getName = (id: string | null) => {
    if (!id) return "—";
    return opsUsersMap.get(id) || profilesMap.get(id) || "—";
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { nuevo: "Nuevo", en_proceso: "En Proceso", configurado: "Configurado", active: "Activo" };
    return map[s] || s;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> Bitácora de Solicitud
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* ID & Status */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-mono">{r.id.slice(0, 8)}...</span>
            <Badge variant="outline">{statusLabel(r.status)}</Badge>
          </div>

          {/* IB Info */}
          <div className="p-3 rounded-lg border border-border bg-secondary/10 space-y-1">
            <p className="text-sm font-medium text-foreground">IB: {r.ibs?.nombre_ib ?? "—"}</p>
            <p className="text-xs text-muted-foreground">BD: {r.ibs?.nombre_bd ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Modelo: {r.ibs?.modelo_negocio ?? "—"}</p>
          </div>

          {/* People */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-border space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><User className="w-3 h-3" /> Solicitante</div>
              <p className="text-sm font-medium text-foreground">{getName(r.created_by)}</p>
            </div>
            <div className="p-3 rounded-lg border border-border space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><User className="w-3 h-3" /> Ejecutor</div>
              <p className="text-sm font-medium text-foreground">{getName(r.taken_by)}</p>
            </div>
          </div>

          {/* Dates */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Creación:</span>
              <span className="text-foreground">{formatDate(r.created_at)}</span>
            </div>
            {r.taken_at && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Tomada:</span>
                <span className="text-foreground">{formatDate(r.taken_at)}</span>
              </div>
            )}
            {r.completed_at && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Completada:</span>
                <span className="text-foreground">{formatDate(r.completed_at)}</span>
              </div>
            )}
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-border space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Timer className="w-3 h-3" /> T. Respuesta</div>
              <p className="text-sm font-medium text-foreground">
                {r.taken_at ? formatDuration(r.created_at, r.taken_at) : (
                  <span className="flex items-center gap-1 text-accent"><Clock className="w-3 h-3" /> En espera</span>
                )}
              </p>
            </div>
            <div className="p-3 rounded-lg border border-border space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Timer className="w-3 h-3" /> T. Ejecución</div>
              <p className="text-sm font-medium text-foreground">
                {r.taken_at && r.completed_at ? formatDuration(r.taken_at, r.completed_at) : (
                  r.taken_at ? <span className="flex items-center gap-1 text-accent"><Clock className="w-3 h-3" /> En proceso</span> : "—"
                )}
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Descripción del requerimiento</p>
            <p className="text-sm text-foreground p-3 rounded-lg border border-border bg-secondary/10 whitespace-pre-wrap">{r.description}</p>
          </div>

          {/* Notes */}
          {r.notes && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Notas operativas</p>
              <p className="text-sm text-foreground p-3 rounded-lg border border-border bg-secondary/10 whitespace-pre-wrap">{r.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OpsRequestBitacora;
