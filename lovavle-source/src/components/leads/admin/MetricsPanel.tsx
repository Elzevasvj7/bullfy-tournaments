import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, RefreshCw, Trophy, Users, Target, Timer } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

type Daily = {
  snapshot_date: string;
  closer_id: string | null;
  new_leads: number;
  contacted_leads: number;
  won_leads: number;
  lost_leads: number;
  conversion_rate: number;
  avg_first_contact_minutes: number | null;
  sla_violations: number;
};
type TopRow = { closer_id: string; closer_name?: string; new_leads: number; won_leads: number; lost_leads: number; conversion_rate: number; avg_first_contact_minutes: number | null; sla_violations: number };

export default function MetricsPanel() {
  const [days, setDays] = useState(30);
  const [series, setSeries] = useState<Daily[]>([]);
  const [top, setTop] = useState<TopRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const { data } = await supabase.from("lead_metrics_daily").select("*").gte("snapshot_date", since).order("snapshot_date");
    setSeries((data ?? []) as Daily[]);

    const { data: tops, error } = await supabase.rpc("lead_top_performers", { period_days: days });
    if (!error && tops) {
      const rows = (tops as any[]).map((r) => ({ ...r, won_leads: Number(r.won_leads), new_leads: Number(r.new_leads), lost_leads: Number(r.lost_leads), sla_violations: Number(r.sla_violations) })) as TopRow[];
      const ids = rows.map((r) => r.closer_id).filter(Boolean);
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id,nombre").in("id", ids) : { data: [] };
      const pMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.nombre]));
      setTop(rows.map((r) => ({ ...r, closer_name: pMap[r.closer_id] ?? r.closer_id.slice(0, 8) })));
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [days]);

  const runAggregate = async () => {
    setRunning(true);
    const { error } = await supabase.functions.invoke("lead-metrics-aggregate");
    setRunning(false);
    if (error) toast.error(error.message); else { toast.success("Métricas recalculadas"); load(); }
  };

  // Aggregate by date across closers
  const byDate = Object.values(series.reduce<Record<string, any>>((acc, r) => {
    const k = r.snapshot_date;
    if (!acc[k]) acc[k] = { date: k, new_leads: 0, won_leads: 0, lost_leads: 0, sla_violations: 0, conv: 0, _n: 0 };
    acc[k].new_leads += r.new_leads;
    acc[k].won_leads += r.won_leads;
    acc[k].lost_leads += r.lost_leads;
    acc[k].sla_violations += r.sla_violations;
    acc[k].conv += Number(r.conversion_rate);
    acc[k]._n += 1;
    return acc;
  }, {})).map((d: any) => ({ ...d, conversion: d._n ? +(d.conv / d._n).toFixed(2) : 0 }));

  const totals = byDate.reduce((acc, d: any) => ({
    n: acc.n + d.new_leads, w: acc.w + d.won_leads, l: acc.l + d.lost_leads, s: acc.s + d.sla_violations,
  }), { n: 0, w: 0, l: 0, s: 0 });
  const convTotal = totals.n ? +((totals.w / totals.n) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Select value={String(days)} onValueChange={(v) => setDays(parseInt(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 días</SelectItem>
              <SelectItem value="30">30 días</SelectItem>
              <SelectItem value="90">90 días</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <Button size="sm" onClick={runAggregate} disabled={running}>
          {running ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <TrendingUp className="w-4 h-4 mr-1" />} Recalcular hoy
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={<Users className="w-4 h-4" />} label="Nuevos" value={totals.n} />
        <KpiCard icon={<Trophy className="w-4 h-4 text-emerald-500" />} label="Ganados" value={totals.w} />
        <KpiCard icon={<Target className="w-4 h-4 text-primary" />} label="Conversión" value={`${convTotal}%`} />
        <KpiCard icon={<Timer className="w-4 h-4 text-destructive" />} label="SLA violados" value={totals.s} />
      </div>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-base">Tendencia</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="h-64 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div> :
            byDate.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Sin datos aún. Pulsa "Recalcular hoy".</p> :
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={byDate}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Line type="monotone" dataKey="new_leads" stroke="hsl(var(--primary))" strokeWidth={2} name="Nuevos" />
                <Line type="monotone" dataKey="won_leads" stroke="hsl(142 71% 45%)" strokeWidth={2} name="Ganados" />
                <Line type="monotone" dataKey="sla_violations" stroke="hsl(var(--destructive))" strokeWidth={2} name="SLA violados" />
              </LineChart>
            </ResponsiveContainer>}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> Top performers ({days}d)</CardTitle></CardHeader>
        <CardContent>
          {top.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Sin datos.</p> :
            <ResponsiveContainer width="100%" height={Math.max(220, top.length * 36)}>
              <BarChart data={top} layout="vertical" margin={{ left: 70 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis type="category" dataKey="closer_name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={120} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="won_leads" fill="hsl(var(--primary))" name="Ganados" />
                <Bar dataKey="new_leads" fill="hsl(var(--muted-foreground) / 0.3)" name="Nuevos" />
              </BarChart>
            </ResponsiveContainer>}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon} {label}</div>
        <div className="text-2xl font-display font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
