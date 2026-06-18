import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, CartesianGrid } from "recharts";
import { CurrencyBreakdown, type CurrencyItem } from "@/components/contabilidad/CurrencyBreakdown";

type Row = { period: string; inflow: number; outflow: number; net: number; cumulative: number };

export default function FlujoCajaPage() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const [from, setFrom] = useState(start.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("month");
  const [rows, setRows] = useState<Row[]>([]);
  const [byMethod, setByMethod] = useState<{ name: string; in: number; out: number }[]>([]);
  const [revItems, setRevItems] = useState<CurrencyItem[]>([]);
  const [expItems, setExpItems] = useState<CurrencyItem[]>([]);
  const [loading, setLoading] = useState(false);

  function bucket(d: string) {
    const dt = new Date(d);
    if (groupBy === "day") return d.slice(0, 10);
    if (groupBy === "week") {
      const day = dt.getUTCDay() || 7;
      const monday = new Date(dt); monday.setUTCDate(dt.getUTCDate() - day + 1);
      return monday.toISOString().slice(0, 10);
    }
    return d.slice(0, 7);
  }

  async function load() {
    setLoading(true);
    const [{ data: rev }, { data: exp }, { data: tr }, { data: methods }] = await Promise.all([
      supabase.from("accounting_revenues").select("revenue_date,amount_usd,amount_original,currency_original").gte("revenue_date", from).lte("revenue_date", to),
      supabase.from("accounting_expenses").select("expense_date,amount_usd,amount_original,currency_original").gte("expense_date", from).lte("expense_date", to),
      supabase.from("accounting_treasury_transfers").select("transfer_date,amount_usd,sender_user_id,recipient_user_id").gte("transfer_date", from).lte("transfer_date", to),
      supabase.from("profiles").select("user_id,nombre"),
    ]);

    const map = new Map<string, Row>();
    function ensure(k: string) {
      if (!map.has(k)) map.set(k, { period: k, inflow: 0, outflow: 0, net: 0, cumulative: 0 });
      return map.get(k)!;
    }
    (rev || []).forEach((r: any) => { const b = ensure(bucket(r.revenue_date)); b.inflow += Number(r.amount_usd || 0); });
    (exp || []).forEach((r: any) => { const b = ensure(bucket(r.expense_date)); b.outflow += Number(r.amount_usd || 0); });

    const sorted = Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period));
    let cum = 0;
    sorted.forEach(r => { r.net = r.inflow - r.outflow; cum += r.net; r.cumulative = cum; });
    setRows(sorted);
    setRevItems(((rev || []) as any[]).map(r => ({ amount_original: r.amount_original, currency_original: r.currency_original })));
    setExpItems(((exp || []) as any[]).map(r => ({ amount_original: r.amount_original, currency_original: r.currency_original })));

    // Treasury transfers grouped by user (sender = out, recipient = in)
    const userMap = new Map<string, { name: string; in: number; out: number }>();
    (methods || []).forEach((p: any) => userMap.set(p.user_id, { name: p.nombre || p.user_id.slice(0, 8), in: 0, out: 0 }));
    (tr || []).forEach((t: any) => {
      const amt = Number(t.amount_usd || 0);
      const s = userMap.get(t.sender_user_id); if (s) s.out += amt;
      const r = userMap.get(t.recipient_user_id); if (r) r.in += amt;
    });
    setByMethod(Array.from(userMap.values()).filter(m => m.in > 0 || m.out > 0));

    setLoading(false);
  }
  useEffect(() => { load(); }, [from, to, groupBy]);

  const totalIn = rows.reduce((s, r) => s + r.inflow, 0);
  const totalOut = rows.reduce((s, r) => s + r.outflow, 0);
  const net = totalIn - totalOut;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Flujo de Caja</h2>
        <p className="text-muted-foreground">Análisis de entradas y salidas en USD</p>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-4 items-end">
          <div><Label>Desde</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-44" /></div>
          <div><Label>Hasta</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-44" /></div>
          <div className="flex gap-1">
            {(["day", "week", "month"] as const).map(g => (
              <button key={g} onClick={() => setGroupBy(g)}
                className={`px-3 py-2 text-sm rounded-md border ${groupBy === g ? "bg-primary text-primary-foreground" : ""}`}>
                {g === "day" ? "Día" : g === "week" ? "Semana" : "Mes"}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader><CardTitle className="text-sm">Entradas</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-emerald-600 flex items-center">${totalIn.toLocaleString(undefined, { maximumFractionDigits: 0 })}<CurrencyBreakdown items={revItems} label="Entradas por moneda" /></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Salidas</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-destructive flex items-center">${totalOut.toLocaleString(undefined, { maximumFractionDigits: 0 })}<CurrencyBreakdown items={expItems} label="Salidas por moneda" /></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Neto</CardTitle></CardHeader>
          <CardContent className={`text-2xl font-bold flex items-center ${net >= 0 ? "text-emerald-600" : "text-destructive"}`}>${net.toLocaleString(undefined, { maximumFractionDigits: 0 })}<CurrencyBreakdown items={[...revItems, ...expItems]} label="Movimientos por moneda" /></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Períodos</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{rows.length}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Saldo acumulado</CardTitle></CardHeader>
        <CardContent className="h-72">
          {loading ? <p>Cargando…</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="period" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="cumulative" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Entradas vs Salidas por período</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="period" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip /><Legend />
              <Bar dataKey="inflow" fill="hsl(142 76% 36%)" name="Entradas" />
              <Bar dataKey="outflow" fill="hsl(var(--destructive))" name="Salidas" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Detalle por período</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Periodo</TableHead><TableHead>Entrada</TableHead><TableHead>Salida</TableHead><TableHead>Neto</TableHead><TableHead>Acumulado</TableHead></TableRow></TableHeader>
              <TableBody>{rows.map(r => (
                <TableRow key={r.period}>
                  <TableCell>{r.period}</TableCell>
                  <TableCell className="text-emerald-600">${r.inflow.toFixed(0)}</TableCell>
                  <TableCell className="text-destructive">${r.outflow.toFixed(0)}</TableCell>
                  <TableCell className={r.net >= 0 ? "text-emerald-600" : "text-destructive"}>${r.net.toFixed(0)}</TableCell>
                  <TableCell>${r.cumulative.toFixed(0)}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Movimientos por usuario (transferencias)</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Cuenta</TableHead><TableHead>Entrada</TableHead><TableHead>Salida</TableHead><TableHead>Neto</TableHead></TableRow></TableHeader>
              <TableBody>{byMethod.map(m => (
                <TableRow key={m.name}>
                  <TableCell>{m.name}</TableCell>
                  <TableCell className="text-emerald-600">${m.in.toFixed(0)}</TableCell>
                  <TableCell className="text-destructive">${m.out.toFixed(0)}</TableCell>
                  <TableCell>${(m.in - m.out).toFixed(0)}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
