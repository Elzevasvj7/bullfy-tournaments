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
import { Plus, Loader2, RefreshCw } from "lucide-react";

interface Revenue {
  id: string; description: string; revenue_date: string;
  amount_original: number; currency_original: string;
  amount_usd: number | null;
}
interface Opt { id: string; name: string }

export default function IngresosPage() {
  const [rows, setRows] = useState<Revenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [cats, setCats] = useState<Opt[]>([]);
  const [sources, setSources] = useState<Opt[]>([]);
  const [currs, setCurrs] = useState<{ code: string }[]>([]);
  const [form, setForm] = useState({
    description: "", revenue_date: new Date().toISOString().slice(0, 10),
    amount_original: "", currency_original: "USD",
    category_id: "", source_id: "", notes: "",
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("accounting_revenues").select("*").order("revenue_date", { ascending: false }).limit(200);
    setRows((data ?? []) as Revenue[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    (async () => {
      const [c, s, cu] = await Promise.all([
        supabase.from("accounting_revenue_categories").select("id,name").eq("is_active", true).order("name"),
        supabase.from("accounting_revenue_sources").select("id,name").eq("is_active", true).order("name"),
        supabase.from("accounting_currencies").select("code").order("code"),
      ]);
      setCats((c.data ?? []) as Opt[]);
      setSources((s.data ?? []) as Opt[]);
      setCurrs((cu.data ?? []) as { code: string }[]);
    })();
  }, []);

  const save = async () => {
    if (!form.description || !form.amount_original) {
      toast({ title: "Faltan datos", variant: "destructive" }); return;
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("accounting_revenues").insert({
      description: form.description,
      revenue_date: form.revenue_date,
      amount_original: Number(form.amount_original),
      currency_original: form.currency_original,
      category_id: form.category_id || null,
      source_id: form.source_id || null,
      notes: form.notes || null,
      created_by: u.user!.id,
    });
    setSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Ingreso registrado" });
    setOpen(false);
    setForm({ ...form, description: "", amount_original: "", notes: "" });
    load();
  };

  const syncTournament = async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("sync-tournament-revenues");
    setSyncing(false);
    if (error || (data && data.ok === false)) {
      toast({ title: "Error sync", description: error?.message ?? data?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Sync OK", description: `${data?.inserted ?? 0} nuevos ingresos importados` });
    load();
  };

  const fmt = (n: number | null) => (n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Ingresos</h2>
          <p className="text-muted-foreground text-sm">Manual + sincronización Bullfy Tournament</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={syncTournament} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sync Tournament
          </Button>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Nuevo ingreso</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-muted-foreground">Cargando…</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-muted-foreground text-sm">Sin ingresos registrados</div>
          ) : (
            <div className="divide-y">
              {rows.map((r) => (
                <div key={r.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.description}</div>
                    <div className="text-xs text-muted-foreground">{r.revenue_date}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-emerald-500">{fmt(r.amount_usd)}</div>
                    <Badge variant="secondary" className="text-xs">
                      {r.amount_original.toLocaleString()} {r.currency_original}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo ingreso</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Descripción</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha</Label>
                <Input type="date" value={form.revenue_date} onChange={(e) => setForm({ ...form, revenue_date: e.target.value })} />
              </div>
              <div>
                <Label>Moneda</Label>
                <Select value={form.currency_original} onValueChange={(v) => setForm({ ...form, currency_original: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{currs.map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Monto</Label>
              <Input type="number" step="0.01" value={form.amount_original} onChange={(e) => setForm({ ...form, amount_original: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoría</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{cats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fuente</Label>
                <Select value={form.source_id} onValueChange={(v) => setForm({ ...form, source_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{sources.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
