import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import StatCard from "@/components/StatCard";
import { Users, Clock, TrendingUp, Award, BarChart3, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface BDMetric {
  bdId: string | null;
  bdName: string;
  total: number;
  submitted: number;
  configured: number;
  draft: number;
  avgDaysToSubmit: number;
  models: Record<string, number>;
}

const MODEL_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#6366f1", "#f59e0b", "#10b981", "#ef4444"];

const BDStats = () => {
  const [metrics, setMetrics] = useState<BDMetric[]>([]);
  const [globalStats, setGlobalStats] = useState({ total: 0, submitted: 0, configured: 0, avgDays: "—", topBD: "—", conversionRate: "0%" });
  const [modelData, setModelData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: ibs } = await supabase.from("ibs").select("id, nombre_bd, created_by, status, modelo_negocio, created_at, updated_at");
      if (!ibs) { setLoading(false); return; }

      const byBD = new Map<string, BDMetric>();

      for (const ib of ibs) {
        const key = ib.created_by || "unknown";
        if (!byBD.has(key)) {
          byBD.set(key, { bdId: ib.created_by, bdName: ib.nombre_bd, total: 0, submitted: 0, configured: 0, draft: 0, avgDaysToSubmit: 0, models: {} });
        }
        const m = byBD.get(key)!;
        m.total++;
        if (ib.status === "submitted" || ib.status === "configurado") m.submitted++;
        if (ib.status === "configurado") m.configured++;
        if (ib.status === "draft") m.draft++;
        m.models[ib.modelo_negocio] = (m.models[ib.modelo_negocio] || 0) + 1;
      }

      // Calc avg days to submit per BD
      for (const [key, m] of byBD) {
        const bdIbs = ibs.filter(ib => (ib.created_by || "unknown") === key && (ib.status === "submitted" || ib.status === "configurado"));
        if (bdIbs.length > 0) {
          const totalDays = bdIbs.reduce((sum, ib) => {
            const created = new Date(ib.created_at).getTime();
            const updated = new Date(ib.updated_at).getTime();
            return sum + (updated - created) / (1000 * 60 * 60 * 24);
          }, 0);
          m.avgDaysToSubmit = Math.round((totalDays / bdIbs.length) * 10) / 10;
        }
      }

      const sorted = Array.from(byBD.values()).sort((a, b) => b.total - a.total);
      setMetrics(sorted);

      const totalIBs = ibs.length;
      const totalSubmitted = ibs.filter(i => i.status === "submitted" || i.status === "configurado").length;
      const totalConfigured = ibs.filter(i => i.status === "configurado").length;
      const topBD = sorted[0]?.bdName || "—";

      const allSubmitted = ibs.filter(i => i.status !== "draft");
      let avgDaysGlobal = 0;
      if (allSubmitted.length > 0) {
        avgDaysGlobal = allSubmitted.reduce((sum, ib) => {
          return sum + (new Date(ib.updated_at).getTime() - new Date(ib.created_at).getTime()) / (1000 * 60 * 60 * 24);
        }, 0) / allSubmitted.length;
      }

      setGlobalStats({
        total: totalIBs,
        submitted: totalSubmitted,
        configured: totalConfigured,
        avgDays: avgDaysGlobal > 0 ? `${Math.round(avgDaysGlobal * 10) / 10}d` : "—",
        topBD,
        conversionRate: totalIBs > 0 ? `${Math.round((totalConfigured / totalIBs) * 100)}%` : "0%",
      });

      // Model breakdown
      const modelCount: Record<string, number> = {};
      ibs.forEach(ib => { modelCount[ib.modelo_negocio] = (modelCount[ib.modelo_negocio] || 0) + 1; });
      setModelData(Object.entries(modelCount).map(([name, value]) => ({ name, value })));

      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <p className="text-muted-foreground">Cargando estadísticas BD...</p>;

  const chartConfig = metrics.reduce((acc, m, i) => {
    acc[m.bdName] = { label: m.bdName, color: MODEL_COLORS[i % MODEL_COLORS.length] };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  const barData = metrics.slice(0, 10).map(m => ({
    name: m.bdName.length > 15 ? m.bdName.slice(0, 15) + "…" : m.bdName,
    fullName: m.bdName,
    total: m.total,
    submitted: m.submitted,
    configured: m.configured,
  }));

  return (
    <div className="space-y-6">
      {/* Global KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="Total IBs" value={globalStats.total} icon={Users} />
        <StatCard title="Enviados" value={globalStats.submitted} icon={FileText} />
        <StatCard title="Configurados" value={globalStats.configured} icon={TrendingUp} />
        <StatCard title="T. Prom. Proceso" value={globalStats.avgDays} icon={Clock} />
        <StatCard title="Tasa Conversión" value={globalStats.conversionRate} icon={BarChart3} />
        <StatCard title="Top BD" value={globalStats.topBD} icon={Award} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar chart - IBs per BD */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">IBs por Business Developer</h3>
          {barData.length > 0 ? (
            <ChartContainer config={{ total: { label: "Total", color: "hsl(var(--primary))" }, submitted: { label: "Enviados", color: "hsl(var(--accent))" }, configured: { label: "Configurados", color: "#10b981" } }} className="h-[300px]">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="submitted" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="configured" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          ) : <p className="text-muted-foreground text-sm">Sin datos</p>}
        </Card>

        {/* Pie chart - Model breakdown */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Distribución por Modelo de Negocio</h3>
          {modelData.length > 0 ? (
            <div className="h-[300px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={modelData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                    {modelData.map((_, i) => <Cell key={i} fill={MODEL_COLORS[i % MODEL_COLORS.length]} />)}
                  </Pie>
                  <ChartTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-muted-foreground text-sm">Sin datos</p>}
        </Card>
      </div>

      {/* Detailed table */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Detalle por BD</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>BD</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Enviados</TableHead>
                <TableHead className="text-center">Configurados</TableHead>
                <TableHead className="text-center">Borradores</TableHead>
                <TableHead className="text-center">T. Prom. (días)</TableHead>
                <TableHead className="text-center">Conversión</TableHead>
                <TableHead>Modelos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.map((m) => (
                <TableRow key={m.bdId || m.bdName}>
                  <TableCell className="font-medium">{m.bdName}</TableCell>
                  <TableCell className="text-center">{m.total}</TableCell>
                  <TableCell className="text-center">{m.submitted}</TableCell>
                  <TableCell className="text-center">{m.configured}</TableCell>
                  <TableCell className="text-center">{m.draft}</TableCell>
                  <TableCell className="text-center">{m.avgDaysToSubmit > 0 ? m.avgDaysToSubmit : "—"}</TableCell>
                  <TableCell className="text-center">{m.total > 0 ? `${Math.round((m.configured / m.total) * 100)}%` : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {Object.entries(m.models).map(([k, v]) => `${k}: ${v}`).join(", ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};

export default BDStats;
