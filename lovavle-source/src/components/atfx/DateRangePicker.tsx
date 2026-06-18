import { useState } from "react";
import { format, subDays, startOfMonth, endOfMonth, startOfYear, startOfWeek, endOfWeek } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

export interface DateRangeValue {
  from?: Date;
  to?: Date;
}

interface Props {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
  className?: string;
}

const presets = [
  { id: "today", label: "Hoy", get: () => ({ from: new Date(), to: new Date() }) },
  { id: "7d", label: "Últimos 7 días", get: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { id: "30d", label: "Últimos 30 días", get: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { id: "week", label: "Esta semana", get: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
  { id: "month", label: "Este mes", get: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { id: "ytd", label: "Año en curso", get: () => ({ from: startOfYear(new Date()), to: new Date() }) },
];

export default function DateRangePicker({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);

  const label = value.from
    ? value.to
      ? `${format(value.from, "dd MMM yyyy")} – ${format(value.to, "dd MMM yyyy")}`
      : format(value.from, "dd MMM yyyy")
    : "Selecciona rango";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select onValueChange={(id) => { const p = presets.find(x => x.id === id); if (p) onChange(p.get()); }}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Presets" /></SelectTrigger>
        <SelectContent>
          {presets.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("min-w-[260px] justify-start text-left font-normal", !value.from && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={value as DateRange}
            onSelect={(r: DateRange | undefined) => onChange({ from: r?.from, to: r?.to })}
            numberOfMonths={2}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function toISO(d?: Date) {
  return d ? format(d, "yyyy-MM-dd") : undefined;
}
