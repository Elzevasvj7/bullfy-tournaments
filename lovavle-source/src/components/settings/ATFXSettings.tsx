import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plug, CheckCircle2, XCircle, Send, Package, Lock, Save, Eye, EyeOff, Settings } from "lucide-react";

interface ATFXResult {
  ok?: boolean;
  connected?: boolean;
  status?: number;
  url?: string;
  sample?: any;
  products?: any;
  response?: any;
  request?: any;
  raw?: any;
  error?: string;
  success?: boolean;
}

const DEFAULT_ENDPOINT = "https://bullfy-live.brokertools.io/api/v1";

const ATFXSettings = () => {
  const { isGlobalAdmin } = useAuth();
  const [testing, setTesting] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [connectionResult, setConnectionResult] = useState<ATFXResult | null>(null);
  const [products, setProducts] = useState<any>(null);
  const [enrollResult, setEnrollResult] = useState<ATFXResult | null>(null);
  const [productId, setProductId] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");

  // Configuración de credenciales
  const [cfgLoading, setCfgLoading] = useState(true);
  const [cfgSaving, setCfgSaving] = useState(false);
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT);
  const [tokenId, setTokenId] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [apiTokenSet, setApiTokenSet] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!isGlobalAdmin) return;
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGlobalAdmin]);

  const loadConfig = async () => {
    setCfgLoading(true);
    const { data, error } = await supabase.functions.invoke("atfx-proxy", {
      body: { action: "get_config" },
    });
    if (!error && data?.ok) {
      setEndpoint(data.endpoint || DEFAULT_ENDPOINT);
      setTokenId(data.token_id || "");
      setApiTokenSet(!!data.api_token_set);
      setConfigured(!!data.configured);
      setUpdatedAt(data.updated_at || null);
    }
    setCfgLoading(false);
  };

  const handleSaveConfig = async () => {
    if (!tokenId.trim()) {
      toast({ title: "Falta Token ID", variant: "destructive" });
      return;
    }
    if (!apiTokenSet && !apiToken.trim()) {
      toast({ title: "Falta API Token", description: "Es requerido la primera vez", variant: "destructive" });
      return;
    }
    setCfgSaving(true);
    const { data, error } = await supabase.functions.invoke("atfx-proxy", {
      body: {
        action: "save_config",
        payload: { endpoint: endpoint.trim(), token_id: tokenId.trim(), api_token: apiToken.trim() },
      },
    });
    setCfgSaving(false);
    if (error || !data?.ok) {
      toast({ title: "❌ Error al guardar", description: data?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "✅ Configuración guardada" });
    setApiToken("");
    setShowToken(false);
    await loadConfig();
  };

  if (!isGlobalAdmin) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
        <Lock className="w-4 h-4" /> Solo Master Admin puede acceder a esta integración.
      </div>
    );
  }

  const invoke = async (action: string, payload?: any): Promise<ATFXResult> => {
    const { data, error } = await supabase.functions.invoke("atfx-proxy", {
      body: { action, payload },
    });
    if (error) return { ok: false, error: error.message };
    return data as ATFXResult;
  };

  const handleTest = async () => {
    setTesting(true);
    setConnectionResult(null);
    const res = await invoke("test_connection");
    setConnectionResult(res);
    if (res.ok && res.connected) toast({ title: "✅ Conexión exitosa con ATFX" });
    else toast({ title: "❌ Falló la conexión", description: res.error || `HTTP ${res.status}`, variant: "destructive" });
    setTesting(false);
  };

  const handleListProducts = async () => {
    setLoadingProducts(true);
    setProducts(null);
    const res = await invoke("list_products");
    if (res.ok) {
      setProducts(res.products);
      toast({ title: "✅ Productos cargados" });
    } else {
      toast({ title: "❌ Error", description: res.error, variant: "destructive" });
    }
    setLoadingProducts(false);
  };

  const handleEnroll = async () => {
    if (!productId || !email) {
      toast({ title: "Falta información", description: "ProductId y email son requeridos", variant: "destructive" });
      return;
    }
    setEnrolling(true);
    setEnrollResult(null);
    const payload: Record<string, unknown> = { productId, email };
    if (firstName) payload.firstName = firstName;
    if (lastName) payload.lastName = lastName;
    if (phone) payload.phone = phone;
    if (country) payload.country = country;

    const res = await invoke("enroll_prop", payload);
    setEnrollResult(res);
    if (res.ok && res.success) toast({ title: "✅ Enroll enviado correctamente" });
    else toast({ title: "❌ Falló enroll", description: res.error || `HTTP ${res.status}`, variant: "destructive" });
    setEnrolling(false);
  };

  const productList = Array.isArray(products) ? products : products?.data ?? products?.products ?? null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Plug className="w-5 h-5 text-primary" />
          API ATFX — CRM Broker
          <Badge variant="outline" className="ml-2 text-[10px]">Solo Master Admin</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Conexión con el CRM del broker.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="config" className="space-y-4">
          <TabsList>
            <TabsTrigger value="config" className="gap-1.5"><Settings className="w-3.5 h-3.5" />Configuración</TabsTrigger>
            <TabsTrigger value="connection">Conexión</TabsTrigger>
          </TabsList>

          {/* CONFIG */}
          <TabsContent value="config" className="space-y-3">
            {cfgLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando configuración…
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-xs">
                  {configured ? (
                    <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/40 gap-1"><CheckCircle2 className="w-3 h-3" />Configurado</Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-600"><XCircle className="w-3 h-3" />Sin configurar</Badge>
                  )}
                  {updatedAt && (
                    <span className="text-muted-foreground">· Actualizado: {new Date(updatedAt).toLocaleString()}</span>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Endpoint base</Label>
                  <Input
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    className="h-9 text-sm font-mono"
                    placeholder={DEFAULT_ENDPOINT}
                  />
                  <p className="text-[10px] text-muted-foreground">URL raíz de la API (sin barra final).</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">API Token ID</Label>
                  <Input
                    value={tokenId}
                    onChange={(e) => setTokenId(e.target.value)}
                    className="h-9 text-sm font-mono"
                    placeholder="Identificador del token"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">
                    API Token {apiTokenSet && <span className="text-muted-foreground font-normal">(guardado — deja vacío para conservar)</span>}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showToken ? "text" : "password"}
                      value={apiToken}
                      onChange={(e) => setApiToken(e.target.value)}
                      className="h-9 text-sm font-mono pr-10"
                      placeholder={apiTokenSet ? "••••••••••••" : "Pega aquí el API token"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showToken ? "Ocultar" : "Mostrar"}
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button onClick={handleSaveConfig} disabled={cfgSaving} className="gap-1.5">
                  {cfgSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar configuración
                </Button>

                <p className="text-[10px] text-muted-foreground">
                  Las credenciales se guardan cifradas en la base de datos y se usan automáticamente en cada llamada a ATFX.
                </p>
              </>
            )}
          </TabsContent>

          {/* CONNECTION */}
          <TabsContent value="connection" className="space-y-3">
            <div className="rounded-md border border-border p-3 bg-secondary/20 text-xs space-y-1">
              <div><span className="text-muted-foreground">Endpoint base:</span> <code>{endpoint || DEFAULT_ENDPOINT}</code></div>
              <div><span className="text-muted-foreground">Auth header:</span> <code>Auth: 0:{"<TOKEN_ID>"}_{"<API_TOKEN>"}</code></div>
              <div><span className="text-muted-foreground">Estado:</span> {configured ? "✅ Credenciales configuradas" : "⚠️ Configura primero en la pestaña Configuración"}</div>
            </div>
            <Button onClick={handleTest} disabled={testing} className="gap-1.5">
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
              Probar conexión
            </Button>
            {connectionResult && (
              <div className={`rounded-md border p-3 text-xs ${connectionResult.ok && connectionResult.connected ? "border-emerald-500/40 bg-emerald-500/5" : "border-destructive/40 bg-destructive/5"}`}>
                <div className="flex items-center gap-2 font-medium mb-2">
                  {connectionResult.ok && connectionResult.connected ? (
                    <><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Conexión OK (HTTP {connectionResult.status})</>
                  ) : (
                    <><XCircle className="w-4 h-4 text-destructive" /> Falló (HTTP {connectionResult.status ?? "?"}) — {connectionResult.error}</>
                  )}
                </div>
                <pre className="whitespace-pre-wrap break-all max-h-64 overflow-auto bg-background/50 p-2 rounded">
                  {JSON.stringify(connectionResult, null, 2)}
                </pre>
              </div>
            )}
          </TabsContent>

        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ATFXSettings;
