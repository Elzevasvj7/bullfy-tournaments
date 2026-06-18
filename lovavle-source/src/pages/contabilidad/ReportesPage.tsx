import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CurrencyBreakdown } from "@/components/contabilidad/CurrencyBreakdown";

type Row = { key: string; label: string; total_usd: number; count: number };

function firstOfMonth() {
  const d = new Date(); d.setDate(1);
  return d.toISOString().slice(0, 10);
}
function today() { return new Date().toISOString().slice(0, 10); }
const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const FUNDING_LABEL: Record<string, string> = {
  corporate_card: "Tarjeta corporativa",
  treasury_advance: "Adelanto tesorería",
  own_money_reimbursable: "Dinero propio (reembolsable)",
};

export default function ReportesPage() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [expenses, setExpenses] = useState<any[]>([]);
  const [revenues, setRevenues] = useState<any[]>([]);
  const [cats, setCats] = useState<Record<string, string>>({});
  const [geos, setGeos] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<Record<string, string>>({});
  const [revSources, setRevSources] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [fundingFilter, setFundingFilter] = useState<string>("all");

  async function load() {
    setLoading(true);
    const [exp, rev, cat, geo, prof, src] = await Promise.all([
      supabase.from("accounting_expenses").select("*").gte("expense_date", from).lte("expense_date", to),
      supabase.from("accounting_revenues").select("*").gte("revenue_date", from).lte("revenue_date", to),
      supabase.from("accounting_expense_categories").select("id,name"),
      supabase.from("accounting_geographies").select("id,name"),
      supabase.from("profiles").select("id,nombre"),
      supabase.from("accounting_revenue_sources").select("id,name"),
    ]);
    setExpenses(exp.data ?? []);
    setRevenues(rev.data ?? []);
    setCats(Object.fromEntries((cat.data ?? []).map((r: any) => [r.id, r.name])));
    setGeos(Object.fromEntries((geo.data ?? []).map((r: any) => [r.id, r.name])));
    setUsers(Object.fromEntries((prof.data ?? []).map((r: any) => [r.id, r.nombre])));
    setRevSources(Object.fromEntries((src.data ?? []).map((r: any) => [r.id, r.name])));
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function groupBy(rows: any[], keyField: string, lookup: Record<string, string>): Row[] {
    const map = new Map<string, Row>();
    for (const r of rows) {
      const k = r[keyField] ?? "—";
      const label = lookup[k] ?? "Sin asignar";
      const cur = map.get(k) ?? { key: k, label, total_usd: 0, count: 0 };
      cur.total_usd += Number(r.amount_usd ?? 0);
      cur.count += 1;
      map.set(k, cur);
    }
    return [...map.values()].sort((a, b) => b.total_usd - a.total_usd);
  }

  // Aplica filtro de fuente de pago a los gastos antes de agrupar
  const filteredExpenses = useMemo(
    () => fundingFilter === "all" ? expenses : expenses.filter((e) => (e.funding_source ?? "—") === fundingFilter),
    [expenses, fundingFilter],
  );

  const byCategory = useMemo(() => groupBy(filteredExpenses, "category_id", cats), [filteredExpenses, cats]);
  const byGeo = useMemo(() => groupBy(filteredExpenses, "geography_id", geos), [filteredExpenses, geos]);
  const byUser = useMemo(() => groupBy(filteredExpenses, "user_id", users), [filteredExpenses, users]);
  const byFunding = useMemo(() => groupBy(filteredExpenses, "funding_source", FUNDING_LABEL), [filteredExpenses]);
  const bySource = useMemo(() => groupBy(revenues, "source_id", revSources), [revenues, revSources]);

  const totalExp = filteredExpenses.reduce((a, r) => a + Number(r.amount_usd ?? 0), 0);
  const totalRev = revenues.reduce((a, r) => a + Number(r.amount_usd ?? 0), 0);
  const totalReimbursementPending = useMemo(
    () => expenses
      .filter((e) => e.funding_source === "own_money_reimbursable" && e.reimbursement_status === "pending")
      .reduce((a, r) => a + Number(r.amount_usd ?? 0), 0),
    [expenses],
  );

  function exportPDF() {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text("Reporte Contable Bullfy", 14, 18);
    doc.setFontSize(10); doc.text(`Periodo: ${from} → ${to}`, 14, 26);
    doc.text(`Ingresos: ${fmt(totalRev)}   Gastos: ${fmt(totalExp)}   Neto: ${fmt(totalRev - totalExp)}`, 14, 32);

    const sections: Array<[string, Row[]]> = [
      ["Gastos por categoría", byCategory],
      ["Gastos por geografía", byGeo],
      ["Gastos por usuario", byUser],
      ["Ingresos por fuente", bySource],
    ];
    let y = 40;
    for (const [title, rows] of sections) {
      autoTable(doc, {
        startY: y,
        head: [[title, "Movs", "Total USD"]],
        body: rows.map(r => [r.label, r.count, fmt(r.total_usd)]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [6, 43, 99] },
      });
      // @ts-ignore lastAutoTable injected by autotable
      y = (doc as any).lastAutoTable.finalY + 8;
      if (y > 260) { doc.addPage(); y = 20; }
    }
    doc.save(`reporte-contable-${from}_${to}.pdf`);
  }

  function Table({ rows }: { rows: Row[] }) {
    return (
      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2">Concepto</th>
              <th className="text-right p-2">Movs</th>
              <th className="text-right p-2">Total USD</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={3} className="text-center p-4 text-muted-foreground">Sin datos</td></tr>
            ) : rows.map(r => (
              <tr key={r.key} className="border-t">
                <td className="p-2">{r.label}</td>
                <td className="p-2 text-right">{r.count}</td>
                <td className="p-2 text-right font-medium">{fmt(r.total_usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">Reportes</h2>
          <p className="text-muted-foreground text-sm">Análisis de gastos e ingresos · USD funcional</p>
        </div>
        <Button onClick={exportPDF} disabled={loading}>
          <Download className="h-4 w-4 mr-2" /> Exportar PDF
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-3 items-end">
          <div>
            <Label>Desde</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>Hasta</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="min-w-[220px]">
            <Label>Fuente de pago</Label>
            <Select value={fundingFilter} onValueChange={setFundingFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="corporate_card">Tarjeta corporativa</SelectItem>
                <SelectItem value="treasury_advance">Adelanto tesorería</SelectItem>
                <SelectItem value="own_money_reimbursable">Dinero propio (reembolsable)</SelectItem>
                <SelectItem value="—">Sin asignar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="secondary" onClick={load} disabled={loading}>
            {loading ? "Cargando…" : "Aplicar"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Ingresos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-500 flex items-center">{fmt(totalRev)}<CurrencyBreakdown items={revenues} label="Ingresos por moneda" /></div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Gastos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-rose-500 flex items-center">{fmt(totalExp)}<CurrencyBreakdown items={filteredExpenses} label="Gastos por moneda" /></div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Neto</CardTitle></CardHeader>
          <CardContent><div className={`text-2xl font-bold flex items-center ${totalRev - totalExp >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{fmt(totalRev - totalExp)}<CurrencyBreakdown items={[...revenues, ...filteredExpenses]} label="Movimientos por moneda" /></div></CardContent></Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Reembolsos pendientes</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-amber-500 flex items-center">{fmt(totalReimbursementPending)}<CurrencyBreakdown items={expenses.filter((e: any) => e.funding_source === "own_money_reimbursable" && e.reimbursement_status === "pending")} label="Reembolsos por moneda" /></div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="cat">
        <TabsList>
          <TabsTrigger value="cat">Gastos · Categoría</TabsTrigger>
          <TabsTrigger value="geo">Gastos · Geografía</TabsTrigger>
          <TabsTrigger value="user">Gastos · Usuario</TabsTrigger>
          <TabsTrigger value="fund">Gastos · Fuente de pago</TabsTrigger>
          <TabsTrigger value="src">Ingresos · Fuente</TabsTrigger>
        </TabsList>
        <TabsContent value="cat"><Table rows={byCategory} /></TabsContent>
        <TabsContent value="geo"><Table rows={byGeo} /></TabsContent>
        <TabsContent value="user"><Table rows={byUser} /></TabsContent>
        <TabsContent value="fund"><Table rows={byFunding} /></TabsContent>
        <TabsContent value="src"><Table rows={bySource} /></TabsContent>
      </Tabs>
    </div>
  );
}
