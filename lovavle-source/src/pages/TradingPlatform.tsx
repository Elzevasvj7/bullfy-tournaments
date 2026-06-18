import DashboardLayout from "@/components/DashboardLayout";
import TradingLayout from "@/components/trading/TradingLayout";
import { Activity, FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function TradingPlatform() {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-primary" />
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">Bullfy Trading</h2>
              <p className="text-sm text-muted-foreground">
                Plataforma propietaria de trading + gráficos · conectada al MT5 Bridge
              </p>
            </div>
          </div>
          <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-500">
            <FlaskConical className="h-3 w-3" />
            Experimental
          </Badge>
        </div>

        <TradingLayout />
      </div>
    </DashboardLayout>
  );
}
