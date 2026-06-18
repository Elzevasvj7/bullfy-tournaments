import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function EntidadesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", legal_name: "", tax_id: "", country_code: "", base_currency: "USD" });

  const load = async () => {
    const { data } = await supabase.from("accounting_entities").select("*").order("name");
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) return;
    const { error } = await supabase.from("accounting_entities").insert(form);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Entidad creada" });
    setOpen(false); setForm({ name: "", legal_name: "", tax_id: "", country_code: "", base_currency: "USD" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6" />Entidades legales</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Nueva entidad</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva entidad legal</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nombre *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Razón social</Label><Input value={form.legal_name} onChange={e => setForm({ ...form, legal_name: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>NIT/Tax ID</Label><Input value={form.tax_id} onChange={e => setForm({ ...form, tax_id: e.target.value })} /></div>
                <div><Label>País</Label><Input placeholder="CO, AE..." value={form.country_code} onChange={e => setForm({ ...form, country_code: e.target.value })} /></div>
                <div><Label>Moneda base</Label><Input value={form.base_currency} onChange={e => setForm({ ...form, base_currency: e.target.value.toUpperCase() })} /></div>
              </div>
              <Button onClick={save} className="w-full">Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Listado</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nombre</TableHead><TableHead>Razón social</TableHead>
              <TableHead>NIT</TableHead><TableHead>País</TableHead>
              <TableHead>Moneda</TableHead><TableHead>Estado</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.legal_name || "—"}</TableCell>
                  <TableCell>{r.tax_id || "—"}</TableCell>
                  <TableCell>{r.country_code || "—"}</TableCell>
                  <TableCell>{r.base_currency}</TableCell>
                  <TableCell><Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Activa" : "Inactiva"}</Badge></TableCell>
                </TableRow>
              ))}
              {!rows.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin entidades aún.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
