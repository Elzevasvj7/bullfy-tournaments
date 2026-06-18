import { useState } from "react";
import ToolNavButtons from "@/components/experience/ToolNavButtons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useExperienceStore } from "@/stores/experienceStore";
import { useExperienceSession } from "@/hooks/useExperienceSession";
import { supabase } from "@/integrations/supabase/client";

const EMPIRE_STAGES = [
  { min: 0, max: 30, label: "Seed Stage", color: "bg-muted" },
  { min: 31, max: 50, label: "Growth Structure", color: "bg-primary/30" },
  { min: 51, max: 70, label: "Expansion Network", color: "bg-primary/50" },
  { min: 71, max: 85, label: "Strategic Empire", color: "bg-primary/70" },
  { min: 86, max: 100, label: "Bullfy Elite Network", color: "bg-primary" },
];

const getStage = (score: number) => EMPIRE_STAGES.find(s => score >= s.min && score <= s.max) || EMPIRE_STAGES[0];

const EmpireBuilder = () => {
  const { sessionId } = useExperienceSession();
  const { addToolUsed, incrementSimulations, addBadge, triggerBenefitMilestone } = useExperienceStore();

  const [initialClients, setInitialClients] = useState(10);
  const [avgDeposit, setAvgDeposit] = useState(500);
  const [avgLots, setAvgLots] = useState(5);
  const [newPerMonth, setNewPerMonth] = useState(5);
  const [retention, setRetention] = useState(85);
  const [subIBs, setSubIBs] = useState(3);
  const [clientsPerSubIB, setClientsPerSubIB] = useState(10);
  const [horizon, setHorizon] = useState(12);
  const [dollarsPerLot, setDollarsPerLot] = useState(7);
  const [results, setResults] = useState<any>(null);

  const calculate = async () => {
    const ret = retention / 100;
    const data: any[] = [];
    let directClients = initialClients;

    for (let m = 1; m <= horizon; m++) {
      directClients = directClients * ret + newPerMonth;
      const subIBClients = subIBs * clientsPerSubIB * Math.min(m / 3, 1); // Sub IBs ramp up over 3 months
      const totalClients = Math.round(directClients + subIBClients);
      const volume = totalClients * avgLots;
      const directIncome = Math.round(directClients * avgLots * dollarsPerLot);
      const networkIncome = Math.round(subIBClients * avgLots * dollarsPerLot * 0.3); // 30% of sub IB revenue
      const totalIncome = directIncome + networkIncome;

      data.push({ mes: `M${m}`, clientes: totalClients, ingresoDirecto: directIncome, ingresoRed: networkIncome, ingresoTotal: totalIncome, volumen: Math.round(volume) });
    }

    const last = data[data.length - 1];
    const expansionScore = Math.min(100, Math.round(
      (last.clientes / 100) * 25 +
      (last.volumen / 500) * 25 +
      (subIBs / 10) * 25 +
      (last.ingresoTotal / 5000) * 25
    ));

    const res = { projections: data, last, expansionScore, stage: getStage(expansionScore) };
    setResults(res);
    addToolUsed("empire");
    incrementSimulations();
    addBadge("Funnel construido");
    triggerBenefitMilestone(Math.max(...data.map((item) => item.ingresoTotal)));

    try {
      await supabase.from("experience_simulations").insert({
        session_id: sessionId, tool_name: "empire",
        inputs: { initialClients, avgDeposit, avgLots, newPerMonth, retention, subIBs, clientsPerSubIB, horizon, dollarsPerLot },
        results: { expansionScore, stage: getStage(expansionScore).label, finalClients: last.clientes, finalIncome: last.ingresoTotal },
      });
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="w-6 h-6 text-primary" />IB Empire Builder</h1>
        <p className="text-muted-foreground">Simula la expansión de tu imperio IB con red de Sub IBs</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-2 bg-card/50 border-border/50">
          <CardHeader><CardTitle className="text-lg">Tu Imperio</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Clientes iniciales</Label><Input type="number" value={initialClients} onChange={e => setInitialClients(+e.target.value)} min={1} /></div>
            <div className="space-y-1"><Label className="text-xs">Depósito promedio</Label><Input type="number" value={avgDeposit} onChange={e => setAvgDeposit(+e.target.value)} min={100} /></div>
            <div className="space-y-1"><Label className="text-xs">Lotes prom. / mes</Label><Input type="number" value={avgLots} onChange={e => setAvgLots(+e.target.value)} min={0.1} step={0.1} /></div>
            <div className="space-y-1"><Label className="text-xs">Nuevos clientes / mes</Label><Input type="number" value={newPerMonth} onChange={e => setNewPerMonth(+e.target.value)} min={0} /></div>
            <div className="space-y-1"><Label className="text-xs">Retención (%)</Label><Input type="number" value={retention} onChange={e => setRetention(+e.target.value)} min={1} max={100} /></div>
            <div className="space-y-1"><Label className="text-xs">Sub IBs estimados</Label><Input type="number" value={subIBs} onChange={e => setSubIBs(+e.target.value)} min={0} /></div>
            <div className="space-y-1"><Label className="text-xs">Clientes por Sub IB</Label><Input type="number" value={clientsPerSubIB} onChange={e => setClientsPerSubIB(+e.target.value)} min={0} /></div>
            <div className="space-y-1"><Label className="text-xs">USD por lote</Label><Input type="number" value={dollarsPerLot} onChange={e => setDollarsPerLot(+e.target.value)} min={1} /></div>
            <div className="space-y-1">
              <Label className="text-xs">Horizonte</Label>
              <div className="flex gap-1">
                {[6, 12, 24].map(h => <Badge key={h} variant={horizon === h ? "default" : "outline"} className="cursor-pointer text-[10px]" onClick={() => setHorizon(h)}>{h}m</Badge>)}
              </div>
            </div>
            <Button onClick={calculate} className="w-full bg-gradient-brand shadow-brand mt-2"><TrendingUp className="w-4 h-4 mr-2" />Construir Imperio</Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          {results ? (
            <>
              {/* Expansion Score */}
              <Card className="bg-card/50 border-border/50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-mono uppercase text-muted-foreground">Expansion Score</span>
                    <Badge className={results.stage.color}>{results.stage.label}</Badge>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-4">
                    <div className="bg-gradient-brand h-4 rounded-full transition-all" style={{ width: `${results.expansionScore}%` }} />
                  </div>
                  <p className="text-center text-2xl font-bold text-primary mt-2">{results.expansionScore}/100</p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-3 gap-3">
                <Card className="bg-primary/5 border-primary/20"><CardContent className="pt-4 text-center"><p className="text-xl font-bold text-primary">{results.last.clientes}</p><p className="text-[10px] font-mono uppercase text-muted-foreground">Clientes</p></CardContent></Card>
                <Card className="bg-primary/5 border-primary/20"><CardContent className="pt-4 text-center"><p className="text-xl font-bold text-primary">${results.last.ingresoTotal.toLocaleString()}</p><p className="text-[10px] font-mono uppercase text-muted-foreground">Ingreso / mes</p></CardContent></Card>
                <Card className="bg-primary/5 border-primary/20"><CardContent className="pt-4 text-center"><p className="text-xl font-bold text-primary">${results.last.ingresoRed.toLocaleString()}</p><p className="text-[10px] font-mono uppercase text-muted-foreground">Ingreso Red</p></CardContent></Card>
              </div>

              <Card className="bg-card/50 border-border/50">
                <CardContent className="pt-6">
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={results.projections}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="mes" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Area type="monotone" dataKey="ingresoDirecto" name="Directo" stackId="1" fill="hsl(var(--primary))" stroke="hsl(var(--primary))" fillOpacity={0.6} />
                      <Area type="monotone" dataKey="ingresoRed" name="Red" stackId="1" fill="#83CBFF" stroke="#83CBFF" fillOpacity={0.4} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="bg-card/50 border-border/50 h-full flex items-center justify-center min-h-[300px]"><CardContent className="text-center text-muted-foreground"><Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Configura tu imperio y visualiza su expansión</p></CardContent></Card>
          )}
        </div>
      </div>
      <ToolNavButtons />
    </div>
  );
};

export default EmpireBuilder;
