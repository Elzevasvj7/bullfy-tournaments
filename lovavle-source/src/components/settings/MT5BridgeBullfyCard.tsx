import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Server, Loader2, RefreshCw, ExternalLink, CheckCircle2, AlertTriangle, Save } from "lucide-react";
import { callMT5Bridge } from "@/services/mt5BridgeApi";

const SERVICE = "mt5_bridge_bullfy";
const BRIDGE_PUBLIC_URL = "http://3.92.223.216:8000";

type Status = "unknown" | "ok" | "degraded" | "down";

const MT5BridgeBullfyCard = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [defaultGroup, setDefaultGroup] = useState("broker\\TEST-B NUEVO ERICK CRM");
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("unknown");
  const [latency, setLatency] = useState<number | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase.from as any)("integration_settings")
        .select("*").eq("service_name", SERVICE).maybeSingle();
      if (data) {
        setSettingsId(data.id);
        setEnabled(data.enabled);
        setDefaultGroup(data.config?.default_group || "broker\\TEST-B NUEVO ERICK CRM");
      }
      setLoading(false);
    };
    load();
  }, []);

  const testConnection = async () => {
    setTesting(true);
    setStatus("unknown");
    setStatusMsg("");
    try {
      const health = await callMT5Bridge({ action: "health" });
      if (!health.ok) {
        setStatus("down");
        setStatusMsg(health.error || "Sin respuesta del bridge");
        return;
      }
      setLatency(health.latency_ms ?? null);
      const ready = await callMT5Bridge({ action: "health_ready" });
      if (!ready.ok) {
        setStatus("degraded");
        setStatusMsg("Bridge OK, pero MT5 no está listo");
        return;
      }
      setStatus("ok");
      setStatusMsg("Bridge y MT5 operativos");
    } catch (e) {
      setStatus("down");
      setStatusMsg((e as Error).message);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    const config = { default_group: defaultGroup, last_status: status, last_latency_ms: latency };

    if (settingsId) {
      const { error } = await (supabase.from as any)("integration_settings")
        .update({ enabled, config, updated_by: userId }).eq("id", settingsId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setSaving(false); return; }
    } else {
      const { data, error } = await (supabase.from as any)("integration_settings")
        .insert({ service_name: SERVICE, enabled, config, updated_by: userId })
        .select().single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setSaving(false); return; }
      setSettingsId(data.id);
    }
    toast({ title: "✅ Configuración guardada" });
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
      </div>
    );
  }

  const statusBadge = () => {
    if (status === "ok") return <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20"><CheckCircle2 className="w-3 h-3" /> Conectado{latency != null && ` · ${latency}ms`}</Badge>;
    if (status === "degraded") return <Badge className="gap-1 bg-yellow-500/10 text-yellow-600 border-yellow-500/20"><AlertTriangle className="w-3 h-3" /> MT5 desconectado</Badge>;
    if (status === "down") return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Sin respuesta</Badge>;
    return <Badge variant="secondary">Sin probar</Badge>;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            Bridge MT5 Bullfy
          </div>
          {statusBadge()}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Integración con el bridge propietario de MT5 Bullfy (creación de cuentas, depósitos, retiros, créditos).
          Las credenciales se guardan en el servidor — no se exponen al navegador.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Servicio activo</Label>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">URL pública del bridge</Label>
          <code className="block text-xs bg-muted px-3 py-2 rounded">{BRIDGE_PUBLIC_URL}</code>
          <p className="text-[11px] text-muted-foreground">
            Configurada como secret <code>MT5_BRIDGE_URL</code>. Para cambiarla, actualiza el secret.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">API key</Label>
          <code className="block text-xs bg-muted px-3 py-2 rounded">••••••••••••••••</code>
          <p className="text-[11px] text-muted-foreground">
            Almacenada como secret <code>MT5_BRIDGE_API_KEY</code>.
          </p>
        </div>

        <div className="space-y-1">
          <Label className="text-sm">Grupo MT5 por defecto</Label>
          <Input
            value={defaultGroup}
            onChange={(e) => setDefaultGroup(e.target.value)}
            className="h-8 text-sm font-mono"
            placeholder="broker\TEST-B NUEVO ERICK CRM"
          />
          <p className="text-[11px] text-muted-foreground">
            Grupo usado al crear cuentas nuevas desde features que consuman el bridge.
          </p>
        </div>

        {statusMsg && (
          <div className="text-xs text-muted-foreground border-t border-border pt-2">{statusMsg}</div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={testConnection} disabled={testing} variant="outline" size="sm" className="gap-1.5">
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Probar conexión
          </Button>
          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Guardar
          </Button>
          <a href={`${BRIDGE_PUBLIC_URL}/docs`} target="_blank" rel="noopener noreferrer"
             className="inline-flex items-center gap-1 text-xs text-primary hover:underline ml-auto self-center">
            Swagger <ExternalLink className="w-3 h-3" />
          </a>
          <a href={`${BRIDGE_PUBLIC_URL}/panel`} target="_blank" rel="noopener noreferrer"
             className="inline-flex items-center gap-1 text-xs text-primary hover:underline self-center">
            Panel <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
};

export default MT5BridgeBullfyCard;
