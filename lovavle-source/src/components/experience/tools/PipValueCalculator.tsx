import { useState } from "react";
import ToolNavButtons from "@/components/experience/ToolNavButtons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity } from "lucide-react";
import { useExperienceStore } from "@/stores/experienceStore";
import { useExperienceSession } from "@/hooks/useExperienceSession";
import { supabase } from "@/integrations/supabase/client";

const SYMBOLS = [
  { symbol: "EUR/USD", pipSize: 0.0001, pipValuePerLot: 10 },
  { symbol: "GBP/USD", pipSize: 0.0001, pipValuePerLot: 10 },
  { symbol: "USD/JPY", pipSize: 0.01, pipValuePerLot: 6.67 },
  { symbol: "XAU/USD", pipSize: 0.01, pipValuePerLot: 1 },
  { symbol: "US30", pipSize: 1, pipValuePerLot: 1 },
  { symbol: "NAS100", pipSize: 1, pipValuePerLot: 1 },
];

const PipValueCalculator = () => {
  const { sessionId } = useExperienceSession();
  const { addToolUsed, incrementSimulations } = useExperienceStore();
  const [selectedSymbol, setSelectedSymbol] = useState(SYMBOLS[0]);
  const [lots, setLots] = useState(1);
  const [results, setResults] = useState<any>(null);

  const calculate = async () => {
    const pipValue = selectedSymbol.pipValuePerLot * lots;
    const res = { pipValue: +pipValue.toFixed(2), symbol: selectedSymbol.symbol, lots };
    setResults(res);
    addToolUsed("pip-value");
    incrementSimulations();
    try { await supabase.from("experience_simulations").insert({ session_id: sessionId, tool_name: "pip-value", inputs: { symbol: selectedSymbol.symbol, lots }, results: res }); } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Activity className="w-6 h-6 text-primary" />Pip Value Calculator</h1>
        <p className="text-muted-foreground">Calcula el valor por pip según el símbolo y lotaje</p>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-card/50 border-border/50">
          <CardHeader><CardTitle className="text-lg">Parámetros</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Símbolo</Label>
              <div className="grid grid-cols-3 gap-2">
                {SYMBOLS.map(s => (
                  <Button key={s.symbol} type="button" variant={selectedSymbol.symbol === s.symbol ? "default" : "outline"} size="sm" onClick={() => setSelectedSymbol(s)}>{s.symbol}</Button>
                ))}
              </div>
            </div>
            <div className="space-y-2"><Label>Lotaje</Label><Input type="number" value={lots} onChange={e => setLots(+e.target.value)} min={0.01} step={0.01} /></div>
            <Button onClick={calculate} className="w-full bg-gradient-brand shadow-brand">Calcular Valor por Pip</Button>
          </CardContent>
        </Card>
        <div>
          {results ? (
            <Card className="bg-primary/5 border-primary/20"><CardContent className="pt-8 text-center space-y-2"><p className="text-4xl font-bold text-primary">${results.pipValue}</p><p className="text-sm font-mono uppercase text-muted-foreground">Valor por pip</p><p className="text-xs text-muted-foreground mt-4">{results.symbol} · {results.lots} lotes</p></CardContent></Card>
          ) : (
            <Card className="bg-card/50 border-border/50 h-full flex items-center justify-center min-h-[250px]"><CardContent className="text-center text-muted-foreground"><Activity className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Selecciona un símbolo y lotaje</p></CardContent></Card>
          )}
        </div>
      </div>
      <ToolNavButtons />
    </div>
  );
};

export default PipValueCalculator;
