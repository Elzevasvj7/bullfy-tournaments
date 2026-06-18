import { useEffect, useRef } from "react";
import { init, dispose, type Chart } from "klinecharts";

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  turnover?: number;
}

interface ChartPanelProps {
  symbol: string;
  timeframe: string;
  candles?: Candle[];
  indicators?: string[];
}

const PRECISION_BY_SYMBOL = (s: string) => (s?.includes("JPY") ? 3 : 5);

// Genera velas dummy mientras conectamos al feed real
function generateDummyCandles(symbol: string, count = 200): Candle[] {
  const out: Candle[] = [];
  const now = Date.now();
  const step = 15 * 60 * 1000; // M15
  let price = symbol?.includes("BTC") ? 65000 : symbol?.includes("JPY") ? 150 : 1.08;
  const vol = symbol?.includes("BTC") ? 800 : symbol?.includes("JPY") ? 0.4 : 0.0015;
  for (let i = count - 1; i >= 0; i--) {
    const ts = now - i * step;
    const open = price;
    const change = (Math.random() - 0.5) * vol;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * (vol / 2);
    const low = Math.min(open, close) - Math.random() * (vol / 2);
    out.push({
      timestamp: ts,
      open,
      high,
      low,
      close,
      volume: Math.round(Math.random() * 1000 + 100),
    });
    price = close;
  }
  return out;
}

export default function ChartPanel({ symbol, timeframe, candles, indicators = ["MA", "VOL"] }: ChartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = init(containerRef.current, {
      styles: {
        grid: { horizontal: { color: "hsl(var(--border))" }, vertical: { color: "hsl(var(--border))" } },
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
            last: {
              upColor: "hsl(142 71% 45%)",
              downColor: "hsl(0 84% 60%)",
            },
          },
        },
        xAxis: { axisLine: { color: "hsl(var(--border))" }, tickText: { color: "hsl(var(--muted-foreground))" } },
        yAxis: { axisLine: { color: "hsl(var(--border))" }, tickText: { color: "hsl(var(--muted-foreground))" } },
      },
    });
    chartRef.current = chart ?? null;
    return () => {
      if (containerRef.current) dispose(containerRef.current);
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c: any = chart;
    c.setPrecision?.({ price: PRECISION_BY_SYMBOL(symbol), volume: 0 });
    const data = candles?.length ? candles : generateDummyCandles(symbol);
    c.applyNewData?.(data);
    indicators.forEach((ind) => {
      try {
        if (ind === "VOL") c.createIndicator?.("VOL", false, { id: "vol_pane" });
        else c.createIndicator?.(ind, true);
      } catch {
        /* noop */
      }
    });
  }, [symbol, timeframe, candles, indicators]);

  return (
    <div className="relative h-full w-full">
      <div className="absolute left-3 top-2 z-10 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono font-semibold text-foreground">{symbol}</span>
        <span className="rounded bg-muted px-1.5 py-0.5">{timeframe}</span>
        <span className="text-[10px] opacity-60">(datos demo)</span>
      </div>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
