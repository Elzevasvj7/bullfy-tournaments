import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Coins, Copy, Loader2 } from "lucide-react";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const WEBHOOK_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/nowpayments-webhook`;

interface ConfigState {
  environment: "sandbox" | "live";
  api_key_live_set: boolean;
  ipn_secret_live_set: boolean;
  api_key_sandbox_set: boolean;
  ipn_secret_sandbox_set: boolean;
}

export default function NowPaymentsSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [config, setConfig] = useState<ConfigState>({
    environment: "sandbox",
    api_key_live_set: false,
    ipn_secret_live_set: false,
    api_key_sandbox_set: false,
    ipn_secret_sandbox_set: false,
  });
  const [creds, setCreds] = useState({
    api_key_live: "",
    ipn_secret_live: "",
    api_key_sandbox: "",
    ipn_secret_sandbox: "",
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("nowpayments-config", {
      body: { action: "get_credentials" },
    });
    if (error) {
      toast.error("Error cargando configuración");
    } else if (data?.ok && data.data) {
      setEnabled(!!data.data.enabled);
      setConfig({ ...config, ...data.data.config });
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("nowpayments-config", {
      body: {
        action: "save_credentials",
        environment: config.environment,
        enabled,
        credentials: {
          api_key_live: creds.api_key_live || undefined,
          ipn_secret_live: creds.ipn_secret_live || undefined,
          api_key_sandbox: creds.api_key_sandbox || undefined,
          ipn_secret_sandbox: creds.ipn_secret_sandbox || undefined,
        },
      },
    });
    setSaving(false);
    if (error || !data?.ok) {
      toast.error(data?.error || "Error guardando configuración");
      return;
    }
    toast.success("Configuración guardada");
    setCreds({ api_key_live: "", ipn_secret_live: "", api_key_sandbox: "", ipn_secret_sandbox: "" });
    load();
  };

  const handleTest = async () => {
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("nowpayments-config", {
      body: { action: "test_connection", environment: config.environment },
    });
    setTesting(false);
    if (error || !data?.ok) {
      toast.error(data?.error || "Conexión fallida");
      return;
    }
    toast.success(`✅ ${config.environment.toUpperCase()} OK · ${data.currencies_count} monedas disponibles`);
  };

  const copyWebhook = async () => {
    await navigator.clipboard.writeText(WEBHOOK_URL);
    toast.success("URL copiada");
  };

  return (
    <Card className="bg-gradient-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          NowPayments (Crypto)
          <Badge variant={enabled ? "default" : "secondary"} className="ml-2">
            {enabled ? "Activado" : "Desactivado"}
          </Badge>
          <Badge variant="outline" className="ml-1">
            Modo: {config.environment === "live" ? "LIVE" : "SANDBOX"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="text-sm font-semibold">Habilitar NowPayments</Label>
                <p className="text-xs text-muted-foreground">Permite cobros en cripto en la plataforma</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div>
              <Label>Modo activo</Label>
              <Select
                value={config.environment}
                onValueChange={(v) => setConfig({ ...config, environment: v as "sandbox" | "live" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (pruebas)</SelectItem>
                  <SelectItem value="live">Live (producción)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Determina qué credenciales y endpoint usar para cobros y validación de webhooks.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <Label className="text-xs font-semibold">URL de Webhook (IPN)</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-background border border-border rounded px-2 py-1 truncate">
                  {WEBHOOK_URL}
                </code>
                <Button size="sm" variant="outline" onClick={copyWebhook}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Pega esta URL en NowPayments → Store Settings → IPN callback URL.
              </p>
            </div>

            <p className="text-xs text-muted-foreground -mt-2">
              💡 Las credenciales de Sandbox son <strong>opcionales</strong>. Puedes guardar y probar solo con Live si no tienes cuenta sandbox.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>
                  API Key (Live) <span className="text-destructive">*</span>{" "}
                  {config.api_key_live_set && <Badge variant="outline" className="ml-1">guardada</Badge>}
                </Label>
                <Input
                  type="password"
                  placeholder={config.api_key_live_set ? "•••••••• (deja vacío para mantener)" : "Pega tu API Key"}
                  value={creds.api_key_live}
                  onChange={(e) => setCreds({ ...creds, api_key_live: e.target.value })}
                />
              </div>
              <div>
                <Label>
                  IPN Secret (Live){" "}
                  {config.ipn_secret_live_set && <Badge variant="outline" className="ml-1">guardado</Badge>}
                </Label>
                <Input
                  type="password"
                  placeholder={config.ipn_secret_live_set ? "•••••••• (deja vacío para mantener)" : "Pega tu IPN Secret"}
                  value={creds.ipn_secret_live}
                  onChange={(e) => setCreds({ ...creds, ipn_secret_live: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-muted-foreground">
                  API Key (Sandbox) <span className="text-xs">(opcional)</span>{" "}
                  {config.api_key_sandbox_set && <Badge variant="outline" className="ml-1">guardada</Badge>}
                </Label>
                <Input
                  type="password"
                  placeholder={
                    config.api_key_sandbox_set ? "•••••••• (deja vacío para mantener)" : "Pega tu API Key sandbox"
                  }
                  value={creds.api_key_sandbox}
                  onChange={(e) => setCreds({ ...creds, api_key_sandbox: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-muted-foreground">
                  IPN Secret (Sandbox) <span className="text-xs">(opcional)</span>{" "}
                  {config.ipn_secret_sandbox_set && <Badge variant="outline" className="ml-1">guardado</Badge>}
                </Label>
                <Input
                  type="password"
                  placeholder={
                    config.ipn_secret_sandbox_set ? "•••••••• (deja vacío para mantener)" : "Pega tu IPN Secret sandbox"
                  }
                  value={creds.ipn_secret_sandbox}
                  onChange={(e) => setCreds({ ...creds, ipn_secret_sandbox: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar configuración
              </Button>
              <Button onClick={handleTest} disabled={testing} variant="outline">
                {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Probar conexión ({config.environment})
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
