import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, AlertCircle, Lightbulb, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

type Insight = {
  id: string; generated_at: string; period_start: string; period_end: string;
  summary: string; anomalies: any[]; recommendations: any[]; kpis: Record<string, any>;
  model: string | null; acknowledged_at: string | null;
};

export default function InsightsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("accounting_ai_insights")
      .select("*").order("generated_at", { ascending: false }).limit(20);
    setItems((data || []) as any);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function generate() {
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("accounting-ai-insights", { body: {} });
    setGenerating(false);
    if (error || !data?.ok) {
      return toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
    }
    toast({ title: "Insights generados" });
    load();
  }

  async function acknowledge(id: string) {
    if (!user) return;
    await supabase.from("accounting_ai_insights")
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user.id })
      .eq("id", id);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="h-6 w-6 text-primary" /> Insights IA</h2>
          <p className="text-muted-foreground">Análisis semanal automático de anomalías y oportunidades</p>
        </div>
        <Button onClick={generate} disabled={generating}>
          {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
          Generar ahora
        </Button>
      </div>

      {loading ? <p>Cargando…</p> : items.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          Aún no hay insights. Pulsa "Generar ahora" para crear el primer análisis.
        </CardContent></Card>
      ) : items.map(it => (
        <Card key={it.id} className={it.acknowledged_at ? "opacity-60" : ""}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">Período: {it.period_start} → {it.period_end}</CardTitle>
                <p className="text-xs text-muted-foreground">Generado: {new Date(it.generated_at).toLocaleString()} · {it.model || "ai"}</p>
              </div>
              {!it.acknowledged_at && (
                <Button size="sm" variant="ghost" onClick={() => acknowledge(it.id)}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Revisado
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm whitespace-pre-wrap">{it.summary}</p>

            {it.kpis && Object.keys(it.kpis).length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(it.kpis).map(([k, v]) => (
                  <div key={k} className="p-2 border rounded text-xs">
                    <div className="text-muted-foreground">{k}</div>
                    <div className="font-mono font-semibold">{typeof v === "number" ? v.toLocaleString() : String(v)}</div>
                  </div>
                ))}
              </div>
            )}

            {it.anomalies?.length > 0 && (
              <div>
                <h4 className="font-medium text-sm flex items-center gap-1 mb-2"><AlertCircle className="h-4 w-4 text-destructive" /> Anomalías</h4>
                <ul className="space-y-1">{it.anomalies.map((a, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <Badge variant={a.severity === "high" ? "destructive" : "outline"} className="text-xs">{a.severity || "med"}</Badge>
                    <span>{a.message || JSON.stringify(a)}</span>
                  </li>
                ))}</ul>
              </div>
            )}

            {it.recommendations?.length > 0 && (
              <div>
                <h4 className="font-medium text-sm flex items-center gap-1 mb-2"><Lightbulb className="h-4 w-4 text-amber-500" /> Recomendaciones</h4>
                <ul className="space-y-1 list-disc list-inside text-sm">
                  {it.recommendations.map((r, i) => <li key={i}>{typeof r === "string" ? r : r.message || JSON.stringify(r)}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
