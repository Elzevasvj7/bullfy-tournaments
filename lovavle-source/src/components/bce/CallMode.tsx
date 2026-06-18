import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  ChevronRight, Flame, Snowflake, Sun, PhoneOff,
  Brain, Shield, MessageSquare, RefreshCw, Loader2, Target,
} from "lucide-react";
import type { FlowSelection } from "./BCEDashboard";
import PostCallFeedback from "./PostCallFeedback";

interface Script { id: string; fase: string; texto_corto: string; orden: number; }
interface Objection {
  id: string; texto_objecion: string; respuesta_logica: string;
  respuesta_emocional: string; reframe: string; contra_pregunta: string;
  cierre_sugerido: string; categoria: string | null;
}

const PHASES = ["apertura", "diagnostico", "presentacion", "objeciones", "cierre"];
const PHASE_LABELS: Record<string, string> = {
  apertura: "🟢 Apertura", diagnostico: "🔍 Diagnóstico", presentacion: "📊 Presentación",
  objeciones: "🛡️ Objeciones", cierre: "🎯 Cierre",
};

const CAPITAL_OPTS = ["alto", "medio", "bajo", "cero"];
const EXP_OPTS = ["alta", "media", "baja"];
const INTEREST_OPTS = ["alto", "medio", "bajo"];

interface Props { flow: FlowSelection; onEnd: () => void; }

const CallMode = ({ flow, onEnd }: Props) => {
  const { user } = useAuth();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [objections, setObjections] = useState<Objection[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Call state
  const [currentPhase, setCurrentPhase] = useState(0);
  const [scriptIdx, setScriptIdx] = useState(0);
  const [selectedObjection, setSelectedObjection] = useState<Objection | null>(null);

  // Lead profiling
  const [capital, setCapital] = useState("medio");
  const [experiencia, setExperiencia] = useState("media");
  const [interes, setInteres] = useState("medio");
  const [objeccionesDetectadas, setObjeccionesDetectadas] = useState<string[]>([]);
  const [notas, setNotas] = useState("");

  // Tracking
  const [respuestasUsadas, setRespuestasUsadas] = useState(0);
  const [objecionesManejadas, setObjecionesManejadas] = useState(0);
  const [callEnded, setCallEnded] = useState(false);

  // Derived intelligence
  const calcTemperature = useCallback(() => {
    let score = 0;
    if (interes === "alto") score += 3; else if (interes === "medio") score += 1;
    if (capital === "alto") score += 2; else if (capital === "medio") score += 1;
    if (experiencia === "alta") score += 1;
    score -= objeccionesDetectadas.length * 0.5;
    if (score >= 4) return "caliente";
    if (score >= 2) return "tibio";
    return "frio";
  }, [interes, capital, experiencia, objeccionesDetectadas]);

  const calcProbability = useCallback(() => {
    let prob = 50;
    if (interes === "alto") prob += 20; else if (interes === "bajo") prob -= 15;
    if (capital === "alto") prob += 15; else if (capital === "cero") prob -= 20;
    if (experiencia === "alta") prob += 10;
    prob -= objeccionesDetectadas.length * 5;
    prob += objecionesManejadas * 3;
    return Math.max(5, Math.min(95, prob));
  }, [interes, capital, experiencia, objeccionesDetectadas, objecionesManejadas]);

  const getRecommendation = useCallback(() => {
    const temp = calcTemperature();
    if (temp === "caliente") return { text: "🎯 Mover a cierre", color: "text-emerald-400" };
    if (interes === "bajo") return { text: "🔥 Generar interés primero", color: "text-amber-400" };
    if (objeccionesDetectadas.length > 2) return { text: "🛡️ Manejar objeciones pendientes", color: "text-red-400" };
    if (capital === "cero") return { text: "💡 Enfocar en Prop Firm", color: "text-blue-400" };
    return { text: "💬 Hacer pregunta de compromiso", color: "text-primary" };
  }, [calcTemperature, interes, objeccionesDetectadas, capital]);

  const temperature = calcTemperature();
  const probability = calcProbability();
  const recommendation = getRecommendation();

  useEffect(() => {
    const load = async () => {
      const [scriptsRes, objRes] = await Promise.all([
        supabase.from("bce_scripts").select("*").eq("flow_id", flow.flowId).order("orden"),
        supabase.from("bce_objections").select("*"),
      ]);
      setScripts(scriptsRes.data ?? []);
      setObjections(objRes.data ?? []);

      // Create session
      if (user) {
        const { data } = await supabase.from("bce_call_sessions").insert({
          bd_id: user.id, flow_id: flow.flowId, is_training: false,
        }).select("id").single();
        if (data) setSessionId(data.id);
      }
      setLoading(false);
    };
    load();
  }, [flow.flowId, user]);

  const currentPhaseScripts = scripts.filter(s => s.fase === PHASES[currentPhase]);
  const currentScript = currentPhaseScripts[scriptIdx];

  const nextScript = () => {
    if (scriptIdx < currentPhaseScripts.length - 1) {
      setScriptIdx(i => i + 1);
    } else if (currentPhase < PHASES.length - 1) {
      setCurrentPhase(p => p + 1);
      setScriptIdx(0);
    }
    setRespuestasUsadas(r => r + 1);
  };

  const goToPhase = (idx: number) => {
    setCurrentPhase(idx);
    setScriptIdx(0);
  };

  const handleObjectionClick = (obj: Objection) => {
    setSelectedObjection(obj);
    if (!objeccionesDetectadas.includes(obj.texto_objecion)) {
      setObjeccionesDetectadas(prev => [...prev, obj.texto_objecion]);
    }
    setObjecionesManejadas(o => o + 1);
  };

  const endCall = async (resultado: string) => {
    if (sessionId) {
      await supabase.from("bce_call_sessions").update({
        capital, experiencia, interes,
        objeciones_detectadas: objeccionesDetectadas,
        temperatura: temperature,
        probabilidad_cierre: probability,
        fase_actual: PHASES[currentPhase],
        respuestas_usadas: respuestasUsadas,
        objeciones_manejadas: objecionesManejadas,
        resultado, notas,
        score: Math.round(probability * 0.5 + objecionesManejadas * 10 + respuestasUsadas * 2),
        ended_at: new Date().toISOString(),
      }).eq("id", sessionId);
    }
    setCallEnded(true);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (callEnded) {
    return (
      <PostCallFeedback
        objeccionesDetectadas={objeccionesDetectadas}
        respuestasUsadas={respuestasUsadas}
        objecionesManejadas={objecionesManejadas}
        probability={probability}
        temperature={temperature}
        onClose={onEnd}
      />
    );
  }

  const TempIcon = temperature === "caliente" ? Flame : temperature === "frio" ? Snowflake : Sun;
  const tempColor = temperature === "caliente" ? "text-red-400" : temperature === "frio" ? "text-blue-400" : "text-amber-400";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-primary border-primary/40">{flow.flowName}</Badge>
          <div className="flex gap-1">
            {PHASES.map((p, i) => (
              <button
                key={p}
                onClick={() => goToPhase(i)}
                className={`px-2 py-1 text-xs rounded transition-all ${
                  i === currentPhase
                    ? "bg-primary text-primary-foreground"
                    : i < currentPhase
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {PHASE_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={() => endCall("no_cerrado")}>
          <PhoneOff className="w-3.5 h-3.5 mr-1" /> Finalizar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* BLOCK 1: Dynamic Script */}
        <div className="lg:col-span-5 space-y-3">
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-blue-400 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" /> Guión — {PHASE_LABELS[PHASES[currentPhase]]}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentScript ? (
                <p className="text-lg font-medium text-foreground leading-relaxed">
                  "{currentScript.texto_corto}"
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No hay scripts para esta fase. Agrega contenido desde "Cargar Base".
                </p>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={nextScript} className="flex-1">
                  Siguiente <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {scriptIdx + 1} / {currentPhaseScripts.length || 1}
              </p>
            </CardContent>
          </Card>

          {/* Lead Profiler */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Brain className="w-4 h-4" /> Perfilamiento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Capital</p>
                <div className="flex gap-1.5">
                  {CAPITAL_OPTS.map(o => (
                    <button key={o} onClick={() => setCapital(o)}
                      className={`px-3 py-1.5 text-xs rounded-md transition-all font-medium ${capital === o ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    >{o === "cero" ? "$0" : o.charAt(0).toUpperCase() + o.slice(1)}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Experiencia</p>
                <div className="flex gap-1.5">
                  {EXP_OPTS.map(o => (
                    <button key={o} onClick={() => setExperiencia(o)}
                      className={`px-3 py-1.5 text-xs rounded-md transition-all font-medium ${experiencia === o ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    >{o.charAt(0).toUpperCase() + o.slice(1)}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Interés</p>
                <div className="flex gap-1.5">
                  {INTEREST_OPTS.map(o => (
                    <button key={o} onClick={() => setInteres(o)}
                      className={`px-3 py-1.5 text-xs rounded-md transition-all font-medium ${interes === o ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    >{o.charAt(0).toUpperCase() + o.slice(1)}</button>
                  ))}
                </div>
              </div>
              <Textarea
                placeholder="Notas de la llamada..."
                value={notas}
                onChange={e => setNotas(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </CardContent>
          </Card>
        </div>

        {/* BLOCK 2: Objection Engine */}
        <div className="lg:col-span-4">
          <Card className="border-amber-500/20 bg-amber-500/5 h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-amber-400 flex items-center gap-1.5">
                <Shield className="w-4 h-4" /> Motor de Objeciones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Objection buttons */}
              <div className="flex flex-wrap gap-1.5">
                {objections.map(obj => (
                  <button
                    key={obj.id}
                    onClick={() => handleObjectionClick(obj)}
                    className={`px-2.5 py-1.5 text-xs rounded-md border transition-all ${
                      selectedObjection?.id === obj.id
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                        : objeccionesDetectadas.includes(obj.texto_objecion)
                        ? "bg-muted/80 border-border text-muted-foreground line-through"
                        : "bg-muted border-border text-foreground hover:border-amber-500/30"
                    }`}
                  >
                    {obj.texto_objecion}
                  </button>
                ))}
              </div>

              {/* Response panel */}
              {selectedObjection && (
                <div className="space-y-2 animate-fade-in border-t border-border pt-3">
                  <div className="space-y-2">
                    <div className="p-2 rounded bg-background/50">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Respuesta Lógica</p>
                      <p className="text-xs text-foreground">{selectedObjection.respuesta_logica}</p>
                    </div>
                    <div className="p-2 rounded bg-background/50">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Respuesta Emocional</p>
                      <p className="text-xs text-foreground">{selectedObjection.respuesta_emocional}</p>
                    </div>
                    <div className="p-2 rounded bg-background/50">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Reframe</p>
                      <p className="text-xs text-foreground">{selectedObjection.reframe}</p>
                    </div>
                    <div className="p-2 rounded bg-background/50">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Contra-pregunta</p>
                      <p className="text-xs font-medium text-primary">{selectedObjection.contra_pregunta}</p>
                    </div>
                    <div className="p-2 rounded bg-primary/10 border border-primary/20">
                      <p className="text-[10px] uppercase tracking-wider text-primary mb-0.5">Micro-cierre sugerido</p>
                      <p className="text-xs font-medium text-foreground">{selectedObjection.cierre_sugerido}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* BLOCK 3: Closing Intelligence */}
        <div className="lg:col-span-3 space-y-3">
          <Card className="border-red-500/20 bg-red-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-red-400 flex items-center gap-1.5">
                <Target className="w-4 h-4" /> Inteligencia de Cierre
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Temperature */}
              <div className="text-center">
                <TempIcon className={`w-10 h-10 mx-auto ${tempColor}`} />
                <p className={`text-lg font-bold mt-1 capitalize ${tempColor}`}>{temperature}</p>
              </div>

              {/* Probability */}
              <div className="text-center">
                <p className="text-3xl font-bold text-foreground">{probability}%</p>
                <p className="text-xs text-muted-foreground">Probabilidad de cierre</p>
                <div className="w-full h-2 bg-muted rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      probability >= 70 ? "bg-emerald-500" : probability >= 40 ? "bg-amber-500" : "bg-red-500"
                    }`}
                    style={{ width: `${probability}%` }}
                  />
                </div>
              </div>

              {/* Recommendation */}
              <div className="p-3 rounded-lg bg-background/50 border border-border">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Recomendación</p>
                <p className={`text-sm font-semibold ${recommendation.color}`}>{recommendation.text}</p>
              </div>

              {/* Quick actions */}
              <div className="space-y-1.5">
                <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => endCall("cerrado")}>
                  ✅ Cerrado
                </Button>
                <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => endCall("seguimiento")}>
                  📅 Seguimiento
                </Button>
                <Button size="sm" variant="destructive" className="w-full text-xs" onClick={() => endCall("no_cerrado")}>
                  ❌ No cerrado
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CallMode;
