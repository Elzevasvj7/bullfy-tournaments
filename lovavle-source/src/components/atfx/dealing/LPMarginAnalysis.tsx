import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Wallet, Calculator, Info } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, Legend } from "recharts";

const LP_LEVERAGES = [100, 200, 300];
const TRADER_LEVERAGES = [500, 1000, 2000];
const BUFFERS = [
  { value: 1.0, label: "Sin buffer" },
  { value: 1.3, label: "+30% (recomendado)" },
  { value: 1.5, label: "+50% (conservador)" },
];

const SYMBOLS = [
  { id: "EURUSD", label: "EURUSD", contractSize: 100000, defaultPrice: 1.085, unit: "EUR" },
  { id: "GBPUSD", label: "GBPUSD", contractSize: 100000, defaultPrice: 1.265, unit: "GBP" },
  { id: "USDJPY", label: "USDJPY", contractSize: 100000, defaultPrice: 150.5, unit: "USD" },
  { id: "XAUUSD", label: "XAUUSD (Oro)", contractSize: 100, defaultPrice: 2350, unit: "oz" },
  { id: "XAGUSD", label: "XAGUSD (Plata)", contractSize: 5000, defaultPrice: 28.5, unit: "oz" },
  { id: "BTCUSD", label: "BTCUSD", contractSize: 1, defaultPrice: 65000, unit: "BTC" },
  { id: "US500", label: "US500 (S&P)", contractSize: 50, defaultPrice: 5200, unit: "idx" },
];

const fmt = (n: number, dec = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });

const fmtUsd = (n: number) => `$${fmt(n, 2)}`;

export default function LPMarginAnalysis() {
  const [balance, setBalance] = useState<number>(100000);
  const [lpLev, setLpLev] = useState<number>(100);
  const [traderLev, setTraderLev] = useState<number>(500);
  const [symbolId, setSymbolId] = useState<string>("EURUSD");
  const [price, setPrice] = useState<number>(1.085);
  const [lots, setLots] = useState<number>(10);
  const [buffer, setBuffer] = useState<number>(1.3);

  const symbol = SYMBOLS.find((s) => s.id === symbolId)!;

  const handleSymbolChange = (id: string) => {
    setSymbolId(id);
    const s = SYMBOLS.find((x) => x.id === id);
    if (s) setPrice(s.defaultPrice);
  };

  const calc = useMemo(() => {
    const notionalPerLot = symbol.contractSize * price; // USD notional
    const marginTraderPerLot = notionalPerLot / traderLev;
    const marginLpPerLot = notionalPerLot / lpLev;
    const gapPerLot = marginLpPerLot - marginTraderPerLot;

    const marginTrader = marginTraderPerLot * lots;
    const marginLp = marginLpPerLot * lots;
    const gap = gapPerLot * lots;
    const gapBuffered = gap * buffer;

    const maxLotsByBalance = balance / (gapPerLot * buffer);
    const balanceUsage = (gapBuffered / balance) * 100;

    const ratio = lpLev > 0 ? traderLev / lpLev : 0;

    return {
      notionalPerLot,
      marginTraderPerLot,
      marginLpPerLot,
      gapPerLot,
      marginTrader,
      marginLp,
      gap,
      gapBuffered,
      maxLotsByBalance,
      balanceUsage,
      ratio,
    };
  }, [symbol, price, traderLev, lpLev, lots, balance, buffer]);

  const scenarios = useMemo(() => {
    const lotSteps = [1, 5, 10, 25, 50, 100, 250, 500];
    return lotSteps.map((l) => {
      const mt = calc.marginTraderPerLot * l;
      const ml = calc.marginLpPerLot * l;
      const g = ml - mt;
      const gb = g * buffer;
      const usage = (gb / balance) * 100;
      return { lots: l, marginTrader: mt, marginLp: ml, gap: g, gapBuffered: gb, usage };
    });
  }, [calc, buffer, balance]);

  const chartData = useMemo(() => {
    const max = Math.max(100, Math.ceil(calc.maxLotsByBalance * 1.2));
    const step = Math.max(1, Math.floor(max / 30));
    const data = [];
    for (let l = 0; l <= max; l += step) {
      const gb = calc.gapPerLot * l * buffer;
      data.push({
        lots: l,
        capital: Math.round(gb),
        balance: balance,
      });
    }
    return data;
  }, [calc, buffer, balance]);

  const usageColor =
    calc.balanceUsage < 50 ? "text-emerald-500" : calc.balanceUsage < 80 ? "text-amber-500" : "text-destructive";

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            Análisis de Margen LP — Gestión de Riesgo Dealing Desk
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Calcula cuánto capital debe mantener el broker en su cuenta margen con el Liquidity Provider para soportar el
            apalancamiento ofrecido al trader sin recibir margin call.
          </p>
        </CardHeader>
      </Card>

      {/* Inputs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parámetros de simulación</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> Balance MT5 broker (USD)
            </Label>
            <Input
              type="number"
              value={balance}
              onChange={(e) => setBalance(Number(e.target.value) || 0)}
              min={0}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Apalancamiento LP</Label>
            <Select value={String(lpLev)} onValueChange={(v) => setLpLev(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LP_LEVERAGES.map((l) => <SelectItem key={l} value={String(l)}>1:{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Apalancamiento Trader</Label>
            <Select value={String(traderLev)} onValueChange={(v) => setTraderLev(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRADER_LEVERAGES.map((l) => <SelectItem key={l} value={String(l)}>1:{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Buffer de seguridad</Label>
            <Select value={String(buffer)} onValueChange={(v) => setBuffer(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BUFFERS.map((b) => <SelectItem key={b.value} value={String(b.value)}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Símbolo</Label>
            <Select value={symbolId} onValueChange={handleSymbolChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SYMBOLS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Contract size: {fmt(symbol.contractSize, 0)} {symbol.unit}</p>
          </div>

          <div className="space-y-1.5">
            <Label>Precio spot</Label>
            <Input
              type="number"
              step="0.0001"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Volumen escenario (lotes)</Label>
            <Input
              type="number"
              step="0.1"
              value={lots}
              onChange={(e) => setLots(Number(e.target.value) || 0)}
              min={0}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Ratio apalancamiento</Label>
            <div className="h-10 flex items-center px-3 rounded-md border bg-muted/30">
              <Badge variant="secondary">{calc.ratio.toFixed(1)}x más leverage al trader</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Margen Trader ({lots} lotes)</p>
            <p className="text-2xl font-bold">{fmtUsd(calc.marginTrader)}</p>
            <p className="text-xs text-muted-foreground mt-1">Bloqueado al cliente @ 1:{traderLev}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Margen exigido por LP</p>
            <p className="text-2xl font-bold">{fmtUsd(calc.marginLp)}</p>
            <p className="text-xs text-muted-foreground mt-1">El LP retiene @ 1:{lpLev}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Capital broker requerido</p>
            <p className="text-2xl font-bold text-primary">{fmtUsd(calc.gapBuffered)}</p>
            <p className="text-xs text-muted-foreground mt-1">Gap × buffer {((buffer - 1) * 100).toFixed(0)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Uso del balance</p>
            <p className={`text-2xl font-bold ${usageColor}`}>{fmt(calc.balanceUsage, 1)}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              Máx soportable: <strong>{fmt(calc.maxLotsByBalance, 1)} lotes</strong>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerta */}
      {calc.balanceUsage > 80 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-destructive">Riesgo elevado de margin call del LP</p>
              <p className="text-sm text-muted-foreground">
                El escenario actual consume el {fmt(calc.balanceUsage, 1)}% del balance. Considera reducir el
                apalancamiento ofrecido, aumentar el balance del puente, o limitar la exposición agregada.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Explicación matemática */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" /> Cómo se calculó
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="p-3 rounded-md bg-muted/40 font-mono text-xs space-y-2">
            <p><span className="text-muted-foreground">// Notional por lote</span></p>
            <p>Notional = ContractSize × Precio = {fmt(symbol.contractSize, 0)} × {price} = <strong>{fmtUsd(calc.notionalPerLot)}</strong></p>

            <p className="pt-2"><span className="text-muted-foreground">// Margen requerido por el TRADER (lo que le bloqueas al cliente)</span></p>
            <p>Margen_Trader = Notional / LeverageTrader = {fmtUsd(calc.notionalPerLot)} / {traderLev} = <strong>{fmtUsd(calc.marginTraderPerLot)} / lote</strong></p>

            <p className="pt-2"><span className="text-muted-foreground">// Margen que TÚ debes mantener con el LP por la misma posición</span></p>
            <p>Margen_LP = Notional / LeverageLP = {fmtUsd(calc.notionalPerLot)} / {lpLev} = <strong>{fmtUsd(calc.marginLpPerLot)} / lote</strong></p>

            <p className="pt-2"><span className="text-muted-foreground">// Gap = capital adicional que el broker debe poner</span></p>
            <p>Gap_por_lote = Margen_LP − Margen_Trader = {fmtUsd(calc.marginLpPerLot)} − {fmtUsd(calc.marginTraderPerLot)} = <strong>{fmtUsd(calc.gapPerLot)}</strong></p>

            <p className="pt-2"><span className="text-muted-foreground">// Para {lots} lotes con buffer de seguridad</span></p>
            <p>Capital_Requerido = Gap_por_lote × Lotes × Buffer = {fmtUsd(calc.gapPerLot)} × {lots} × {buffer} = <strong className="text-primary">{fmtUsd(calc.gapBuffered)}</strong></p>

            <p className="pt-2"><span className="text-muted-foreground">// Capacidad máxima dado tu balance MT5</span></p>
            <p>Lotes_Max = Balance / (Gap_por_lote × Buffer) = {fmtUsd(balance)} / ({fmtUsd(calc.gapPerLot)} × {buffer}) = <strong>{fmt(calc.maxLotsByBalance, 1)} lotes</strong></p>
          </div>

          <div className="text-xs text-muted-foreground space-y-1 pt-2">
            <p><strong>¿Por qué existe el gap?</strong> El trader opera con apalancamiento 1:{traderLev}, así que solo le exiges una fracción pequeña como margen. Pero el LP solo te concede 1:{lpLev}, así que te exige <strong>{calc.ratio.toFixed(1)}× más margen</strong> que el que tú cobras al cliente. Esa diferencia debes financiarla del balance del broker.</p>
            <p><strong>Buffer:</strong> protege contra movimientos adversos del precio (drawdown flotante). Sin buffer, una pérdida no realizada del cliente puede gatillar margin call del LP antes que del cliente.</p>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de escenarios */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Escenarios por volumen</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lotes</TableHead>
                <TableHead className="text-right">Margen Trader</TableHead>
                <TableHead className="text-right">Margen LP</TableHead>
                <TableHead className="text-right">Gap</TableHead>
                <TableHead className="text-right">Capital req. (con buffer)</TableHead>
                <TableHead className="text-right">% Balance</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scenarios.map((s) => {
                const status =
                  s.usage < 50 ? { label: "OK", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" }
                  : s.usage < 80 ? { label: "Vigilar", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" }
                  : s.usage < 100 ? { label: "Alto riesgo", className: "bg-orange-500/10 text-orange-600 border-orange-500/30" }
                  : { label: "Margin call", className: "bg-destructive/10 text-destructive border-destructive/30" };
                return (
                  <TableRow key={s.lots}>
                    <TableCell className="font-medium">{s.lots}</TableCell>
                    <TableCell className="text-right">{fmtUsd(s.marginTrader)}</TableCell>
                    <TableCell className="text-right">{fmtUsd(s.marginLp)}</TableCell>
                    <TableCell className="text-right">{fmtUsd(s.gap)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtUsd(s.gapBuffered)}</TableCell>
                    <TableCell className="text-right">{fmt(s.usage, 1)}%</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={status.className}>{status.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Gráfico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Consumo de balance vs volumen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="capGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="lots" stroke="hsl(var(--muted-foreground))" label={{ value: "Lotes", position: "insideBottom", offset: -5, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
                formatter={(v: number) => fmtUsd(v)}
              />
              <Legend />
              <ReferenceLine y={balance} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label={{ value: "Balance MT5 (margin call LP)", fill: "hsl(var(--destructive))", fontSize: 11 }} />
              <Area type="monotone" dataKey="capital" name="Capital requerido" stroke="hsl(var(--primary))" fill="url(#capGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
