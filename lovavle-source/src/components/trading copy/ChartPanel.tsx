import { useEffect, useRef, type MutableRefObject } from "react";
import { init, dispose, type Chart, type KLineData, type PeriodType } from "klinecharts";

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  turnover?: number;
}

// Ref compartido de ticks vivos por símbolo (lo llena useBridgeTicks).
export type LiveTickRef = MutableRefObject<Record<string, { bid: number; timeMs: number }>>;

interface ChartPanelProps {
  symbol: string;
  timeframe: string;
  candles?: Candle[];
  indicators?: string[];
  // Si se pasa, la vela en formación se mueve con los ticks (estilo MT5: bid).
  tickRef?: LiveTickRef;
}

// Segundos por temporalidad (para bucketizar la vela viva), igual que el prototipo.
const TF_SECONDS: Record<string, number> = { M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400, D1: 86400 };

const PRECISION_BY_SYMBOL = (s: string) => {
  const u = (s || "").toUpperCase();
  if (u.includes("JPY")) return 3;
  if (u.includes("XAU") || u.includes("BTC")) return 2;
  return 5;
};

// Mapea el timeframe del terminal (M1, M15, H4, D1...) al Period de klinecharts v10.
const periodFor = (tf: string): { type: PeriodType; span: number } => {
  const m = /^([A-Za-z])(\d+)$/.exec((tf || "M15").trim());
  const unit = (m?.[1] || "M").toUpperCase();
  const span = Number(m?.[2] || 15);
  switch (unit) {
    case "M": return { type: "minute", span };
    case "H": return { type: "hour", span };
    case "D": return { type: "day", span };
    case "W": return { type: "week", span };
    default: return { type: "minute", span: 15 };
  }
};

// Genera velas demo mientras no hay feed real (o la cuenta no es Bridge).
function generateDummyCandles(symbol: string, count = 200): Candle[] {
  const out: Candle[] = [];
  const now = 1_700_000_000_000; // base fija (Date.now no disponible en algunos entornos de build)
  const step = 15 * 60 * 1000; // M15
  const u = (symbol || "").toUpperCase();
  let price = u.includes("BTC") ? 65000 : u.includes("XAU") ? 2300 : u.includes("JPY") ? 150 : 1.08;
  const vol = u.includes("BTC") ? 800 : u.includes("XAU") ? 6 : u.includes("JPY") ? 0.4 : 0.0015;
  for (let i = count - 1; i >= 0; i--) {
    const ts = now - i * step;
    const open = price;
    const change = (Math.sin(i / 7) + (i % 5) / 5 - 0.5) * vol;
    const close = open + change;
    const high = Math.max(open, close) + (Math.abs(Math.cos(i / 3)) * vol) / 2;
    const low = Math.min(open, close) - (Math.abs(Math.sin(i / 4)) * vol) / 2;
    out.push({ timestamp: ts, open, high, low, close, volume: 100 + (i % 50) * 7 });
    price = close;
  }
  return out;
}

export default function ChartPanel({ symbol, timeframe, candles, indicators = ["MA", "VOL"], tickRef }: ChartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);
  // Callback de vela viva que entrega klinecharts (subscribeBar) + última vela en curso.
  const subscribeCbRef = useRef<((d: KLineData) => void) | null>(null);
  const lastBarRef = useRef<KLineData | null>(null);

  // Init/dispose una sola vez.
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = init(containerRef.current, {
      styles: {
        grid: { horizontal: { color: "rgba(255,255,255,0.06)" }, vertical: { color: "rgba(255,255,255,0.06)" } },
        candle: {
          bar: {
            upColor: "hsl(142 71% 45%)",
            downColor: "hsl(0 84% 60%)",
            upBorderColor: "hsl(142 71% 45%)",
            downBorderColor: "hsl(0 84% 60%)",
            upWickColor: "hsl(142 71% 45%)",
            downWickColor: "hsl(0 84% 60%)",
          },
          priceMark: {
            last: { upColor: "hsl(142 71% 45%)", downColor: "hsl(0 84% 60%)" },
          },
        },
        xAxis: { axisLine: { color: "rgba(255,255,255,0.12)" }, tickText: { color: "hsl(var(--muted-foreground))" } },
        yAxis: { axisLine: { color: "rgba(255,255,255,0.12)" }, tickText: { color: "hsl(var(--muted-foreground))" } },
      },
    });
    chartRef.current = chart ?? null;

    // Indicadores: MA superpuesta en el panel de velas, VOL en panel inferior.
    if (chart) {
      try {
        indicators.forEach((ind) => {
          if (ind === "VOL") chart.createIndicator("VOL");
          else chart.createIndicator(ind, { pane: { id: "candle_pane" } });
        });
      } catch {
        /* noop */
      }
    }

    return () => {
      if (containerRef.current) dispose(containerRef.current);
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aplica símbolo, periodo y datos (v10: vía setDataLoader.getBars -> callback).
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const data = (candles?.length ? candles : generateDummyCandles(symbol)) as KLineData[];
    chart.setSymbol({ ticker: symbol || "—", pricePrecision: PRECISION_BY_SYMBOL(symbol), volumePrecision: 0 });
    chart.setPeriod(periodFor(timeframe));
    chart.setDataLoader({
      getBars: ({ callback }) => {
        callback(data);
        lastBarRef.current = data.length ? { ...data[data.length - 1] } : null;
      },
      // klinecharts entrega aquí el callback para empujar la vela en formación.
      subscribeBar: ({ callback }) => { subscribeCbRef.current = callback; },
      unsubscribeBar: () => { subscribeCbRef.current = null; },
    });
  }, [symbol, timeframe, candles]);

  // Vela viva: cada 250 ms leemos el último tick del símbolo y rolamos la vela
  // en formación (precio = bid, regla MT5). No re-renderiza al componente padre.
  useEffect(() => {
    if (!tickRef) return;
    const tfSec = TF_SECONDS[timeframe] ?? 60;
    const sym = (symbol || "").toUpperCase();
    const id = window.setInterval(() => {
      const cb = subscribeCbRef.current;
      const lb = lastBarRef.current;
      if (!cb || !lb) return;
      const tick = tickRef.current?.[sym];
      if (!tick || !Number.isFinite(tick.bid)) return;
      const tickSec = Math.floor(tick.timeMs / 1000);
      const bucketMs = (tickSec - (tickSec % tfSec)) * 1000;
      if (bucketMs < lb.timestamp) return; // tick más viejo que la vela actual
      const px = tick.bid;
      const bar: KLineData =
        bucketMs > lb.timestamp
          ? { timestamp: bucketMs, open: px, high: px, low: px, close: px, volume: 0 }
          : { ...lb, close: px, high: Math.max(lb.high, px), low: Math.min(lb.low, px) };
      lastBarRef.current = bar;
      try { cb(bar); } catch { /* noop */ }
    }, 250);
    return () => window.clearInterval(id);
  }, [symbol, timeframe, tickRef]);

  return (
    <div className="relative h-full w-full">
      <div className="absolute left-3 top-2 z-10 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono font-semibold text-foreground">{symbol}</span>
        <span className="rounded bg-muted px-1.5 py-0.5">{timeframe}</span>
        {!candles?.length && <span className="text-[10px] opacity-60">(datos demo)</span>}
      </div>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
