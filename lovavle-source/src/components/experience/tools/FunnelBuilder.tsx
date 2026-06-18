import { useState } from "react";
import ToolNavButtons from "@/components/experience/ToolNavButtons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, TrendingUp } from "lucide-react";
import { useExperienceStore } from "@/stores/experienceStore";
import { useExperienceSession } from "@/hooks/useExperienceSession";
import { supabase } from "@/integrations/supabase/client";

const FunnelBuilder = () => {
  const { sessionId } = useExperienceSession();
  const { addToolUsed, incrementSimulations, triggerBenefitMilestone } = useExperienceStore();
  const [leads, setLeads] = useState(1000);
  const [registerRate, setRegisterRate] = useState(15);
  const [depositRate, setDepositRate] = useState(30);
  const [avgDeposit, setAvgDeposit] = useState(500);
  const [dollarsPerLot, setDollarsPerLot] = useState(7);
  const [avgLots, setAvgLots] = useState(5);
  const [results, setResults] = useState<any>(null);

  const calculate = async () => {
    const registered = Math.round(leads * (registerRate / 100));
    const deposited = Math.round(registered * (depositRate / 100));
    const monthlyIncome = deposited * avgLots * dollarsPerLot;
    const res = { registered, deposited, monthlyIncome: Math.round(monthlyIncome), annualIncome: Math.round(monthlyIncome * 12), totalDeposits: deposited * avgDeposit };
    setResults(res);
    addToolUsed("funnel");
    incrementSimulations();
    triggerBenefitMilestone(Math.max(res.monthlyIncome, res.annualIncome));
    try { await supabase.from("experience_simulations").insert({ session_id: sessionId, tool_name: "funnel", inputs: { leads, registerRate, depositRate, avgDeposit, dollarsPerLot, avgLots }, results: res }); } catch {}
  };

  const funnelSteps = results ? [
    { label: "Leads", value: leads, pct: 100 },
    { label: "Registrados", value: results.registered, pct: (results.registered / leads) * 100 },
    { label: "Depositaron", value: results.deposited, pct: (results.deposited / leads) * 100 },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Target className="w-6 h-6 text-primary" />Funnel Builder</h1>
        <p className="text-muted-foreground">Construye y visualiza tu embudo de conversión IB</p>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-card/50 border-border/50">
          <CardHeader><CardTitle className="text-lg">Embudo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Leads totales</Label><Input type="number" value={leads} onChange={e => setLeads(+e.target.value)} min={1} /></div>
            <div className="space-y-2"><Label>Tasa de registro (%)</Label><Input type="number" value={registerRate} onChange={e => setRegisterRate(+e.target.value)} min={0.1} max={100} step={0.1} /></div>
            <div className="space-y-2"><Label>Tasa de depósito (%)</Label><Input type="number" value={depositRate} onChange={e => setDepositRate(+e.target.value)} min={0.1} max={100} step={0.1} /></div>
            <div className="space-y-2"><Label>Depósito promedio (USD)</Label><Input type="number" value={avgDeposit} onChange={e => setAvgDeposit(+e.target.value)} min={100} /></div>
            <div className="space-y-2"><Label>Lotes prom. / mes</Label><Input type="number" value={avgLots} onChange={e => setAvgLots(+e.target.value)} min={0.1} step={0.1} /></div>
            <div className="space-y-2"><Label>USD por lote</Label><Input type="number" value={dollarsPerLot} onChange={e => setDollarsPerLot(+e.target.value)} min={1} /></div>
            <Button onClick={calculate} className="w-full bg-gradient-brand shadow-brand"><TrendingUp className="w-4 h-4 mr-2" />Construir Funnel</Button>
          </CardContent>
        </Card>
        <div className="space-y-4">
          {results ? (
            <>
              {/* Visual funnel */}
              <Card className="bg-card/50 border-border/50">
                <CardContent className="pt-6 space-y-3">
                  {funnelSteps.map((step, i) => (
                    <div key={step.label} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{step.label}</span>
                        <span className="font-mono text-foreground">{step.value.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-8 flex items-center justify-center relative overflow-hidden" style={{ maxWidth: `${Math.max(step.pct, 20)}%`, margin: "0 auto" }}>
                        <div className="absolute inset-0 bg-gradient-brand opacity-60 rounded-full" />
                        <span className="relative text-xs font-mono text-primary-foreground">{step.pct.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-primary/5 border-primary/20"><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-primary">${results.monthlyIncome.toLocaleString()}</p><p className="text-[10px] font-mono uppercase text-muted-foreground">Ingreso mensual</p></CardContent></Card>
                <Card className="bg-primary/5 border-primary/20"><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-primary">${results.annualIncome.toLocaleString()}</p><p className="text-[10px] font-mono uppercase text-muted-foreground">Ingreso anual</p></CardContent></Card>
              </div>
            </>
          ) : (
            <Card className="bg-card/50 border-border/50 h-full flex items-center justify-center min-h-[300px]"><CardContent className="text-center text-muted-foreground"><Target className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Configura tu embudo para ver las conversiones</p></CardContent></Card>
          )}
        </div>
      </div>
      <ToolNavButtons />
    </div>
  );
};

export default FunnelBuilder;
