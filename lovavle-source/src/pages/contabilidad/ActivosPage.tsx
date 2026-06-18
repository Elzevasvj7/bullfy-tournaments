import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Boxes, Plus, Play, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function ActivosPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "", asset_type: "equipment",
    acquisition_date: new Date().toISOString().slice(0, 10),
    acquisition_cost_original: "", currency_original: "USD",
    useful_life_months: 36, salvage_value_usd: 0,
  });

  const load = async () => {
    const [a, d] = await Promise.all([
      supabase.from("accounting_assets").select("*").order("acquisition_date", { ascending: false }),
      supabase.from("accounting_depreciation_entries").select("*").order("period_year", { ascending: false }).order("period_month", { ascending: false }).limit(50),
    ]);
    setRows(a.data || []); setEntries(d.data || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const cost = Number(form.acquisition_cost_original);
    if (!form.name || !cost) return toast({ title: "Datos incompletos", variant: "destructive" });
    const { error } = await supabase.from("accounting_assets").insert({
      ...form,
      acquisition_cost_original: cost,
      acquisition_cost_usd: cost, // simplificado: asume USD o FX=1; ajustar luego con FX histórico
      fx_rate_to_usd: 1,
      salvage_value_usd: Number(form.salvage_value_usd),
      useful_life_months: Number(form.useful_life_months),
    });
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Activo creado" }); setOpen(false); load();
  };

  const runDep = async () => {
    setBusy(true);
    const { data } = await supabase.functions.invoke("accounting-depreciation-run");
    setBusy(false);
    toast({ title: data?.ok ? `Depreciación corrida (${data.processed})` : "Error", variant: data?.ok ? "default" : "destructive" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Boxes className="h-6 w-6" />Activos fijos</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={runDep} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Play className="h-4 w-4 mr-1" />Correr depreciación mes</>}
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Nuevo activo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuevo activo fijo</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nombre *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Tipo</Label><Input value={form.asset_type} onChange={e => setForm({ ...form, asset_type: e.target.value })} /></div>
                  <div><Label>Fecha adquisición</Label><Input type="date" value={form.acquisition_date} onChange={e => setForm({ ...form, acquisition_date: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label>Costo *</Label><Input type="number" value={form.acquisition_cost_original} onChange={e => setForm({ ...form, acquisition_cost_original: e.target.value })} /></div>
                  <div><Label>Moneda</Label><Input value={form.currency_original} onChange={e => setForm({ ...form, currency_original: e.target.value.toUpperCase() })} /></div>
                  <div><Label>Vida útil (meses)</Label><Input type="number" value={form.useful_life_months} onChange={e => setForm({ ...form, useful_life_months: Number(e.target.value) })} /></div>
                </div>
                <div><Label>Valor salvamento (USD)</Label><Input type="number" value={form.salvage_value_usd} onChange={e => setForm({ ...form, salvage_value_usd: Number(e.target.value) })} /></div>
                <Button onClick={save} className="w-full">Guardar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Activos</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nombre</TableHead><TableHead>Tipo</TableHead>
              <TableHead>Adquisición</TableHead><TableHead>Costo USD</TableHead>
              <TableHead>Vida útil</TableHead><TableHead>Estado</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.asset_type}</TableCell>
                  <TableCell>{r.acquisition_date}</TableCell>
                  <TableCell>${Number(r.acquisition_cost_usd).toFixed(2)}</TableCell>
                  <TableCell>{r.useful_life_months}m</TableCell>
                  <TableCell><Badge>{r.status}</Badge></TableCell>
                </TableRow>
              ))}
              {!rows.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin activos.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Asientos de depreciación recientes</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Período</TableHead><TableHead>Activo</TableHead>
              <TableHead>Depreciación</TableHead><TableHead>Acumulada</TableHead><TableHead>Valor libros</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {entries.map(e => {
                const a = rows.find(r => r.id === e.asset_id);
                return (
                  <TableRow key={e.id}>
                    <TableCell>{e.period_year}-{String(e.period_month).padStart(2, "0")}</TableCell>
                    <TableCell>{a?.name || e.asset_id.slice(0, 8)}</TableCell>
                    <TableCell>${Number(e.amount_usd).toFixed(2)}</TableCell>
                    <TableCell>${Number(e.accumulated_usd).toFixed(2)}</TableCell>
                    <TableCell>${Number(e.book_value_usd).toFixed(2)}</TableCell>
                  </TableRow>
                );
              })}
              {!entries.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin asientos.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
