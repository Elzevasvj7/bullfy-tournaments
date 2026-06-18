import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Minus, LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string | number;
  prevValue?: string | number;
  delta?: number; // percentage change
  icon?: LucideIcon;
  iconColor?: string;
  loading?: boolean;
  format?: (v: number | string) => string;
}

export default function KPICard({ label, value, prevValue, delta, icon: Icon, iconColor, loading, format }: Props) {
  const positive = (delta ?? 0) > 0;
  const negative = (delta ?? 0) < 0;
  const display = typeof value === "number" && format ? format(value) : value;
  const displayPrev = prevValue !== undefined && typeof prevValue === "number" && format ? format(prevValue) : prevValue;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-mono">{label}</p>
            <p className="text-2xl font-bold mt-2">{loading ? "—" : display}</p>
            {prevValue !== undefined && (
              <p className="text-xs text-muted-foreground mt-1">Anterior: {displayPrev}</p>
            )}
          </div>
          {Icon && (
            <div className="rounded-md p-2 bg-muted/50">
              <Icon className="w-4 h-4" style={{ color: iconColor }} />
            </div>
          )}
        </div>
        {delta !== undefined && (
          <div className={cn("flex items-center gap-1 mt-3 text-xs font-medium",
            positive && "text-green-500",
            negative && "text-red-500",
            !positive && !negative && "text-muted-foreground")}>
            {positive ? <ArrowUp className="w-3 h-3" /> : negative ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {Math.abs(delta).toFixed(1)}% vs periodo anterior
          </div>
        )}
      </CardContent>
    </Card>
  );
}
