import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, Briefcase, Target, Loader2 } from "lucide-react";
import type { FlowSelection } from "./BCEDashboard";

interface Flow {
  id: string;
  tipo_lead: string;
  objetivo: string;
  nombre: string;
  descripcion: string | null;
}

const LEAD_TYPES = [
  { value: "IB", label: "IB (Introducing Broker)", icon: Users, color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  { value: "trader", label: "Trader", icon: TrendingUp, color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  { value: "inversionista", label: "Inversionista", icon: Briefcase, color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
];

interface Props {
  onStart: (flow: FlowSelection) => void;
}

const ScenarioSelector = ({ onStart }: Props) => {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("bce_call_flows").select("*").then(({ data }) => {
      setFlows(data ?? []);
      setLoading(false);
    });
  }, []);

  const filteredFlows = selectedType ? flows.filter(f => f.tipo_lead === selectedType) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold text-foreground">Selecciona el escenario</h3>
        <p className="text-sm text-muted-foreground">Elige el tipo de lead y objetivo para iniciar el copiloto</p>
      </div>

      {/* Step 1: Lead Type */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Tipo de Lead</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {LEAD_TYPES.map(lt => (
            <Card
              key={lt.value}
              className={`cursor-pointer transition-all hover:scale-[1.02] ${
                selectedType === lt.value ? "ring-2 ring-primary border-primary" : "border-border"
              }`}
              onClick={() => setSelectedType(lt.value)}
            >
              <CardContent className="py-5 flex flex-col items-center gap-2 text-center">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${lt.color}`}>
                  <lt.icon className="w-6 h-6" />
                </div>
                <span className="font-semibold text-foreground">{lt.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Step 2: Objective/Flow */}
      {selectedType && (
        <div className="animate-fade-in">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Objetivo</p>
          {filteredFlows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay flujos configurados para este tipo de lead.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredFlows.map(flow => (
                <Card key={flow.id} className="border-border hover:border-primary/50 transition-all">
                  <CardContent className="py-5 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-foreground">{flow.nombre}</span>
                      </div>
                      {flow.descripcion && (
                        <p className="text-xs text-muted-foreground">{flow.descripcion}</p>
                      )}
                    </div>
                    <Button
                      onClick={() => onStart({
                        tipoLead: flow.tipo_lead,
                        objetivo: flow.objetivo,
                        flowId: flow.id,
                        flowName: flow.nombre,
                      })}
                      className="shrink-0"
                    >
                      Iniciar
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScenarioSelector;
