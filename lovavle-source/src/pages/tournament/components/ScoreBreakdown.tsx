import { motion } from "framer-motion";
import { Info, AlertTriangle } from "lucide-react";
import { computeBreakdown, formatContribution, isNoTradesScore, type ScoreMetrics } from "@/lib/tournamentScore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  weights: any;
  metrics: Partial<ScoreMetrics>;
  totalScore: number;
  variant?: "podium" | "row" | "full";
  tradesCount?: number;
}

const colorFor = (n: number) =>
  n > 0 ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10"
       : n < 0 ? "text-red-500 border-red-500/30 bg-red-500/10"
       : "text-muted-foreground border-border bg-muted/20";

export default function ScoreBreakdown({ weights, metrics, totalScore, variant = "row", tradesCount }: Props) {
  const noTrades = (tradesCount !== undefined && tradesCount === 0) || isNoTradesScore(totalScore);

  if (noTrades) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs">
          <div className="font-semibold text-amber-500">Sin trades cerrados</div>
          <div className="text-muted-foreground">
            Regla del torneo: los participantes que no abren operaciones quedan al final del ranking, por debajo de cualquiera que sí haya operado.
          </div>
        </div>
      </div>
    );
  }

  const items = computeBreakdown(weights, metrics);

  if (variant === "podium") {
    return (
      <div className="flex flex-wrap gap-1 justify-center max-w-[140px]">
        {items.map((b) => (
          <TooltipProvider key={b.key} delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${colorFor(b.contribution)}`}>
                  {b.shortLabel} {formatContribution(b.contribution)}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <div className="font-semibold">{b.label}</div>
                <div className="font-mono">
                  {b.value.toFixed(2)} × {b.isPenalty ? "−" : ""}{b.weight} = {formatContribution(b.contribution)}
                </div>
                <div className="text-muted-foreground max-w-[200px] mt-1">{b.description}</div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    );
  }

  // Stacked bar normalizada para variant="row" y "full"
  const totalAbs = items.reduce((s, b) => s + Math.abs(b.contribution), 0) || 1;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] sm:text-xs">
        <span className="text-muted-foreground uppercase tracking-wider">Score = suma ponderada</span>
        <span className="font-mono font-bold text-primary">Total {totalScore.toFixed(2)}</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden border border-border bg-muted/20">
        {items.map((b) => {
          const width = (Math.abs(b.contribution) / totalAbs) * 100;
          if (width < 0.5) return null;
          return (
            <motion.div
              key={b.key}
              initial={{ width: 0 }}
              animate={{ width: `${width}%` }}
              transition={{ duration: 0.5 }}
              className={b.contribution >= 0 ? "bg-emerald-500/80" : "bg-red-500/80"}
              title={`${b.label}: ${formatContribution(b.contribution)}`}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[10px] sm:text-xs">
        {items.map((b) => (
          <div key={b.key} className={`rounded border px-2 py-1 ${colorFor(b.contribution)}`}>
            <div className="flex items-center justify-between gap-1">
              <span className="font-semibold">{b.label}</span>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 opacity-60 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs max-w-[220px]">
                    {b.description}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="font-mono mt-0.5">
              <span className="opacity-70">{b.value.toFixed(2)}</span>
              <span className="opacity-50"> × {b.isPenalty ? "−" : ""}{b.weight}</span>
            </div>
            <div className="font-mono font-bold">{formatContribution(b.contribution)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
