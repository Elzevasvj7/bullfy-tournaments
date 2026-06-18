import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users } from "lucide-react";

interface Props {
  portal: { id: string; display_name: string | null; nombre_portal: string };
  metrics: {
    nuevos: number;
    pendientes: number;
    seguimiento: number;
    cerrados: number;
    conversion: number;
  };
  assigned: boolean;
  onOpen: () => void;
}

const CommunityCard = ({ portal, metrics, assigned, onOpen }: Props) => {
  const name = portal.display_name || portal.nombre_portal;
  return (
    <Card className="bg-card/60 border-border hover:border-primary/60 transition-all">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 grid place-items-center flex-shrink-0">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground truncate">{name}</p>
              <Badge variant={assigned ? "default" : "secondary"} className="mt-1 text-[10px]">
                {assigned ? "Asignada" : "No asignada"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          <Row label="Leads Nuevos" value={metrics.nuevos} />
          <Row label="Pendientes" value={metrics.pendientes} />
          <Row label="Seguimiento" value={metrics.seguimiento} />
          <Row label="Cerrados" value={metrics.cerrados} />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/60">
          <span className="text-xs text-muted-foreground">Conversión</span>
          <span className="text-sm font-bold text-primary">{metrics.conversion}%</span>
        </div>

        <Button
          size="sm"
          variant={assigned ? "default" : "outline"}
          className="w-full gap-1"
          onClick={onOpen}
          disabled={!assigned}
          title={assigned ? "Abrir workspace" : "No tienes esta comunidad asignada"}
        >
          {assigned ? "Ver comunidad" : "Sin acceso"} <ArrowRight className="w-3 h-3" />
        </Button>
      </CardContent>
    </Card>
  );
};

const Row = ({ label, value }: { label: string; value: number }) => (
  <>
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-semibold text-foreground">{value}</span>
  </>
);

export default CommunityCard;
