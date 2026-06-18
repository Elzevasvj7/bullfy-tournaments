import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2, TrendingUp, Plus, X, Phone, AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, Activity, FlaskConical } from "lucide-react";
import { Link } from "react-router-dom";

import WhatsAppSettingsCard from "./WhatsAppSettingsCard";
import MT5BridgeBullfyCard from "./MT5BridgeBullfyCard";
import MT5BridgeAccountLookup from "./MT5BridgeAccountLookup";

const DEFAULT_SYMBOLS = ["EUR/USD", "GBP/USD", "BTC/USD", "AAPL", "SPY"];

// ─── Twilio Balance Card ───
function TwilioBalanceCard() {
  const [balance, setBalance] = useState<number | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBalance = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("twilio-balance-check");
      if (invokeError) throw invokeError;
      if (data?.error) {
        setError(data.error);
      } else {
        setBalance(data.balance);
        setCurrency(data.currency || "USD");
      }
    } catch (err: any) {
      setError(err.message || "Error consultando saldo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  const isLow = balance !== null && balance < 20;
  const isCritical = balance !== null && balance < 5;
  const statusColor = isCritical
    ? "border-destructive bg-destructive/5"
    : isLow
    ? "border-yellow-500/50 bg-yellow-500/5"
    : "border-border";

  return (
    <Card className={statusColor}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-primary" />
            Twilio — SMS & Llamadas
          </div>
          <Button variant="ghost" size="sm" onClick={fetchBalance} disabled={loading} className="h-7 w-7 p-0">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Saldo de la cuenta para envío de SMS OTP y llamadas Click-to-Call
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Consultando saldo...
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : balance !== null ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">
                ${balance.toFixed(2)}
              </span>
              <span className="text-sm text-muted-foreground">{currency}</span>
              {!isLow && (
                <Badge variant="secondary" className="ml-auto gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" /> OK
                </Badge>
              )}
              {isLow && !isCritical && (
                <Badge variant="secondary" className="ml-auto gap-1 bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                  <AlertTriangle className="w-3 h-3" /> Saldo bajo
                </Badge>
              )}
              {isCritical && (
                <Badge variant="destructive" className="ml-auto gap-1">
                  <AlertTriangle className="w-3 h-3" /> Crítico
                </Badge>
              )}
            </div>
            {isLow && (
              <div className="text-xs text-muted-foreground border-t border-border pt-2">
                {isCritical
                  ? "⚠️ Saldo crítico. Los SMS y llamadas pueden empezar a fallar. Recarga ahora."
                  : "Saldo bajo. Recomendamos recargar antes de que se agote para evitar fallos en SMS y llamadas."}
              </div>
            )}
            <a
              href="https://console.twilio.com/us1/billing/manage-billing/recharge"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Recargar en Twilio Console <ExternalLink className="w-3 h-3" />
            </a>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

const IntegrationSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_SYMBOLS);
  const [scrollSpeed, setScrollSpeed] = useState(30);
  const [newSymbol, setNewSymbol] = useState("");
  const [settingsId, setSettingsId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase.from as any)("integration_settings")
        .select("*")
        .eq("service_name", "twelvedata")
        .maybeSingle();

      if (data) {
        setSettingsId(data.id);
        setEnabled(data.enabled);
        const config = data.config || {};
        setSymbols(config.symbols || DEFAULT_SYMBOLS);
        setScrollSpeed(config.scroll_speed || 30);
      }
      setLoading(false);
    };
    load();
  }, []);

  const addSymbol = () => {
    const sym = newSymbol.trim().toUpperCase();
    if (!sym) return;
    if (symbols.includes(sym)) {
      toast({ title: "Símbolo duplicado", variant: "destructive" });
      return;
    }
    setSymbols((prev) => [...prev, sym]);
    setNewSymbol("");
  };

  const removeSymbol = (sym: string) => {
    setSymbols((prev) => prev.filter((s) => s !== sym));
  };

  const handleSave = async () => {
    setSaving(true);
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;

    const config = { symbols, scroll_speed: scrollSpeed };

    if (settingsId) {
      const { error } = await (supabase.from as any)("integration_settings")
        .update({ enabled, config, updated_by: userId })
        .eq("id", settingsId);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await (supabase.from as any)("integration_settings")
        .insert({ service_name: "twelvedata", enabled, config, updated_by: userId })
        .select()
        .single();
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
      setSettingsId(data.id);
    }

    toast({ title: "✅ Configuración guardada" });
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TwilioBalanceCard />
      <WhatsAppSettingsCard />
      <MT5BridgeBullfyCard />
      <MT5BridgeAccountLookup />

      {/* Bullfy Trading — plataforma propietaria experimental */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Bullfy Trading — Plataforma propietaria
            </div>
            <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-500">
              <FlaskConical className="w-3 h-3" /> Experimental
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Visualizador de gráficos + ejecución de trades vía MT5 Bridge. Sistema 100% propietario (klinecharts MIT).
          </p>
        </CardHeader>
        <CardContent>
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/trading-platform">
              <ExternalLink className="w-3.5 h-3.5" /> Abrir plataforma
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-5 h-5 text-primary" />
            Twelve Data — Ticker Financiero
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Cintillo de precios en tiempo real para Bullfy Live (Forex, Crypto, Acciones)
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Servicio activo</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {enabled && (
            <>
              {/* Symbols */}
              <div className="space-y-2">
                <Label className="text-sm">Símbolos a mostrar</Label>
                <div className="flex flex-wrap gap-1.5">
                  {symbols.map((sym) => (
                    <Badge key={sym} variant="secondary" className="gap-1 text-xs">
                      {sym}
                      <button onClick={() => removeSymbol(sym)} className="hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addSymbol()}
                    placeholder="Ej: USD/JPY, TSLA, ETH/USD"
                    className="h-8 text-sm flex-1"
                  />
                  <Button size="sm" variant="outline" onClick={addSymbol} className="h-8 gap-1">
                    <Plus className="w-3 h-3" /> Agregar
                  </Button>
                </div>
              </div>

              {/* Scroll speed */}
              <div className="space-y-1">
                <Label className="text-sm">Velocidad de scroll (segundos por ciclo)</Label>
                <Input
                  type="number"
                  value={scrollSpeed}
                  onChange={(e) => setScrollSpeed(Number(e.target.value))}
                  min={5}
                  max={120}
                  className="h-8 text-sm w-32"
                />
                <p className="text-xs text-muted-foreground">
                  Menor = más rápido. Rango: 5-120 segundos.
                </p>
              </div>
            </>
          )}

          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Guardando..." : "Guardar configuración"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default IntegrationSettings;
