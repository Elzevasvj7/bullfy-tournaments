import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, CheckCircle2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

type Customer = { id: string; name: string; tax_id?: string; email?: string };
type Invoice = {
  id: string; invoice_number: string; issue_date: string; due_date: string;
  paid_at: string | null; currency: string; amount: number; amount_usd: number;
  status: string; customer_id: string; notes?: string;
  customer?: Customer;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "secondary", unpaid: "outline", partial: "default",
  paid: "default", overdue: "destructive", void: "secondary",
};

export default function CuentasCobrarPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currencies, setCurrencies] = useState<{ code: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [openInv, setOpenInv] = useState(false);
  const [openCust, setOpenCust] = useState(false);

  const [newCust, setNewCust] = useState({ name: "", tax_id: "", email: "" });
  const [newInv, setNewInv] = useState({
    customer_id: "", invoice_number: "", issue_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    currency: "USD", amount: "", tax_amount: "0", notes: "",
  });

  async function load() {
    setLoading(true);
    const [{ data: inv }, { data: cust }, { data: curr }] = await Promise.all([
      supabase.from("accounting_ar_invoices").select("*, customer:accounting_ar_customers(*)").order("issue_date", { ascending: false }),
      supabase.from("accounting_ar_customers").select("*").order("name"),
      supabase.from("accounting_currencies").select("code").order("code"),
    ]);
    // mark overdue client-side
    const today = new Date().toISOString().slice(0, 10);
    const fixed = (inv || []).map((i: any) =>
      i.status === "unpaid" && i.due_date < today ? { ...i, status: "overdue" } : i
    );
    setInvoices(fixed as any);
    setCustomers(cust || []);
    setCurrencies(curr || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function createCustomer() {
    if (!newCust.name.trim() || !user) return;
    const { error } = await supabase.from("accounting_ar_customers").insert({ ...newCust, created_by: user.id });
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Cliente creado" });
    setNewCust({ name: "", tax_id: "", email: "" });
    setOpenCust(false);
    load();
  }

  async function createInvoice() {
    if (!user || !newInv.customer_id || !newInv.amount) return;
    const amount = parseFloat(newInv.amount);
    const tax = parseFloat(newInv.tax_amount || "0");
    let fx = 1;
    if (newInv.currency !== "USD") {
      const { data: rate } = await supabase.from("accounting_fx_rates")
        .select("rate").eq("currency_from", newInv.currency).eq("currency_to", "USD")
        .lte("rate_date", newInv.issue_date)
        .order("rate_date", { ascending: false }).limit(1).maybeSingle();
      fx = Number(rate?.rate || 1);
    }
    const { error } = await supabase.from("accounting_ar_invoices").insert({
      customer_id: newInv.customer_id, invoice_number: newInv.invoice_number,
      issue_date: newInv.issue_date, due_date: newInv.due_date,
      currency: newInv.currency, amount, tax_amount: tax,
      amount_usd: amount * fx, fx_rate: fx, notes: newInv.notes,
      created_by: user.id, status: "unpaid",
    });
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Factura creada" });
    setOpenInv(false);
    setNewInv({ ...newInv, invoice_number: "", amount: "", notes: "" });
    load();
  }

  async function markPaid(inv: Invoice) {
    const { error } = await supabase.from("accounting_ar_invoices")
      .update({ status: "paid", paid_at: new Date().toISOString().slice(0, 10) })
      .eq("id", inv.id);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Marcada como pagada" });
    load();
  }

  const totalOutstanding = invoices.filter(i => i.status !== "paid" && i.status !== "void")
    .reduce((s, i) => s + Number(i.amount_usd), 0);
  const overdueCount = invoices.filter(i => i.status === "overdue").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Cuentas por Cobrar</h2>
          <p className="text-muted-foreground">Facturas emitidas a clientes</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={openCust} onOpenChange={setOpenCust}>
            <DialogTrigger asChild><Button variant="outline"><Plus className="h-4 w-4 mr-1" /> Cliente</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuevo cliente</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nombre*</Label><Input value={newCust.name} onChange={e => setNewCust({ ...newCust, name: e.target.value })} /></div>
                <div><Label>NIF/RFC</Label><Input value={newCust.tax_id} onChange={e => setNewCust({ ...newCust, tax_id: e.target.value })} /></div>
                <div><Label>Email</Label><Input type="email" value={newCust.email} onChange={e => setNewCust({ ...newCust, email: e.target.value })} /></div>
                <Button onClick={createCustomer} className="w-full">Crear</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={openInv} onOpenChange={setOpenInv}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Factura</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nueva factura</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Cliente*</Label>
                  <Select value={newInv.customer_id} onValueChange={v => setNewInv({ ...newInv, customer_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div><Label>Nº Factura*</Label><Input value={newInv.invoice_number} onChange={e => setNewInv({ ...newInv, invoice_number: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Fecha emisión</Label><Input type="date" value={newInv.issue_date} onChange={e => setNewInv({ ...newInv, issue_date: e.target.value })} /></div>
                  <div><Label>Vencimiento</Label><Input type="date" value={newInv.due_date} onChange={e => setNewInv({ ...newInv, due_date: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Moneda</Label>
                    <Select value={newInv.currency} onValueChange={v => setNewInv({ ...newInv, currency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{currencies.map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}</SelectContent>
                    </Select></div>
                  <div><Label>Importe*</Label><Input type="number" step="0.01" value={newInv.amount} onChange={e => setNewInv({ ...newInv, amount: e.target.value })} /></div>
                  <div><Label>Impuestos</Label><Input type="number" step="0.01" value={newInv.tax_amount} onChange={e => setNewInv({ ...newInv, tax_amount: e.target.value })} /></div>
                </div>
                <div><Label>Notas</Label><Input value={newInv.notes} onChange={e => setNewInv({ ...newInv, notes: e.target.value })} /></div>
                <Button onClick={createInvoice} className="w-full">Crear factura</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle className="text-sm">Pendiente de cobro</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">${totalOutstanding.toLocaleString(undefined, { maximumFractionDigits: 2 })}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Facturas vencidas</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-destructive flex items-center gap-2">{overdueCount > 0 && <AlertTriangle className="h-5 w-5" />}{overdueCount}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Clientes</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{customers.length}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Facturas</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-muted-foreground">Cargando…</p> : invoices.length === 0 ? (
            <p className="text-muted-foreground">Sin facturas</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Nº</TableHead><TableHead>Cliente</TableHead><TableHead>Emisión</TableHead>
                <TableHead>Vence</TableHead><TableHead>Importe</TableHead><TableHead>USD</TableHead>
                <TableHead>Estado</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {invoices.map(i => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.invoice_number}</TableCell>
                    <TableCell>{i.customer?.name}</TableCell>
                    <TableCell>{i.issue_date}</TableCell>
                    <TableCell>{i.due_date}</TableCell>
                    <TableCell>{Number(i.amount).toFixed(2)} {i.currency}</TableCell>
                    <TableCell>${Number(i.amount_usd).toFixed(2)}</TableCell>
                    <TableCell><Badge variant={STATUS_COLORS[i.status] as any}>{i.status}</Badge></TableCell>
                    <TableCell>{i.status !== "paid" && i.status !== "void" && (
                      <Button size="sm" variant="ghost" onClick={() => markPaid(i)}><CheckCircle2 className="h-4 w-4" /></Button>
                    )}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
