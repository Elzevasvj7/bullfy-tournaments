import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Plus, Pencil, Trash2, Webhook, RefreshCw, Send, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

type Wh = { id: string; name: string; url: string; events: string[]; secret: string | null; is_active: boolean };
type Del = {
  id: string; webhook_id: string; event: string; status: string; attempts: number;
  next_attempt_at: string; response_status: number | null; last_error: string | null; created_at: string;
};

const EVENTS = ["lead.created", "lead.stage_changed", "lead.assigned", "lead.won", "lead.lost"];
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-500",
  delivered: "bg-emerald-500/15 text-emerald-500",
  failed: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

export default function WebhooksPanel() {
  const [hooks, setHooks] = useState<Wh[]>([]);
  const [deliveries, setDeliveries] = useState<Del[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState<Partial<Wh> | null>(null);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: h }, { data: d }] = await Promise.all([
      supabase.from("lead_webhooks").select("*").order("created_at", { ascending: false }),
      supabase.from("lead_webhook_deliveries").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setHooks((h ?? []) as Wh[]);
    setDeliveries((d ?? []) as Del[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!dialog?.name || !dialog?.url) { toast.error("Nombre y URL requeridos"); return; }
    const payload = {
      name: dialog.name,
      url: dialog.url,
      events: dialog.events ?? [],
      secret: dialog.secret ?? null,
      is_active: dialog.is_active ?? true,
    };
    const { error } = dialog.id
      ? await supabase.from("lead_webhooks").update(payload).eq("id", dialog.id)
      : await supabase.from("lead_webhooks").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Guardado");
    setDialog(null);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("¿Eliminar webhook?")) return;
    await supabase.from("lead_webhooks").delete().eq("id", id);
    load();
  };
  const toggle = async (h: Wh) => {
    await supabase.from("lead_webhooks").update({ is_active: !h.is_active }).eq("id", h.id);
    load();
  };
  const dispatch = async () => {
    setRunning(true);
    const { error } = await supabase.functions.invoke("lead-webhook-dispatch");
    setRunning(false);
    if (error) toast.error(error.message); else { toast.success("Dispatch ejecutado"); load(); }
  };
  const retry = async (id: string) => {
    await supabase.from("lead_webhook_deliveries").update({ status: "pending", next_attempt_at: new Date().toISOString() }).eq("id", id);
    toast.success("Reencolado");
    load();
  };

  const toggleEvent = (ev: string) => {
    const list = new Set(dialog?.events ?? []);
    list.has(ev) ? list.delete(ev) : list.add(ev);
    setDialog({ ...dialog, events: [...list] });
  };

  return (
    <Tabs defaultValue="hooks">
      <TabsList>
        <TabsTrigger value="hooks"><Webhook className="w-3 h-3 mr-1" /> Webhooks ({hooks.length})</TabsTrigger>
        <TabsTrigger value="deliveries"><Send className="w-3 h-3 mr-1" /> Entregas</TabsTrigger>
      </TabsList>

      <TabsContent value="hooks" className="mt-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Endpoints suscritos</CardTitle>
            <Button size="sm" onClick={() => setDialog({ is_active: true, events: [] })}><Plus className="w-4 h-4" /> Nuevo</Button>
          </CardHeader>
          <CardContent>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
              hooks.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Sin webhooks.</p> :
              <div className="space-y-2">
                {hooks.map((h) => (
                  <div key={h.id} className="p-3 rounded-lg border border-border bg-secondary/30">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{h.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{h.url}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {h.events.map((e) => <Badge key={e} variant="outline" className="text-[10px]">{e}</Badge>)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Switch checked={h.is_active} onCheckedChange={() => toggle(h)} />
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setDialog(h)}><Pencil className="w-3 h-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => remove(h.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="deliveries" className="mt-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Últimas 50 entregas</CardTitle>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
              <Button size="sm" onClick={dispatch} disabled={running}>{running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-1" />} Dispatch</Button>
            </div>
          </CardHeader>
          <CardContent>
            {deliveries.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Sin entregas.</p> :
              <div className="space-y-2">
                {deliveries.map((d) => {
                  const Icon = d.status === "delivered" ? CheckCircle2 : d.status === "failed" ? XCircle : Clock;
                  return (
                    <div key={d.id} className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border bg-secondary/30">
                      <div className="min-w-0">
                        <div className="text-sm font-medium flex items-center gap-2"><Icon className="w-3 h-3" /> {d.event}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(d.created_at), { addSuffix: true, locale: es })} · intentos: {d.attempts}
                          {d.response_status && ` · HTTP ${d.response_status}`}
                          {d.last_error && ` · ${d.last_error.slice(0, 60)}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={STATUS_COLOR[d.status] ?? ""}>{d.status}</Badge>
                        {(d.status === "failed" || d.status === "cancelled") && (
                          <Button size="sm" variant="ghost" onClick={() => retry(d.id)}>Reintentar</Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>}
          </CardContent>
        </Card>
      </TabsContent>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dialog?.id ? "Editar" : "Nuevo"} webhook</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nombre" value={dialog?.name ?? ""} onChange={(e) => setDialog({ ...dialog, name: e.target.value })} />
            <Input placeholder="URL https://..." value={dialog?.url ?? ""} onChange={(e) => setDialog({ ...dialog, url: e.target.value })} />
            <Input placeholder="Secret (HMAC-SHA256)" value={dialog?.secret ?? ""} onChange={(e) => setDialog({ ...dialog, secret: e.target.value })} />
            <div>
              <label className="text-xs text-muted-foreground">Eventos suscritos</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {EVENTS.map((ev) => (
                  <Badge key={ev} variant={(dialog?.events ?? []).includes(ev) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleEvent(ev)}>{ev}</Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={dialog?.is_active ?? true} onCheckedChange={(v) => setDialog({ ...dialog, is_active: v })} /> Activo</div>
          </div>
          <DialogFooter><Button onClick={save}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
