import { subDays, differenceInDays } from "date-fns";

export const fmtUSD = (n: number | string | null | undefined) => {
  if (n === null || n === undefined || n === "") return "—";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (Number.isNaN(num)) return String(n);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(num);
};

export const fmtNum = (n: number | string | null | undefined) => {
  if (n === null || n === undefined || n === "") return "—";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (Number.isNaN(num)) return String(n);
  return new Intl.NumberFormat("en-US").format(num);
};

export const pct = (current: number, prev: number) => {
  if (!prev) return current > 0 ? 100 : 0;
  return ((current - prev) / prev) * 100;
};

// Given a current range, return the previous range of equal length
export function getPreviousRange(from?: Date, to?: Date): { from?: Date; to?: Date } {
  if (!from || !to) return {};
  const days = differenceInDays(to, from) + 1;
  return { from: subDays(from, days), to: subDays(to, 1) };
}

// Best-effort: extract array of rows from various ATFX response shapes
export function extractRows(resp: any): any[] {
  if (!resp) return [];
  const d = resp.data ?? resp;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.results)) return d.results;
  if (Array.isArray(d?.rows)) return d.rows;
  return [];
}

export function sumField(rows: any[], field: string): number {
  return rows.reduce((acc, r) => {
    const v = parseFloat(r?.[field]);
    return acc + (Number.isFinite(v) ? v : 0);
  }, 0);
}
