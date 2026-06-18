import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Link2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

type Statement = { id: string; payment_method_id: string; period_start: string; period_end: string; closing_balance: number; currency: string; status: string; file_name: string };
type Line = { id: string; txn_date: string; description: string; amount: number; direction: string; match_status: string; matched_type: string | null; matched_id: string | null };

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ""));
  return lines.slice(1).map(l => {
    const cells = l.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => row[h] = cells[i] || "");
    return row;
  });
}

export default function ConciliacionPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [methods, setMethods] = useState<{ id: string; name: string; currency: string }[]>([]);
  const [selected, setSelected] = useState<Statement | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [openUpload, setOpenUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ payment_method_id: "", period_start: "", period_end: "", opening_balance: "0" });

  async function loadStmts() {
    const { data } = await supabase.from("accounting_bank_statements").select("*").order("period_end", { ascending: false });
    setStatements((data || []) as any);
  }
  async function loadMethods() {
    const { data } = await supabase.from("accounting_payment_methods").select("id,name,currency").order("name");
    setMethods((data || []) as any);
  }
  useEffect(() => { loadStmts(); loadMethods(); }, []);

  async function loadLines(stmt: Statement) {
    setSelected(stmt);
    const { data } = await supabase.from("accounting_bank_statement_lines").select("*").eq("statement_id", stmt.id).order("txn_date");
    setLines((data || []) as any);
  }

  async function handleUpload(file: File) {
    if (!user || !uploadForm.payment_method_id) {
      return toast({ title: "Completa los datos", variant: "destructive" });
    }
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length === 0) return toast({ title: "CSV vacío o inválido", variant: "destructive" });

    const method = methods.find(m => m.id === uploadForm.payment_method_id);
    // Detect columns flexibly
    const dateKey = Object.keys(rows[0]).find(k => /fecha|date/.test(k))!;
    const descKey = Object.keys(rows[0]).find(k => /descrip|concepto|desc|memo/.test(k)) || Object.keys(rows[0])[1];
    const amtKey = Object.keys(rows[0]).find(k => /import|amount|monto/.test(k))!;
    if (!dateKey || !amtKey) return toast({ title: "CSV debe tener columnas fecha e importe", variant: "destructive" });

    let total = 0;
    const parsedLines = rows.map(r => {
      const raw = r[amtKey].replace(/\./g, "").replace(",", ".");
      const amt = parseFloat(raw) || 0;
      total += amt;
      return {
        txn_date: r[dateKey].split("/").reverse().join("-").length === 10 ? r[dateKey].split("/").reverse().join("-") : r[dateKey],
        description: r[descKey] || "",
        amount: Math.abs(amt),
        direction: amt >= 0 ? "in" : "out",
        match_status: "unmatched",
      };
    });

    const { data: stmt, error } = await supabase.from("accounting_bank_statements").insert({
      payment_method_id: uploadForm.payment_method_id,
      period_start: uploadForm.period_start || parsedLines[0].txn_date,
      period_end: uploadForm.period_end || parsedLines[parsedLines.length - 1].txn_date,
      opening_balance: parseFloat(uploadForm.opening_balance) || 0,
      closing_balance: (parseFloat(uploadForm.opening_balance) || 0) + total,
      currency: method?.currency || "USD",
      file_name: file.name, uploaded_by: user.id,
    }).select().single();
    if (error || !stmt) return toast({ title: "Error", description: error?.message, variant: "destructive" });

    const { error: e2 } = await supabase.from("accounting_bank_statement_lines")
      .insert(parsedLines.map(l => ({ ...l, statement_id: stmt.id })));
    if (e2) return toast({ title: "Error líneas", description: e2.message, variant: "destructive" });

    toast({ title: `Importadas ${parsedLines.length} líneas` });
    setOpenUpload(false);
    loadStmts();
  }

  async function autoMatch() {
    if (!selected) return;
    // Try matching against expenses + transfers within ±3 days and same amount
    const { data: exp } = await supabase.from("accounting_expenses").select("id,expense_date,amount_original");
    const { data: trf } = await supabase.from("accounting_treasury_transfers").select("id,transfer_date,amount_original");
    let matched = 0;
    for (const line of lines.filter(l => l.match_status === "unmatched")) {
      const target = line.amount;
      const candidates = [
        ...((exp || []).filter((e: any) => Math.abs(Number(e.amount_original) - target) < 0.01 && Math.abs(new Date(e.expense_date).getTime() - new Date(line.txn_date).getTime()) < 3 * 86400000)
          .map((e: any) => ({ type: "expense", id: e.id }))),
        ...((trf || []).filter((t: any) => Math.abs(Number(t.amount_original) - target) < 0.01 && Math.abs(new Date(t.transfer_date).getTime() - new Date(line.txn_date).getTime()) < 3 * 86400000)
          .map((t: any) => ({ type: "transfer", id: t.id }))),
      ];
      if (candidates.length === 1) {
        await supabase.from("accounting_bank_statement_lines").update({
          matched_type: candidates[0].type, matched_id: candidates[0].id, match_status: "matched",
        }).eq("id", line.id);
        matched++;
      } else if (candidates.length > 1) {
        await supabase.from("accounting_bank_statement_lines").update({ match_status: "suggested" }).eq("id", line.id);
      }
    }
    toast({ title: `${matched} líneas conciliadas` });
    loadLines(selected);
  }

  async function ignoreLine(id: string) {
    await supabase.from("accounting_bank_statement_lines").update({ match_status: "ignored" }).eq("id", id);
    if (selected) loadLines(selected);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Conciliación Bancaria</h2>
          <p className="text-muted-foreground">Importa extractos CSV y concilia con gastos/transferencias</p>
        </div>
        <Dialog open={openUpload} onOpenChange={setOpenUpload}>
          <DialogTrigger asChild><Button><Upload className="h-4 w-4 mr-1" /> Importar CSV</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Importar extracto bancario</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Cuenta / Método</Label>
                <Select value={uploadForm.payment_method_id} onValueChange={v => setUploadForm({ ...uploadForm, payment_method_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>{methods.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.currency})</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Periodo desde</Label><Input type="date" value={uploadForm.period_start} onChange={e => setUploadForm({ ...uploadForm, period_start: e.target.value })} /></div>
                <div><Label>Periodo hasta</Label><Input type="date" value={uploadForm.period_end} onChange={e => setUploadForm({ ...uploadForm, period_end: e.target.value })} /></div>
              </div>
              <div><Label>Saldo inicial</Label><Input type="number" step="0.01" value={uploadForm.opening_balance} onChange={e => setUploadForm({ ...uploadForm, opening_balance: e.target.value })} /></div>
              <div><Label>CSV (columnas: fecha, descripción, importe)</Label>
                <Input ref={fileRef} type="file" accept=".csv" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} /></div>
              <p className="text-xs text-muted-foreground">Acepta separadores , o ;. Importes negativos = salidas.</p>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Extractos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {statements.length === 0 ? <p className="text-muted-foreground text-sm">Sin extractos</p> :
              statements.map(s => (
                <button key={s.id} onClick={() => loadLines(s)} className={`w-full text-left p-3 rounded-lg border hover:bg-accent ${selected?.id === s.id ? "bg-accent" : ""}`}>
                  <div className="font-medium text-sm">{methods.find(m => m.id === s.payment_method_id)?.name}</div>
                  <div className="text-xs text-muted-foreground">{s.period_start} → {s.period_end}</div>
                  <div className="text-xs">Saldo: {Number(s.closing_balance).toFixed(2)} {s.currency} <Badge variant="outline" className="ml-1">{s.status}</Badge></div>
                </button>
              ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Líneas</CardTitle>
            {selected && <Button size="sm" variant="outline" onClick={autoMatch}><Link2 className="h-4 w-4 mr-1" /> Auto-conciliar</Button>}
          </CardHeader>
          <CardContent>
            {!selected ? <p className="text-muted-foreground">Selecciona un extracto</p> :
              lines.length === 0 ? <p className="text-muted-foreground">Sin líneas</p> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Fecha</TableHead><TableHead>Descripción</TableHead><TableHead>Importe</TableHead>
                    <TableHead>Estado</TableHead><TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {lines.map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs">{l.txn_date}</TableCell>
                        <TableCell className="text-xs">{l.description}</TableCell>
                        <TableCell className={l.direction === "in" ? "text-emerald-600" : "text-destructive"}>
                          {l.direction === "in" ? "+" : "-"}{Number(l.amount).toFixed(2)}
                        </TableCell>
                        <TableCell><Badge variant={l.match_status === "matched" ? "default" : l.match_status === "suggested" ? "secondary" : "outline"}>{l.match_status}</Badge></TableCell>
                        <TableCell>{l.match_status !== "matched" && l.match_status !== "ignored" && (
                          <Button size="sm" variant="ghost" onClick={() => ignoreLine(l.id)}><X className="h-4 w-4" /></Button>
                        )}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
