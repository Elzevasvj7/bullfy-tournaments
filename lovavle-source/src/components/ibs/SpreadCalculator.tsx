import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Eye, EyeOff, Calculator, DollarSign, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_BROKER_GAIN, useBrokerPropSettings } from "@/hooks/useBrokerPropSettings";
import { calculateReferenceStandardSpread } from "@/lib/spreadCalculations";

const JPY_KEYWORDS = ["JPY"];
const DEFAULT_DOLARES_IB = 7;

const spreadToPips = (symbol: string, spread: number): number => {
  const isJpy = JPY_KEYWORDS.some((k) => symbol.toUpperCase().includes(k));
  const divisor = isJpy ? 1 : 10;
  return Math.round((spread / divisor) * 100) / 100;
};

interface SpreadRow {
  symbol: string;
  raw: number;
  spread_estandar: number;
  dolares_ib_default: number;
  ajuste_manual: number;
  bullfy_dollars: number;
  nuevo_dolar_ib: number;
  diferencia_ib: number;
  diferencia_bullfy: number;
  nuevo_spread_cliente: number;
}

const SpreadCalculator = () => {
  const [showPips, setShowPips] = useState(false);
  const [customDolarIB, setCustomDolarIB] = useState<number>(DEFAULT_DOLARES_IB);
  const [useCustomIB, setUseCustomIB] = useState(false);
  const { data: brokerSettings } = useBrokerPropSettings();
  const brokerGain = brokerSettings?.gananciaBroker ?? DEFAULT_BROKER_GAIN;
  const [customBullfy, setCustomBullfy] = useState<number>(brokerGain);
  const [useCustomBullfy, setUseCustomBullfy] = useState(false);
  const [rows, setRows] = useState<SpreadRow[]>([]);

  useEffect(() => {
    setCustomBullfy(brokerGain);
  }, [brokerGain]);

  const { data: refSpreads, isLoading } = useQuery({
    queryKey: ["ref_spreads_calc"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ref_spreads").select("*").order("symbol");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!refSpreads) return;
    const bullfyVal = useCustomBullfy ? customBullfy : brokerGain;
    const newRows: SpreadRow[] = refSpreads.map((s) => {
      const defaultDolIB = s.dolares_ib;
      const nuevoDolIB = useCustomIB ? customDolarIB : defaultDolIB;
      const spreadEstandar = calculateReferenceStandardSpread({ raw: s.raw, dolares_ib_original: s.dolares_ib, ajuste_manual: s.ajuste_manual }, brokerGain);
      const difIB = nuevoDolIB - defaultDolIB;
      const difBullfy = bullfyVal - brokerGain;
      const nuevoSpread = spreadEstandar + difIB + difBullfy;
      return {
        symbol: s.symbol,
        raw: s.raw,
        spread_estandar: spreadEstandar,
        dolares_ib_default: defaultDolIB,
        ajuste_manual: s.ajuste_manual ?? 0,
        bullfy_dollars: bullfyVal,
        nuevo_dolar_ib: nuevoDolIB,
        diferencia_ib: difIB,
        diferencia_bullfy: difBullfy,
        nuevo_spread_cliente: nuevoSpread,
      };
    });
    setRows(newRows);
  }, [refSpreads, customDolarIB, useCustomIB, customBullfy, useCustomBullfy, brokerGain]);

  const hasChanges = useCustomIB || useCustomBullfy;
  const totalDiferencia = (r: SpreadRow) => r.diferencia_ib + r.diferencia_bullfy;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Calculadora de Spreads</CardTitle>
              <CardDescription>Visualiza cómo varía el spread del cliente al cambiar los dólares por lote</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-end gap-6">
            {/* Bullfy toggle */}
            <div className="flex items-center gap-3">
              <Switch checked={useCustomBullfy} onCheckedChange={setUseCustomBullfy} id="bullfy-toggle" />
              <Label htmlFor="bullfy-toggle" className="text-sm cursor-pointer">Personalizar dólares Bullfy</Label>
            </div>
            {useCustomBullfy && (
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm whitespace-nowrap">Bullfy / lote:</Label>
                <Input
                  type="number" min={0} max={50} step={0.5}
                  value={customBullfy}
                  onChange={(e) => setCustomBullfy(Number(e.target.value))}
                  className="w-24"
                />
              </div>
            )}

            {/* IB toggle */}
            <div className="flex items-center gap-3">
              <Switch checked={useCustomIB} onCheckedChange={setUseCustomIB} id="custom-toggle" />
              <Label htmlFor="custom-toggle" className="text-sm cursor-pointer">Personalizar dólares IB</Label>
            </div>
            {useCustomIB && (
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm whitespace-nowrap">Dólares IB / lote:</Label>
                <Input
                  type="number" min={0} max={50} step={0.5}
                  value={customDolarIB}
                  onChange={(e) => setCustomDolarIB(Number(e.target.value))}
                  className="w-24"
                />
              </div>
            )}

            <Button
              type="button" variant="outline" size="sm"
              onClick={() => setShowPips(!showPips)}
              className="gap-1.5 text-xs ml-auto"
            >
              {showPips ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showPips ? "Ocultar Pips" : "Ver Pips"}
            </Button>
          </div>

          {/* Info banner */}
          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">RAW</strong> + <strong className="text-foreground">Bullfy ($)</strong> + <strong className="text-foreground">Dólares IB</strong> = <strong className="text-foreground">Spread Estándar</strong>.{" "}
              Bullfy cobra <strong className="text-foreground">${brokerGain}</strong> por defecto y los dólares IB son <strong className="text-foreground">${DEFAULT_DOLARES_IB}</strong> por lote.
              {hasChanges && <> Al cambiar cualquiera de estos valores, la diferencia se refleja en el <strong className="text-foreground">Nuevo Spread</strong> del cliente.</>}
            </p>
          </div>

          {/* Table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary">
                    <TableHead className="text-xs">Símbolo</TableHead>
                    <TableHead className="text-xs text-right">RAW</TableHead>
                    <TableHead className="text-xs text-right">Bullfy ($)</TableHead>
                    <TableHead className="text-xs text-right">Dólares IB</TableHead>
                    <TableHead className="text-xs text-right">Spread Estándar</TableHead>
                    {showPips && <TableHead className="text-xs text-right text-primary">Pips</TableHead>}
                    {hasChanges && (
                      <>
                        <TableHead className="text-xs text-right text-primary">Diferencia</TableHead>
                        <TableHead className="text-xs text-right text-primary">Nuevo Spread</TableHead>
                        {showPips && <TableHead className="text-xs text-right text-primary">Nuevo Pips</TableHead>}
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s, i) => {
                    const diff = totalDiferencia(s);
                    const diffClass = diff !== 0 ? (diff > 0 ? "text-destructive font-semibold" : "text-primary font-semibold") : "";
                    return (
                      <TableRow key={i} className="text-xs">
                        <TableCell className="font-mono font-semibold">{s.symbol}</TableCell>
                        <TableCell className="text-right">{s.raw}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          ${s.bullfy_dollars}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${s.nuevo_dolar_ib}
                        </TableCell>
                        <TableCell className="text-right">{s.spread_estandar}</TableCell>
                        {showPips && (
                          <TableCell className="text-right text-primary font-medium">
                            {spreadToPips(s.symbol, s.spread_estandar)}
                          </TableCell>
                        )}
                        {hasChanges && (
                          <>
                            <TableCell className={`text-right ${diffClass}`}>
                              {diff > 0 ? `+${diff}` : diff}
                            </TableCell>
                            <TableCell className={`text-right ${diffClass}`}>
                              {s.nuevo_spread_cliente}
                            </TableCell>
                            {showPips && (
                              <TableCell className={`text-right ${diffClass}`}>
                                {spreadToPips(s.symbol, s.nuevo_spread_cliente)}
                              </TableCell>
                            )}
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SpreadCalculator;
