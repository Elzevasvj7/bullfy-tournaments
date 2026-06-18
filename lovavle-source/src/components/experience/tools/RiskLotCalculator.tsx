import { useState } from "react";
import ToolNavButtons from "@/components/experience/ToolNavButtons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator } from "lucide-react";
import { useExperienceStore } from "@/stores/experienceStore";
import { useExperienceSession } from "@/hooks/useExperienceSession";
import { supabase } from "@/integrations/supabase/client";

const RiskLotCalculator = () => {
  const { sessionId } = useExperienceSession();
  const { addToolUsed, incrementSimulations } = useExperienceStore();
  const [balance, setBalance] = useState(10000);
  const [riskPercent, setRiskPercent] = useState(2);
  const [stopLossPips, setStopLossPips] = useState(30);
  const [pipValue, setPipValue] = useState(10);
  const [results, setResults] = useState<any>(null);

  const calculate = async () => {
    const riskAmount = balance * (riskPercent / 100);
    const lotSize = riskAmount / (stopLossPips * pipValue);
    const res = { lotSize: +lotSize.toFixed(2), riskAmount: +riskAmount.toFixed(2), maxLoss: +riskAmount.toFixed(2) };
    setResults(res);
    addToolUsed("risk-lot");
    incrementSimulations();
    try { await supabase.from("experience_simulations").insert({ session_id: sessionId, tool_name: "risk-lot", inputs: { balance, riskPercent, stopLossPips, pipValue }, results: res }); } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Calculator className="w-6 h-6 text-primary" />Risk Lot Size Calculator</h1>
        <p className="text-muted-foreground">Calcula el lotaje recomendado según tu gestión de riesgo</p>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-card/50 border-border/50">
          <CardHeader><CardTitle className="text-lg">Parámetros</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Balance (USD)</Label><Input type="number" value={balance} onChange={e => setBalance(+e.target.value)} min={100} /></div>
            <div className="space-y-2"><Label>Riesgo (%)</Label><Input type="number" value={riskPercent} onChange={e => setRiskPercent(+e.target.value)} min={0.1} max={100} step={0.1} /></div>
            <div className="space-y-2"><Label>Stop Loss (pips)</Label><Input type="number" value={stopLossPips} onChange={e => setStopLossPips(+e.target.value)} min={1} /></div>
            <div className="space-y-2"><Label>Valor por pip (USD)</Label><Input type="number" value={pipValue} onChange={e => setPipValue(+e.target.value)} min={0.01} step={0.01} /></div>
            <Button onClick={calculate} className="w-full bg-gradient-brand shadow-brand">Calcular Lotaje</Button>
          </CardContent>
        </Card>
        <div>
          {results ? (
            <div className="grid gap-3">
              <Card className="bg-primary/5 border-primary/20"><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-primary">{results.lotSize}</p><p className="text-xs font-mono uppercase text-muted-foreground mt-1">Lotaje recomendado</p></CardContent></Card>
              <Card className="bg-primary/5 border-primary/20"><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-primary">${results.maxLoss}</p><p className="text-xs font-mono uppercase text-muted-foreground mt-1">Pérdida máxima</p></CardContent></Card>
            </div>
          ) : (
            <Card className="bg-card/50 border-border/50 h-full flex items-center justify-center min-h-[250px]"><CardContent className="text-center text-muted-foreground"><Calculator className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Ingresa tus parámetros de riesgo</p></CardContent></Card>
          )}
        </div>
      </div>
      <ToolNavButtons />
    </div>
  );
};

export default RiskLotCalculator;
