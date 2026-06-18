import { HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CalcTooltipProps {
  formula: string;
  substitution?: string;
  result?: string;
  explanation: string;
}

const CalcTooltip = ({ formula, substitution, result, explanation }: CalcTooltipProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground hover:text-primary transition-colors align-middle ml-1"
          aria-label="Ver explicación"
          onClick={(e) => e.stopPropagation()}
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-xs space-y-2" side="top">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Fórmula
          </div>
          <code className="block bg-secondary/70 rounded px-2 py-1 font-mono text-[11px] text-foreground">
            {formula}
          </code>
        </div>
        {substitution && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Sustitución
            </div>
            <code className="block bg-secondary/70 rounded px-2 py-1 font-mono text-[11px] text-foreground">
              {substitution}
            </code>
          </div>
        )}
        {result && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Resultado
            </div>
            <code className="block bg-primary/10 border border-primary/30 rounded px-2 py-1 font-mono text-[11px] text-primary font-bold">
              {result}
            </code>
          </div>
        )}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Explicación
          </div>
          <p className="text-[11px] leading-relaxed text-foreground">{explanation}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default CalcTooltip;
