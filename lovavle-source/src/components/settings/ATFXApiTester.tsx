import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { Send, Loader2, Plus, X, Copy, ChevronDown, History, FlaskConical, Trash2, RotateCcw, Save } from "lucide-react";

type Method = "GET" | "POST" | "PUT" | "DELETE";

interface KV { id: string; key: string; value: string; enabled: boolean; }

interface HistoryEntry {
  id: string;
  ts: number;
  method: Method;
  path: string;
  status: number;
  ok: boolean;
  elapsed_ms: number;
}

interface ResponsePayload {
  status: number;
  success: boolean;
  data: unknown;
  url: string;
  elapsed_ms: number;
  sent_headers: Record<string, string>;
  method: string;
}

// Endpoints reales del manual ATFX
const ATFX_ENDPOINTS: { path: string; label: string }[] = [
  { path: "/trades", label: "Trades — historial completo" },
  { path: "/customers", label: "Customers — listado de clientes" },
  { path: "/accounts", label: "Accounts — cuentas de trading" },
  { path: "/agents", label: "Agents — IBs / agentes" },
  { path: "/transactions", label: "Transactions — depósitos/retiros" },
  { path: "/symbols", label: "Symbols — instrumentos" },
  { path: "/orders", label: "Orders — órdenes pendientes" },
  { path: "/groups", label: "Groups — grupos de trading" },
  { path: "/products", label: "Products — productos del store" },
  { path: "/bonuses", label: "Bonuses — bonificaciones" },
  { path: "/customerbonuses", label: "Customer Bonuses" },
  { path: "/customerfiles", label: "Customer Files — KYC" },
  { path: "/userlogin", label: "User Login — historial de sesiones" },
  { path: "/agentcommission", label: "Agent Commission" },
  { path: "/agenttree", label: "Agent Tree — jerarquía" },
  { path: "/agentstatistics", label: "Agent Statistics" },
  { path: "/auditlog", label: "Audit Log" },
  { path: "/webhooks", label: "Webhooks" },
  { path: "/adapters", label: "Adapters" },
  { path: "/pamm", label: "PAMM" },
  { path: "/store", label: "Store" },
  { path: "/proptrading", label: "Prop Trading" },
];

const HISTORY_KEY = "atfx_tester_history_v1";
const newId = () => Math.random().toString(36).slice(2, 9);

export default function ATFXApiTester() {
  const [open, setOpen] = useState(false);
  const [endpoint, setEndpoint] = useState<string>("");
  const [savedEndpoint, setSavedEndpoint] = useState<string>("");
  const [savingEndpoint, setSavingEndpoint] = useState(false);
  const [method, setMethod] = useState<Method>("GET");
  const [path, setPath] = useState("/trades");
  const [params, setParams] = useState<KV[]>([
    { id: newId(), key: "limit", value: "10", enabled: true },
  ]);
  const [bodyText, setBodyText] = useState('{\n  "key": "value"\n}');
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<ResponsePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Cargar config (endpoint actual) e historial
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.functions.invoke("atfx-proxy", { body: { action: "get_config" } });
      if (data?.endpoint) {
        setEndpoint(data.endpoint);
        setSavedEndpoint(data.endpoint);
      }
    })();
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch { /* noop */ }
  }, [open]);

  const saveHistory = (entry: HistoryEntry) => {
    const next = [entry, ...history].slice(0, 20);
    setHistory(next);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* noop */ }
  };

  const clearHistory = () => {
    setHistory([]);
    try { localStorage.removeItem(HISTORY_KEY); } catch { /* noop */ }
  };

  const addParam = () => setParams((p) => [...p, { id: newId(), key: "", value: "", enabled: true }]);
  const updateParam = (id: string, patch: Partial<KV>) =>
    setParams((p) => p.map((kv) => (kv.id === id ? { ...kv, ...patch } : kv)));
  const removeParam = (id: string) => setParams((p) => p.filter((kv) => kv.id !== id));

  const buildQueryString = () => {
    const sp = new URLSearchParams();
    params.forEach((kv) => {
      if (kv.enabled && kv.key.trim()) sp.append(kv.key.trim(), kv.value);
    });
    const s = sp.toString();
    return s ? `?${s}` : "";
  };

  const fullPath = path + buildQueryString();
  const fullUrl = `${endpoint}${fullPath}`;

  const buildCurl = () => {
    const lines = [
      `curl -X ${method} '${fullUrl}'`,
      `  -H 'Auth: <TOKEN_ID>:<API_TOKEN>'`,
    ];
    if (method !== "GET" && bodyText.trim()) {
      lines.push(`  -H 'Content-Type: application/json'`);
      lines.push(`  -d '${bodyText.replace(/'/g, "'\\''")}'`);
    }
    return lines.join(" \\\n");
  };

  const send = async () => {
    setSending(true);
    setError(null);
    setResponse(null);

    let parsedBody: unknown = undefined;
    if (method !== "GET" && bodyText.trim()) {
      try {
        parsedBody = JSON.parse(bodyText);
      } catch {
        setSending(false);
        setError("JSON del body inválido");
        return;
      }
    }

    const { data, error: invErr } = await supabase.functions.invoke("atfx-proxy", {
      body: {
        action: "raw",
        payload: { path: fullPath, method, body: parsedBody, base_override: endpoint || undefined },
      },
    });

    if (invErr) {
      setError(invErr.message);
      setSending(false);
      return;
    }
    if (!data?.ok) {
      setError(data?.error || "Error en la edge function");
      setSending(false);
      return;
    }

    const payload: ResponsePayload = {
      status: data.status,
      success: data.success,
      data: data.data,
      url: data.url,
      elapsed_ms: data.elapsed_ms ?? 0,
      sent_headers: data.sent_headers ?? {},
      method: data.method ?? method,
    };
    setResponse(payload);
    saveHistory({
      id: newId(),
      ts: Date.now(),
      method,
      path: fullPath,
      status: payload.status,
      ok: payload.success,
      elapsed_ms: payload.elapsed_ms,
    });
    setSending(false);
  };

  const replayFromHistory = (h: HistoryEntry) => {
    setMethod(h.method);
    const [p, qs] = h.path.split("?");
    setPath(p);
    if (qs) {
      const sp = new URLSearchParams(qs);
      const list: KV[] = [];
      sp.forEach((value, key) => list.push({ id: newId(), key, value, enabled: true }));
      setParams(list.length ? list : [{ id: newId(), key: "", value: "", enabled: true }]);
    } else {
      setParams([{ id: newId(), key: "", value: "", enabled: true }]);
    }
  };

  const statusColor = !response
    ? ""
    : response.status >= 200 && response.status < 300
    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
    : response.status >= 400 && response.status < 500
    ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/30"
    : "bg-destructive/10 text-destructive border-destructive/30";

  const responseBodyText =
    typeof response?.data === "string"
      ? response.data
      : JSON.stringify(response?.data ?? null, null, 2);

  return (
    <Card className="border-primary/20">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-primary" />
              <div className="text-left">
                <div className="text-sm font-semibold flex items-center gap-2">
                  ATFX API Tester
                  <Badge variant="outline" className="text-[10px]">Debug · Talend-style</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Inspecciona request/response de cualquier endpoint ATFX en vivo
                </p>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Base endpoint editable */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] uppercase text-muted-foreground">Base URL</Label>
                {endpoint !== savedEndpoint && (
                  <Badge variant="outline" className="text-[9px] text-warning border-warning/30">modificada (no guardada)</Badge>
                )}
              </div>
              <div className="flex gap-1.5">
                <Input
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="https://client.bullfy.com/api/v1"
                  className="h-9 font-mono text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEndpoint(savedEndpoint)}
                  disabled={endpoint === savedEndpoint}
                  className="h-9 gap-1 text-xs"
                  title="Restaurar a la base guardada"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    setSavingEndpoint(true);
                    const { data, error: err } = await supabase.functions.invoke("atfx-proxy", {
                      body: { action: "save_config", payload: { endpoint } },
                    });
                    setSavingEndpoint(false);
                    if (err || !data?.ok) {
                      toast({ title: "Error guardando base", description: err?.message || data?.error, variant: "destructive" });
                      return;
                    }
                    const newEp = data.endpoint || endpoint;
                    setEndpoint(newEp);
                    setSavedEndpoint(newEp);
                    toast({ title: "Base guardada", description: newEp });
                  }}
                  disabled={savingEndpoint || endpoint === savedEndpoint || !endpoint.trim()}
                  className="h-9 gap-1 text-xs"
                  title="Guardar como base permanente"
                >
                  {savingEndpoint ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Editar solo afecta esta prueba. Usa <span className="font-semibold">Save</span> para hacerla permanente.
              </p>
            </div>

            {/* Request bar — METHOD + PATH + SEND */}
            <div className="flex gap-2 items-end">
              <div className="w-28">
                <Label className="text-[10px] uppercase text-muted-foreground">Method</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Path</Label>
                <div className="flex gap-1">
                  <Input
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    placeholder="/trades"
                    className="h-9 font-mono text-sm"
                    list="atfx-endpoints"
                  />
                  <datalist id="atfx-endpoints">
                    {ATFX_ENDPOINTS.map((e) => (
                      <option key={e.path} value={e.path}>{e.label}</option>
                    ))}
                  </datalist>
                </div>
              </div>
              <Button onClick={send} disabled={sending || !endpoint} className="h-9 gap-1.5">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send
              </Button>
            </div>

            {/* URL preview */}
            <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs font-mono break-all text-muted-foreground">
              {method} <span className="text-foreground">{fullUrl}</span>
            </div>

            {/* Quick endpoint chips */}
            <div className="flex flex-wrap gap-1">
              {ATFX_ENDPOINTS.slice(0, 10).map((e) => (
                <button
                  key={e.path}
                  onClick={() => setPath(e.path)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                    path === e.path
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/30 border-border hover:bg-muted"
                  }`}
                  title={e.label}
                >
                  {e.path}
                </button>
              ))}
            </div>

            {/* Query Parameters */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Query Parameters</Label>
                <Button size="sm" variant="ghost" onClick={addParam} className="h-7 gap-1 text-xs">
                  <Plus className="w-3 h-3" /> Add parameter
                </Button>
              </div>
              <div className="space-y-1.5">
                {params.map((kv) => (
                  <div key={kv.id} className="flex gap-1.5 items-center">
                    <input
                      type="checkbox"
                      checked={kv.enabled}
                      onChange={(e) => updateParam(kv.id, { enabled: e.target.checked })}
                      className="w-4 h-4 accent-primary"
                    />
                    <Input
                      value={kv.key}
                      onChange={(e) => updateParam(kv.id, { key: e.target.value })}
                      placeholder="key"
                      className="h-8 text-xs font-mono flex-1"
                    />
                    <span className="text-muted-foreground">=</span>
                    <Input
                      value={kv.value}
                      onChange={(e) => updateParam(kv.id, { value: e.target.value })}
                      placeholder="value"
                      className="h-8 text-xs font-mono flex-[2]"
                    />
                    <Button size="sm" variant="ghost" onClick={() => removeParam(kv.id)} className="h-7 w-7 p-0">
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Headers (read-only, mostrados informativamente) */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Headers (auto)</Label>
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs font-mono space-y-0.5">
                <div><span className="text-muted-foreground">Auth:</span> &lt;tokenId&gt;:&lt;apiToken&gt; <Badge variant="outline" className="ml-1 text-[9px]">inyectado por proxy</Badge></div>
                {method !== "GET" && <div><span className="text-muted-foreground">Content-Type:</span> application/json</div>}
              </div>
            </div>

            {/* Body */}
            {method !== "GET" && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Body (JSON)</Label>
                <Textarea
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  rows={6}
                  className="font-mono text-xs"
                  placeholder='{"key":"value"}'
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                {error}
              </div>
            )}

            {/* Response panel */}
            {response && (
              <div className="space-y-2">
                <div className={`flex items-center justify-between rounded-md border px-3 py-2 ${statusColor}`}>
                  <div className="flex items-center gap-3 text-sm font-semibold">
                    <span>{response.status}</span>
                    <span className="opacity-70">·</span>
                    <span>{response.success ? "OK" : "ERROR"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span>{response.elapsed_ms} ms</span>
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(buildCurl());
                        toast({ title: "cURL copiado al portapapeles" });
                      }}
                      className="h-6 gap-1 text-[10px]"
                    >
                      <Copy className="w-3 h-3" /> Copy as cURL
                    </Button>
                  </div>
                </div>

                <Tabs defaultValue="body">
                  <TabsList className="h-8">
                    <TabsTrigger value="body" className="text-xs h-6">Body (pretty)</TabsTrigger>
                    <TabsTrigger value="raw" className="text-xs h-6">Body (raw)</TabsTrigger>
                    <TabsTrigger value="headers" className="text-xs h-6">Sent headers</TabsTrigger>
                    <TabsTrigger value="curl" className="text-xs h-6">cURL</TabsTrigger>
                  </TabsList>
                  <TabsContent value="body" className="mt-2">
                    <pre className="text-xs bg-muted/40 p-3 rounded-md overflow-auto max-h-[400px] border border-border">
                      {responseBodyText}
                    </pre>
                  </TabsContent>
                  <TabsContent value="raw" className="mt-2">
                    <Textarea readOnly value={responseBodyText} rows={14} className="font-mono text-xs" />
                  </TabsContent>
                  <TabsContent value="headers" className="mt-2">
                    <pre className="text-xs bg-muted/40 p-3 rounded-md overflow-auto max-h-[200px] border border-border">
                      {Object.entries(response.sent_headers).map(([k, v]) => `${k}: ${v}`).join("\n")}
                    </pre>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Token enmascarado. La edge function envía las credenciales reales al llamar a ATFX.
                    </p>
                  </TabsContent>
                  <TabsContent value="curl" className="mt-2">
                    <Textarea readOnly value={buildCurl()} rows={6} className="font-mono text-xs" />
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {/* Historial */}
            {history.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" /> Historial ({history.length})
                  </Label>
                  <Button size="sm" variant="ghost" onClick={clearHistory} className="h-6 gap-1 text-[10px]">
                    <Trash2 className="w-3 h-3" /> Limpiar
                  </Button>
                </div>
                <div className="space-y-1 max-h-48 overflow-auto">
                  {history.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => replayFromHistory(h)}
                      className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded hover:bg-muted/40 text-left font-mono"
                    >
                      <Badge
                        variant="outline"
                        className={`text-[9px] ${h.ok ? "text-emerald-600 border-emerald-500/30" : "text-destructive border-destructive/30"}`}
                      >
                        {h.status}
                      </Badge>
                      <span className="text-muted-foreground w-12">{h.method}</span>
                      <span className="flex-1 truncate">{h.path}</span>
                      <span className="text-muted-foreground">{h.elapsed_ms}ms</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
