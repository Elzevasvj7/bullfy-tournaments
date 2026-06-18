import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2, Bitcoin, CreditCard, Eye, EyeOff, Shield } from "lucide-react";

interface GatewayConfig {
  id: string | null;
  enabled: boolean;
  environment: "sandbox" | "production";
  config: Record<string, any>;
}

const PaymentGatewaySettings = () => {
  const [loading, setLoading] = useState(true);
  const [savingCrypto, setSavingCrypto] = useState(false);
  const [savingCard, setSavingCard] = useState(false);

  // Coinsbuy state
  const [crypto, setCrypto] = useState<GatewayConfig>({
    id: null, enabled: false, environment: "sandbox", config: {}
  });
  const [cryptoClientId, setCryptoClientId] = useState("");
  const [cryptoClientSecret, setCryptoClientSecret] = useState("");
  const [cryptoCallbackSecret, setCryptoCallbackSecret] = useState("");
  const [showCryptoSecret, setShowCryptoSecret] = useState(false);
  const [showCryptoCallback, setShowCryptoCallback] = useState(false);

  // Stripe state
  const [card, setCard] = useState<GatewayConfig>({
    id: null, enabled: false, environment: "sandbox", config: {}
  });
  const [stripePublishable, setStripePublishable] = useState("");
  const [stripeSecret, setStripeSecret] = useState("");
  const [showStripeSecret, setShowStripeSecret] = useState(false);
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState("");
  const [showStripeWebhook, setShowStripeWebhook] = useState(false);

  // NOWPayments state
  const [savingNow, setSavingNow] = useState(false);
  const [now, setNow] = useState<GatewayConfig>({
    id: null, enabled: false, environment: "sandbox", config: {}
  });
  const [nowApiKey, setNowApiKey] = useState("");
  const [nowIpnSecret, setNowIpnSecret] = useState("");
  const [showNowApiKey, setShowNowApiKey] = useState(false);
  const [showNowIpn, setShowNowIpn] = useState(false);
  // Credenciales para PAYOUTS (retiros a IBs): JWT con email+password de la cuenta NP.
  const [nowEmail, setNowEmail] = useState("");
  const [nowPassword, setNowPassword] = useState("");
  const [showNowPassword, setShowNowPassword] = useState(false);

  // Proveedor cripto activo para el checkout del cliente final.
  const [activeCrypto, setActiveCrypto] = useState<"coinsbuy" | "nowpayments">("coinsbuy");
  const [savingActive, setSavingActive] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase.from as any)("integration_settings")
        .select("*")
        .in("service_name", ["coinsbuy", "stripe_gateway", "nowpayments", "crypto_router"]);

      if (data) {
        for (const row of data) {
          if (row.service_name === "coinsbuy") {
            setCrypto({ id: row.id, enabled: row.enabled, environment: row.config?.environment || "sandbox", config: row.config || {} });
            setCryptoClientId(row.config?.client_id || "");
            setCryptoClientSecret(row.config?.client_secret_masked ? "••••••••" : "");
            setCryptoCallbackSecret(row.config?.callback_secret_masked ? "••••••••" : "");
          }
          if (row.service_name === "stripe_gateway") {
            setCard({ id: row.id, enabled: row.enabled, environment: row.config?.environment || "sandbox", config: row.config || {} });
            setStripePublishable(row.config?.publishable_key || "");
            setStripeSecret(row.config?.secret_key_masked ? "••••••••" : "");
            setStripeWebhookSecret(row.config?.webhook_secret_masked ? "••••••••" : "");
          }
          if (row.service_name === "nowpayments") {
            setNow({ id: row.id, enabled: row.enabled, environment: row.config?.environment || "sandbox", config: row.config || {} });
            setNowApiKey(row.config?.api_key_masked ? "••••••••" : "");
            setNowIpnSecret(row.config?.ipn_secret_masked ? "••••••••" : "");
            setNowEmail(row.config?.email || "");
            setNowPassword(row.config?.password_masked ? "••••••••" : "");
          }
          if (row.service_name === "crypto_router") {
            setActiveCrypto(row.config?.active_provider === "nowpayments" ? "nowpayments" : "coinsbuy");
          }
        }
      }
      setLoading(false);
    };
    load();
  }, []);

  const saveCrypto = async () => {
    setSavingCrypto(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      // Save secrets via Edge Function
      const { data: result, error: fnError } = await supabase.functions.invoke("payment-gateway-config", {
        body: {
          action: "save_credentials",
          gateway: "coinsbuy",
          credentials: {
            client_id: cryptoClientId,
            client_secret: cryptoClientSecret !== "••••••••" ? cryptoClientSecret : undefined,
            callback_secret: cryptoCallbackSecret !== "••••••••" ? cryptoCallbackSecret : undefined,
          },
          environment: crypto.environment,
          enabled: crypto.enabled,
        }
      });

      if (fnError) throw fnError;
      if (result && !result.ok) throw new Error(result.error || "Error al guardar");

      toast({ title: "✅ Coinsbuy configurado" });
      // Update masked state
      if (cryptoClientSecret && cryptoClientSecret !== "••••••••") setCryptoClientSecret("••••••••");
      if (cryptoCallbackSecret && cryptoCallbackSecret !== "••••••••") setCryptoCallbackSecret("••••••••");
      if (result?.id) setCrypto(prev => ({ ...prev, id: result.id }));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingCrypto(false);
    }
  };

  const saveCard = async () => {
    setSavingCard(true);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("payment-gateway-config", {
        body: {
          action: "save_credentials",
          gateway: "stripe_gateway",
          credentials: {
            publishable_key: stripePublishable,
            secret_key: stripeSecret !== "••••••••" ? stripeSecret : undefined,
            webhook_secret: stripeWebhookSecret !== "••••••••" ? stripeWebhookSecret : undefined,
          },
          environment: card.environment,
          enabled: card.enabled,
        }
      });

      if (fnError) throw fnError;
      if (result && !result.ok) throw new Error(result.error || "Error al guardar");

      toast({ title: "✅ Stripe configurado" });
      if (stripeSecret && stripeSecret !== "••••••••") setStripeSecret("••••••••");
      if (stripeWebhookSecret && stripeWebhookSecret !== "••••••••") setStripeWebhookSecret("••••••••");
      if (result?.id) setCard(prev => ({ ...prev, id: result.id }));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingCard(false);
    }
  };

  const saveNowpayments = async () => {
    setSavingNow(true);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("payment-gateway-config", {
        body: {
          action: "save_credentials",
          gateway: "nowpayments",
          credentials: {
            api_key: nowApiKey !== "••••••••" ? nowApiKey : undefined,
            ipn_secret: nowIpnSecret !== "••••••••" ? nowIpnSecret : undefined,
            email: nowEmail || undefined,
            password: nowPassword !== "••••••••" ? nowPassword : undefined,
          },
          environment: now.environment,
          enabled: now.enabled,
        }
      });

      if (fnError) throw fnError;
      if (result && !result.ok) throw new Error(result.error || "Error al guardar");

      toast({ title: "✅ NOWPayments configurado" });
      if (nowApiKey && nowApiKey !== "••••••••") setNowApiKey("••••••••");
      if (nowIpnSecret && nowIpnSecret !== "••••••••") setNowIpnSecret("••••••••");
      if (nowPassword && nowPassword !== "••••••••") setNowPassword("••••••••");
      if (result?.id) setNow(prev => ({ ...prev, id: result.id }));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingNow(false);
    }
  };

  const changeActiveCrypto = async (provider: "coinsbuy" | "nowpayments") => {
    const prev = activeCrypto;
    setActiveCrypto(provider);
    setSavingActive(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("payment-gateway-config", {
        body: { action: "set_active_crypto", provider },
      });
      if (error) throw error;
      if (result && !result.ok) throw new Error(result.error || "Error");
      toast({ title: `✅ Proveedor cripto activo: ${provider === "nowpayments" ? "NOWPayments" : "Coinsbuy"}` });
    } catch (err: any) {
      setActiveCrypto(prev);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingActive(false);
    }
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
      {/* Proveedor cripto activo para el checkout del cliente final */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bitcoin className="w-5 h-5 text-primary" />
            Proveedor cripto activo
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Define qué pasarela usa el botón "Pagar con cripto" del cliente final. Cambia entre Coinsbuy y NOWPayments para comparar.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={activeCrypto === "coinsbuy" ? "default" : "outline"}
              disabled={savingActive}
              onClick={() => changeActiveCrypto("coinsbuy")}
              className="flex-1"
            >
              Coinsbuy
            </Button>
            <Button
              variant={activeCrypto === "nowpayments" ? "default" : "outline"}
              disabled={savingActive}
              onClick={() => changeActiveCrypto("nowpayments")}
              className="flex-1"
            >
              NOWPayments
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Coinsbuy Crypto */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bitcoin className="w-5 h-5 text-orange-500" />
            Coinsbuy — Pasarela Crypto
            <Badge variant={crypto.environment === "sandbox" ? "secondary" : "default"} className="ml-auto text-xs">
              {crypto.environment === "sandbox" ? "🧪 Sandbox" : "🚀 Producción"}
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Pagos en criptomonedas (BTC, ETH, USDT, etc.) vía Coinsbuy API v3
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Pasarela activa</Label>
            <Switch checked={crypto.enabled} onCheckedChange={async (v) => {
              setCrypto(p => ({ ...p, enabled: v }));
              if (crypto.id) {
                await (supabase.from as any)("integration_settings").update({ enabled: v }).eq("id", crypto.id);
              }
            }} />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Entorno</Label>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${crypto.environment === "sandbox" ? "text-foreground font-semibold" : "text-muted-foreground"}`}>Sandbox</span>
              <Switch
                checked={crypto.environment === "production"}
                onCheckedChange={(v) => setCrypto(p => ({ ...p, environment: v ? "production" : "sandbox" }))}
              />
              <span className={`text-xs ${crypto.environment === "production" ? "text-foreground font-semibold" : "text-muted-foreground"}`}>Producción</span>
            </div>
          </div>

          {crypto.environment === "production" && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
              <Shield className="w-4 h-4 text-destructive" />
              <span className="text-xs text-destructive font-medium">⚠️ Modo producción — las transacciones son reales</span>
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Client ID (API Key)</Label>
              <Input value={cryptoClientId} onChange={(e) => setCryptoClientId(e.target.value)} placeholder="Tu API Key de Coinsbuy" className="h-8 text-sm font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Client Secret</Label>
              <div className="relative">
                <Input
                  type={showCryptoSecret ? "text" : "password"}
                  value={cryptoClientSecret}
                  onChange={(e) => setCryptoClientSecret(e.target.value)}
                  placeholder="Tu API Secret de Coinsbuy"
                  className="h-8 text-sm font-mono pr-10"
                />
                <button type="button" onClick={() => setShowCryptoSecret(!showCryptoSecret)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showCryptoSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Callback Secret</Label>
              <div className="relative">
                <Input
                  type={showCryptoCallback ? "text" : "password"}
                  value={cryptoCallbackSecret}
                  onChange={(e) => setCryptoCallbackSecret(e.target.value)}
                  placeholder="Tu Callback Secret de Coinsbuy"
                  className="h-8 text-sm font-mono pr-10"
                />
                <button type="button" onClick={() => setShowCryptoCallback(!showCryptoCallback)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showCryptoCallback ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <Button onClick={saveCrypto} disabled={savingCrypto} className="gap-1.5">
            {savingCrypto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {savingCrypto ? "Guardando..." : "Guardar Coinsbuy"}
          </Button>
        </CardContent>
      </Card>

      {/* NOWPayments Crypto */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bitcoin className="w-5 h-5 text-emerald-500" />
            NOWPayments — Pasarela Crypto
            <Badge variant={now.environment === "sandbox" ? "secondary" : "default"} className="ml-auto text-xs">
              {now.environment === "sandbox" ? "🧪 Sandbox" : "🚀 Producción"}
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Pagos en criptomonedas vía NOWPayments (invoice hospedado)
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Pasarela activa</Label>
            <Switch checked={now.enabled} onCheckedChange={async (v) => {
              setNow(p => ({ ...p, enabled: v }));
              if (now.id) {
                await (supabase.from as any)("integration_settings").update({ enabled: v }).eq("id", now.id);
              }
            }} />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Entorno</Label>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${now.environment === "sandbox" ? "text-foreground font-semibold" : "text-muted-foreground"}`}>Sandbox</span>
              <Switch
                checked={now.environment === "production"}
                onCheckedChange={(v) => setNow(p => ({ ...p, environment: v ? "production" : "sandbox" }))}
              />
              <span className={`text-xs ${now.environment === "production" ? "text-foreground font-semibold" : "text-muted-foreground"}`}>Producción</span>
            </div>
          </div>

          {now.environment === "production" && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
              <Shield className="w-4 h-4 text-destructive" />
              <span className="text-xs text-destructive font-medium">⚠️ Modo producción — las transacciones son reales</span>
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">API Key</Label>
              <div className="relative">
                <Input
                  type={showNowApiKey ? "text" : "password"}
                  value={nowApiKey}
                  onChange={(e) => setNowApiKey(e.target.value)}
                  placeholder="Tu API Key de NOWPayments"
                  className="h-8 text-sm font-mono pr-10"
                />
                <button type="button" onClick={() => setShowNowApiKey(!showNowApiKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showNowApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">IPN Secret</Label>
              <div className="relative">
                <Input
                  type={showNowIpn ? "text" : "password"}
                  value={nowIpnSecret}
                  onChange={(e) => setNowIpnSecret(e.target.value)}
                  placeholder="Tu IPN Secret de NOWPayments"
                  className="h-8 text-sm font-mono pr-10"
                />
                <button type="button" onClick={() => setShowNowIpn(!showNowIpn)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showNowIpn ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="pt-2 mt-1 border-t border-border">
              <p className="text-[11px] text-muted-foreground mb-2">Credenciales para <strong>retiros/payouts a IBs</strong> (JWT). Solo necesarias si vas a pagar comisiones en cripto.</p>
              <div className="space-y-1">
                <Label className="text-xs">Email de la cuenta NOWPayments</Label>
                <Input value={nowEmail} onChange={(e) => setNowEmail(e.target.value)} placeholder="email@cuenta-nowpayments" className="h-8 text-sm font-mono" />
              </div>
              <div className="space-y-1 mt-2">
                <Label className="text-xs">Password</Label>
                <div className="relative">
                  <Input
                    type={showNowPassword ? "text" : "password"}
                    value={nowPassword}
                    onChange={(e) => setNowPassword(e.target.value)}
                    placeholder="Password de la cuenta (para payouts)"
                    className="h-8 text-sm font-mono pr-10"
                  />
                  <button type="button" onClick={() => setShowNowPassword(!showNowPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showNowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <Button onClick={saveNowpayments} disabled={savingNow} className="gap-1.5">
            {savingNow ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {savingNow ? "Guardando..." : "Guardar NOWPayments"}
          </Button>
        </CardContent>
      </Card>

      {/* Stripe Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="w-5 h-5 text-blue-500" />
            Stripe — Pasarela Tarjeta
            <Badge variant={card.environment === "sandbox" ? "secondary" : "default"} className="ml-auto text-xs">
              {card.environment === "sandbox" ? "🧪 Sandbox" : "🚀 Producción"}
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Pagos con tarjeta de crédito/débito vía Stripe
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Pasarela activa</Label>
            <Switch checked={card.enabled} onCheckedChange={async (v) => {
              setCard(p => ({ ...p, enabled: v }));
              if (card.id) {
                await (supabase.from as any)("integration_settings").update({ enabled: v }).eq("id", card.id);
              }
            }} />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Entorno</Label>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${card.environment === "sandbox" ? "text-foreground font-semibold" : "text-muted-foreground"}`}>Test</span>
              <Switch
                checked={card.environment === "production"}
                onCheckedChange={(v) => setCard(p => ({ ...p, environment: v ? "production" : "sandbox" }))}
              />
              <span className={`text-xs ${card.environment === "production" ? "text-foreground font-semibold" : "text-muted-foreground"}`}>Live</span>
            </div>
          </div>

          {card.environment === "production" && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
              <Shield className="w-4 h-4 text-destructive" />
              <span className="text-xs text-destructive font-medium">⚠️ Modo live — las transacciones son reales</span>
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Publishable Key</Label>
              <Input value={stripePublishable} onChange={(e) => setStripePublishable(e.target.value)} placeholder="pk_test_... o pk_live_..." className="h-8 text-sm font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Secret Key</Label>
              <div className="relative">
                <Input
                  type={showStripeSecret ? "text" : "password"}
                  value={stripeSecret}
                  onChange={(e) => setStripeSecret(e.target.value)}
                  placeholder="sk_test_... o sk_live_..."
                  className="h-8 text-sm font-mono pr-10"
                />
                <button type="button" onClick={() => setShowStripeSecret(!showStripeSecret)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showStripeSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Webhook Signing Secret</Label>
              <div className="relative">
                <Input
                  type={showStripeWebhook ? "text" : "password"}
                  value={stripeWebhookSecret}
                  onChange={(e) => setStripeWebhookSecret(e.target.value)}
                  placeholder="whsec_..."
                  className="h-8 text-sm font-mono pr-10"
                />
                <button type="button" onClick={() => setShowStripeWebhook(!showStripeWebhook)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showStripeWebhook ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* URL del endpoint que se registra en Stripe (Developers → Webhooks). */}
          <div className="space-y-1 p-3 rounded-md bg-secondary/30 border border-border">
            <Label className="text-xs text-muted-foreground">URL del Webhook (regístrala en Stripe → Developers → Webhooks)</Label>
            <code className="block text-xs font-mono break-all text-foreground">
              {(import.meta.env.VITE_SUPABASE_URL || "https://<tu-proyecto>.supabase.co")}/functions/v1/stripe-webhook
            </code>
            <p className="text-[11px] text-muted-foreground mt-1">
              Eventos a suscribir: <span className="font-mono">checkout.session.completed</span>, <span className="font-mono">checkout.session.async_payment_succeeded</span>. Copia el <span className="font-mono">whsec_…</span> que Stripe muestra al crear el endpoint y pégalo arriba.
            </p>
          </div>

          <Button onClick={saveCard} disabled={savingCard} className="gap-1.5">
            {savingCard ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {savingCard ? "Guardando..." : "Guardar Stripe"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentGatewaySettings;
