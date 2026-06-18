import { useState } from "react";
import ToolNavButtons from "@/components/experience/ToolNavButtons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Award, Star } from "lucide-react";
import { useExperienceStore } from "@/stores/experienceStore";
import { useExperienceSession } from "@/hooks/useExperienceSession";
import { supabase } from "@/integrations/supabase/client";

const RANKS = [
  { min: 0, max: 10, label: "Starter IB", icon: "🌱", color: "text-muted-foreground" },
  { min: 11, max: 50, label: "Growth IB", icon: "📈", color: "text-primary/70" },
  { min: 51, max: 200, label: "Master IB", icon: "⭐", color: "text-primary" },
  { min: 201, max: 500, label: "Elite IB", icon: "💎", color: "text-primary" },
  { min: 501, max: Infinity, label: "Global Partner", icon: "🌍", color: "text-primary" },
];

const getRank = (clients: number, volume: number) => {
  const score = clients + volume / 10;
  return RANKS.find(r => score >= r.min && score <= r.max) || RANKS[0];
};

const IBRankSimulator = () => {
  const { sessionId } = useExperienceSession();
  const { addToolUsed, incrementSimulations } = useExperienceStore();
  const [clients, setClients] = useState(25);
  const [volume, setVolume] = useState(200);
  const [result, setResult] = useState<any>(null);

  const calculate = async () => {
    const rank = getRank(clients, volume);
    const nextRank = RANKS[RANKS.indexOf(rank) + 1];
    setResult({ rank, nextRank, score: clients + volume / 10 });
    addToolUsed("rank");
    incrementSimulations();
    try { await supabase.from("experience_simulations").insert({ session_id: sessionId, tool_name: "rank", inputs: { clients, volume }, results: { rank: rank.label, score: clients + volume / 10 } }); } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Award className="w-6 h-6 text-primary" />IB Rank Simulator</h1>
        <p className="text-muted-foreground">Descubre tu nivel como IB basado en clientes y volumen</p>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-card/50 border-border/50">
          <CardHeader><CardTitle className="text-lg">Tu Actividad</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Clientes activos</Label><Input type="number" value={clients} onChange={e => setClients(+e.target.value)} min={0} /></div>
            <div className="space-y-2"><Label>Volumen mensual (lotes)</Label><Input type="number" value={volume} onChange={e => setVolume(+e.target.value)} min={0} /></div>
            <Button onClick={calculate} className="w-full bg-gradient-brand shadow-brand">Calcular Rango</Button>
          </CardContent>
        </Card>
        <div className="space-y-4">
          {result ? (
            <>
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-8 text-center space-y-3">
                  <p className="text-5xl">{result.rank.icon}</p>
                  <p className={`text-2xl font-bold ${result.rank.color}`}>{result.rank.label}</p>
                  <p className="text-sm text-muted-foreground">Score: {Math.round(result.score)}</p>
                </CardContent>
              </Card>
              {result.nextRank && (
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs font-mono uppercase text-muted-foreground">Próximo nivel</p>
                    <p className="text-lg font-semibold">{result.nextRank.icon} {result.nextRank.label}</p>
                    <p className="text-xs text-muted-foreground">Necesitas un score de {result.nextRank.min}</p>
                  </CardContent>
                </Card>
              )}
              {/* All ranks */}
              <Card className="bg-card/50 border-border/50">
                <CardContent className="pt-4 space-y-2">
                  {RANKS.map(r => (
                    <div key={r.label} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${r.label === result.rank.label ? "bg-primary/10 border border-primary/20" : ""}`}>
                      <span className="text-xl">{r.icon}</span>
                      <span className="text-sm font-medium flex-1">{r.label}</span>
                      <span className="text-xs text-muted-foreground">{r.min === 501 ? "500+" : `${r.min}-${r.max}`}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="bg-card/50 border-border/50 h-full flex items-center justify-center min-h-[250px]"><CardContent className="text-center text-muted-foreground"><Award className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Ingresa tu actividad para descubrir tu rango</p></CardContent></Card>
          )}
        </div>
      </div>
      <ToolNavButtons />
    </div>
  );
};

export default IBRankSimulator;
