import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { CurrencyBreakdown, type CurrencyItem } from "@/components/contabilidad/CurrencyBreakdown";

interface Totals {
  expenses_usd: number;
  revenues_usd: number;
  net_usd: number;
  open_transfers: number;
  pending_invoices: number;
}

interface ForecastPoint { month: string; revenues: number; expenses: number; net: number; confidence?: string; forecast?: boolean }

export default function ContabilidadDashboard() {
  const [t, setT] = useState<Totals>({ expenses_usd: 0, revenues_usd: 0, net_usd: 0, open_transfers: 0, pending_invoices: 0 });
  const [expItems, setExpItems] = useState<CurrencyItem[]>([]);
  const [revItems, setRevItems] = useState<CurrencyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [narrative, setNarrative] = useState<string>("");
  const [loadingFc, setLoadingFc] = useState(false);

  useEffect(() => {
    (async () => {
      const monthStart = new Date(); monthStart.setDate(1);
      const start = monthStart.toISOString().slice(0, 10);
      const [exp, rev, transf, inv] = await Promise.all([
        supabase.from("accounting_expenses").select("amount_usd,amount_original,currency_original").gte("expense_date", start),
        supabase.from("accounting_revenues").select("amount_usd,amount_original,currency_original").gte("revenue_date", start),
        supabase.from("accounting_treasury_transfers").select("id", { count: "exact", head: true })
          .in("status", ["pending_sender_proof", "pending_recipient_receipt", "partially_justified"]),
        supabase.from("accounting_invoices").select("id", { count: "exact", head: true })
          .in("status", ["uploaded", "ocr_done"]),
      ]);
      const sum = (arr: any[] | null) => (arr ?? []).reduce((a, r) => a + Number(r.amount_usd ?? 0), 0);
      const e = sum(exp.data), r = sum(rev.data);
      setExpItems((exp.data ?? []) as CurrencyItem[]);
      setRevItems((rev.data ?? []) as CurrencyItem[]);
      setT({
        expenses_usd: e, revenues_usd: r, net_usd: r - e,
        open_transfers: transf.count ?? 0, pending_invoices: inv.count ?? 0,
      });
      setLoading(false);
    })();
  }, []);

  const runForecast = async () => {
    setLoadingFc(true);
    try {
      const { data, error } = await supabase.functions.invoke("accounting-forecast", { body: {} });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Error");
      const hist: ForecastPoint[] = (data.history ?? []).map((h: any) => ({ ...h, forecast: false }));
      const fc: ForecastPoint[] = (data.forecast ?? []).map((h: any) => ({ ...h, forecast: true }));
      setForecast([...hist, ...fc]);
      setNarrative(data.narrative ?? "");
      toast.success("Forecast generado");
    } catch (e: any) {
      toast.error(e.message ?? "Error al generar forecast");
    } finally {
      setLoadingFc(false);
    }
  };

  const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const cards: Array<{ label: string; value: string; color?: string; items?: CurrencyItem[] }> = [
    { label: "Ingresos del mes", value: fmt(t.revenues_usd), color: "text-emerald-500", items: revItems },
    { label: "Gastos del mes", value: fmt(t.expenses_usd), color: "text-rose-500", items: expItems },
    { label: "Resultado neto", value: fmt(t.net_usd), color: t.net_usd >= 0 ? "text-emerald-500" : "text-rose-500", items: [...revItems, ...expItems] },
    { label: "Transferencias abiertas", value: String(t.open_transfers) },
    { label: "Facturas por revisar", value: String(t.pending_invoices) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard CEO</h2>
        <p className="text-muted-foreground text-sm">Vista ejecutiva del mes en curso · USD funcional</p>
      </div>
      {loading ? <div className="text-muted-foreground">Cargando…</div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {cards.map((c) => (
            <Card key={c.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-medium">{c.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold flex items-center ${c.color ?? ""}`}>
                  <span>{c.value}</span>
                  {c.items && c.items.length > 0 && <CurrencyBreakdown items={c.items} label={c.label} />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Forecast IA · 3 meses</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Proyección de ingresos, gastos y neto con base en los últimos 6 meses</p>
          </div>
          <Button onClick={runForecast} disabled={loadingFc} size="sm">
            <Sparkles className="h-4 w-4 mr-1" />
            {loadingFc ? "Generando…" : forecast.length ? "Regenerar" : "Generar forecast"}
          </Button>
        </CardHeader>
        <CardContent>
          {forecast.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay forecast. Pulsa "Generar forecast" para obtener proyecciones IA.</p>
          ) : (
            <>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={forecast}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      formatter={(v: any) => fmt(Number(v))} />
                    <Legend />
                    <Bar dataKey="revenues" name="Ingresos" fill="hsl(var(--primary))" />
                    <Bar dataKey="expenses" name="Gastos" fill="hsl(var(--destructive))" />
                    <Line type="monotone" dataKey="net" name="Neto" stroke="hsl(var(--foreground))" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              {narrative && (
                <div className="mt-4 p-3 rounded-md bg-muted/40 text-sm whitespace-pre-wrap">{narrative}</div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
