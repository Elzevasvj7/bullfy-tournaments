import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { GraduationCap, MessageSquare, ArrowRight, RotateCcw, Loader2 } from "lucide-react";

interface Objection {
  id: string; texto_objecion: string; respuesta_logica: string;
  respuesta_emocional: string; reframe: string; contra_pregunta: string;
  cierre_sugerido: string;
}

const SCENARIOS = [
  { id: "esceptico", label: "Cliente Escéptico", emoji: "🤨", description: "No confía en nada, cuestiona todo" },
  { id: "sin_dinero", label: "IB Sin Dinero", emoji: "💸", description: "Interesado pero sin capital" },
  { id: "quemado", label: "Inversionista Quemado", emoji: "🔥", description: "Tuvo malas experiencias previas" },
  { id: "frustrado", label: "Trader Frustrado", emoji: "😤", description: "No ha logrado rentabilidad" },
];

const SCENARIO_OBJECTIONS: Record<string, string[]> = {
  esceptico: ["No confío en brokers", "Es muy riesgoso"],
  sin_dinero: ["No tengo dinero"],
  quemado: ["No confío en brokers", "Es muy riesgoso", "Ya trabajo con otro broker"],
  frustrado: ["No entiendo el modelo", "Es muy riesgoso"],
};

const TrainingMode = () => {
  const { user } = useAuth();
  const [objections, setObjections] = useState<Objection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    supabase.from("bce_objections").select("*").then(({ data }) => {
      setObjections(data ?? []);
      setLoading(false);
    });
  }, []);

  const startScenario = (id: string) => {
    setSelectedScenario(id);
    setStep(0);
    setShowAnswer(false);
    setScore(0);
    setCompleted(false);
  };

  const scenarioObjections = selectedScenario
    ? objections.filter(o => SCENARIO_OBJECTIONS[selectedScenario]?.includes(o.texto_objecion))
    : [];

  const currentObj = scenarioObjections[step];

  const handleGood = () => {
    setScore(s => s + 10);
    advance();
  };

  const handleNeedsPractice = () => {
    advance();
  };

  const advance = () => {
    if (step < scenarioObjections.length - 1) {
      setStep(s => s + 1);
      setShowAnswer(false);
    } else {
      setCompleted(true);
      // Save training session
      if (user) {
        supabase.from("bce_call_sessions").insert({
          bd_id: user.id,
          is_training: true,
          score: score,
          resultado: "entrenamiento",
          objeciones_manejadas: scenarioObjections.length,
        });
      }
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!selectedScenario) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h3 className="text-xl font-semibold text-foreground flex items-center justify-center gap-2">
            <GraduationCap className="w-5 h-5" /> Modo Simulación
          </h3>
          <p className="text-sm text-muted-foreground">Practica con escenarios reales. El sistema te evalúa.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
          {SCENARIOS.map(s => (
            <Card key={s.id} className="cursor-pointer hover:border-primary/50 transition-all hover:scale-[1.02]"
              onClick={() => startScenario(s.id)}>
              <CardContent className="py-5 flex items-center gap-3">
                <span className="text-3xl">{s.emoji}</span>
                <div>
                  <p className="font-semibold text-foreground">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (completed) {
    const scenario = SCENARIOS.find(s => s.id === selectedScenario)!;
    return (
      <div className="max-w-md mx-auto text-center space-y-4 animate-fade-in py-8">
        <span className="text-5xl">{scenario.emoji}</span>
        <h3 className="text-xl font-bold text-foreground">Simulación completada</h3>
        <p className="text-3xl font-bold text-primary">{score} pts</p>
        <p className="text-sm text-muted-foreground">
          Manejaste {scenarioObjections.length} objeción(es) en el escenario "{scenario.label}"
        </p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={() => setSelectedScenario(null)}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Otro escenario
          </Button>
          <Button onClick={() => startScenario(selectedScenario)}>Repetir</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <Badge variant="outline">{SCENARIOS.find(s => s.id === selectedScenario)?.label}</Badge>
        <span className="text-sm text-muted-foreground">{step + 1} / {scenarioObjections.length}</span>
      </div>

      {currentObj && (
        <Card className="border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-400">
              <MessageSquare className="w-4 h-4 inline mr-1" /> El prospecto dice:
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg font-medium text-foreground">"{currentObj.texto_objecion}"</p>

            {!showAnswer ? (
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-3">Piensa tu respuesta antes de ver la sugerida</p>
                <Button onClick={() => setShowAnswer(true)}>
                  Ver respuesta sugerida <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2 animate-fade-in">
                <div className="p-2 rounded bg-background/50 text-xs">
                  <p className="text-muted-foreground mb-0.5 uppercase text-[10px]">Reframe</p>
                  <p className="text-foreground">{currentObj.reframe}</p>
                </div>
                <div className="p-2 rounded bg-background/50 text-xs">
                  <p className="text-muted-foreground mb-0.5 uppercase text-[10px]">Contra-pregunta</p>
                  <p className="text-primary font-medium">{currentObj.contra_pregunta}</p>
                </div>
                <div className="p-2 rounded bg-primary/10 border border-primary/20 text-xs">
                  <p className="text-primary mb-0.5 uppercase text-[10px]">Cierre sugerido</p>
                  <p className="text-foreground font-medium">{currentObj.cierre_sugerido}</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="flex-1" onClick={handleGood}>✅ Lo manejé bien</Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={handleNeedsPractice}>🔄 Necesito práctica</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TrainingMode;
