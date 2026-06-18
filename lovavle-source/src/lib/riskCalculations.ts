/**
 * Risk calculations for the live stream Risk Calculator overlay.
 *
 * Formulas (standard Forex/CFD risk management):
 *   riskUsd        = balance * (riskPercent / 100)
 *   pipSize        = (digits === 3 || digits === 5) ? tickSize * 10 : tickSize
 *   pipsPerTick    = pipSize / tickSize
 *   pipValuePerLot = pipsPerTick * tickValue
 *   lotSize        = riskUsd / (stopLossPips * pipValuePerLot)
 *   stopLossPips   = riskUsd / (lotSize * pipValuePerLot)
 *   takeProfitPips = stopLossPips * rrRatio
 *   stopLossPrice  = entry - sign * stopLossPips * pipSize
 *   takeProfitPrice= entry + sign * takeProfitPips * pipSize
 *
 * Inputs come from broker_symbols (digits, tickSize, tickValue, contractSize).
 */

export interface SymbolSpec {
  symbol: string;
  digits: number;
  tickSize: number;
  tickValue: number;
  contractSize: number;
}

export interface RiskInputs {
  balance: number;
  riskPercent: number;
  rrRatio: number;
  entryPrice: number;
  side: "buy" | "sell";
  /** Provide either lotSize OR stopLossPips. The missing one will be computed. */
  lotSize?: number;
  stopLossPips?: number;
  spec: SymbolSpec;
}

export interface RiskResult {
  riskUsd: number;
  pipSize: number;
  pipValuePerLot: number;
  lotSize: number;
  stopLossPips: number;
  takeProfitPips: number;
  stopLossPrice: number;
  takeProfitPrice: number;
}

export const computePipSize = (spec: SymbolSpec): number => {
  if (!spec.tickSize || spec.tickSize <= 0) return 0;
  // 5/3 digits FX → 1 pip = 10 ticks. Otherwise 1 pip = 1 tick (metals, indices, crypto).
  const isFx = spec.digits === 3 || spec.digits === 5;
  return isFx ? spec.tickSize * 10 : spec.tickSize;
};

export const computePipValuePerLot = (spec: SymbolSpec): number => {
  const pipSize = computePipSize(spec);
  if (!pipSize || !spec.tickSize || !spec.tickValue) return 0;
  const pipsPerTick = pipSize / spec.tickSize;
  return pipsPerTick * spec.tickValue;
};

export const calculateRisk = (inp: RiskInputs): RiskResult | null => {
  const { balance, riskPercent, rrRatio, entryPrice, side, spec } = inp;
  // entryPrice is OPTIONAL — without it we still compute risk/lot/pips, just not SL/TP prices.
  if (!(balance > 0) || !(riskPercent > 0) || !(rrRatio > 0)) return null;
  const pipSize = computePipSize(spec);
  const pipValuePerLot = computePipValuePerLot(spec);
  if (!pipSize || !pipValuePerLot) return null;

  const riskUsd = balance * (riskPercent / 100);

  let lotSize = inp.lotSize ?? 0;
  let stopLossPips = inp.stopLossPips ?? 0;

  if (stopLossPips > 0 && !(lotSize > 0)) {
    lotSize = riskUsd / (stopLossPips * pipValuePerLot);
  } else if (lotSize > 0 && !(stopLossPips > 0)) {
    stopLossPips = riskUsd / (lotSize * pipValuePerLot);
  } else if (!(stopLossPips > 0) && !(lotSize > 0)) {
    return null;
  }

  const takeProfitPips = stopLossPips * rrRatio;
  const sign = side === "buy" ? 1 : -1;
  const hasEntry = entryPrice > 0;
  const stopLossPrice = hasEntry ? entryPrice - sign * stopLossPips * pipSize : 0;
  const takeProfitPrice = hasEntry ? entryPrice + sign * takeProfitPips * pipSize : 0;
  const dp = spec.digits || 5;

  return {
    riskUsd,
    pipSize,
    pipValuePerLot,
    lotSize: Math.max(0, +lotSize.toFixed(2)),
    stopLossPips: Math.max(0, +stopLossPips.toFixed(1)),
    takeProfitPips: Math.max(0, +takeProfitPips.toFixed(1)),
    stopLossPrice: hasEntry ? +stopLossPrice.toFixed(dp) : 0,
    takeProfitPrice: hasEntry ? +takeProfitPrice.toFixed(dp) : 0,
  };
};

export const RISK_PRESETS = [0.5, 1, 2, 3, 5];
export const RR_PRESETS = [1, 1.5, 2, 3];
