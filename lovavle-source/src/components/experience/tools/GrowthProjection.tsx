import { useState } from "react";
import ToolNavButtons from "@/components/experience/ToolNavButtons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useExperienceStore } from "@/stores/experienceStore";
import { useExperienceSession } from "@/hooks/useExperienceSession";
import { supabase } from "@/integrations/supabase/client";

const HORIZONS = [
  { value: 3, label: "3 meses" },
  { value: 6, label: "6 meses" },
  { value: 12, label: "12 meses" },
  { value: 24, label: "24 meses" },
];

const GrowthProjection = () => {
  const { sessionId } = useExperienceSession();
  const { addToolUsed, incrementSimulations, addBadge, triggerBenefitMilestone } = useExperienceStore();

  const [newClientsPerMonth, setNewClientsPerMonth] = useState(5);
  const [retentionRate, setRetentionRate] = useState(85);
  const [avgDeposit, setAvgDeposit] = useState(500);
  const [avgLots, setAvgLots] = useState(5);
  const [dollarsPerLot, setDollarsPerLot] = useState(7);
  const [horizon, setHorizon] = useState(12);
  const [results, setResults] = useState<any[]>([]);

  const calculate = async () => {
    const retention = retentionRate / 100;
    const data: any[] = [];
    let totalClients = 0;

    for (let month = 1; month <= horizon; month++) {
      totalClients = totalClients * retention + newClientsPerMonth;
      const activeClients = Math.round(totalClients);
      const volume = activeClients * avgLots;
      const income = volume * dollarsPerLot;

      data.push({
        mes: `M${month}`,
        clientes: activeClients,
        volumen: Math.round(volume),
        ingreso: Math.round(income),
      });
    }

    setResults(data);
    addToolUsed("growth");
    incrementSimulations();
    addBadge("Potencial detectado");
    triggerBenefitMilestone(Math.max(...data.map((item) => item.ingreso)));

    try {
      await supabase.from("experience_simulations").insert({
        session_id: sessionId,
        tool_name: "growth",
        inputs: { newClientsPerMonth, retentionRate, avgDeposit, avgLots, dollarsPerLot, horizon },
        results: { projections: data },
      });
    } catch (e) {
      console.error("Error saving simulation:", e);
    }
  };

  const lastMonth = results.length ? results[results.length - 1] : null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-primary" />
          Growth Projection Engine
        </h1>
        <p className="text-muted-foreground">Proyecta el crecimiento de tu negocio IB a lo largo del tiempo</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-2 bg-card/50 border-border/50">
          <CardHeader><CardTitle className="text-lg">Parámetros</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Clientes nuevos / mes</Label>
              <Input type="number" value={newClientsPerMonth} onChange={(e) => setNewClientsPerMonth(+e.target.value)} min={1} />
            </div>
            <div className="space-y-2">
              <Label>Tasa de retención (%)</Label>
              <Input type="number" value={retentionRate} onChange={(e) => setRetentionRate(+e.target.value)} min={1} max={100} />
            </div>
            <div className="space-y-2">
              <Label>Depósito promedio (USD)</Label>
              <Input type="number" value={avgDeposit} onChange={(e) => setAvgDeposit(+e.target.value)} min={100} />
            </div>
            <div className="space-y-2">
              <Label>Lotes promedio / mes</Label>
              <Input type="number" value={avgLots} onChange={(e) => setAvgLots(+e.target.value)} min={0.1} step={0.1} />
            </div>
            <div className="space-y-2">
              <Label>USD por lote</Label>
              <Input type="number" value={dollarsPerLot} onChange={(e) => setDollarsPerLot(+e.target.value)} min={1} />
            </div>
            <div className="space-y-2">
              <Label>Horizonte</Label>
              <div className="flex flex-wrap gap-2">
                {HORIZONS.map((h) => (
                  <Badge key={h.value} variant={horizon === h.value ? "default" : "outline"} className="cursor-pointer" onClick={() => setHorizon(h.value)}>
                    {h.label}
                  </Badge>
                ))}
              </div>
            </div>
            <Button onClick={calculate} className="w-full bg-gradient-brand shadow-brand">
              <TrendingUp className="w-4 h-4 mr-2" />
              Proyectar Crecimiento
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          {lastMonth ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold text-primary">{lastMonth.clientes}</p>
                    <p className="text-[10px] font-mono uppercase text-muted-foreground">Clientes al final</p>
                  </CardContent>
                </Card>
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold text-primary">{lastMonth.volumen.toLocaleString()}</p>
                    <p className="text-[10px] font-mono uppercase text-muted-foreground">Lotes / mes</p>
                  </CardContent>
                </Card>
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold text-primary">${lastMonth.ingreso.toLocaleString()}</p>
                    <p className="text-[10px] font-mono uppercase text-muted-foreground">Ingreso / mes</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-card/50 border-border/50">
                <CardContent className="pt-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={results}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="mes" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Legend />
                      <Line type="monotone" dataKey="clientes" name="Clientes" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="ingreso" name="Ingreso ($)" stroke="#83CBFF" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="bg-card/50 border-border/50 h-full flex items-center justify-center min-h-[300px]">
              <CardContent className="text-center text-muted-foreground">
                <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Configura los parámetros y proyecta tu crecimiento</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <ToolNavButtons />
    </div>
  );
};

export default GrowthProjection;
