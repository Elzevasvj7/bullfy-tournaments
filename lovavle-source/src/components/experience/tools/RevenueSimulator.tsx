import { useState } from "react";
import ToolNavButtons from "@/components/experience/ToolNavButtons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useExperienceStore } from "@/stores/experienceStore";
import { useExperienceSession } from "@/hooks/useExperienceSession";
import { supabase } from "@/integrations/supabase/client";

const MODELS = [
  { value: "cpa", label: "CPA" },
  { value: "rebates", label: "Rebates" },
  { value: "hibrido", label: "Híbrido" },
  { value: "propfirm", label: "PropFirm" },
  { value: "mixto", label: "Mixto" },
];

// Simplified CPA tiers
const CPA_TIERS = [
  { min: 0, max: 250, cpa: 50 },
  { min: 251, max: 500, cpa: 100 },
  { min: 501, max: 1000, cpa: 200 },
  { min: 1001, max: 5000, cpa: 350 },
  { min: 5001, max: Infinity, cpa: 500 },
];

const getCPA = (deposit: number) => CPA_TIERS.find((t) => deposit >= t.min && deposit <= t.max)?.cpa || 50;

const RevenueSimulator = () => {
  const { sessionId } = useExperienceSession();
  const { addToolUsed, incrementSimulations, addBadge, triggerBenefitMilestone } = useExperienceStore();

  const [clients, setClients] = useState(20);
  const [avgDeposit, setAvgDeposit] = useState(500);
  const [avgLots, setAvgLots] = useState(5);
  const [model, setModel] = useState("rebates");
  const [dollarsPerLot, setDollarsPerLot] = useState(7);
  const [results, setResults] = useState<any>(null);

  const calculate = async () => {
    let monthly = 0;
    const cpaPerClient = getCPA(avgDeposit);

    if (model === "cpa") {
      monthly = clients * cpaPerClient;
    } else if (model === "rebates") {
      monthly = clients * avgLots * dollarsPerLot;
    } else if (model === "hibrido") {
      monthly = clients * cpaPerClient * 0.5 + clients * avgLots * dollarsPerLot * 0.5;
    } else if (model === "propfirm") {
      monthly = clients * avgDeposit * 0.15; // 15% commission estimate
    } else {
      // Mixto
      monthly = clients * cpaPerClient * 0.3 + clients * avgLots * dollarsPerLot * 0.7;
    }

    const res = {
      monthly: Math.round(monthly),
      quarterly: Math.round(monthly * 3),
      annual: Math.round(monthly * 12),
      perClient: Math.round(monthly / (clients || 1)),
      cpaPerClient,
    };

    setResults(res);
    addToolUsed("revenue");
    incrementSimulations();
    addBadge("Primera simulación");
    triggerBenefitMilestone(Math.max(res.monthly, res.quarterly, res.annual));

    // Save to DB
    try {
      await supabase.from("experience_simulations").insert({
        session_id: sessionId,
        tool_name: "revenue",
        inputs: { clients, avgDeposit, avgLots, model, dollarsPerLot },
        results: res,
      });
    } catch (e) {
      console.error("Error saving simulation:", e);
    }
  };

  const chartData = results
    ? [
        { period: "Mes 1", ingreso: results.monthly },
        { period: "Mes 3", ingreso: results.quarterly },
        { period: "Mes 6", ingreso: results.quarterly * 2 },
        { period: "Año 1", ingreso: results.annual },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-primary" />
          IB Revenue Simulator
        </h1>
        <p className="text-muted-foreground">Simula tus ingresos según tu modelo de negocio IB</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Inputs */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader><CardTitle className="text-lg">Parámetros</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Número de clientes</Label>
              <Input type="number" value={clients} onChange={(e) => setClients(+e.target.value)} min={1} />
            </div>
            <div className="space-y-2">
              <Label>Depósito promedio (USD)</Label>
              <Input type="number" value={avgDeposit} onChange={(e) => setAvgDeposit(+e.target.value)} min={100} />
            </div>
            <div className="space-y-2">
              <Label>Lotes promedio / mes por cliente</Label>
              <Input type="number" value={avgLots} onChange={(e) => setAvgLots(+e.target.value)} min={0.1} step={0.1} />
            </div>
            <div className="space-y-2">
              <Label>Modelo de acuerdo</Label>
              <div className="flex flex-wrap gap-2">
                {MODELS.map((m) => (
                  <Badge
                    key={m.value}
                    variant={model === m.value ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setModel(m.value)}
                  >
                    {m.label}
                  </Badge>
                ))}
              </div>
            </div>
            {(model === "rebates" || model === "hibrido" || model === "mixto") && (
              <div className="space-y-2">
                <Label>Dólares por lote</Label>
                <Input type="number" value={dollarsPerLot} onChange={(e) => setDollarsPerLot(+e.target.value)} min={1} step={0.5} />
              </div>
            )}
            <Button onClick={calculate} className="w-full bg-gradient-brand shadow-brand">
              <TrendingUp className="w-4 h-4 mr-2" />
              Calcular Ingresos
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-4">
          {results ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold text-primary">${results.monthly.toLocaleString()}</p>
                    <p className="text-xs font-mono uppercase text-muted-foreground">Mensual</p>
                  </CardContent>
                </Card>
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold text-primary">${results.quarterly.toLocaleString()}</p>
                    <p className="text-xs font-mono uppercase text-muted-foreground">Trimestral</p>
                  </CardContent>
                </Card>
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold text-primary">${results.annual.toLocaleString()}</p>
                    <p className="text-xs font-mono uppercase text-muted-foreground">Anual</p>
                  </CardContent>
                </Card>
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold text-primary">${results.perClient.toLocaleString()}</p>
                    <p className="text-xs font-mono uppercase text-muted-foreground">Por Cliente</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-card/50 border-border/50">
                <CardContent className="pt-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="period" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                        formatter={(v: number) => [`$${v.toLocaleString()}`, "Ingreso"]}
                      />
                      <Bar dataKey="ingreso" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="bg-card/50 border-border/50 h-full flex items-center justify-center min-h-[300px]">
              <CardContent className="text-center text-muted-foreground">
                <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Configura los parámetros y calcula tus ingresos estimados</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <ToolNavButtons />
    </div>
  );
};

export default RevenueSimulator;
