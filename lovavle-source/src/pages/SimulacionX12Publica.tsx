import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import logoBullfy from "@/assets/logo-bullfy-blue.svg";
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Target,
  TrendingUp,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Snapshot {
  id: string;
  code: string;
  simulation_type: string;
  inputs: any;
  results: any;
  ai_analysis: any | null;
  created_at: string;
}

const fmt = (n: number, d = 2) =>
  Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const PIP_VALUE_PER_LOT = 10;

const SimulacionX12Publica = () => {
  const { code } = useParams<{ code: string }>();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);
  const [pollAi, setPollAi] = useState(false);

  useEffect(() => {
    if (!code) return;
    let cancel = false;
    const load = async () => {
      const { data, error } = await supabase
        .from("simulation_snapshots")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      if (cancel) return;
      if (error || !data) {
        setErr("Simulación no encontrada");
        setLoading(false);
        return;
      }
      setSnap(data as Snapshot);
      setLoading(false);
      if (!data.ai_analysis) {
        setPollAi(true);
        // Idempotent trigger: function returns cached if already analyzed
        supabase.functions.invoke("analyze-simulation", {
          body: { snapshot_id: data.id },
        }).then(({ data: aiData, error: aiErr }) => {
          if (cancel) return;
          if (aiErr) {
            console.error("AI invoke error:", aiErr);
            setPollAi(false);
            return;
          }
          if ((aiData as any)?.ok === false) {
            console.error("AI failed:", (aiData as any).error);
            setPollAi(false);
            return;
          }
          if ((aiData as any)?.analysis) {
            setSnap((s) => (s ? { ...s, ai_analysis: (aiData as any).analysis } : s));
            setPollAi(false);
          }
        });
      }
    };
    load();
    return () => { cancel = true; };
  }, [code]);

  // Fallback poll (in case another session triggers it)
  useEffect(() => {
    if (!pollAi || !snap || snap.ai_analysis) return;
    let attempts = 0;
    const t = setInterval(async () => {
      attempts++;
      const { data } = await supabase
        .from("simulation_snapshots")
        .select("ai_analysis")
        .eq("id", snap.id)
        .maybeSingle();
      if (data?.ai_analysis) {
        setSnap((s) => (s ? { ...s, ai_analysis: data.ai_analysis } : s));
        setPollAi(false);
      } else if (attempts >= 30) {
        setPollAi(false);
      }
    }, 3000);
    return () => clearInterval(t);
  }, [pollAi, snap]);

  const chartData = useMemo(() => {
    if (!snap) return [] as any[];
    const { inputs, results } = snap;
    const points = 41;
    const range = Math.max(50, Math.abs(inputs.pips) * 2);
    const step = (range * 2) / (points - 1);
    return Array.from({ length: points }, (_, i) => {
      const p = -range + step * i;
      const clientPnl = inputs.lotSize * p * PIP_VALUE_PER_LOT - results.spreadCost;
      const bbookPnl = -(results.bbookLots * p * PIP_VALUE_PER_LOT);
      const abookPnl = results.lpLotsScaled * p * PIP_VALUE_PER_LOT;
      const brokerPnl = bbookPnl + abookPnl + results.brokerSpreadRevenue;
      return { pips: p, cliente: Math.round(clientPnl), broker: Math.round(brokerPnl) };
    });
  }, [snap]);

  const slides = useMemo(() => {
    if (!snap) return [];
    const { inputs, results, ai_analysis } = snap;
    const profitable = ai_analysis?.is_profitable;

    return [
      // 1. Cover
      {
        key: "cover",
        node: (
          <div className="flex flex-col items-center justify-center h-full text-center px-12">
            <img src={logoBullfy} alt="Bullfy" className="w-32 mb-12 opacity-90" />
            <div className="text-[#146EF5] text-sm font-mono uppercase tracking-[0.3em] mb-4">Bullfy Simulations</div>
            <h1 className="text-6xl font-bold mb-6 leading-tight" style={{ fontFamily: "Figtree, sans-serif" }}>
              Cuentas <span className="text-[#146EF5]">x12</span>
            </h1>
            <p className="text-xl text-white/70 max-w-2xl mb-12">
              Modelo de apalancamiento artificial controlado — análisis matemático completo y defensa de cada cálculo.
            </p>
            <div className="flex items-center gap-6 text-xs text-white/50 font-mono">
              <span>CÓDIGO: {snap.code.toUpperCase()}</span>
              <span>•</span>
              <span>{new Date(snap.created_at).toLocaleDateString("es-ES")}</span>
            </div>
          </div>
        ),
      },
      // 2. Concept
      {
        key: "concept",
        node: (
          <div className="px-16 py-12 h-full flex flex-col justify-center max-w-5xl mx-auto">
            <div className="text-[#146EF5] text-xs font-mono uppercase tracking-widest mb-3">Concepto</div>
            <h2 className="text-4xl font-bold mb-8">¿Qué son las Cuentas x12?</h2>
            <div className="space-y-6 text-lg text-white/80 leading-relaxed">
              <p>
                Es un producto donde el cliente recibe un <strong className="text-[#146EF5]">balance percibido 12x mayor</strong> a su depósito real.
              </p>
              <p>
                <strong className="text-white">No es apalancamiento real.</strong> Es un modelo controlado donde el broker reduce su exposición al LP escalando proporcionalmente el volumen ejecutado.
              </p>
              <p>
                El riesgo del broker queda <strong className="text-[#146EF5]">acotado al depósito original + 20% buffer</strong>, mientras el cliente percibe operar con capital amplificado.
              </p>
            </div>
          </div>
        ),
      },
      // 3. Inputs
      {
        key: "inputs",
        node: (
          <div className="px-16 py-12 h-full flex flex-col max-w-5xl mx-auto">
            <div className="text-[#146EF5] text-xs font-mono uppercase tracking-widest mb-3">Parámetros de Entrada</div>
            <h2 className="text-4xl font-bold mb-10">Configuración de la simulación</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                ["Depósito real", `$${fmt(inputs.deposit, 0)}`],
                ["Tamaño de lote", fmt(inputs.lotSize, 2)],
                ["Movimiento de precio", `${inputs.pips} pips`],
                ["Apalancamiento cliente", `1:${inputs.clientLeverage}`],
                ["Apalancamiento LP", `1:${inputs.lpLeverage}`],
                ["Spread por lote", `$${fmt(inputs.spreadPerLot, 0)}`],
                ["Rebate IB por lote", `$${fmt(inputs.rebatePerLot, 1)}`],
                ["Smart Hedging", inputs.smartHedging ? `${inputs.bbookPercent}% B-Book` : "Desactivado"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-sm text-white/60">{k}</span>
                  <span className="text-lg font-mono font-bold text-[#146EF5]">{v}</span>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      // 4-7. Cálculos defendidos
      {
        key: "calc-balance",
        node: (
          <CalcSlide
            badge="Cálculo 1 / 6"
            title="Balance Mostrado al Cliente"
            formula="Balance percibido = Depósito × 12"
            substitution={`${fmt(inputs.deposit, 0)} × 12`}
            result={`$${fmt(results.displayedBalance, 0)}`}
            explanation="El factor de amplificación 12x es la base del producto. Esto define cuánto capital ve el cliente para tomar decisiones de tamaño de posición. Es un valor visual; el dinero real sigue siendo el depósito."
          />
        ),
      },
      {
        key: "calc-scaling",
        node: (
          <CalcSlide
            badge="Cálculo 2 / 6"
            title="Factor de Escala A-Book"
            formula="Factor = Depósito / Balance mostrado = 1/12"
            substitution={`${fmt(inputs.deposit, 0)} / ${fmt(results.displayedBalance, 0)}`}
            result={`${(results.scalingFactor * 100).toFixed(2)}%`}
            explanation="Por cada lote que el cliente ejecuta sobre su balance percibido, el broker solo envía al LP el 8.33% del volumen. Esto mantiene el riesgo real del broker proporcional al capital depositado."
          />
        ),
      },
      {
        key: "calc-lp",
        node: (
          <CalcSlide
            badge="Cálculo 3 / 6"
            title="Lotes Enviados al Liquidity Provider"
            formula="Lotes LP = Lotes A-Book × Factor escala"
            substitution={`${fmt(results.abookLots, 4)} × ${results.scalingFactor.toFixed(4)}`}
            result={fmt(results.lpLotsScaled, 4)}
            explanation="El LP solo ve este volumen reducido. Por eso el broker puede ofrecer balances amplificados sin necesitar capital adicional para cubrir spreads ni margen externo."
          />
        ),
      },
      {
        key: "calc-pnl-client",
        node: (
          <CalcSlide
            badge="Cálculo 4 / 6"
            title="P&L Cliente"
            formula="P&L = Lotes × Pips × $10/pip − Spread"
            substitution={`(${inputs.lotSize} × ${inputs.pips} × 10) − ${fmt(results.spreadCost, 2)}`}
            result={`$${fmt(results.clientNetPnl, 2)}`}
            explanation="Cada pip de EURUSD vale $10 USD por lote estándar. El cliente paga el spread como costo de transacción, lo cual representa el revenue principal del broker."
          />
        ),
      },
      {
        key: "calc-pnl-broker",
        node: (
          <CalcSlide
            badge="Cálculo 5 / 6"
            title="P&L Real del Broker"
            formula="P&L Broker = P&L B-Book + P&L A-Book + Spread neto"
            substitution={`${fmt(results.bbookPnl, 2)} + ${fmt(results.abookPnl, 2)} + ${fmt(results.brokerSpreadRevenue, 2)}`}
            result={`$${fmt(results.brokerRealPnl + results.brokerSpreadRevenue, 2)}`}
            explanation="El broker mezcla revenue por spread (post-rebate IB) con resultado neto de cobertura. El P&L del A-Book está escalado, por lo que las pérdidas/ganancias del LP son fracciones del movimiento del cliente."
          />
        ),
      },
      {
        key: "calc-stopout",
        node: (
          <CalcSlide
            badge="Cálculo 6 / 6"
            title="Drawdown y Stop-Out"
            formula="DD% = (Pérdida / Balance mostrado) × 100   |   Stop-out @ 10%"
            substitution={`(${fmt(results.drawdownUsd, 2)} / ${fmt(results.displayedBalance, 0)}) × 100`}
            result={`${results.drawdownPct.toFixed(2)}%`}
            explanation="El cierre forzado al 10% del balance percibido equivale aproximadamente al 120% del depósito real, alineado al buffer de riesgo del broker. Protege contra pérdidas que excedan el capital del cliente."
          />
        ),
      },
      // 8. Chart
      {
        key: "chart",
        node: (
          <div className="px-16 py-12 h-full flex flex-col max-w-6xl mx-auto">
            <div className="text-[#146EF5] text-xs font-mono uppercase tracking-widest mb-3">Visualización</div>
            <h2 className="text-4xl font-bold mb-8">Curva P&L: Cliente vs Broker</h2>
            <div className="flex-1 bg-white/5 rounded-2xl p-6 border border-white/10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis dataKey="pips" stroke="#ffffff80" tick={{ fontSize: 12 }} label={{ value: "Pips", position: "insideBottom", offset: -5, fill: "#ffffff80" }} />
                  <YAxis stroke="#ffffff80" tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#062B63", border: "1px solid #146EF5", borderRadius: 8, color: "white" }} formatter={(v: number) => `$${fmt(v, 0)}`} />
                  <Legend />
                  <Line type="monotone" dataKey="cliente" name="P&L Cliente" stroke="#146EF5" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="broker" name="P&L Broker real" stroke="#f97316" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ),
      },
      // 9. AI Analysis
      {
        key: "ai-analysis",
        node: (
          <div className="px-16 py-12 h-full flex flex-col max-w-5xl mx-auto overflow-y-auto">
            <div className="text-[#146EF5] text-xs font-mono uppercase tracking-widest mb-3">Análisis IA</div>
            <h2 className="text-4xl font-bold mb-6">Veredicto de Rentabilidad</h2>
            {!ai_analysis ? (
              <div className="flex flex-col items-center justify-center flex-1 text-white/60">
                {pollAi ? (
                  <>
                    <Loader2 className="w-12 h-12 animate-spin mb-4 text-[#146EF5]" />
                    <p>Generando análisis con IA...</p>
                    <p className="text-xs text-white/40 mt-2">Esto puede tardar 20-40 segundos</p>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-12 h-12 mb-4 text-yellow-400" />
                    <p className="text-center">El análisis IA no está disponible.</p>
                    <button
                      onClick={() => window.location.reload()}
                      className="mt-4 px-4 py-2 rounded bg-[#146EF5] text-white text-sm hover:bg-[#146EF5]/80"
                    >
                      Reintentar
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className={`p-6 rounded-2xl border-2 mb-6 flex items-start gap-4 ${profitable ? "bg-green-500/10 border-green-500/40" : "bg-red-500/10 border-red-500/40"}`}>
                  {profitable ? (
                    <CheckCircle2 className="w-10 h-10 text-green-400 flex-shrink-0 mt-1" />
                  ) : (
                    <XCircle className="w-10 h-10 text-red-400 flex-shrink-0 mt-1" />
                  )}
                  <div>
                    <div className={`text-2xl font-bold mb-2 ${profitable ? "text-green-400" : "text-red-400"}`}>
                      {profitable ? "RENTABLE PARA EL BROKER" : "NO RENTABLE — REQUIERE AJUSTES"}
                    </div>
                    <div className="text-lg text-white/90">{ai_analysis.verdict}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <MiniStat label="Revenue/lote esperado" value={`$${fmt(ai_analysis.expected_revenue_per_lot_usd, 2)}`} />
                  <MiniStat label="Riesgo máx. broker" value={`$${fmt(ai_analysis.max_broker_risk_usd, 0)}`} />
                  <MiniStat label="Risk/Reward" value={fmt(ai_analysis.risk_reward_ratio, 2)} />
                </div>

                <div className="bg-white/5 rounded-xl p-5 border border-white/10 mb-4">
                  <div className="text-xs font-mono uppercase tracking-widest text-[#146EF5] mb-2">Resumen Ejecutivo</div>
                  <p className="text-white/85 leading-relaxed">{ai_analysis.executive_summary}</p>
                </div>

                <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                  <div className="text-xs font-mono uppercase tracking-widest text-[#146EF5] mb-3 flex items-center gap-2">
                    <Target className="w-3.5 h-3.5" /> Puntos Críticos
                  </div>
                  <ul className="space-y-2">
                    {ai_analysis.critical_points?.map((p: string, i: number) => (
                      <li key={i} className="flex items-start gap-3 text-white/85">
                        <span className="text-[#146EF5] font-mono">{String(i + 1).padStart(2, "0")}</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        ),
      },
      // 10. Recommended adjustments (if any)
      {
        key: "ai-adjustments",
        node: (
          <div className="px-16 py-12 h-full flex flex-col max-w-5xl mx-auto overflow-y-auto">
            <div className="text-[#146EF5] text-xs font-mono uppercase tracking-widest mb-3">Recomendaciones IA</div>
            <h2 className="text-4xl font-bold mb-2">
              {profitable ? "Optimizaciones Sugeridas" : "Ajustes para Rentabilizar"}
            </h2>
            <p className="text-white/60 mb-8">
              {profitable
                ? "Mejoras opcionales para maximizar el spread real del broker."
                : "Cambios concretos necesarios para que el modelo sea rentable."}
            </p>
            {!ai_analysis ? (
              <div className="flex items-center justify-center flex-1 text-white/60">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : ai_analysis.recommended_adjustments?.length === 0 ? (
              <div className="flex items-center gap-3 p-6 bg-green-500/10 border border-green-500/30 rounded-xl">
                <ShieldCheck className="w-8 h-8 text-green-400" />
                <p className="text-white/90">Configuración óptima — no se requieren ajustes.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {ai_analysis.recommended_adjustments?.map((adj: any, i: number) => (
                  <div key={i} className="p-5 bg-white/5 border border-white/10 rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full bg-[#146EF5]/20 border border-[#146EF5]/40 flex items-center justify-center text-[#146EF5] text-sm font-bold">
                        {i + 1}
                      </div>
                      <div className="text-lg font-bold">{adj.parameter}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div className="p-3 rounded bg-red-500/10 border border-red-500/20">
                        <div className="text-[10px] uppercase tracking-widest text-red-400 mb-1">Actual</div>
                        <div className="font-mono text-white/90">{adj.current}</div>
                      </div>
                      <div className="p-3 rounded bg-green-500/10 border border-green-500/20">
                        <div className="text-[10px] uppercase tracking-widest text-green-400 mb-1">Sugerido</div>
                        <div className="font-mono text-white/90">{adj.suggested}</div>
                      </div>
                    </div>
                    <p className="text-sm text-white/70">{adj.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ),
      },
      // 11. Scenarios
      {
        key: "ai-scenarios",
        node: (
          <div className="px-16 py-12 h-full flex flex-col max-w-5xl mx-auto">
            <div className="text-[#146EF5] text-xs font-mono uppercase tracking-widest mb-3">Escenarios</div>
            <h2 className="text-4xl font-bold mb-10">Análisis de Escenarios</h2>
            {!ai_analysis ? (
              <div className="flex items-center justify-center flex-1 text-white/60">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                <ScenarioCard icon={TrendingUp} color="green" title="Si el cliente gana" text={ai_analysis.scenario_analysis?.client_wins} />
                <ScenarioCard icon={AlertTriangle} color="red" title="Si el cliente pierde" text={ai_analysis.scenario_analysis?.client_loses} />
                <ScenarioCard icon={Zap} color="blue" title="Punto de equilibrio" text={ai_analysis.scenario_analysis?.breakeven} />
              </div>
            )}
          </div>
        ),
      },
      // 12. Closing
      {
        key: "closing",
        node: (
          <div className="flex flex-col items-center justify-center h-full text-center px-12">
            <img src={logoBullfy} alt="Bullfy" className="w-24 mb-8 opacity-90" />
            <div className="text-[#146EF5] text-xs font-mono uppercase tracking-widest mb-4">Conclusión</div>
            <h2 className="text-5xl font-bold mb-8 max-w-3xl leading-tight">
              Riesgo controlado, percepción amplificada
            </h2>
            <p className="text-xl text-white/70 max-w-2xl mb-12">
              El modelo x12 permite ofrecer balances atractivos manteniendo la exposición real del broker dentro del depósito del cliente.
            </p>
            <div className="text-xs text-white/40 font-mono">
              bullfytech.online · simulaciones/x12/{snap.code}
            </div>
          </div>
        ),
      },
    ];
  }, [snap, chartData]);

  const next = useCallback(() => setSlide((s) => Math.min(s + 1, slides.length - 1)), [slides.length]);
  const prev = useCallback(() => setSlide((s) => Math.max(s - 1, 0)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const goFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#062B63", color: "white", fontFamily: "Figtree, sans-serif" }}>
        <Loader2 className="w-10 h-10 animate-spin text-[#146EF5]" />
      </div>
    );
  }

  if (err || !snap) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "#062B63", color: "white", fontFamily: "Figtree, sans-serif" }}>
        <h1 className="text-3xl font-bold mb-4">Simulación no encontrada</h1>
        <p className="text-white/60">El código "{code}" no corresponde a ninguna simulación publicada.</p>
      </div>
    );
  }

  const current = slides[slide];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#062B63", color: "white", fontFamily: "Figtree, sans-serif" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10">
        <img src={logoBullfy} alt="Bullfy" className="h-6 opacity-80" />
        <div className="text-xs font-mono text-white/50">
          Slide {slide + 1} / {slides.length}
        </div>
        <button onClick={goFullscreen} className="p-2 rounded hover:bg-white/10 transition" aria-label="Pantalla completa">
          <Maximize className="w-4 h-4" />
        </button>
      </div>

      {/* Slide */}
      <div className="flex-1 relative overflow-hidden">
        <div key={current.key} className="absolute inset-0 animate-in fade-in slide-in-from-right-4 duration-300">
          {current.node}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
        <button onClick={prev} disabled={slide === 0} className="flex items-center gap-2 px-4 py-2 rounded hover:bg-white/10 disabled:opacity-30 transition">
          <ChevronLeft className="w-4 h-4" /> Anterior
        </button>
        <div className="flex gap-1">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className={`h-1 rounded-full transition-all ${i === slide ? "w-8 bg-[#146EF5]" : "w-2 bg-white/20 hover:bg-white/40"}`}
              aria-label={`Ir a slide ${i + 1}`}
            />
          ))}
        </div>
        <button onClick={next} disabled={slide === slides.length - 1} className="flex items-center gap-2 px-4 py-2 rounded hover:bg-white/10 disabled:opacity-30 transition">
          Siguiente <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Components
const CalcSlide = ({ badge, title, formula, substitution, result, explanation }: any) => (
  <div className="px-16 py-12 h-full flex flex-col max-w-5xl mx-auto justify-center">
    <div className="text-[#146EF5] text-xs font-mono uppercase tracking-widest mb-3">{badge}</div>
    <h2 className="text-4xl font-bold mb-10">{title}</h2>
    <div className="space-y-5">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-white/50 mb-2">Fórmula</div>
        <code className="block bg-white/5 border border-white/10 rounded-xl p-5 font-mono text-xl text-[#146EF5]">{formula}</code>
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-white/50 mb-2">Sustitución</div>
        <code className="block bg-white/5 border border-white/10 rounded-xl p-5 font-mono text-lg text-white/90">{substitution}</code>
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-white/50 mb-2">Resultado</div>
        <code className="block bg-[#146EF5]/15 border-2 border-[#146EF5]/40 rounded-xl p-5 font-mono text-3xl font-bold text-[#146EF5]">{result}</code>
      </div>
      <div className="pt-4 text-white/75 leading-relaxed text-base">{explanation}</div>
    </div>
  </div>
);

const MiniStat = ({ label, value }: { label: string; value: string }) => (
  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
    <div className="text-[10px] uppercase tracking-widest text-white/50 mb-2">{label}</div>
    <div className="text-xl font-mono font-bold text-[#146EF5]">{value}</div>
  </div>
);

const ScenarioCard = ({ icon: Icon, color, title, text }: any) => {
  const palette: any = {
    green: "border-green-500/30 bg-green-500/10 text-green-400",
    red: "border-red-500/30 bg-red-500/10 text-red-400",
    blue: "border-[#146EF5]/30 bg-[#146EF5]/10 text-[#146EF5]",
  };
  return (
    <div className={`p-5 rounded-xl border ${palette[color]}`}>
      <div className="flex items-center gap-3 mb-2">
        <Icon className="w-5 h-5" />
        <div className="font-bold text-base">{title}</div>
      </div>
      <p className="text-white/85 text-sm leading-relaxed">{text}</p>
    </div>
  );
};

export default SimulacionX12Publica;
