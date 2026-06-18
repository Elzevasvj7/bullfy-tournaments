import { useState, useEffect } from "react";
import { useOnboardingStore, SpreadConfig } from "@/stores/onboardingStore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_BROKER_GAIN, useBrokerPropSettings } from "@/hooks/useBrokerPropSettings";
import { calculateReferenceStandardSpread } from "@/lib/spreadCalculations";

const JPY_KEYWORDS = ["JPY"];

const spreadToPips = (symbol: string, spread: number): number => {
  const isJpy = JPY_KEYWORDS.some((k) => symbol.toUpperCase().includes(k));
  const divisor = isJpy ? 1 : 10;
  return Math.round((spread / divisor) * 100) / 100;
};

interface SpreadTableProps {
  readOnly?: boolean;
  forceShowCustom?: boolean;
  baseDolarOverride?: number;
}

const SpreadTable = ({ readOnly = true, forceShowCustom, baseDolarOverride }: SpreadTableProps) => {
  const { formData, updateFormData } = useOnboardingStore();
  const [showPips, setShowPips] = useState(false);
  const { data: brokerSettings } = useBrokerPropSettings();
  const bullfyDollars = brokerSettings?.gananciaBroker ?? DEFAULT_BROKER_GAIN;

  const { data: refSpreads } = useQuery({
    queryKey: ["ref_spreads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ref_spreads").select("*").order("symbol");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (refSpreads && formData.spread_config.length === 0) {
      const config: SpreadConfig[] = refSpreads.map((s) => ({
        symbol: s.symbol,
        raw: s.raw,
        spread_estandar: calculateReferenceStandardSpread({ raw: s.raw, dolares_ib_original: s.dolares_ib, ajuste_manual: s.ajuste_manual }, bullfyDollars),
        dolares_ib_original: s.dolares_ib,
        ajuste_manual: s.ajuste_manual ?? 0,
        nuevo_dolar_ib: null,
        diferencia: 0,
        nuevo_spread_cliente: calculateReferenceStandardSpread({ raw: s.raw, dolares_ib_original: s.dolares_ib, ajuste_manual: s.ajuste_manual }, bullfyDollars),
      }));
      updateFormData({ spread_config: config });
    }
  }, [refSpreads]);

  const displayConfig = formData.spread_config.length > 0
    ? formData.spread_config
    : (refSpreads?.map((s) => ({
        symbol: s.symbol,
        raw: s.raw,
        spread_estandar: calculateReferenceStandardSpread({ raw: s.raw, dolares_ib_original: s.dolares_ib, ajuste_manual: s.ajuste_manual }, bullfyDollars),
        dolares_ib_original: s.dolares_ib,
        ajuste_manual: s.ajuste_manual ?? 0,
        nuevo_dolar_ib: null,
        diferencia: 0,
        nuevo_spread_cliente: calculateReferenceStandardSpread({ raw: s.raw, dolares_ib_original: s.dolares_ib, ajuste_manual: s.ajuste_manual }, bullfyDollars),
      })) || []);

  const showCustomCols = forceShowCustom !== undefined
    ? forceShowCustom
    : (!readOnly && !formData.usar_spreads_default);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Tabla de Spreads y Dólares IB por lote</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowPips(!showPips)}
          className="gap-1.5 text-xs"
        >
          {showPips ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showPips ? "Ocultar Pips" : "Ver Pips"}
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="max-h-[300px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary">
                <TableHead className="text-xs">Símbolo</TableHead>
                <TableHead className="text-xs text-right">RAW</TableHead>
                <TableHead className="text-xs text-right">Bullfy ($)</TableHead>
                <TableHead className="text-xs text-right">Dólares IB</TableHead>
                <TableHead className="text-xs text-right">Spread Estándar</TableHead>
                {showPips && <TableHead className="text-xs text-right text-primary">Pips</TableHead>}
                {showCustomCols && (
                  <>
                    <TableHead className="text-xs text-right text-primary">Diferencia</TableHead>
                    <TableHead className="text-xs text-right text-primary">Nuevo Spread</TableHead>
                    {showPips && <TableHead className="text-xs text-right text-primary">Nuevo Pips</TableHead>}
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayConfig.map((s, i) => (
                <TableRow key={i} className="text-xs">
                  <TableCell className="font-mono font-semibold">{s.symbol}</TableCell>
                  <TableCell className="text-right">{s.raw}</TableCell>
                  <TableCell className="text-right text-muted-foreground">${bullfyDollars}</TableCell>
                  <TableCell className="text-right">{baseDolarOverride ?? s.dolares_ib_original}</TableCell>
                  <TableCell className="text-right">{s.spread_estandar}</TableCell>
                  {showPips && (
                    <TableCell className="text-right text-primary font-medium">
                      {spreadToPips(s.symbol, s.spread_estandar)}
                    </TableCell>
                  )}
                  {showCustomCols && (
                    <>
                      <TableCell className={`text-right ${s.diferencia !== 0 ? 'text-primary font-semibold' : ''}`}>
                        {s.diferencia}
                      </TableCell>
                      <TableCell className={`text-right ${s.diferencia !== 0 ? 'text-primary font-semibold' : ''}`}>
                        {s.nuevo_spread_cliente}
                      </TableCell>
                      {showPips && (
                        <TableCell className={`text-right ${s.diferencia !== 0 ? 'text-primary font-semibold' : ''}`}>
                          {spreadToPips(s.symbol, s.nuevo_spread_cliente)}
                        </TableCell>
                      )}
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default SpreadTable;
