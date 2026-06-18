import { useState } from "react";
import ToolNavButtons from "@/components/experience/ToolNavButtons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingUp } from "lucide-react";
import { useExperienceStore } from "@/stores/experienceStore";
import { useExperienceSession } from "@/hooks/useExperienceSession";
import { supabase } from "@/integrations/supabase/client";

const REGIONS: Record<string, number> = { "LATAM": 20, "Europa": 18, "Asia": 15, "Medio Oriente": 17, "África": 12, "Norteamérica": 20 };

const IBSuccessScore = () => {
  const { sessionId } = useExperienceSession();
  const { addToolUsed, incrementSimulations, addBadge } = useExperienceStore();
  const [audienceSize, setAudienceSize] = useState(500);
  const [tradingExp, setTradingExp] = useState(3);
  const [salesExp, setSalesExp] = useState(2);
  const [activeCommunity, setActiveCommunity] = useState(true);
  const [region, setRegion] = useState("LATAM");
  const [result, setResult] = useState<any>(null);

  const calculate = async () => {
    const audienceScore = Math.min(25, (audienceSize / 5000) * 25);
    const tradingScore = Math.min(20, tradingExp * 4);
    const salesScore = Math.min(15, salesExp * 5);
    const communityBonus = activeCommunity ? 10 : 0;
    const regionScore = REGIONS[region] || 15;
    const total = Math.round(audienceScore + tradingScore + salesScore + communityBonus + regionScore);

    const diagnosis = total >= 80 ? "Perfil excepcional — candidato elite" :
      total >= 60 ? "Perfil sólido — alto potencial de crecimiento" :
      total >= 40 ? "Perfil prometedor — necesita desarrollo" :
      "Perfil en construcción — oportunidad de capacitación";

    const res = { score: total, diagnosis, breakdown: { audienceScore: Math.round(audienceScore), tradingScore: Math.round(tradingScore), salesScore: Math.round(salesScore), communityBonus, regionScore } };
    setResult(res);
    addToolUsed("score");
    incrementSimulations();
    addBadge("Lead calificado");
    try { await supabase.from("experience_simulations").insert({ session_id: sessionId, tool_name: "score", inputs: { audienceSize, tradingExp, salesExp, activeCommunity, region }, results: res }); } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="w-6 h-6 text-primary" />IB Success Score</h1>
        <p className="text-muted-foreground">Evalúa tu potencial como Introducing Broker</p>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-card/50 border-border/50">
          <CardHeader><CardTitle className="text-lg">Tu Perfil</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Tamaño de audiencia</Label><Input type="number" value={audienceSize} onChange={e => setAudienceSize(+e.target.value)} min={0} /></div>
            <div className="space-y-2"><Label>Años experiencia trading</Label><Input type="number" value={tradingExp} onChange={e => setTradingExp(+e.target.value)} min={0} /></div>
            <div className="space-y-2"><Label>Años experiencia ventas</Label><Input type="number" value={salesExp} onChange={e => setSalesExp(+e.target.value)} min={0} /></div>
            <div className="flex items-center gap-3">
              <Label>¿Comunidad activa?</Label>
              <Button type="button" variant={activeCommunity ? "default" : "outline"} size="sm" onClick={() => setActiveCommunity(!activeCommunity)}>
                {activeCommunity ? "Sí" : "No"}
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Región</Label>
              <div className="flex flex-wrap gap-2">
                {Object.keys(REGIONS).map(r => (
                  <Badge key={r} variant={region === r ? "default" : "outline"} className="cursor-pointer" onClick={() => setRegion(r)}>{r}</Badge>
                ))}
              </div>
            </div>
            <Button onClick={calculate} className="w-full bg-gradient-brand shadow-brand"><TrendingUp className="w-4 h-4 mr-2" />Evaluar Potencial</Button>
          </CardContent>
        </Card>
        <div className="space-y-4">
          {result ? (
            <>
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-8 text-center space-y-3">
                  <p className="text-5xl font-bold text-primary">{result.score}<span className="text-xl text-muted-foreground">/100</span></p>
                  <p className="text-sm text-muted-foreground">{result.diagnosis}</p>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border/50">
                <CardContent className="pt-6 space-y-3">
                  {Object.entries(result.breakdown).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-secondary rounded-full h-2"><div className="bg-primary h-2 rounded-full" style={{ width: `${Math.min(100, (val as number) * 4)}%` }} /></div>
                        <span className="text-sm font-mono text-foreground w-6 text-right">{val as number}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="bg-card/50 border-border/50 h-full flex items-center justify-center min-h-[250px]"><CardContent className="text-center text-muted-foreground"><Brain className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Completa tu perfil para obtener tu score</p></CardContent></Card>
          )}
        </div>
      </div>
      <ToolNavButtons />
    </div>
  );
};

export default IBSuccessScore;
