import { useState } from "react";
import ToolNavButtons from "@/components/experience/ToolNavButtons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useExperienceStore } from "@/stores/experienceStore";
import { useExperienceSession } from "@/hooks/useExperienceSession";
import { supabase } from "@/integrations/supabase/client";

const COLORS = ["hsl(var(--primary))", "#83CBFF", "#A0B1BD"];

const CommunityCalculator = () => {
  const { sessionId } = useExperienceSession();
  const { addToolUsed, incrementSimulations, addBadge, triggerBenefitMilestone } = useExperienceStore();

  const [communitySize, setCommunitySize] = useState(500);
  const [conversionRate, setConversionRate] = useState(5);
  const [avgDeposit, setAvgDeposit] = useState(500);
  const [avgLots, setAvgLots] = useState(3);
  const [dollarsPerLot, setDollarsPerLot] = useState(7);
  const [results, setResults] = useState<any>(null);

  const calculate = async () => {
    const traders = Math.round(communitySize * (conversionRate / 100));
    const deposits = traders * avgDeposit;
    const monthlyVolume = traders * avgLots;
    const monthlyIncome = monthlyVolume * dollarsPerLot;

    const res = {
      traders,
      deposits,
      monthlyVolume,
      monthlyIncome: Math.round(monthlyIncome),
      annualIncome: Math.round(monthlyIncome * 12),
      nonConverted: communitySize - traders,
    };

    setResults(res);
    addToolUsed("community");
    incrementSimulations();
    addBadge("Perfil analizado");
    triggerBenefitMilestone(Math.max(res.monthlyIncome, res.annualIncome));

    try {
      await supabase.from("experience_simulations").insert({
        session_id: sessionId,
        tool_name: "community",
        inputs: { communitySize, conversionRate, avgDeposit, avgLots, dollarsPerLot },
        results: res,
      });
    } catch (e) {
      console.error("Error saving simulation:", e);
    }
  };

  const pieData = results
    ? [
        { name: "Traders activos", value: results.traders },
        { name: "Potencial", value: results.nonConverted },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          Community Value Calculator
        </h1>
        <p className="text-muted-foreground">Calcula el valor potencial de tu comunidad como fuente de traders</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-card/50 border-border/50">
          <CardHeader><CardTitle className="text-lg">Tu Comunidad</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tamaño de comunidad</Label>
              <Input type="number" value={communitySize} onChange={(e) => setCommunitySize(+e.target.value)} min={1} />
            </div>
            <div className="space-y-2">
              <Label>Tasa de conversión (%)</Label>
              <Input type="number" value={conversionRate} onChange={(e) => setConversionRate(+e.target.value)} min={0.1} max={100} step={0.1} />
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
            <Button onClick={calculate} className="w-full bg-gradient-brand shadow-brand">
              <TrendingUp className="w-4 h-4 mr-2" />
              Calcular Valor
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {results ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold text-primary">{results.traders}</p>
                    <p className="text-[10px] font-mono uppercase text-muted-foreground">Traders potenciales</p>
                  </CardContent>
                </Card>
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold text-primary">${results.deposits.toLocaleString()}</p>
                    <p className="text-[10px] font-mono uppercase text-muted-foreground">Depósitos potenciales</p>
                  </CardContent>
                </Card>
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold text-primary">${results.monthlyIncome.toLocaleString()}</p>
                    <p className="text-[10px] font-mono uppercase text-muted-foreground">Ingreso mensual</p>
                  </CardContent>
                </Card>
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold text-primary">${results.annualIncome.toLocaleString()}</p>
                    <p className="text-[10px] font-mono uppercase text-muted-foreground">Ingreso anual</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-card/50 border-border/50">
                <CardContent className="pt-6">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="bg-card/50 border-border/50 h-full flex items-center justify-center min-h-[300px]">
              <CardContent className="text-center text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Ingresa los datos de tu comunidad para calcular su valor</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <ToolNavButtons />
    </div>
  );
};

export default CommunityCalculator;
