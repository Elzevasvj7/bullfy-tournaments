import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, ChevronDown, ChevronUp, Loader2, Target, TrendingUp, AlertTriangle, Lightbulb, MessageSquare } from "lucide-react";
import { toast } from "@/lib/toastUtils";

interface CallAnalysisPanelProps {
  callId: string;
  compact?: boolean;
}

const sentimentLabels: Record<string, { label: string; color: string }> = {
  muy_positivo: { label: "Muy Positivo", color: "text-green-500" },
  positivo: { label: "Positivo", color: "text-green-400" },
  neutral: { label: "Neutral", color: "text-muted-foreground" },
  negativo: { label: "Negativo", color: "text-orange-500" },
  muy_negativo: { label: "Muy Negativo", color: "text-destructive" },
};

const phaseLabels: Record<string, string> = {
  apertura: "🟢 Apertura",
  sondeo: "🔵 Sondeo",
  presentacion: "🟣 Presentación",
  objeciones: "🟡 Objeciones",
  cierre: "🔴 Cierre",
};

const CallAnalysisPanel = ({ callId, compact = false }: CallAnalysisPanelProps) => {
  const [expanded, setExpanded] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const { data: analysis, isLoading, refetch } = useQuery({
    queryKey: ["call-analysis", callId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_call_analysis")
        .select("*")
        .eq("call_id", callId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const retryAnalysis = async () => {
    setRetrying(true);
    try {
      const { error } = await supabase.functions.invoke("analyze-call-recording", {
        body: { call_id: callId },
      });
      if (error) throw error;
      toast.success("Análisis reiniciado");
      setTimeout(() => refetch(), 3000);
    } catch (err: any) {
      toast.error(err.message || "Error al reiniciar análisis");
    } finally {
      setRetrying(false);
    }
  };

  if (isLoading) return null;

  if (!analysis) return null;

  if (analysis.processing_status === "processing") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Analizando con IA...</span>
      </div>
    );
  }

  if (analysis.processing_status === "error") {
    return (
      <div className="flex items-center gap-2 text-xs text-destructive mt-1">
        <AlertTriangle className="w-3 h-3" />
        <span>Error: {analysis.error_message}</span>
        <Button variant="ghost" size="sm" className="h-5 px-1 text-xs" onClick={retryAnalysis} disabled={retrying}>
          {retrying ? <Loader2 className="w-3 h-3 animate-spin" /> : "Reintentar"}
        </Button>
      </div>
    );
  }

  if (analysis.processing_status !== "completed") return null;

  const scoreColor = analysis.success_score >= 70 ? "text-green-500" : analysis.success_score >= 50 ? "text-yellow-500" : "text-destructive";
  const sent = sentimentLabels[analysis.sentiment] || sentimentLabels.neutral;

  // Compact inline view
  if (compact && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 text-xs mt-1 hover:bg-secondary/50 rounded px-1 py-0.5 transition-colors w-full text-left"
      >
        <Brain className="w-3 h-3 text-primary" />
        <span className={`font-bold ${scoreColor}`}>{analysis.success_score}</span>
        <span className="text-muted-foreground">pts</span>
        <span className="text-muted-foreground">•</span>
        <span className="text-muted-foreground truncate flex-1">{analysis.summary?.substring(0, 60)}...</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Smart Call Analysis</span>
        </div>
        {compact && (
          <Button variant="ghost" size="sm" className="h-5 px-1" onClick={() => setExpanded(false)}>
            <ChevronUp className="w-3 h-3" />
          </Button>
        )}
      </div>

      {/* Score + Sentiment + Phase */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <div className={`text-lg font-bold ${scoreColor}`}>{analysis.success_score}</div>
          <div className="text-[10px] text-muted-foreground">Score</div>
        </div>
        <div className="text-center">
          <div className={`text-sm font-semibold ${sent.color}`}>{sent.label}</div>
          <div className="text-[10px] text-muted-foreground">Sentimiento</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold">{phaseLabels[analysis.sales_phase_reached] || "—"}</div>
          <div className="text-[10px] text-muted-foreground">Fase alcanzada</div>
        </div>
      </div>

      {/* Summary */}
      <div>
        <div className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1">
          <MessageSquare className="w-3 h-3" /> Resumen
        </div>
        <p className="text-xs text-foreground/80">{analysis.summary}</p>
      </div>

      {/* Keywords */}
      {analysis.keywords && analysis.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {analysis.keywords.map((kw: string, i: number) => (
            <Badge key={i} variant="secondary" className="text-[10px]">{kw}</Badge>
          ))}
        </div>
      )}

      {/* Objections */}
      {analysis.objections_detected && analysis.objections_detected.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1">
            <Target className="w-3 h-3" /> Objeciones ({analysis.objections_handled?.length || 0}/{analysis.objections_detected.length} manejadas)
          </div>
          <div className="space-y-0.5">
            {analysis.objections_detected.map((obj: string, i: number) => {
              const handled = analysis.objections_handled?.includes(obj);
              return (
                <div key={i} className="text-xs flex items-center gap-1">
                  <span>{handled ? "✅" : "❌"}</span>
                  <span className={handled ? "text-foreground/80" : "text-destructive/80"}>{obj}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Improvement Suggestions */}
      {analysis.improvement_suggestions && analysis.improvement_suggestions.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Sugerencias de Mejora
          </div>
          <ul className="space-y-0.5">
            {analysis.improvement_suggestions.map((s: string, i: number) => (
              <li key={i} className="text-xs text-foreground/80 flex gap-1">
                <Lightbulb className="w-3 h-3 text-yellow-500 flex-shrink-0 mt-0.5" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Coaching Notes */}
      {analysis.coaching_notes && (
        <div className="bg-secondary/40 rounded p-2">
          <div className="text-xs font-semibold text-foreground mb-1">🎓 Notas de Coaching</div>
          <p className="text-xs text-foreground/80 whitespace-pre-wrap">{analysis.coaching_notes}</p>
        </div>
      )}
    </div>
  );
};

export default CallAnalysisPanel;
