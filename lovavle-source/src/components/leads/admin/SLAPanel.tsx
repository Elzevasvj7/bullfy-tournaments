import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, AlertTriangle, ShieldCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

type Cfg = {
  id: string;
  pipeline_stage_id: string | null;
  first_contact_minutes: number;
  follow_up_hours: number;
  max_days_in_stage: number;
  auto_escalate: boolean;
  escalate_to_role: string | null;
  notify_closer: boolean;
  notify_admin: boolean;
  is_active: boolean;
};
type Stage = { id: string; name: string };
type Violation = {
  id: string;
  lead_id: string;
  violation_type: string;
  severity: string;
  detected_at: string;
  resolved_at: string | null;
  closer_id: string | null;
  lead_name?: string;
  closer_name?: string;
};

const SEV_COLOR: Record<string, string> = {
  low: "bg-amber-500/15 text-amber-500",
  medium: "bg-orange-500/15 text-orange-500",
  high: "bg-destructive/15 text-destructive",
  critical: "bg-destructive text-destructive-foreground",
};

export default function SLAPanel() {
  const [configs, setConfigs] = useState<Cfg[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState<Partial<Cfg> | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: c }, { data: s }, { data: v }] = await Promise.all([
      supabase.from("lead_sla_config").select("*").order("created_at"),
      supabase.from("lead_pipeline_stages").select("id,name").order("position"),
      supabase.from("lead_sla_violations").select("*").order("detected_at", { ascending: false }).limit(50),
    ]);
    setConfigs((c ?? []) as Cfg[]);
    setStages((s ?? []) as Stage[]);

    const vs = (v ?? []) as Violation[];
    const leadIds = [...new Set(vs.map((x) => x.lead_id))];
    const closerIds = [...new Set(vs.map((x) => x.closer_id).filter(Boolean) as string[])];
    const [{ data: leads }, { data: profs }] = await Promise.all([
      leadIds.length ? supabase.from("stream_leads").select("id,name").in("id", leadIds) : Promise.resolve({ data: [] }),
      closerIds.length ? supabase.from("profiles").select("id,nombre").in("id", closerIds) : Promise.resolve({ data: [] }),
    ]);
    const lMap = Object.fromEntries((leads ?? []).map((l: any) => [l.id, l.name]));
    const pMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.nombre]));
    setViolations(vs.map((x) => ({ ...x, lead_name: lMap[x.lead_id], closer_name: x.closer_id ? pMap[x.closer_id] : undefined })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!dialog) return;
    const payload = {
      pipeline_stage_id: dialog.pipeline_stage_id ?? null,
      first_contact_minutes: dialog.first_contact_minutes ?? 30,
      follow_up_hours: dialog.follow_up_hours ?? 24,
      max_days_in_stage: dialog.max_days_in_stage ?? 7,
      auto_escalate: dialog.auto_escalate ?? false,
      escalate_to_role: dialog.escalate_to_role ?? null,
      notify_closer: dialog.notify_closer ?? true,
      notify_admin: dialog.notify_admin ?? false,
      is_active: dialog.is_active ?? true,
    };
    const { error } = dialog.id
      ? await supabase.from("lead_sla_config").update(payload).eq("id", dialog.id)
      : await supabase.from("lead_sla_config").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Guardado");
    setDialog(null);
    load();
  };
  const resolve = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("lead_sla_violations").update({ resolved_at: new Date().toISOString(), resolved_by: user?.id }).eq("id", id);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("¿Eliminar configuración?")) return;
    await supabase.from("lead_sla_config").delete().eq("id", id);
    load();
  };

  const filtered = showResolved ? violations : violations.filter((v) => !v.resolved_at);

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Reglas SLA</CardTitle>
          <Button size="sm" onClick={() => setDialog({ first_contact_minutes: 30, follow_up_hours: 24, max_days_in_stage: 7, is_active: true })}><Plus className="w-4 h-4" /> Regla</Button>
        </CardHeader>
        <CardContent>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
            configs.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Sin reglas SLA.</p> :
            <div className="space-y-2">
              {configs.map((c) => {
                const stage = stages.find((s) => s.id === c.pipeline_stage_id);
                return (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30">
                    <div>
                      <div className="text-sm font-medium">{stage?.name ?? "Global"}</div>
                      <div className="text-xs text-muted-foreground">1er contacto ≤ {c.first_contact_minutes}m · follow-up ≤ {c.follow_up_hours}h · máx stage {c.max_days_in_stage}d</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={c.is_active ? "default" : "outline"}>{c.is_active ? "activa" : "off"}</Badge>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setDialog(c)}><Pencil className="w-3 h-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => remove(c.id)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-destructive" /> Violaciones</CardTitle>
          <div className="flex items-center gap-2 text-xs"><Switch checked={showResolved} onCheckedChange={setShowResolved} /> Mostrar resueltas</div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Sin violaciones {showResolved ? "" : "abiertas"}.</p> :
            <div className="space-y-2">
              {filtered.map((v) => (
                <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{v.lead_name ?? v.lead_id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">{v.violation_type} · {v.closer_name ?? "—"} · {formatDistanceToNow(new Date(v.detected_at), { addSuffix: true, locale: es })}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={SEV_COLOR[v.severity] ?? ""}>{v.severity}</Badge>
                    {v.resolved_at ? <Badge variant="outline" className="text-emerald-500"><CheckCircle2 className="w-3 h-3 mr-1" /> resuelta</Badge>
                      : <Button size="sm" variant="ghost" onClick={() => resolve(v.id)}>Resolver</Button>}
                  </div>
                </div>
              ))}
            </div>}
        </CardContent>
      </Card>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dialog?.id ? "Editar" : "Nueva"} regla SLA</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={dialog?.pipeline_stage_id ?? "global"} onValueChange={(v) => setDialog({ ...dialog, pipeline_stage_id: v === "global" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global (sin stage)</SelectItem>
                {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="text-xs text-muted-foreground">1er contacto (min)</label><Input type="number" value={dialog?.first_contact_minutes ?? ""} onChange={(e) => setDialog({ ...dialog, first_contact_minutes: parseInt(e.target.value) })} /></div>
              <div><label className="text-xs text-muted-foreground">Follow-up (h)</label><Input type="number" value={dialog?.follow_up_hours ?? ""} onChange={(e) => setDialog({ ...dialog, follow_up_hours: parseInt(e.target.value) })} /></div>
              <div><label className="text-xs text-muted-foreground">Máx días stage</label><Input type="number" value={dialog?.max_days_in_stage ?? ""} onChange={(e) => setDialog({ ...dialog, max_days_in_stage: parseInt(e.target.value) })} /></div>
            </div>
            <div className="flex items-center gap-2 text-sm"><Switch checked={dialog?.auto_escalate ?? false} onCheckedChange={(v) => setDialog({ ...dialog, auto_escalate: v })} /> Auto-escalar</div>
            <Select value={dialog?.escalate_to_role ?? ""} onValueChange={(v) => setDialog({ ...dialog, escalate_to_role: v || null })}>
              <SelectTrigger><SelectValue placeholder="Escalar a rol" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin_ventas">admin_ventas</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><Switch checked={dialog?.notify_closer ?? true} onCheckedChange={(v) => setDialog({ ...dialog, notify_closer: v })} /> Notificar closer</label>
              <label className="flex items-center gap-2"><Switch checked={dialog?.notify_admin ?? false} onCheckedChange={(v) => setDialog({ ...dialog, notify_admin: v })} /> Notificar admin</label>
            </div>
            <div className="flex items-center gap-2"><Switch checked={dialog?.is_active ?? true} onCheckedChange={(v) => setDialog({ ...dialog, is_active: v })} /> Activa</div>
          </div>
          <DialogFooter><Button onClick={save}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
