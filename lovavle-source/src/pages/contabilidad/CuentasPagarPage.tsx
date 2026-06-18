import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Invoice = {
  id: string; invoice_number: string | null; vendor_name: string | null;
  issue_date: string | null; due_date: string | null; paid_at: string | null;
  currency_original: string | null; amount_original: number | null;
  payment_status: string; payment_method_id: string | null; status: string;
};

const PAY_COLORS: Record<string, string> = {
  unpaid: "outline", partial: "default", paid: "default", overdue: "destructive", void: "secondary",
};

export default function CuentasPagarPage() {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [methods, setMethods] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [openPay, setOpenPay] = useState<Invoice | null>(null);
  const [payForm, setPayForm] = useState({ paid_at: "", payment_method_id: "" });

  async function load() {
    setLoading(true);
    const [{ data: inv }, { data: m }] = await Promise.all([
      supabase.from("accounting_invoices").select("*").eq("status", "approved")
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("accounting_payment_methods").select("id,name").order("name"),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const fixed = (inv || []).map((i: any) =>
      i.payment_status === "unpaid" && i.due_date && i.due_date < today ? { ...i, payment_status: "overdue" } : i
    );
    setInvoices(fixed as any);
    setMethods(m || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openPayDialog(i: Invoice) {
    setOpenPay(i);
    setPayForm({ paid_at: new Date().toISOString().slice(0, 10), payment_method_id: i.payment_method_id || "" });
  }
  async function confirmPay() {
    if (!openPay) return;
    const { error } = await supabase.from("accounting_invoices").update({
      payment_status: "paid", paid_at: payForm.paid_at,
      payment_method_id: payForm.payment_method_id || null,
    }).eq("id", openPay.id);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Pago registrado" });
    setOpenPay(null);
    load();
  }

  const totalDue = invoices.filter(i => i.payment_status !== "paid" && i.payment_status !== "void")
    .reduce((s, i) => s + Number(i.amount_original || 0), 0);
  const overdueCount = invoices.filter(i => i.payment_status === "overdue").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Cuentas por Pagar</h2>
        <p className="text-muted-foreground">Facturas de proveedores aprobadas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle className="text-sm">Total a pagar</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">${totalDue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Vencidas</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-destructive flex items-center gap-2">{overdueCount > 0 && <AlertTriangle className="h-5 w-5" />}{overdueCount}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Facturas aprobadas</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{invoices.length}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Facturas pendientes</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p>Cargando…</p> : invoices.length === 0 ? (
            <p className="text-muted-foreground">No hay facturas aprobadas pendientes</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Nº</TableHead><TableHead>Proveedor</TableHead><TableHead>Emisión</TableHead>
                <TableHead>Vence</TableHead><TableHead>Importe</TableHead><TableHead>Estado</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {invoices.map(i => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.invoice_number || "—"}</TableCell>
                    <TableCell>{i.vendor_name || "—"}</TableCell>
                    <TableCell>{i.issue_date || "—"}</TableCell>
                    <TableCell>{i.due_date || "—"}</TableCell>
                    <TableCell>{Number(i.amount_original || 0).toFixed(2)} {i.currency_original}</TableCell>
                    <TableCell><Badge variant={PAY_COLORS[i.payment_status] as any}>{i.payment_status}</Badge></TableCell>
                    <TableCell>{i.payment_status !== "paid" && i.payment_status !== "void" && (
                      <Button size="sm" variant="ghost" onClick={() => openPayDialog(i)}><CheckCircle2 className="h-4 w-4" /></Button>
                    )}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!openPay} onOpenChange={o => !o && setOpenPay(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar pago</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Fecha de pago</Label><Input type="date" value={payForm.paid_at} onChange={e => setPayForm({ ...payForm, paid_at: e.target.value })} /></div>
            <div><Label>Método de pago</Label>
              <Select value={payForm.payment_method_id} onValueChange={v => setPayForm({ ...payForm, payment_method_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>{methods.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select></div>
            <Button onClick={confirmPay} className="w-full">Confirmar pago</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
