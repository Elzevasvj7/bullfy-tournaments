import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileBarChart } from "lucide-react";
import { CurrencyBreakdown, type CurrencyItem } from "@/components/contabilidad/CurrencyBreakdown";

type AggRow = { nombre: string; ingresos: number; gastos: number; revItems: CurrencyItem[]; expItems: CurrencyItem[] };

export default function ReportesFiscalesPage() {
  const [from, setFrom] = useState(new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [byGeo, setByGeo] = useState<AggRow[]>([]);
  const [byEntity, setByEntity] = useState<AggRow[]>([]);

  useEffect(() => {
    (async () => {
      const [exp, geos, ents] = await Promise.all([
        supabase.from("accounting_expenses").select("amount_usd,amount_original,currency_original,geography_id,entity_id,expense_date").gte("expense_date", from).lte("expense_date", to),
        supabase.from("accounting_geographies").select("id,name,country_code"),
        supabase.from("accounting_entities").select("id,name,country_code"),
      ]);
      const rev = await supabase.from("accounting_revenues").select("amount_usd,amount_original,currency_original,geography_id,entity_id,revenue_date").gte("revenue_date", from).lte("revenue_date", to);

      const ensure = (map: Record<string, AggRow>, k: string, nombre: string) => {
        if (!map[k]) map[k] = { nombre, ingresos: 0, gastos: 0, revItems: [], expItems: [] };
        return map[k];
      };

      const aggGeo: Record<string, AggRow> = {};
      (exp.data ?? []).forEach((e: any) => {
        const g = geos.data?.find(x => x.id === e.geography_id);
        const k = e.geography_id || "_sin";
        const row = ensure(aggGeo, k, g?.name || "Sin geografía");
        row.gastos += Number(e.amount_usd || 0);
        row.expItems.push({ amount_original: e.amount_original, currency_original: e.currency_original });
      });
      (rev.data ?? []).forEach((e: any) => {
        const g = geos.data?.find(x => x.id === e.geography_id);
        const k = e.geography_id || "_sin";
        const row = ensure(aggGeo, k, g?.name || "Sin geografía");
        row.ingresos += Number(e.amount_usd || 0);
        row.revItems.push({ amount_original: e.amount_original, currency_original: e.currency_original });
      });
      setByGeo(Object.values(aggGeo));

      const aggEnt: Record<string, AggRow> = {};
      (exp.data ?? []).forEach((e: any) => {
        const en = ents.data?.find(x => x.id === e.entity_id);
        const k = e.entity_id || "_sin";
        const row = ensure(aggEnt, k, en?.name || "Sin entidad");
        row.gastos += Number(e.amount_usd || 0);
        row.expItems.push({ amount_original: e.amount_original, currency_original: e.currency_original });
      });
      (rev.data ?? []).forEach((e: any) => {
        const en = ents.data?.find(x => x.id === e.entity_id);
        const k = e.entity_id || "_sin";
        const row = ensure(aggEnt, k, en?.name || "Sin entidad");
        row.ingresos += Number(e.amount_usd || 0);
        row.revItems.push({ amount_original: e.amount_original, currency_original: e.currency_original });
      });
      setByEntity(Object.values(aggEnt));
    })();
  }, [from, to]);

  const renderTable = (rows: AggRow[], header: string) => (
    <Table>
      <TableHeader><TableRow><TableHead>{header}</TableHead><TableHead>Ingresos USD</TableHead><TableHead>Gastos USD</TableHead><TableHead>Neto</TableHead></TableRow></TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            <TableCell className="font-medium">{r.nombre}</TableCell>
            <TableCell><span className="inline-flex items-center">${r.ingresos.toFixed(2)}<CurrencyBreakdown items={r.revItems} label="Ingresos por moneda" /></span></TableCell>
            <TableCell><span className="inline-flex items-center">${r.gastos.toFixed(2)}<CurrencyBreakdown items={r.expItems} label="Gastos por moneda" /></span></TableCell>
            <TableCell className={r.ingresos - r.gastos >= 0 ? "text-green-600" : "text-red-600"}>
              <span className="inline-flex items-center">${(r.ingresos - r.gastos).toFixed(2)}<CurrencyBreakdown items={[...r.revItems, ...r.expItems]} label="Movimientos por moneda" /></span>
            </TableCell>
          </TableRow>
        ))}
        {!rows.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sin datos.</TableCell></TableRow>}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><FileBarChart className="h-6 w-6" />Reportes fiscales</h1>

      <Card>
        <CardHeader><CardTitle>Período</CardTitle></CardHeader>
        <CardContent className="flex gap-3">
          <div><Label>Desde</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>Hasta</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Por geografía</CardTitle></CardHeader>
        <CardContent>{renderTable(byGeo, "Geografía")}</CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Por entidad legal</CardTitle></CardHeader>
        <CardContent>{renderTable(byEntity, "Entidad")}</CardContent>
      </Card>
    </div>
  );
}
