import { useEffect, useState } from "react";
import { Plus, Trash2, Save, Edit2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type Plan = {
  id: string;
  plan_code: string;
  display_name: string;
  mode: string | null;
  session_key: string | null;
  session_label: string | null;
  active_hours_per_month: number | null;
  metaapi_cost_monthly: number | null;
  target_price_monthly: number | null;
  target_margin_pct: number | null;
  is_active: boolean;
  sort_order: number | null;
  notes: string | null;
};

const empty: Partial<Plan> = {
  plan_code: "",
  display_name: "",
  mode: "session",
  session_key: "",
  session_label: "",
  active_hours_per_month: 0,
  metaapi_cost_monthly: 0,
  target_price_monthly: 0,
  is_active: true,
  sort_order: 0,
  notes: "",
};

const TradingRoomPlansSettings = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Plan> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("trading_room_plan_catalog")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("target_price_monthly", { ascending: true });
    if (error) toast.error("Error cargando planes: " + error.message);
    else setPlans((data ?? []) as Plan[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.plan_code || !editing.display_name) {
      toast.error("Código y nombre son requeridos");
      return;
    }
    setSaving(true);
    const payload = {
      plan_code: editing.plan_code,
      display_name: editing.display_name,
      mode: editing.mode || "session",
      session_key: editing.session_key || null,
      session_label: editing.session_label || null,
      active_hours_per_month: Number(editing.active_hours_per_month) || 0,
      metaapi_cost_monthly: Number(editing.metaapi_cost_monthly) || 0,
      target_price_monthly: Number(editing.target_price_monthly) || 0,
      is_active: editing.is_active ?? true,
      sort_order: Number(editing.sort_order) || 0,
      notes: editing.notes || null,
    };

    let error;
    if (editing.id) {
      ({ error } = await supabase.from("trading_room_plan_catalog").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("trading_room_plan_catalog").insert(payload));
    }
    setSaving(false);
    if (error) {
      toast.error("Error guardando: " + error.message);
      return;
    }
    toast.success(editing.id ? "Plan actualizado" : "Plan creado");
    setEditing(null);
    load();
  };

  const handleDelete = async (plan: Plan) => {
    if (!window.confirm(`¿Eliminar el plan "${plan.display_name}"? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from("trading_room_plan_catalog").delete().eq("id", plan.id);
    if (error) {
      toast.error("Error eliminando: " + error.message);
      return;
    }
    toast.success("Plan eliminado");
    load();
  };

  const toggleActive = async (plan: Plan) => {
    const { error } = await supabase
      .from("trading_room_plan_catalog")
      .update({ is_active: !plan.is_active })
      .eq("id", plan.id);
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-display font-bold text-foreground">Cobros de Planes — Bullfy Trading Room</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Configura los planes que se cobrarán a los usuarios.
          </p>
        </div>
        <Button onClick={() => setEditing({ ...empty })} className="gap-2">
          <Plus className="w-4 h-4" /> Nuevo plan
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead>Código</TableHead>
              <TableHead className="text-right">Precio cliente / mes</TableHead>
              <TableHead className="text-center">Activo</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : plans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  No hay planes configurados.
                </TableCell>
              </TableRow>
            ) : (
              plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{plan.display_name}</div>
                    <div className="text-xs text-muted-foreground">{plan.session_label || "—"}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{plan.plan_code}</TableCell>
                  <TableCell className="text-right font-semibold text-foreground">
                    ${Number(plan.target_price_monthly ?? 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={plan.is_active} onCheckedChange={() => toggleActive(plan)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(plan)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(plan)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar plan" : "Nuevo plan"}</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código del plan *</Label>
                <Input
                  value={editing.plan_code ?? ""}
                  onChange={(e) => setEditing({ ...editing, plan_code: e.target.value })}
                  placeholder="ej: session_ny"
                />
              </div>
              <div className="space-y-2">
                <Label>Nombre visible *</Label>
                <Input
                  value={editing.display_name ?? ""}
                  onChange={(e) => setEditing({ ...editing, display_name: e.target.value })}
                  placeholder="ej: Sesión NY"
                />
              </div>

              <div className="space-y-2">
                <Label>Modo</Label>
                <Input
                  value={editing.mode ?? ""}
                  onChange={(e) => setEditing({ ...editing, mode: e.target.value })}
                  placeholder="session / stream / 24-7"
                />
              </div>
              <div className="space-y-2">
                <Label>Etiqueta de sesión</Label>
                <Input
                  value={editing.session_label ?? ""}
                  onChange={(e) => setEditing({ ...editing, session_label: e.target.value })}
                  placeholder="ej: Sesión New York"
                />
              </div>

              <div className="space-y-2">
                <Label>Precio cliente / mes (USD) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editing.target_price_monthly ?? 0}
                  onChange={(e) => setEditing({ ...editing, target_price_monthly: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label>Horas activas / mes</Label>
                <Input
                  type="number"
                  value={editing.active_hours_per_month ?? 0}
                  onChange={(e) => setEditing({ ...editing, active_hours_per_month: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Orden</Label>
                <Input
                  type="number"
                  value={editing.sort_order ?? 0}
                  onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Notas (visible al cliente)</Label>
                <Textarea
                  rows={2}
                  value={editing.notes ?? ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-3 md:col-span-2">
                <Switch
                  checked={editing.is_active ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
                <Label>Plan activo (visible para los usuarios)</Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-1" /> {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TradingRoomPlansSettings;
