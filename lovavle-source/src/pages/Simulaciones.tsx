import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layers, ArrowLeft } from "lucide-react";
import ArtificialLeverageSimulator from "@/components/simulaciones/ArtificialLeverageSimulator";

const SIMULATIONS = [
  {
    id: "artificial-leverage",
    name: "Apalancamiento Artificial",
    description: "Simulador de cuentas con balance amplificado por multiplicador configurable, ejecución A-Book y exposición real del broker.",
    icon: Layers,
    color: "#146EF5",
  },
];

const Simulaciones = () => {
  const [active, setActive] = useState<string | null>(null);

  if (active === "artificial-leverage") {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setActive(null)} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Volver a simulaciones
          </Button>
          <ArtificialLeverageSimulator />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Simulaciones</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Modelos cuantitativos para visualizar riesgo, exposición y ejecución de productos Bullfy.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SIMULATIONS.map((s) => {
            const Icon = s.icon;
            return (
              <Card
                key={s.id}
                className="p-6 cursor-pointer hover:border-primary/40 transition-all hover:shadow-lg group"
                onClick={() => setActive(s.id)}
              >
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${s.color}20` }}
                >
                  <Icon className="w-6 h-6" style={{ color: s.color }} />
                </div>
                <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                  {s.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-2">{s.description}</p>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Simulaciones;
