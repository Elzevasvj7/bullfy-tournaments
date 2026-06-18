import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingUp, TrendingDown, Shield, Zap, Info, Presentation, Loader2, Copy, Check } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import CalcTooltip from "./CalcTooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// Constants for standard FX (EURUSD style)
const PIP_VALUE_PER_LOT = 10; // USD per pip per 1.0 lot on EURUSD
const CONTRACT_SIZE = 100_000; // standard lot
const PRICE_REF = 1.1; // approx EURUSD reference for margin calc

const fmt = (n: number, d = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const generateCode = () => {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "x12-";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

const ArtificialLeverageSimulator = () => {
  const { user } = useAuth();
  // Inputs
  const [multiplier, setMultiplier] = useState(12);
  const [deposit, setDeposit] = useState(1000);
  const [lotSize, setLotSize] = useState(1);
  const [pips, setPips] = useState(20); // can be negative
  const [clientLeverage, setClientLeverage] = useState(30);
  const [lpLeverage, setLpLeverage] = useState(100);
  const [spreadPerLot, setSpreadPerLot] = useState(60);
  const [rebatePerLot, setRebatePerLot] = useState(7);
  const [smartHedging, setSmartHedging] = useState(false);
  const [bbookPercent, setBbookPercent] = useState(50);

  const [creating, setCreating] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const calc = useMemo(() => {
    const displayedBalance = deposit * multiplier;
    const realRisk = deposit * 1.2;
    const maxDrawdownUsd = displayedBalance * 0.1;
    const scalingFactor = displayedBalance > 0 ? deposit / displayedBalance : 0; // = 1/multiplier

    const bbookLots = smartHedging ? lotSize * (bbookPercent / 100) : 0;
    const abookLots = smartHedging ? lotSize * (1 - bbookPercent / 100) : lotSize;
    const lpLotsScaled = abookLots * scalingFactor;

    const clientFloatingPnl = lotSize * pips * PIP_VALUE_PER_LOT;
    const bbookPnl = -(bbookLots * pips * PIP_VALUE_PER_LOT);
    const abookPnl = lpLotsScaled * pips * PIP_VALUE_PER_LOT;
    const brokerRealPnl = bbookPnl + abookPnl;

    const spreadCost = lotSize * spreadPerLot;
    const rebateCost = lotSize * rebatePerLot;
    const clientNetPnl = clientFloatingPnl - spreadCost;
    const brokerSpreadRevenue = spreadCost - rebateCost;

    const drawdownUsd = clientNetPnl < 0 ? Math.abs(clientNetPnl) : 0;
    const drawdownPct = (drawdownUsd / displayedBalance) * 100;
    const distanceToStopOut = maxDrawdownUsd - drawdownUsd;
    const stoppedOut = drawdownPct >= 10;
    const warning = drawdownPct >= 8 && !stoppedOut;

    const notional = lotSize * CONTRACT_SIZE * PRICE_REF;
    const clientMargin = notional / clientLeverage;
    const lpNotional = lpLotsScaled * CONTRACT_SIZE * PRICE_REF;
    const lpMargin = lpNotional / lpLeverage;

    const lpRiskReductionPct = lotSize > 0 ? (1 - lpLotsScaled / lotSize) * 100 : 0;

    return {
      displayedBalance,
      realRisk,
      maxDrawdownUsd,
      scalingFactor,
      bbookLots,
      abookLots,
      lpLotsScaled,
      clientFloatingPnl,
      brokerRealPnl,
      spreadCost,
      rebateCost,
      clientNetPnl,
      brokerSpreadRevenue,
      drawdownUsd,
      drawdownPct,
      distanceToStopOut,
      stoppedOut,
      warning,
      clientMargin,
      lpMargin,
      lpRiskReductionPct,
      bbookPnl,
      abookPnl,
    };
  }, [deposit, multiplier, lotSize, pips, clientLeverage, lpLeverage, spreadPerLot, rebatePerLot, smartHedging, bbookPercent]);

  const chartData = useMemo(() => {
    const points = 41;
    const range = Math.max(50, Math.abs(pips) * 2);
    const step = (range * 2) / (points - 1);
    return Array.from({ length: points }, (_, i) => {
      const p = -range + step * i;
      const clientPnl = lotSize * p * PIP_VALUE_PER_LOT - calc.spreadCost;
      const bbookPnl = -(calc.bbookLots * p * PIP_VALUE_PER_LOT);
      const abookPnl = calc.lpLotsScaled * p * PIP_VALUE_PER_LOT;
      const brokerPnl = bbookPnl + abookPnl + calc.brokerSpreadRevenue;
      return {
        pips: p,
        cliente: Math.round(clientPnl),
        broker: Math.round(brokerPnl),
      };
    });
  }, [pips, lotSize, calc.spreadCost, calc.bbookLots, calc.lpLotsScaled, calc.brokerSpreadRevenue]);

  const insights = useMemo(() => {
    const arr: { type: "info" | "warn" | "success"; text: string }[] = [];
    arr.push({
      type: "info",
      text: `El cliente percibe ${fmt(calc.displayedBalance, 0)} USD de balance pero el capital real es ${fmt(deposit, 0)} USD (riesgo real ${fmt(calc.realRisk, 0)} USD).`,
    });
    arr.push({
      type: "success",
      text: `Factor de escala A-Book: ${(calc.scalingFactor * 100).toFixed(2)}% — reduce la exposición del LP en ${calc.lpRiskReductionPct.toFixed(1)}%.`,
    });
    if (smartHedging) {
      arr.push({
        type: "info",
        text: `Smart Hedging activo: ${bbookPercent}% interno (B-Book) + ${100 - bbookPercent}% al LP escalado.`,
      });
    }
    if (calc.warning) {
      arr.push({ type: "warn", text: `Drawdown ${calc.drawdownPct.toFixed(2)}% — cerca del stop-out (10%).` });
    }
    if (calc.stoppedOut) {
      arr.push({ type: "warn", text: `Cuenta cerrada por stop-out. Pérdida ≥ 10% del balance mostrado.` });
    }
    arr.push({
      type: "info",
      text: `Spread cobrado: ${fmt(calc.spreadCost, 2)} USD — neto broker tras rebate IB: ${fmt(calc.brokerSpreadRevenue, 2)} USD.`,
    });
    return arr;
  }, [calc, deposit, smartHedging, bbookPercent]);

  const handleCreatePresentation = async () => {
    if (!user) {
      toast.error("Debes iniciar sesión");
      return;
    }
    setCreating(true);
    setPublishedUrl(null);
    try {
      const code = generateCode();
      const inputs = {
        multiplier, deposit, lotSize, pips, clientLeverage, lpLeverage,
        spreadPerLot, rebatePerLot, smartHedging, bbookPercent,
      };
      const results = { ...calc };

      const { data: snap, error: insErr } = await supabase
        .from("simulation_snapshots")
        .insert({
          code,
          simulation_type: "x12",
          inputs,
          results,
          created_by: user.id,
        })
        .select()
        .single();

      if (insErr || !snap) throw new Error(insErr?.message || "No se pudo crear");

      toast.success("Presentación creada — generando análisis IA...");
      const url = `https://bullfytech.online/simulaciones/x12/${code}`;
      setPublishedUrl(url);

      // Fire AI analysis (non-blocking for UI but we await to surface errors)
      const { data: aiData, error: aiErr } = await supabase.functions.invoke("analyze-simulation", {
        body: { snapshot_id: snap.id },
      });

      if (aiErr) {
        toast.warning("Presentación lista, pero el análisis IA falló");
      } else if ((aiData as any)?.ok === false) {
        toast.warning((aiData as any).error || "Análisis IA falló");
      } else {
        toast.success("Análisis IA completado ✓");
      }
    } catch (e: any) {
      toast.error(e?.message || "Error al crear presentación");
    } finally {
      setCreating(false);
    }
  };

  const copyUrl = async () => {
    if (!publishedUrl) return;
    await navigator.clipboard.writeText(publishedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            Simulador de Apalancamiento Artificial
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Modelo A-Book con escalado de volumen para visualizar exposición real vs percibida.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {calc.stoppedOut && (
            <Badge variant="destructive" className="text-sm py-1 px-3">
              <AlertTriangle className="w-4 h-4 mr-1" /> STOP-OUT
            </Badge>
          )}
          {calc.warning && (
            <Badge className="text-sm py-1 px-3 bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
              <AlertTriangle className="w-4 h-4 mr-1" /> Drawdown crítico
            </Badge>
          )}
          <Button onClick={handleCreatePresentation} disabled={creating} size="sm">
            {creating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generando…</>
            ) : (
              <><Presentation className="w-4 h-4 mr-2" /> Crear Presentación</>
            )}
          </Button>
        </div>
      </div>

      {publishedUrl && (
        <Card className="p-4 bg-primary/5 border-primary/30 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground mb-1">Presentación pública creada:</div>
            <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-mono text-primary truncate block">
              {publishedUrl}
            </a>
          </div>
          <Button variant="outline" size="sm" onClick={copyUrl}>
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? "Copiado" : "Copiar enlace"}
          </Button>
        </Card>
      )}

      {/* Input panel */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wide">Parámetros</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Multiplicador (x)</Label>
              <Input type="number" value={multiplier} onChange={(e) => setMultiplier(Math.max(1, Number(e.target.value) || 1))} className="w-28 h-8 text-right" />
            </div>
            <Slider value={[multiplier]} onValueChange={(v) => setMultiplier(v[0])} min={1} max={100} step={1} />
            <p className="text-[10px] text-muted-foreground">Balance mostrado = Depósito × {multiplier}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Depósito (USD)</Label>
              <Input type="number" value={deposit} onChange={(e) => setDeposit(Math.max(100, Number(e.target.value) || 0))} className="w-28 h-8 text-right" />
            </div>
            <Slider value={[deposit]} onValueChange={(v) => setDeposit(v[0])} min={100} max={50000} step={100} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Tamaño de lote</Label>
              <Input type="number" step="0.01" value={lotSize} onChange={(e) => setLotSize(Math.max(0.01, Number(e.target.value) || 0))} className="w-28 h-8 text-right" />
            </div>
            <Slider value={[lotSize]} onValueChange={(v) => setLotSize(v[0])} min={0.01} max={20} step={0.01} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Movimiento (pips)</Label>
              <Input type="number" value={pips} onChange={(e) => setPips(Number(e.target.value) || 0)} className="w-28 h-8 text-right" />
            </div>
            <Slider value={[pips]} onValueChange={(v) => setPips(v[0])} min={-200} max={200} step={1} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Apalancamiento Cliente (1:X)</Label>
              <Input type="number" value={clientLeverage} onChange={(e) => setClientLeverage(Math.max(1, Number(e.target.value) || 1))} className="w-28 h-8 text-right" />
            </div>
            <Slider value={[clientLeverage]} onValueChange={(v) => setClientLeverage(v[0])} min={1} max={500} step={1} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Apalancamiento LP (1:X)</Label>
              <Input type="number" value={lpLeverage} onChange={(e) => setLpLeverage(Math.max(1, Number(e.target.value) || 1))} className="w-28 h-8 text-right" />
            </div>
            <Slider value={[lpLeverage]} onValueChange={(v) => setLpLeverage(v[0])} min={1} max={500} step={1} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Spread por lote (USD)</Label>
              <Input type="number" value={spreadPerLot} onChange={(e) => setSpreadPerLot(Math.max(0, Number(e.target.value) || 0))} className="w-28 h-8 text-right" />
            </div>
            <Slider value={[spreadPerLot]} onValueChange={(v) => setSpreadPerLot(v[0])} min={0} max={200} step={1} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Rebate IB por lote (USD)</Label>
              <Input type="number" value={rebatePerLot} onChange={(e) => setRebatePerLot(Math.max(0, Number(e.target.value) || 0))} className="w-28 h-8 text-right" />
            </div>
            <Slider value={[rebatePerLot]} onValueChange={(v) => setRebatePerLot(v[0])} min={0} max={50} step={0.5} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <Label className="cursor-pointer">Smart Hedging (A-Book parcial)</Label>
              </div>
              <Switch checked={smartHedging} onCheckedChange={setSmartHedging} />
            </div>
            {smartHedging && (
              <div className="space-y-2 px-3">
                <div className="flex items-center justify-between text-xs">
                  <Label className="text-xs">B-Book interno: {bbookPercent}%</Label>
                  <span className="text-muted-foreground">A-Book LP: {100 - bbookPercent}%</span>
                </div>
                <Slider value={[bbookPercent]} onValueChange={(v) => setBbookPercent(v[0])} min={0} max={100} step={5} />
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* CLIENT vs BROKER comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">Lado Cliente (Percibido)</h3>
            <Badge variant="outline" className="text-blue-500 border-blue-500/40">Visible</Badge>
          </div>
          <div className="space-y-3">
            <Row label="Balance mostrado" value={`$${fmt(calc.displayedBalance, 0)}`} highlight tip={
              <CalcTooltip formula={`Balance = Depósito × ${multiplier}`} substitution={`${fmt(deposit, 0)} × ${multiplier}`} result={`$${fmt(calc.displayedBalance, 0)}`} explanation={`El cliente ve un balance amplificado ${multiplier} veces su depósito real. Esto le da percepción de mayor capital pero el riesgo está limitado por el modelo A-Book escalado.`} />
            } />
            <Row label="Floating P&L" value={`$${fmt(calc.clientFloatingPnl, 2)}`} valueClass={calc.clientFloatingPnl >= 0 ? "text-green-500" : "text-red-500"} tip={
              <CalcTooltip formula="P&L = Lotes × Pips × $10/pip" substitution={`${lotSize} × ${pips} × 10`} result={`$${fmt(calc.clientFloatingPnl, 2)}`} explanation="Para EURUSD, cada pip vale $10 USD por lote estándar. El P&L se calcula sobre el volumen total operado por el cliente." />
            } />
            <Row label="Spread cobrado" value={`-$${fmt(calc.spreadCost, 2)}`} valueClass="text-red-500" tip={
              <CalcTooltip formula="Spread = Lotes × Spread/lote" substitution={`${lotSize} × ${spreadPerLot}`} result={`$${fmt(calc.spreadCost, 2)}`} explanation="Costo cobrado al cliente por la apertura/cierre de posición. Es el revenue principal del broker en modelo A-Book." />
            } />
            <Row label="P&L neto cliente" value={`$${fmt(calc.clientNetPnl, 2)}`} valueClass={calc.clientNetPnl >= 0 ? "text-green-500" : "text-red-500"} tip={
              <CalcTooltip formula="Neto = Floating P&L − Spread" substitution={`${fmt(calc.clientFloatingPnl, 2)} − ${fmt(calc.spreadCost, 2)}`} result={`$${fmt(calc.clientNetPnl, 2)}`} explanation="Resultado real del cliente después de descontar costos transaccionales." />
            } />
            <Row label="Drawdown actual" value={`${calc.drawdownPct.toFixed(2)}%`} valueClass={calc.drawdownPct >= 8 ? "text-yellow-500" : ""} tip={
              <CalcTooltip formula="DD% = (Pérdida / Balance mostrado) × 100" substitution={`(${fmt(calc.drawdownUsd, 2)} / ${fmt(calc.displayedBalance, 0)}) × 100`} result={`${calc.drawdownPct.toFixed(2)}%`} explanation="Mide qué porcentaje del balance percibido se ha perdido. El stop-out se activa al 10%." />
            } />
            <Row label="Distancia a stop-out (10%)" value={`$${fmt(Math.max(0, calc.distanceToStopOut), 2)}`} tip={
              <CalcTooltip formula="Dist = (Balance × 10%) − Pérdida actual" substitution={`(${fmt(calc.displayedBalance, 0)} × 0.10) − ${fmt(calc.drawdownUsd, 2)}`} result={`$${fmt(Math.max(0, calc.distanceToStopOut), 2)}`} explanation="USD restantes antes del cierre forzado de la cuenta. Protege al broker de pérdidas que excedan el depósito." />
            } />
            <Row label="Margen usado" value={`$${fmt(calc.clientMargin, 2)}`} tip={
              <CalcTooltip formula="Margen = (Lotes × 100.000 × Precio) / Apalancamiento" substitution={`(${lotSize} × 100.000 × ${PRICE_REF}) / ${clientLeverage}`} result={`$${fmt(calc.clientMargin, 2)}`} explanation="Capital bloqueado en margen según el apalancamiento configurado del cliente. Cálculo basado en EURUSD ~1.1." />
            } />
          </div>
        </Card>

        <Card className="p-6 border-l-4 border-l-orange-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">Realidad Broker (Oculto)</h3>
            <Badge variant="outline" className="text-orange-500 border-orange-500/40">Interno</Badge>
          </div>
          <div className="space-y-3">
            <Row label="Capital real" value={`$${fmt(deposit, 0)}`} highlight tip={
              <CalcTooltip formula="Capital = Depósito del cliente" result={`$${fmt(deposit, 0)}`} explanation="Es el dinero realmente recibido. Define el riesgo máximo absoluto del broker por esta cuenta." />
            } />
            <Row label="Riesgo real (1.2x dep.)" value={`$${fmt(calc.realRisk, 2)}`} tip={
              <CalcTooltip formula="Riesgo real = Depósito × 1.2" substitution={`${fmt(deposit, 0)} × 1.2`} result={`$${fmt(calc.realRisk, 2)}`} explanation="Buffer del 20% sobre el depósito que el broker está dispuesto a respaldar como exposición máxima en operaciones escaladas." />
            } />
            <Row label="Factor de escala" value={`${(calc.scalingFactor * 100).toFixed(2)}%`} tip={
              <CalcTooltip formula="Factor = Depósito / Balance mostrado" substitution={`${fmt(deposit, 0)} / ${fmt(calc.displayedBalance, 0)}`} result={`${(calc.scalingFactor * 100).toFixed(2)}% (= 1/${multiplier})`} explanation={`Proporción aplicada al volumen enviado al LP. Reduce la exposición real del broker a 1/${multiplier} del volumen percibido por el cliente.`} />
            } />
            <Row label="Lotes enviados al LP" value={fmt(calc.lpLotsScaled, 4)} tip={
              <CalcTooltip formula="Lotes LP = Lotes A-Book × Factor escala" substitution={`${fmt(calc.abookLots, 4)} × ${calc.scalingFactor.toFixed(4)}`} result={fmt(calc.lpLotsScaled, 4)} explanation="Volumen real ejecutado en el liquidity provider. Mucho menor que el percibido, lo que reduce drásticamente la necesidad de capital del broker." />
            } />
            {smartHedging && <Row label="Lotes B-Book (internos)" value={fmt(calc.bbookLots, 4)} tip={
              <CalcTooltip formula="B-Book = Lotes × % B-Book" substitution={`${lotSize} × ${bbookPercent}%`} result={fmt(calc.bbookLots, 4)} explanation="Volumen no enviado al LP — el broker toma la contraparte directa. Genera ganancia si el cliente pierde, y viceversa." />
            } />}
            <Row label="Margen usado en LP" value={`$${fmt(calc.lpMargin, 2)}`} tip={
              <CalcTooltip formula="Margen LP = (Lotes LP × 100.000 × Precio) / Apalancamiento LP" substitution={`(${fmt(calc.lpLotsScaled, 4)} × 100.000 × ${PRICE_REF}) / ${lpLeverage}`} result={`$${fmt(calc.lpMargin, 2)}`} explanation="Capital efectivamente bloqueado en la cuenta del LP por la posición escalada." />
            } />
            <Row label="P&L real broker (neto)" value={`$${fmt(calc.brokerRealPnl + calc.brokerSpreadRevenue, 2)}`} valueClass={(calc.brokerRealPnl + calc.brokerSpreadRevenue) >= 0 ? "text-green-500" : "text-red-500"} tip={
              <CalcTooltip formula="P&L Broker = P&L B-Book + P&L A-Book + Spread neto" substitution={`${fmt(calc.bbookPnl, 2)} + ${fmt(calc.abookPnl, 2)} + ${fmt(calc.brokerSpreadRevenue, 2)}`} result={`$${fmt(calc.brokerRealPnl + calc.brokerSpreadRevenue, 2)}`} explanation="Resultado neto real del broker considerando hedging y revenue por spread tras pagar el rebate IB." />
            } />
            <Row label="Spread retenido (post rebate)" value={`$${fmt(calc.brokerSpreadRevenue, 2)}`} valueClass="text-green-500" tip={
              <CalcTooltip formula="Spread neto = (Spread − Rebate) × Lotes" substitution={`(${spreadPerLot} − ${rebatePerLot}) × ${lotSize}`} result={`$${fmt(calc.brokerSpreadRevenue, 2)}`} explanation="Revenue limpio del broker tras pagar la comisión al IB que trajo el cliente." />
            } />
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> Comparativa de Exposición
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricBlock
            label="P&L Cliente"
            value={`$${fmt(calc.clientNetPnl, 2)}`}
            color={calc.clientNetPnl >= 0 ? "text-green-500" : "text-red-500"}
            icon={calc.clientNetPnl >= 0 ? TrendingUp : TrendingDown}
          />
          <MetricBlock
            label="P&L Broker (real)"
            value={`$${fmt(calc.brokerRealPnl + calc.brokerSpreadRevenue, 2)}`}
            color={(calc.brokerRealPnl + calc.brokerSpreadRevenue) >= 0 ? "text-green-500" : "text-red-500"}
            icon={(calc.brokerRealPnl + calc.brokerSpreadRevenue) >= 0 ? TrendingUp : TrendingDown}
          />
          <MetricBlock
            label="Mismatch (apalancamiento real)"
            value={`${(deposit > 0 ? Math.abs(calc.clientNetPnl / deposit) : 0).toFixed(2)}x`}
            color="text-primary"
            icon={Zap}
          />
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">
          Curva de P&L: Cliente vs Broker (rango de pips)
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="pips" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} label={{ value: "Pips", position: "insideBottom", offset: -5, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: number) => `$${fmt(v, 0)}`} />
              <Legend />
              <Line type="monotone" dataKey="cliente" name="P&L Cliente" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="broker" name="P&L Broker real" stroke="#f97316" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
          <Info className="w-4 h-4 text-primary" /> Insights Automáticos
        </h3>
        <div className="space-y-2">
          {insights.map((i, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg text-sm border ${
                i.type === "warn"
                  ? "bg-red-500/10 border-red-500/30 text-red-600"
                  : i.type === "success"
                  ? "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400"
                  : "bg-secondary/50 border-border text-foreground"
              }`}
            >
              {i.text}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 bg-primary/5 border-primary/20">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Concepto del producto:</strong> El apalancamiento artificial no es apalancamiento real.
          Es un modelo controlado de riesgo donde el balance mostrado es {multiplier}x el depósito, pero la exposición real al LP
          se escala proporcionalmente ({fmt(calc.scalingFactor * 100, 2)}%) para mantener el riesgo del broker dentro del capital depositado.
          Los pagos de profit dependen del correcto escalado de exposición.
        </p>
      </Card>
    </div>
  );
};

const Row = ({ label, value, valueClass = "", highlight = false, tip }: { label: string; value: string; valueClass?: string; highlight?: boolean; tip?: React.ReactNode }) => (
  <div className={`flex items-center justify-between py-2 ${highlight ? "border-b border-border" : ""}`}>
    <span className="text-xs text-muted-foreground flex items-center">
      {label}
      {tip}
    </span>
    <span className={`text-sm font-mono font-semibold ${highlight ? "text-base text-foreground" : "text-foreground"} ${valueClass}`}>
      {value}
    </span>
  </div>
);

const MetricBlock = ({ label, value, color, icon: Icon }: { label: string; value: string; color: string; icon: any }) => (
  <div className="p-4 rounded-lg bg-secondary/50 border border-border">
    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
      <Icon className="w-3.5 h-3.5" />
      {label}
    </div>
    <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
  </div>
);

export default ArtificialLeverageSimulator;
