import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import StatCard from "@/components/StatCard";
import { Clock, AlertCircle, CheckCircle2, TrendingUp, ShieldCheck, Inbox, UserPlus, Sparkles } from "lucide-react";

interface UnifiedStats {
  nuevo: number;
  en_proceso: number;
  completado: number;
  total: number;
  avgWaitTime: string;
  avgProcessTime: string;
  subIbRequests: number;
  especialRequests: number;
}

const OpsDashboard = () => {
  const [stats, setStats] = useState<UnifiedStats>({ nuevo: 0, en_proceso: 0, completado: 0, total: 0, avgWaitTime: "—", avgProcessTime: "—", subIbRequests: 0, especialRequests: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [queueRes, reqRes, ibExtRes] = await Promise.all([
        supabase.from("ops_queue").select("status, created_at, taken_at, completed_at"),
        supabase.from("ops_requests").select("status, created_at, taken_at, completed_at"),
        supabase.from("ib_external_requests").select("status, request_type, created_at, ops_taken_at, ops_completed_at"),
      ]);

      const ibExtStatusMap: Record<string, string> = {
        pendiente_bd: "submitted",
        aprobado_bd: "submitted",
        en_proceso_ops: "en_proceso",
        completado: "configurado",
        rechazado: "configurado",
      };

      const allItems = [
        ...(queueRes.data ?? []).map(d => ({ ...d, _source: "queue" as const })),
        ...(reqRes.data ?? []).map(d => ({ ...d, _source: "request" as const })),
        ...(ibExtRes.data ?? []).map(d => ({
          status: ibExtStatusMap[d.status] || d.status,
          created_at: d.created_at,
          taken_at: d.ops_taken_at,
          completed_at: d.ops_completed_at,
          _source: "ib_externo" as const,
        })),
      ];

      const nuevo = allItems.filter(d => d.status === "nuevo" || d.status === "submitted").length;
      const en_proceso = allItems.filter(d => d.status === "en_proceso").length;
      const completado = allItems.filter(d => d.status === "configurado").length;

      const withTaken = allItems.filter(d => d.taken_at);
      let avgWaitMs = 0;
      if (withTaken.length > 0) {
        avgWaitMs = withTaken.reduce((sum, d) => sum + (new Date(d.taken_at!).getTime() - new Date(d.created_at).getTime()), 0) / withTaken.length;
      }

      const withCompleted = allItems.filter(d => d.taken_at && d.completed_at);
      let avgProcessMs = 0;
      if (withCompleted.length > 0) {
        avgProcessMs = withCompleted.reduce((sum, d) => sum + (new Date(d.completed_at!).getTime() - new Date(d.taken_at!).getTime()), 0) / withCompleted.length;
      }

      const ibExtItems = ibExtRes.data ?? [];
      const subIbRequests = ibExtItems.filter(d => d.request_type === "sub_ib").length;
      const especialRequests = ibExtItems.filter(d => d.request_type !== "sub_ib").length;

      setStats({
        nuevo,
        en_proceso,
        completado,
        total: allItems.length,
        avgWaitTime: formatDuration(avgWaitMs),
        avgProcessTime: formatDuration(avgProcessMs),
        subIbRequests,
        especialRequests,
      });
      setLoading(false);
    };

    fetchStats();

    const ch1 = supabase.channel("dash-queue").on("postgres_changes", { event: "*", schema: "public", table: "ops_queue" }, () => fetchStats()).subscribe();
    const ch2 = supabase.channel("dash-requests").on("postgres_changes", { event: "*", schema: "public", table: "ops_requests" }, () => fetchStats()).subscribe();
    const ch3 = supabase.channel("dash-ibext").on("postgres_changes", { event: "*", schema: "public", table: "ib_external_requests" }, () => fetchStats()).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); supabase.removeChannel(ch3); };
  }, []);

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

  if (loading) return <p className="text-muted-foreground">Cargando métricas...</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="Pendientes" value={stats.nuevo.toString()} icon={AlertCircle} />
        <StatCard title="En Proceso" value={stats.en_proceso.toString()} icon={Clock} />
        <StatCard title="Completados" value={stats.completado.toString()} icon={CheckCircle2} />
        <StatCard title="Total" value={stats.total.toString()} icon={Inbox} />
        <StatCard title="T. Prom. Espera" value={stats.avgWaitTime} icon={TrendingUp} />
        <StatCard title="T. Prom. Proceso" value={stats.avgProcessTime} icon={TrendingUp} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Solicitudes Sub IB" value={stats.subIbRequests.toString()} icon={UserPlus} />
        <StatCard title="Solicitudes Especiales" value={stats.especialRequests.toString()} icon={Sparkles} />
      </div>
    </div>
  );
};

export default OpsDashboard;
