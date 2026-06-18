// Gestión de Membresías del IB:
//   1) Vencimientos — qué usuarios tienen membresía, cuándo vencen y su estado.
//   2) Campañas de recordatorio — emails automáticos X días antes de vencer
//      (los envía el cron diario `membership-reminders`).
//
// Tablas nuevas (aún no en los tipos generados) → casts (supabase.from as any).

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/lib/toastUtils";
import { Plus, Edit, Trash2, Loader2, BellRing, CalendarClock } from "lucide-react";
import { usePortalTiers } from "@/hooks/usePortalTiers";

interface Props { portalId: string; }

interface UserMembership {
  id: string;
  tier_slug: string;
  started_at: string;
  expires_at: string | null;
  status: string;
  partner_users: { nombre: string; email: string } | null;
  portal_products: { title: string } | null;
}

interface Campaign {
  id: string;
  name: string;
  days_before: number;
  subject: string;
  message: string;
  active: boolean;
}

const emptyCampaign = {
  name: "",
  days_before: 7,
  subject: "Tu membresía está por vencer",
  message: "Hola {nombre},\n\nTu membresía {membresia} vence el {fecha_vencimiento}. Renuévala para no perder tus beneficios.\n\n¡Te esperamos!",
  active: true,
};

const PortalMembershipsAdmin = ({ portalId }: Props) => {
  const { labelFor } = usePortalTiers(portalId);
  const [memberships, setMemberships] = useState<UserMembership[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialog, setDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyCampaign);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [mRes, cRes] = await Promise.all([
      (supabase.from as any)("portal_user_memberships")
        .select("id, tier_slug, started_at, expires_at, status, partner_users:partner_user_id(nombre, email), portal_products:product_id(title)")
        .eq("portal_id", portalId)
        .order("expires_at", { ascending: true, nullsFirst: false }),
      (supabase.from as any)("portal_membership_reminder_campaigns")
        .select("id, name, days_before, subject, message, active")
        .eq("portal_id", portalId)
        .order("days_before", { ascending: true }),
    ]);
    setMemberships((mRes.data as UserMembership[]) || []);
    setCampaigns((cRes.data as Campaign[]) || []);
    setLoading(false);
  }, [portalId]);

  useEffect(() => { load(); }, [load]);

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "Vitalicia";

  const daysLeft = (iso: string | null): number | null => {
    if (!iso) return null;
    return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  // ---- Campaign CRUD ----
  const open = (c?: Campaign) => {
    if (c) { setEditId(c.id); setForm({ name: c.name, days_before: c.days_before, subject: c.subject, message: c.message, active: c.active }); }
    else { setEditId(null); setForm(emptyCampaign); }
    setDialog(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("El nombre de la campaña es requerido"); return; }
    if (!form.subject.trim() || !form.message.trim()) { toast.error("Asunto y mensaje son requeridos"); return; }
    const days = Number(form.days_before);
    if (!Number.isFinite(days) || days < 1 || days > 60) { toast.error("Los días antes deben estar entre 1 y 60"); return; }
    setSaving(true);
    try {
      const payload = {
        portal_id: portalId,
        name: form.name.trim(),
        days_before: days,
        subject: form.subject.trim(),
        message: form.message.trim(),
        active: form.active,
      };
      const { error } = editId
        ? await (supabase.from as any)("portal_membership_reminder_campaigns").update(payload).eq("id", editId)
        : await (supabase.from as any)("portal_membership_reminder_campaigns").insert(payload);
      if (error) throw error;
      toast.success(editId ? "Campaña actualizada" : "Campaña creada");
      setDialog(false);
      load();
    } catch (e: any) {
      toast.error("Error: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c: Campaign) => {
    await (supabase.from as any)("portal_membership_reminder_campaigns").update({ active: !c.active }).eq("id", c.id);
    load();
  };

  const remove = async (c: Campaign) => {
    if (!confirm(`¿Eliminar la campaña "${c.name}"?`)) return;
    const { error } = await (supabase.from as any)("portal_membership_reminder_campaigns").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Campaña eliminada");
    load();
  };

  const activeMemberships = useMemo(() => memberships.filter(m => m.status === "active"), [memberships]);

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Campañas de recordatorio */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><BellRing className="w-4 h-4 text-primary" /> Campañas de recordatorio</CardTitle>
          <Button size="sm" onClick={() => open()} className="gap-1.5"><Plus className="w-4 h-4" /> Nueva campaña</Button>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Envía un email automático a tus usuarios X días antes de que venza su membresía. Variables disponibles: <code className="text-[11px]">{"{nombre}"}</code>, <code className="text-[11px]">{"{membresia}"}</code>, <code className="text-[11px]">{"{fecha_vencimiento}"}</code>.
          </p>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aún no hay campañas de recordatorio.</p>
          ) : (
            <div className="space-y-2">
              {campaigns.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-md border border-border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{c.name}</span>
                      <Badge variant="secondary" className="text-xs">{c.days_before} {c.days_before === 1 ? "día" : "días"} antes</Badge>
                      {!c.active && <Badge variant="outline" className="text-xs">Inactiva</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{c.subject}</p>
                  </div>
                  <Switch checked={c.active} onCheckedChange={() => toggleActive(c)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => open(c)}><Edit className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(c)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vencimientos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><CalendarClock className="w-4 h-4 text-primary" /> Membresías y vencimientos</CardTitle>
        </CardHeader>
        <CardContent>
          {activeMemberships.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Todavía no hay membresías activas compradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Membresía</TableHead>
                    <TableHead>Nivel</TableHead>
                    <TableHead>Inicio</TableHead>
                    <TableHead>Vence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeMemberships.map(m => {
                    const dl = daysLeft(m.expires_at);
                    const soon = dl !== null && dl <= 7;
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{m.partner_users?.nombre || "—"}</p>
                            <p className="text-xs text-muted-foreground truncate">{m.partner_users?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{m.portal_products?.title || "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{labelFor(m.tier_slug)}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmt(m.started_at)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {m.expires_at === null ? (
                            <Badge variant="secondary" className="text-xs">Vitalicia</Badge>
                          ) : (
                            <span className={`text-sm ${soon ? "text-destructive font-medium" : "text-foreground"}`}>
                              {fmt(m.expires_at)}{dl !== null && dl >= 0 && <span className="text-xs text-muted-foreground"> · {dl}d</span>}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campaign dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Editar campaña" : "Nueva campaña"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nombre de la campaña</Label><Input value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="Ej: Aviso 7 días antes" /></div>
            <div>
              <Label>Días antes de vencer</Label>
              <Input type="number" min={1} max={60} value={form.days_before} onChange={e => setForm((f: any) => ({ ...f, days_before: parseInt(e.target.value) || 0 }))} />
              <p className="text-xs text-muted-foreground mt-1">El email se envía ese día. Puedes crear varias campañas (ej. una a 7 días y otra a 1 día).</p>
            </div>
            <div><Label>Asunto</Label><Input value={form.subject} onChange={e => setForm((f: any) => ({ ...f, subject: e.target.value }))} /></div>
            <div>
              <Label>Mensaje</Label>
              <Textarea rows={6} value={form.message} onChange={e => setForm((f: any) => ({ ...f, message: e.target.value }))} />
              <p className="text-xs text-muted-foreground mt-1">Variables: <code className="text-[11px]">{"{nombre}"}</code>, <code className="text-[11px]">{"{membresia}"}</code>, <code className="text-[11px]">{"{fecha_vencimiento}"}</code>.</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={v => setForm((f: any) => ({ ...f, active: v }))} />
              <Label>Campaña activa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="gap-1.5">{saving && <Loader2 className="w-4 h-4 animate-spin" />}{editId ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortalMembershipsAdmin;
