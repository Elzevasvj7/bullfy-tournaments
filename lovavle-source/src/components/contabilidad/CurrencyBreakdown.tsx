import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type CurrencyItem = { amount_original: number | null | undefined; currency_original: string | null | undefined };

export function buildCurrencyBreakdown(items: CurrencyItem[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const it of items) {
    const cur = (it?.currency_original || "").toUpperCase();
    const amt = Number(it?.amount_original || 0);
    if (!cur || !amt) continue;
    m[cur] = (m[cur] || 0) + amt;
  }
  return m;
}

export function formatCurrencyBreakdown(b: Record<string, number>): string {
  const entries = Object.entries(b).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return "";
  return entries
    .map(([cur, amt]) => `${amt.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${cur}`)
    .join(" · ");
}

interface Props {
  items: CurrencyItem[];
  label?: string;
  className?: string;
}

export function CurrencyBreakdown({ items, label = "Desglose por moneda", className }: Props) {
  const b = buildCurrencyBreakdown(items);
  const text = formatCurrencyBreakdown(b);
  if (!text) return null;
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className={`inline-flex items-center justify-center text-muted-foreground hover:text-foreground ml-1.5 align-middle rounded-full ${className ?? ""}`}
            aria-label={label}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-xs">
            <div className="font-semibold mb-1">{label}</div>
            <div className="leading-relaxed">{text}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default CurrencyBreakdown;
