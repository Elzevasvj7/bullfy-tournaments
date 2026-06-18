import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingUp, Target, Users, BarChart3, Award, AlertTriangle, Lightbulb } from "lucide-react";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";
import SmartCallKeywordAlerts from "./SmartCallKeywordAlerts";

const SmartCallDashboard = () => {
  // All completed analyses
  const { data: analyses = [] } = useQuery({
    queryKey: ["smart-call-analyses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_call_analysis")
        .select("*")
        .eq("processing_status", "completed")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  // Agent profiles for ranking
  const { data: agentProfiles = {} } = useQuery({
    queryKey: ["smart-call-agent-profiles"],
    queryFn: async () => {
      const agentIds = [...new Set(analyses.map((a: any) => a.agent_id))];
      if (agentIds.length === 0) return {};
      const { data } = await supabase
        .from("profiles")
        .select("id, nombre")
        .in("id", agentIds);
      const map: Record<string, string> = {};
      data?.forEach((p: any) => { map[p.id] = p.nombre; });
      return map;
    },
    enabled: analyses.length > 0,
  });

  if (analyses.length === 0) {
    return (
      <div className="text-center py-12">
        <Brain className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
        <h3 className="text-lg font-semibold text-foreground">Bullfy Smart Call</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Los análisis aparecerán aquí automáticamente después de cada llamada completada.
        </p>
      </div>
    );
  }

  // KPIs
  const avgScore = Math.round(analyses.reduce((s: number, a: any) => s + (a.success_score || 0), 0) / analyses.length);
  const totalObjectionsDetected = analyses.reduce((s: number, a: any) => s + (a.objections_detected?.length || 0), 0);
  const totalObjectionsHandled = analyses.reduce((s: number, a: any) => s + (a.objections_handled?.length || 0), 0);
  const objHandleRate = totalObjectionsDetected > 0 ? Math.round((totalObjectionsHandled / totalObjectionsDetected) * 100) : 0;

  // Sentiment distribution
  const sentimentCounts: Record<string, number> = {};
  analyses.forEach((a: any) => { sentimentCounts[a.sentiment] = (sentimentCounts[a.sentiment] || 0) + 1; });

  // Phase distribution
  const phaseCounts: Record<string, number> = {};
  analyses.forEach((a: any) => { phaseCounts[a.sales_phase_reached] = (phaseCounts[a.sales_phase_reached] || 0) + 1; });

  // Agent rankings
  const agentStats: Record<string, { total: number; scoreSum: number; calls: number }> = {};
  analyses.forEach((a: any) => {
    if (!agentStats[a.agent_id]) agentStats[a.agent_id] = { total: 0, scoreSum: 0, calls: 0 };
    agentStats[a.agent_id].scoreSum += a.success_score || 0;
    agentStats[a.agent_id].calls += 1;
  });
  const agentRanking = Object.entries(agentStats)
    .map(([id, s]) => ({ id, name: (agentProfiles as any)[id] || "Agente", avg: Math.round(s.scoreSum / s.calls), calls: s.calls }))
    .sort((a, b) => b.avg - a.avg);

  // Top objections
  const objectionFreq: Record<string, number> = {};
  analyses.forEach((a: any) => {
    (a.objections_detected || []).forEach((o: string) => {
      objectionFreq[o] = (objectionFreq[o] || 0) + 1;
    });
  });
  const topObjections = Object.entries(objectionFreq).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Top improvement suggestions
  const suggestionFreq: Record<string, number> = {};
  analyses.forEach((a: any) => {
    (a.improvement_suggestions || []).forEach((s: string) => {
      const key = s.substring(0, 80);
      suggestionFreq[key] = (suggestionFreq[key] || 0) + 1;
    });
  });
  const topSuggestions = Object.entries(suggestionFreq).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const scoreColor = (score: number) =>
    score >= 70 ? "text-green-500" : score >= 50 ? "text-yellow-500" : "text-destructive";

  const phaseLabels: Record<string, string> = {
    apertura: "Apertura",
    sondeo: "Sondeo",
    presentacion: "Presentación",
    objeciones: "Objeciones",
    cierre: "Cierre",
  };

  const sentimentLabels: Record<string, { label: string; color: string }> = {
    muy_positivo: { label: "Muy Positivo", color: "bg-green-500" },
    positivo: { label: "Positivo", color: "bg-green-400" },
    neutral: { label: "Neutral", color: "bg-muted-foreground" },
    negativo: { label: "Negativo", color: "bg-orange-500" },
    muy_negativo: { label: "Muy Negativo", color: "bg-destructive" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Brain className="w-6 h-6 text-primary" />
        <div>
          <h3 className="text-lg font-bold text-foreground">Bullfy Smart Call</h3>
          <p className="text-xs text-muted-foreground">{analyses.length} llamadas analizadas</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-5 h-5 mx-auto text-primary mb-1" />
            <div className={`text-2xl font-bold ${scoreColor(avgScore)}`}>{avgScore}</div>
            <div className="text-[10px] text-muted-foreground">Score Promedio</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <Target className="w-5 h-5 mx-auto text-primary mb-1" />
            <div className="text-2xl font-bold text-foreground">{objHandleRate}%</div>
            <div className="text-[10px] text-muted-foreground">Objeciones Manejadas</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <BarChart3 className="w-5 h-5 mx-auto text-primary mb-1" />
            <div className="text-2xl font-bold text-foreground">{analyses.length}</div>
            <div className="text-[10px] text-muted-foreground">Análisis Totales</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <Users className="w-5 h-5 mx-auto text-primary mb-1" />
            <div className="text-2xl font-bold text-foreground">{agentRanking.length}</div>
            <div className="text-[10px] text-muted-foreground">Agentes Activos</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Agent Ranking */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" /> Ranking de Agentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {agentRanking.map((agent, idx) => (
              <div key={agent.id} className="flex items-center gap-3">
                <span className="text-sm font-bold text-muted-foreground w-5">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{agent.name}</div>
                  <div className="text-[10px] text-muted-foreground">{agent.calls} llamadas</div>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={agent.avg} className="w-16 h-2" />
                  <span className={`text-sm font-bold ${scoreColor(agent.avg)} w-8 text-right`}>{agent.avg}</span>
                </div>
              </div>
            ))}
            {agentRanking.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Sin datos de agentes</p>
            )}
          </CardContent>
        </Card>

        {/* Top Objections */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" /> Objeciones Frecuentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topObjections.map(([obj, count], idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] flex-shrink-0">{count}x</Badge>
                <span className="text-xs text-foreground/80 truncate">{obj}</span>
              </div>
            ))}
            {topObjections.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Sin objeciones detectadas</p>
            )}
          </CardContent>
        </Card>

        {/* Phase Distribution */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Fases Alcanzadas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {["apertura", "sondeo", "presentacion", "objeciones", "cierre"].map((phase) => {
              const count = phaseCounts[phase] || 0;
              const pct = analyses.length > 0 ? Math.round((count / analyses.length) * 100) : 0;
              return (
                <div key={phase} className="flex items-center gap-2">
                  <span className="text-xs w-24 text-foreground">{phaseLabels[phase]}</span>
                  <Progress value={pct} className="flex-1 h-2" />
                  <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Sentiment Distribution */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" /> Distribución de Sentimiento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(sentimentLabels).map(([key, val]) => {
              const count = sentimentCounts[key] || 0;
              const pct = analyses.length > 0 ? Math.round((count / analyses.length) * 100) : 0;
              return (
                <div key={key} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${val.color}`} />
                  <span className="text-xs w-24 text-foreground">{val.label}</span>
                  <Progress value={pct} className="flex-1 h-2" />
                  <span className="text-xs text-muted-foreground w-10 text-right">{count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Top Improvement Suggestions */}
      {topSuggestions.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-500" /> Áreas de Mejora más Comunes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topSuggestions.map(([suggestion, count], idx) => (
              <div key={idx} className="flex items-start gap-2">
                <Badge variant="outline" className="text-[10px] flex-shrink-0 mt-0.5">{count}x</Badge>
                <span className="text-xs text-foreground/80">{suggestion}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Keyword Alerts from Streams */}
      <SmartCallKeywordAlerts />

      {/* Recent Analyses */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" /> Análisis Recientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {analyses.slice(0, 20).map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
                <span className={`text-sm font-bold ${scoreColor(a.success_score)} w-8 text-right`}>{a.success_score}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-foreground truncate">{a.summary?.substring(0, 80)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {(agentProfiles as any)[a.agent_id] || "Agente"} • {format(new Date(a.created_at), "dd/MM HH:mm")}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">{phaseLabels[a.sales_phase_reached] || a.sales_phase_reached}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SmartCallDashboard;
