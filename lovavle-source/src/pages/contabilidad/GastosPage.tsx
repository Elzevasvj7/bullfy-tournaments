import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Loader2 } from "lucide-react";

interface Expense {
  id: string; description: string | null; expense_date: string;
  amount_original: number; currency_original: string;
  amount_usd: number | null; status: string;
  funding_source: string | null; reimbursement_status: string | null;
}
const FUNDING_LABEL: Record<string, string> = {
  corporate_card: "Tarjeta corporativa",
  treasury_advance: "Adelanto tesorería",
  own_money_reimbursable: "Dinero propio",
};
interface Opt { id: string; name: string; code?: string | null }

export default function GastosPage() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cats, setCats] = useState<Opt[]>([]);
  const [geos, setGeos] = useState<Opt[]>([]);
  const [currs, setCurrs] = useState<{ code: string; name: string }[]>([]);
  const [form, setForm] = useState({
    description: "", expense_date: new Date().toISOString().slice(0, 10),
    amount_original: "", currency_original: "USD",
    category_id: "", geography_id: "",
    funding_source: "corporate_card" as "corporate_card" | "treasury_advance" | "own_money_reimbursable",
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("accounting_expenses").select("*").order("expense_date", { ascending: false }).limit(200);
    setRows((data ?? []) as Expense[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    (async () => {
      const [c, g, cu] = await Promise.all([
        supabase.from("accounting_expense_categories").select("id,name,code").eq("is_active", true).order("name"),
        supabase.from("accounting_geographies").select("id,name").eq("is_active", true).order("name"),
        supabase.from("accounting_currencies").select("code,name").order("code"),
      ]);
      setCats((c.data ?? []) as Opt[]);
      setGeos((g.data ?? []) as Opt[]);
      setCurrs((cu.data ?? []) as any);
    })();
  }, []);

  const submit = async () => {
    if (!form.description || !form.amount_original) {
      toast({ title: "Faltan datos", description: "Descripción y monto son obligatorios", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("accounting_expenses").insert({
      description: form.description,
      expense_date: form.expense_date,
      amount_original: Number(form.amount_original),
      currency_original: form.currency_original,
      category_id: form.category_id || null,
      geography_id: form.geography_id || null,
      funding_source: form.funding_source,
      user_id: u.user?.id,
      created_by: u.user!.id,
    } as any);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Gasto creado" });
    setOpen(false);
    setForm({ ...form, description: "", amount_original: "" });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gastos</h2>
          <p className="text-muted-foreground text-sm">Gastos de la empresa (carga manual + desde facturas).</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Nuevo gasto</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <div className="p-6 text-muted-foreground">Cargando…</div> :
            rows.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">Sin gastos aún.</div>
            ) : (
            <div className="divide-y">
              {rows.map((r) => (
                <div key={r.id} className="p-3 flex items-center gap-3 flex-wrap">
                  <div className="text-sm font-medium flex-1 truncate">{r.description ?? "(sin descripción)"}</div>
                  <Badge variant="secondary">{r.status}</Badge>
                  {r.funding_source && (
                    <Badge variant="outline" className={
                      r.funding_source === "own_money_reimbursable"
                        ? "border-amber-500/50 text-amber-500"
                        : r.funding_source === "treasury_advance"
                        ? "border-blue-500/50 text-blue-500"
                        : "border-emerald-500/50 text-emerald-500"
                    }>
                      {FUNDING_LABEL[r.funding_source] ?? r.funding_source}
                      {r.reimbursement_status === "pending" && " · Pendiente reembolso"}
                      {r.reimbursement_status === "reimbursed" && " · Reembolsado"}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{r.expense_date}</span>
                  <span className="text-sm">
                    {Number(r.amount_original).toLocaleString()} {r.currency_original}
                  </span>
                  <span className="text-sm font-semibold">
                    {r.amount_usd != null ? `$${Number(r.amount_usd).toFixed(2)}` : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nuevo gasto</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Descripción *</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha *</Label>
                <Input type="date" value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
              </div>
              <div>
                <Label>Moneda</Label>
                <Select value={form.currency_original} onValueChange={(v) => setForm({ ...form, currency_original: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{currs.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Monto *</Label>
                <Input type="number" step="0.01" value={form.amount_original}
                  onChange={(e) => setForm({ ...form, amount_original: e.target.value })} />
              </div>
              <div>
                <Label>Categoría</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Geografía</Label>
                <Select value={form.geography_id} onValueChange={(v) => setForm({ ...form, geography_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{geos.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>¿Cómo se pagó? *</Label>
                <Select value={form.funding_source} onValueChange={(v) => setForm({ ...form, funding_source: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corporate_card">Tarjeta corporativa</SelectItem>
                    <SelectItem value="treasury_advance">Adelanto de tesorería</SelectItem>
                    <SelectItem value="own_money_reimbursable">Dinero propio (a reembolsar)</SelectItem>
                  </SelectContent>
                </Select>
                {form.funding_source === "own_money_reimbursable" && (
                  <p className="text-xs text-amber-500 mt-1">Quedará marcado como pendiente de reembolso.</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
