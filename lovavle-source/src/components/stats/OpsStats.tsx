import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import StatCard from "@/components/StatCard";
import { Clock, CheckCircle2, AlertCircle, TrendingUp, Users, Inbox, UserPlus, Sparkles, Timer } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#6366f1", "#f59e0b", "#10b981", "#ef4444"];

const formatDuration = (ms: number): string => {
  if (ms === 0) return "—";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
};

interface OperatorMetric {
  name: string;
  completed: number;
  avgProcessTime: string;
  avgProcessMs: number;
}

const OpsStats = () => {
  const [loading, setLoading] = useState(true);
  const [globalStats, setGlobalStats] = useState({
    pendientes: 0, enProceso: 0, completados: 0, total: 0,
    avgWait: "—", avgProcess: "—", slaCompliance: "—",
    subIbReqs: 0, specialReqs: 0,
  });
  const [operatorMetrics, setOperatorMetrics] = useState<OperatorMetric[]>([]);
  const [weeklyData, setWeeklyData] = useState<{ week: string; completed: number; created: number }[]>([]);
  const [sourceBreakdown, setSourceBreakdown] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const [queueRes, reqRes, ibExtRes, profilesRes] = await Promise.all([
        supabase.from("ops_queue").select("id, status, created_at, taken_at, completed_at, assigned_to"),
        supabase.from("ops_requests").select("id, status, created_at, taken_at, completed_at, taken_by, description"),
        supabase.from("ib_external_requests").select("id, status, request_type, created_at, ops_taken_at, ops_completed_at, ops_assigned_to"),
        supabase.from("profiles").select("id, nombre"),
      ]);

      const profileMap = new Map<string, string>();
      (profilesRes.data ?? []).forEach(p => profileMap.set(p.id, p.nombre));

      const queue = queueRes.data ?? [];
      const requests = reqRes.data ?? [];
      const ibExt = ibExtRes.data ?? [];

      // Normalize all items
      const ibExtStatusMap: Record<string, string> = {
        pendiente_bd: "submitted", aprobado_bd: "submitted",
        en_proceso_ops: "en_proceso", completado: "configurado", rechazado: "configurado",
      };

      const allItems = [
        ...queue.map(d => ({ source: "Cola IB" as const, status: d.status, created_at: d.created_at, taken_at: d.taken_at, completed_at: d.completed_at, operator: d.assigned_to })),
        ...requests.map(d => ({ source: "Solicitudes" as const, status: d.status, created_at: d.created_at, taken_at: d.taken_at, completed_at: d.completed_at, operator: d.taken_by })),
        ...ibExt.map(d => ({ source: "IB Externo" as const, status: ibExtStatusMap[d.status] || d.status, created_at: d.created_at, taken_at: d.ops_taken_at, completed_at: d.ops_completed_at, operator: d.ops_assigned_to })),
      ];

      const pendientes = allItems.filter(d => d.status === "nuevo" || d.status === "submitted").length;
      const enProceso = allItems.filter(d => d.status === "en_proceso").length;
      const completados = allItems.filter(d => d.status === "configurado").length;

      // Avg wait time (created → taken)
      const withTaken = allItems.filter(d => d.taken_at);
      const avgWaitMs = withTaken.length > 0 ? withTaken.reduce((s, d) => s + (new Date(d.taken_at!).getTime() - new Date(d.created_at).getTime()), 0) / withTaken.length : 0;

      // Avg process time (taken → completed)
      const withCompleted = allItems.filter(d => d.taken_at && d.completed_at);
      const avgProcessMs = withCompleted.length > 0 ? withCompleted.reduce((s, d) => s + (new Date(d.completed_at!).getTime() - new Date(d.taken_at!).getTime()), 0) / withCompleted.length : 0;

      // SLA: % completed within 24h of being taken
      const sla24h = withCompleted.length > 0
        ? Math.round((withCompleted.filter(d => (new Date(d.completed_at!).getTime() - new Date(d.taken_at!).getTime()) < 24 * 60 * 60 * 1000).length / withCompleted.length) * 100)
        : 0;

      // IB Externo breakdown
      const subIbReqs = ibExt.filter(d => d.request_type === "sub_ib").length;
      const specialReqs = ibExt.filter(d => d.request_type !== "sub_ib").length;

      setGlobalStats({
        pendientes, enProceso, completados, total: allItems.length,
        avgWait: formatDuration(avgWaitMs),
        avgProcess: formatDuration(avgProcessMs),
        slaCompliance: withCompleted.length > 0 ? `${sla24h}%` : "—",
        subIbReqs, specialReqs,
      });

      // Source breakdown for pie
      const sourceCount: Record<string, number> = {};
      allItems.forEach(d => { sourceCount[d.source] = (sourceCount[d.source] || 0) + 1; });
      setSourceBreakdown(Object.entries(sourceCount).map(([name, value]) => ({ name, value })));

      // Operator performance
      const opMap = new Map<string, { completed: number; totalMs: number }>();
      withCompleted.forEach(d => {
        if (!d.operator) return;
        if (!opMap.has(d.operator)) opMap.set(d.operator, { completed: 0, totalMs: 0 });
        const op = opMap.get(d.operator)!;
        op.completed++;
        op.totalMs += new Date(d.completed_at!).getTime() - new Date(d.taken_at!).getTime();
      });
      const opMetrics: OperatorMetric[] = Array.from(opMap.entries()).map(([id, data]) => ({
        name: profileMap.get(id) || id.slice(0, 8),
        completed: data.completed,
        avgProcessMs: data.totalMs / data.completed,
        avgProcessTime: formatDuration(data.totalMs / data.completed),
      })).sort((a, b) => b.completed - a.completed);
      setOperatorMetrics(opMetrics);

      // Weekly trend (last 8 weeks)
      const now = Date.now();
      const weeks: { week: string; completed: number; created: number }[] = [];
      for (let i = 7; i >= 0; i--) {
        const weekStart = now - (i + 1) * 7 * 24 * 60 * 60 * 1000;
        const weekEnd = now - i * 7 * 24 * 60 * 60 * 1000;
        const label = new Date(weekStart).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
        const created = allItems.filter(d => { const t = new Date(d.created_at).getTime(); return t >= weekStart && t < weekEnd; }).length;
        const completed = allItems.filter(d => d.completed_at && (() => { const t = new Date(d.completed_at!).getTime(); return t >= weekStart && t < weekEnd; })()).length;
        weeks.push({ week: label, created, completed });
      }
      setWeeklyData(weeks);

      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <p className="text-muted-foreground">Cargando estadísticas de operaciones...</p>;

  return (
    <div className="space-y-6">
      {/* Global KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard title="Pendientes" value={globalStats.pendientes} icon={AlertCircle} />
        <StatCard title="En Proceso" value={globalStats.enProceso} icon={Clock} />
        <StatCard title="Completados" value={globalStats.completados} icon={CheckCircle2} />
        <StatCard title="T. Prom. Espera" value={globalStats.avgWait} icon={Timer} />
        <StatCard title="T. Prom. Proceso" value={globalStats.avgProcess} icon={TrendingUp} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Items" value={globalStats.total} icon={Inbox} />
        <StatCard title="SLA < 24h" value={globalStats.slaCompliance} icon={CheckCircle2} subtitle="Completados en menos de 24h" />
        <StatCard title="Solicitudes Sub IB" value={globalStats.subIbReqs} icon={UserPlus} />
        <StatCard title="Solicitudes Especiales" value={globalStats.specialReqs} icon={Sparkles} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly trend */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Tendencia Semanal (Creados vs Completados)</h3>
          <ChartContainer config={{ created: { label: "Creados", color: "hsl(var(--primary))" }, completed: { label: "Completados", color: "#10b981" } }} className="h-[300px]">
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="created" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ChartContainer>
        </Card>

        {/* Source breakdown */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Distribución por Origen</h3>
          {sourceBreakdown.length > 0 ? (
            <div className="h-[300px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sourceBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                    {sourceBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <ChartTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-muted-foreground text-sm">Sin datos</p>}
        </Card>
      </div>

      {/* Operator performance */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Rendimiento por Operador</h3>
        {operatorMetrics.length > 0 ? (
          <div className="space-y-6">
            <ChartContainer config={{ completed: { label: "Completados", color: "hsl(var(--primary))" } }} className="h-[250px]">
              <BarChart data={operatorMetrics}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="completed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operador</TableHead>
                  <TableHead className="text-center">Completados</TableHead>
                  <TableHead className="text-center">T. Prom. Proceso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operatorMetrics.map((op) => (
                  <TableRow key={op.name}>
                    <TableCell className="font-medium">{op.name}</TableCell>
                    <TableCell className="text-center">{op.completed}</TableCell>
                    <TableCell className="text-center">{op.avgProcessTime}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : <p className="text-muted-foreground text-sm">Sin datos de operadores</p>}
      </Card>
    </div>
  );
};

export default OpsStats;
