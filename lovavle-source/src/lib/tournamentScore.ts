// Cálculo y desglose del score de torneos.
// Mantiene exactamente la misma fórmula que supabase/functions/tournament-engine-tick/index.ts
// para que lo que se ve en UI cuadre con lo que persiste el engine.

export type ScoreMetrics = {
  profit_pct: number;
  winrate: number;
  profit_factor: number;
  sharpe: number;
  max_drawdown_pct: number;
};

export type ScoreWeights = {
  profit: number;
  winrate: number;
  profit_factor: number;
  sharpe: number;
  drawdown: number;
};

export const DEFAULT_WEIGHTS: ScoreWeights = {
  profit: 0.5,
  winrate: 0.2,
  profit_factor: 0.15,
  sharpe: 0.1,
  drawdown: 0.05,
};

// Score centinela que el engine asigna a participantes sin trades cerrados,
// para forzarlos al final del ranking.
export const NO_TRADES_SCORE = -9999;
export const isNoTradesScore = (s: number) => s <= -9000;

export function normalizeWeights(raw: any): ScoreWeights {
  const w = raw || {};
  return {
    profit: Number(w.profit_pct ?? w.profit ?? DEFAULT_WEIGHTS.profit) || 0,
    winrate: Number(w.winrate ?? DEFAULT_WEIGHTS.winrate) || 0,
    profit_factor: Number(w.profit_factor ?? DEFAULT_WEIGHTS.profit_factor) || 0,
    sharpe: Number(w.sharpe ?? DEFAULT_WEIGHTS.sharpe) || 0,
    drawdown: Number(w.max_drawdown ?? w.drawdown ?? DEFAULT_WEIGHTS.drawdown) || 0,
  };
}

export type BreakdownItem = {
  key: "profit" | "winrate" | "profit_factor" | "sharpe" | "drawdown";
  label: string;
  shortLabel: string;
  weight: number;
  value: number;
  contribution: number;
  isPenalty: boolean;
  description: string;
};

export function computeBreakdown(rawWeights: any, m: Partial<ScoreMetrics>): BreakdownItem[] {
  const w = normalizeWeights(rawWeights);
  const profit_pct = Number(m.profit_pct ?? 0);
  const winrate = Number(m.winrate ?? 0);
  const profit_factor = Number(m.profit_factor ?? 0);
  const sharpe = Number(m.sharpe ?? 0);
  const max_drawdown_pct = Number(m.max_drawdown_pct ?? 0);

  return [
    {
      key: "profit",
      label: "Profit %",
      shortLabel: "Profit",
      weight: w.profit,
      value: profit_pct,
      contribution: w.profit * profit_pct,
      isPenalty: false,
      description: "Crecimiento porcentual del balance respecto al inicial.",
    },
    {
      key: "winrate",
      label: "Winrate %",
      shortLabel: "Win",
      weight: w.winrate,
      value: winrate,
      contribution: w.winrate * winrate,
      isPenalty: false,
      description: "Porcentaje de trades cerrados en positivo.",
    },
    {
      key: "profit_factor",
      label: "Profit Factor",
      shortLabel: "PF",
      weight: w.profit_factor,
      value: profit_factor,
      contribution: w.profit_factor * profit_factor,
      isPenalty: false,
      description: "Ganancia bruta dividida entre pérdida bruta. >1 es positivo.",
    },
    {
      key: "sharpe",
      label: "Sharpe",
      shortLabel: "Sh",
      weight: w.sharpe,
      value: sharpe,
      contribution: w.sharpe * sharpe,
      isPenalty: false,
      description: "Consistencia: media de retornos dividida entre desviación estándar.",
    },
    {
      key: "drawdown",
      label: "Max Drawdown %",
      shortLabel: "DD",
      weight: w.drawdown,
      value: max_drawdown_pct,
      contribution: -w.drawdown * max_drawdown_pct,
      isPenalty: true,
      description: "Peor caída acumulada desde un pico. Penaliza el score.",
    },
  ];
}

export function computeScore(rawWeights: any, m: Partial<ScoreMetrics>): number {
  return computeBreakdown(rawWeights, m).reduce((s, b) => s + b.contribution, 0);
}

// Devuelve la métrica con mayor contribución positiva (o la menos negativa si todo es negativo).
export function topDriver(breakdown: BreakdownItem[]): BreakdownItem | null {
  if (!breakdown.length) return null;
  return [...breakdown].sort((a, b) => b.contribution - a.contribution)[0];
}

export function formatContribution(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}`;
}
