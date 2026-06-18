import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calculator, ShieldCheck, Clock } from "lucide-react";
import { normalizeWeights, computeBreakdown, formatContribution, type ScoreMetrics } from "@/lib/tournamentScore";
import ScoreBreakdown from "./components/ScoreBreakdown";

type Sample = {
  id: string;
  name: string;
  current_score: number;
  metrics: ScoreMetrics;
};

export default function TournamentScoring() {
  const { slug } = useParams();
  const [tour, setTour] = useState<any>(null);
  const [samples, setSamples] = useState<Sample[]>([]);

  useEffect(() => {
    (async () => {
      if (!slug) return;
      const { data: t } = await supabase
        .from("tournaments")
        .select("id, name, scoring_weights, status")
        .eq("slug", slug)
        .maybeSingle();
      setTour(t);
      if (!t) return;
      const { data: ps } = await supabase
        .from("tournament_participants")
        .select("id, user_id, current_score, profit_pct, winrate, profit_factor, sharpe, max_drawdown_pct")
        .eq("tournament_id", t.id)
        .order("current_score", { ascending: false })
        .limit(2);
      const ids = (ps || []).map((p) => p.user_id);
      const { data: us } = ids.length
        ? await supabase.from("tournament_users").select("id, full_name").in("id", ids)
        : { data: [] as any[] };
      const map = new Map((us || []).map((u: any) => [u.id, u]));
      setSamples(
        (ps || []).map((p) => ({
          id: p.id,
          name: (map.get(p.user_id) as any)?.full_name || "Trader",
          current_score: Number(p.current_score),
          metrics: {
            profit_pct: Number(p.profit_pct),
            winrate: Number(p.winrate),
            profit_factor: Number(p.profit_factor),
            sharpe: Number(p.sharpe),
            max_drawdown_pct: Number(p.max_drawdown_pct),
          },
        })),
      );
    })();
  }, [slug]);

  if (!tour) return <div className="text-muted-foreground">Cargando…</div>;

  const w = normalizeWeights(tour.scoring_weights);
  const rows: Array<{ key: string; label: string; weight: number; sign: string; desc: string }> = [
    { key: "profit", label: "Profit %", weight: w.profit, sign: "+", desc: "Crecimiento porcentual del balance respecto al inicial." },
    { key: "winrate", label: "Winrate %", weight: w.winrate, sign: "+", desc: "Porcentaje de trades cerrados en positivo." },
    { key: "profit_factor", label: "Profit Factor", weight: w.profit_factor, sign: "+", desc: "Ganancia bruta / pérdida bruta. >1 es positivo." },
    { key: "sharpe", label: "Sharpe", weight: w.sharpe, sign: "+", desc: "Media de retornos / desviación estándar. Mide consistencia." },
    { key: "drawdown", label: "Max Drawdown %", weight: w.drawdown, sign: "−", desc: "Peor caída desde un pico. Resta puntos." },
  ];

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button variant="ghost" asChild>
          <Link to={`/tournament/t/${slug}/live`}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver al podio
          </Link>
        </Button>
      </div>

      <Card className="border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/10 via-bullfy-blue/5 to-transparent">
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            ¿Cómo se calcula el ranking?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <p className="text-sm text-muted-foreground">
            En <span className="font-semibold text-foreground">{tour.name}</span> el score de cada participante es una
            suma ponderada de cinco métricas calculadas desde MT5. Mismo cálculo para todos, sin excepciones.
          </p>

          {/* Fórmula */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="text-xs uppercase tracking-widest text-primary font-bold mb-2">Fórmula</div>
            <div className="font-mono text-xs sm:text-sm leading-relaxed break-words">
              Score = <span className="text-emerald-500">{w.profit}</span>·Profit%
              {" + "}<span className="text-emerald-500">{w.winrate}</span>·Winrate
              {" + "}<span className="text-emerald-500">{w.profit_factor}</span>·ProfitFactor
              {" + "}<span className="text-emerald-500">{w.sharpe}</span>·Sharpe
              {" − "}<span className="text-red-500">{w.drawdown}</span>·MaxDrawdown%
            </div>
          </div>

          {/* Tabla de pesos */}
          <div>
            <h3 className="text-sm font-bold mb-2">Pesos de este torneo</h3>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-3 py-2">Métrica</th>
                    <th className="text-right px-3 py-2">Peso</th>
                    <th className="text-left px-3 py-2 hidden sm:table-cell">Significado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className="border-t border-border">
                      <td className="px-3 py-2 font-semibold">{r.label}</td>
                      <td className={`px-3 py-2 text-right font-mono ${r.sign === "−" ? "text-red-500" : "text-emerald-500"}`}>
                        {r.sign}{r.weight}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{r.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              La suma de los pesos no tiene que ser 1: el score es absoluto y comparable entre participantes del mismo torneo.
            </p>
            <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
              <div className="font-semibold text-amber-500 mb-1">Regla especial: participantes sin trades</div>
              <div className="text-muted-foreground">
                Los traders que <span className="font-semibold text-foreground">no abren ninguna operación</span> durante el torneo quedan automáticamente al final del ranking, por debajo de cualquier participante que sí haya operado (incluso con pérdidas). El objetivo es premiar a quien compite, no a quien observa.
              </div>
            </div>
          </div>

          {/* Ejemplo real */}
          {samples.length > 0 && (
            <div>
              <h3 className="text-sm font-bold mb-2">Ejemplo con los líderes actuales</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {samples.map((s, i) => {
                  const items = computeBreakdown(tour.scoring_weights, s.metrics);
                  return (
                    <div key={s.id} className="rounded-xl border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-bold">#{i + 1} {s.name}</div>
                        <div className="font-mono font-bold text-primary">Score {s.current_score.toFixed(2)}</div>
                      </div>
                      <ScoreBreakdown
                        weights={tour.scoring_weights}
                        metrics={s.metrics}
                        totalScore={s.current_score}
                        variant="full"
                      />
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {items
                          .map((b) => `${b.shortLabel}: ${b.value.toFixed(2)} × ${b.isPenalty ? "−" : ""}${b.weight} = ${formatContribution(b.contribution)}`)
                          .join("  ·  ")}
                      </div>
                    </div>
                  );
                })}
              </div>
              {samples.length === 2 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Por eso el #1 no es siempre quien más profit tiene: si su drawdown es alto o su consistencia baja, otro
                  puede superarlo aun con menos ganancia.
                </p>
              )}
            </div>
          )}

          {/* FAQ */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold">Preguntas frecuentes</h3>
            <Faq q="¿Por qué no gana siempre el de más profit?">
              Porque el score también valora consistencia (Sharpe), eficiencia (Profit Factor), aciertos (Winrate) y
              penaliza el peor drawdown. Un trader estable con +6% puede superar a otro con +10% y caídas grandes.
            </Faq>
            <Faq q="¿Cómo se calcula el drawdown?">
              Recorremos los trades cerrados en orden. Cada vez que el equity supera el máximo anterior, ese pasa a ser
              el pico. El drawdown es la mayor caída porcentual desde un pico hasta el siguiente mínimo.
            </Faq>
            <Faq q="¿Cada cuánto se actualiza?">
              El motor consulta MT5 y recalcula score cada minuto mientras el torneo está en curso. La tabla en vivo se
              sincroniza en tiempo real con cada cambio.
            </Faq>
            <Faq q="¿Quién define los pesos?">
              El organizador del torneo, antes de que arranque. Una vez iniciado no se modifican.
            </Faq>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 pt-2">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-semibold text-emerald-500">Auditable</div>
                <div className="text-muted-foreground">Misma fórmula y mismos datos MT5 para todos.</div>
              </div>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-start gap-2">
              <Clock className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-semibold text-primary">Tiempo real</div>
                <div className="text-muted-foreground">Sincronización cada minuto desde MT5.</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="rounded-lg border border-border p-3 group">
      <summary className="cursor-pointer text-sm font-semibold list-none flex items-center justify-between">
        {q}
        <span className="text-muted-foreground group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{children}</p>
    </details>
  );
}
