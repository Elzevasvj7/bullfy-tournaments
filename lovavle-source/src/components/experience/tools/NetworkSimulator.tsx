import { useState } from "react";
import ToolNavButtons from "@/components/experience/ToolNavButtons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GitBranch, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useExperienceStore } from "@/stores/experienceStore";
import { useExperienceSession } from "@/hooks/useExperienceSession";
import { supabase } from "@/integrations/supabase/client";

const NetworkSimulator = () => {
  const { sessionId } = useExperienceSession();
  const { addToolUsed, incrementSimulations, triggerBenefitMilestone } = useExperienceStore();
  const [directClients, setDirectClients] = useState(30);
  const [subIBs, setSubIBs] = useState(5);
  const [clientsPerSubIB, setClientsPerSubIB] = useState(15);
  const [avgLots, setAvgLots] = useState(5);
  const [dollarsPerLot, setDollarsPerLot] = useState(7);
  const [subIBShare, setSubIBShare] = useState(30);
  const [results, setResults] = useState<any>(null);

  const calculate = async () => {
    const directIncome = directClients * avgLots * dollarsPerLot;
    const subIBClientsTotal = subIBs * clientsPerSubIB;
    const subIBGrossIncome = subIBClientsTotal * avgLots * dollarsPerLot;
    const networkIncome = subIBGrossIncome * ((100 - subIBShare) / 100);
    const totalIncome = directIncome + networkIncome;

    const res = { directIncome: Math.round(directIncome), networkIncome: Math.round(networkIncome), totalIncome: Math.round(totalIncome), totalClients: directClients + subIBClientsTotal, subIBClientsTotal };
    setResults(res);
    addToolUsed("network");
    incrementSimulations();
    triggerBenefitMilestone(res.totalIncome);
    try { await supabase.from("experience_simulations").insert({ session_id: sessionId, tool_name: "network", inputs: { directClients, subIBs, clientsPerSubIB, avgLots, dollarsPerLot, subIBShare }, results: res }); } catch {}
  };

  const chartData = results ? [
    { source: "Directo", ingreso: results.directIncome },
    { source: "Red", ingreso: results.networkIncome },
    { source: "Total", ingreso: results.totalIncome },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2"><GitBranch className="w-6 h-6 text-primary" />IB Network Simulator</h1>
        <p className="text-muted-foreground">Simula los ingresos de tu red de Sub IBs</p>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-card/50 border-border/50">
          <CardHeader><CardTitle className="text-lg">Tu Red</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Clientes directos</Label><Input type="number" value={directClients} onChange={e => setDirectClients(+e.target.value)} min={0} /></div>
            <div className="space-y-2"><Label>Número de Sub IBs</Label><Input type="number" value={subIBs} onChange={e => setSubIBs(+e.target.value)} min={0} /></div>
            <div className="space-y-2"><Label>Clientes por Sub IB</Label><Input type="number" value={clientsPerSubIB} onChange={e => setClientsPerSubIB(+e.target.value)} min={0} /></div>
            <div className="space-y-2"><Label>Lotes prom. / cliente / mes</Label><Input type="number" value={avgLots} onChange={e => setAvgLots(+e.target.value)} min={0.1} step={0.1} /></div>
            <div className="space-y-2"><Label>USD por lote</Label><Input type="number" value={dollarsPerLot} onChange={e => setDollarsPerLot(+e.target.value)} min={1} /></div>
            <div className="space-y-2"><Label>Comisión Sub IB (%)</Label><Input type="number" value={subIBShare} onChange={e => setSubIBShare(+e.target.value)} min={0} max={100} /></div>
            <Button onClick={calculate} className="w-full bg-gradient-brand shadow-brand"><TrendingUp className="w-4 h-4 mr-2" />Simular Red</Button>
          </CardContent>
        </Card>
        <div className="space-y-4">
          {results ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Card className="bg-primary/5 border-primary/20"><CardContent className="pt-4 text-center"><p className="text-xl font-bold text-primary">${results.directIncome.toLocaleString()}</p><p className="text-[10px] font-mono uppercase text-muted-foreground">Directo</p></CardContent></Card>
                <Card className="bg-primary/5 border-primary/20"><CardContent className="pt-4 text-center"><p className="text-xl font-bold text-primary">${results.networkIncome.toLocaleString()}</p><p className="text-[10px] font-mono uppercase text-muted-foreground">Red</p></CardContent></Card>
                <Card className="bg-primary/5 border-primary/20"><CardContent className="pt-4 text-center"><p className="text-xl font-bold text-primary">${results.totalIncome.toLocaleString()}</p><p className="text-[10px] font-mono uppercase text-muted-foreground">Total / mes</p></CardContent></Card>
              </div>
              <Card className="bg-card/50 border-border/50"><CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="source" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} /><YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} /><Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: number) => [`$${v.toLocaleString()}`, "Ingreso"]} /><Bar dataKey="ingreso" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart>
                </ResponsiveContainer>
              </CardContent></Card>
            </>
          ) : (
            <Card className="bg-card/50 border-border/50 h-full flex items-center justify-center min-h-[250px]"><CardContent className="text-center text-muted-foreground"><GitBranch className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Configura tu red de Sub IBs</p></CardContent></Card>
          )}
        </div>
      </div>
      <ToolNavButtons />
    </div>
  );
};

export default NetworkSimulator;
