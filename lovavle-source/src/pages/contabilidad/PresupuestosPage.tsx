import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { Plus, Loader2, ChevronRight, Trash2 } from "lucide-react";
import DeleteWithReasonDialog from "@/components/contabilidad/DeleteWithReasonDialog";
import { useAuth } from "@/hooks/useAuth";

interface Budget {
  id: string; name: string; period_start: string; period_end: string;
  status: string; scope: string;
}
interface Variance {
  budget_line_id: string;
  category_name: string | null;
  planned_usd: number;
  actual_usd: number;
  variance_usd: number;
  variance_pct: number | null;
  status: string;
}
interface Cat { id: string; name: string }

const statusColor: Record<string, string> = {
  under: "bg-emerald-500", on_track: "bg-blue-500", over: "bg-amber-500",
  critical: "bg-rose-500", no_plan: "bg-muted",
};

export default function PresupuestosPage() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Budget | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Budget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [variances, setVariances] = useState<Variance[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [openLine, setOpenLine] = useState(false);
  const [cats, setCats] = useState<Cat[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", period_start: "", period_end: "", scope: "global", status: "active",
  });
  const [line, setLine] = useState({ category_id: "", amount_planned_usd: "" });

  const loadBudgets = async () => {
    setLoading(true);
    const { data } = await supabase.from("accounting_budgets").select("*").order("created_at", { ascending: false });
    setBudgets((data ?? []) as Budget[]);
    setLoading(false);
  };

  const loadVariances = async (b: Budget) => {
    setSelected(b);
    const { data, error } = await supabase.rpc("get_budget_variances", { _budget_id: b.id });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setVariances((data ?? []) as Variance[]);
  };

  useEffect(() => {
    loadBudgets();
    supabase.from("accounting_expense_categories").select("id,name").eq("is_active", true).order("name")
      .then(({ data }) => setCats((data ?? []) as Cat[]));
  }, []);

  const saveBudget = async () => {
    if (!form.name || !form.period_start || !form.period_end) {
      toast({ title: "Faltan datos", variant: "destructive" }); return;
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("accounting_budgets").insert({
      name: form.name, period_start: form.period_start, period_end: form.period_end,
      scope: form.scope, status: form.status, created_by: u.user!.id,
    });
    setSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setOpenNew(false);
    setForm({ name: "", period_start: "", period_end: "", scope: "global", status: "active" });
    loadBudgets();
  };

  const saveLine = async () => {
    if (!selected || !line.amount_planned_usd) return;
    setSaving(true);
    const { error } = await supabase.from("accounting_budget_lines").insert({
      budget_id: selected.id,
      category_id: line.category_id || null,
      amount_planned_usd: Number(line.amount_planned_usd),
    });
    setSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setOpenLine(false); setLine({ category_id: "", amount_planned_usd: "" });
    loadVariances(selected);
  };

  const doDeleteBudget = async (b: Budget, reason: string) => {
    setDeleting(true);
    try {
      // Audit log BEFORE deletion so the trail survives FK cascades.
      await supabase.from("accounting_audit_log").insert({
        actor_user_id: user?.id ?? null,
        entity: "accounting_budgets",
        entity_id: b.id,
        action: "delete",
        before_data: { ...(b as any), deletion_reason: reason },
        after_data: null,
      });
      // Remove dependent lines first (in case FK is RESTRICT).
      await supabase.from("accounting_budget_lines").delete().eq("budget_id", b.id);
      const { error } = await supabase.from("accounting_budgets").delete().eq("id", b.id);
      if (error) throw error;
      toast({ title: "Presupuesto eliminado", description: "Motivo registrado en Auditoría." });
      setConfirmDelete(null);
      if (selected?.id === b.id) { setSelected(null); setVariances([]); }
      await loadBudgets();
    } catch (e: any) {
      toast({ title: "Error al eliminar", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const fmt = (n: number) => (n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">Presupuestos</h2>
          <p className="text-muted-foreground text-sm">Plan vs. real con análisis de variaciones</p>
        </div>
        <Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-2" />Nuevo presupuesto</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Presupuestos</CardTitle></CardHeader>
          <CardContent className="p-0">
            {loading ? <div className="p-4 text-muted-foreground text-sm">Cargando…</div> :
              budgets.length === 0 ? <div className="p-4 text-muted-foreground text-sm">Sin presupuestos</div> :
              <div className="divide-y">
                {budgets.map((b) => (
                  <div key={b.id}
                    className={`group w-full p-3 flex items-center justify-between gap-2 hover:bg-secondary/40 ${selected?.id === b.id ? "bg-secondary/60" : ""}`}>
                    <button onClick={() => loadVariances(b)} className="flex-1 min-w-0 text-left">
                      <div className="font-medium truncate">{b.name}</div>
                      <div className="text-xs text-muted-foreground">{b.period_start} → {b.period_end}</div>
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-60 group-hover:opacity-100"
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(b); }}
                      title="Eliminar presupuesto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            }
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {selected ? `Variaciones · ${selected.name}` : "Selecciona un presupuesto"}
            </CardTitle>
            {selected && (
              <Button size="sm" variant="outline" onClick={() => setOpenLine(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Línea
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!selected ? <div className="text-muted-foreground text-sm">—</div> :
              variances.length === 0 ? <div className="text-muted-foreground text-sm">Sin líneas. Agrega una.</div> :
              <div className="space-y-3">
                {variances.map((v) => {
                  const pct = v.planned_usd > 0 ? Math.min(100, (v.actual_usd / v.planned_usd) * 100) : 0;
                  return (
                    <div key={v.budget_line_id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="font-medium">{v.category_name ?? "(sin categoría)"}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{fmt(v.actual_usd)} / {fmt(v.planned_usd)}</span>
                          <Badge className={`${statusColor[v.status] ?? "bg-muted"} text-white`}>{v.status}</Badge>
                        </div>
                      </div>
                      <Progress value={pct} className="h-2" />
                      {v.variance_pct !== null && (
                        <div className={`text-xs ${v.variance_usd > 0 ? "text-rose-500" : "text-emerald-500"}`}>
                          {v.variance_usd > 0 ? "+" : ""}{v.variance_pct}% · {fmt(v.variance_usd)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            }
          </CardContent>
        </Card>
      </div>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo presupuesto</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Desde</Label><Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} /></div>
              <div><Label>Hasta</Label><Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Alcance</Label>
                <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="category">Por categoría</SelectItem>
                    <SelectItem value="geography">Por geografía</SelectItem>
                    <SelectItem value="cost_center">Centro de costo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Borrador</SelectItem>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="closed">Cerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
            <Button onClick={saveBudget} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openLine} onOpenChange={setOpenLine}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva línea de presupuesto</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Categoría (opcional)</Label>
              <Select value={line.category_id} onValueChange={(v) => setLine({ ...line, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>{cats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Monto planeado (USD)</Label>
              <Input type="number" step="0.01" value={line.amount_planned_usd} onChange={(e) => setLine({ ...line, amount_planned_usd: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenLine(false)}>Cancelar</Button>
            <Button onClick={saveLine} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteWithReasonDialog
        open={!!confirmDelete}
        title="¿Eliminar este presupuesto?"
        description="Se eliminarán también todas sus líneas asociadas. Quedará registrado en Auditoría con tu usuario, fecha y el motivo."
        itemLabel={confirmDelete ? `${confirmDelete.name} · ${confirmDelete.period_start} → ${confirmDelete.period_end}` : null}
        busy={deleting}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={(reason) => confirmDelete && doDeleteBudget(confirmDelete, reason)}
      />
    </div>
  );
}
