export interface SpreadReferenceRow {
  raw: number;
  dolares_ib_original: number;
  spread_estandar: number;
  ajuste_manual?: number | null;
}

const toNumber = (value: number | null | undefined, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export const getManualSpreadAdjustment = (ajusteManual?: number | null) =>
  toNumber(ajusteManual, 0);

export const calculateReferenceStandardSpread = (
  row: Pick<SpreadReferenceRow, "raw" | "dolares_ib_original" | "ajuste_manual">,
  brokerGain: number,
) => toNumber(row.raw) + toNumber(brokerGain) + toNumber(row.dolares_ib_original) + getManualSpreadAdjustment(row.ajuste_manual);

export const calculateRebateClientSpread = (row: SpreadReferenceRow, nuevoDolarIb: number) => {
  const diff = toNumber(nuevoDolarIb) - toNumber(row.dolares_ib_original);
  return {
    diff,
    nuevoSpread: toNumber(row.spread_estandar) + diff,
  };
};

export const calculateHybridClientSpread = (row: SpreadReferenceRow, brokerGain: number, nuevoBullfy: number) => {
  const diff = toNumber(nuevoBullfy) - toNumber(brokerGain);
  return {
    diff,
    nuevoSpread: toNumber(row.spread_estandar) + diff,
  };
};
