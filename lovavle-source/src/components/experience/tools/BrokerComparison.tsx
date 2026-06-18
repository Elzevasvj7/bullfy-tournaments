import ToolNavButtons from "@/components/experience/ToolNavButtons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Check, X } from "lucide-react";
import { useExperienceStore } from "@/stores/experienceStore";
import { useEffect } from "react";

const features = [
  { feature: "CPA hasta $500", bullfy: true, others: "Variable" },
  { feature: "Rebates personalizables", bullfy: true, others: "Limitado" },
  { feature: "Modelo Híbrido", bullfy: true, others: "Raro" },
  { feature: "PropFirm comisiones", bullfy: true, others: "No" },
  { feature: "Sub IBs multinivel", bullfy: true, others: "Limitado" },
  { feature: "Spreads desde 0.0", bullfy: true, others: "Variable" },
  { feature: "Reportes automatizados", bullfy: true, others: "Manual" },
  { feature: "Dashboard en tiempo real", bullfy: true, others: "Parcial" },
  { feature: "Soporte dedicado BD", bullfy: true, others: "General" },
  { feature: "Cuentas de marketing", bullfy: true, others: "Raro" },
];

const BrokerComparison = () => {
  const { addToolUsed } = useExperienceStore();

  useEffect(() => { addToolUsed("comparison"); }, []);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6 text-primary" />Broker Comparison</h1>
        <p className="text-muted-foreground">Compara las ventajas de Bullfy frente a otros brokers</p>
      </div>
      <Card className="bg-card/50 border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-3 text-center border-b border-border bg-secondary/30">
            <div className="p-4 text-sm font-medium text-muted-foreground">Característica</div>
            <div className="p-4 text-sm font-bold text-primary">Bullfy</div>
            <div className="p-4 text-sm font-medium text-muted-foreground">Otros Brokers</div>
          </div>
          {features.map((f, i) => (
            <div key={f.feature} className={`grid grid-cols-3 text-center border-b border-border/50 ${i % 2 === 0 ? "" : "bg-secondary/10"}`}>
              <div className="p-3 text-sm text-left text-foreground">{f.feature}</div>
              <div className="p-3 flex justify-center"><Check className="w-5 h-5 text-primary" /></div>
              <div className="p-3 text-sm text-muted-foreground">{f.others}</div>
            </div>
          ))}
        </CardContent>
      </Card>
      <ToolNavButtons />
    </div>
  );
};

export default BrokerComparison;
