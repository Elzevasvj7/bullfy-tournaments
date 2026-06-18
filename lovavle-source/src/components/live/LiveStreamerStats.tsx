import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Trophy, Users, DollarSign, Radio, Star, UserCheck } from "lucide-react";

interface StreamerStat {
  host_id: string;
  host_name: string;
  total_streams: number;
  total_viewers: number;       // unique presences (max_viewers sum)
  total_leads: number;         // valid leads (full-stream rule)
  total_interactions: number;
  avg_rating: number;
  total_earnings: number;
}

const LiveStreamerStats = () => {
  const [stats, setStats] = useState<StreamerStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    // Unified source: live_streamer_earnings (same as Earnings & Reports panels)
    const [{ data: earnings }, { data: profiles }] = await Promise.all([
      supabase
        .from("live_streamer_earnings")
        .select("host_id, total_streams, total_viewers, total_leads, total_interactions, avg_rating, earnings_total"),
      supabase.from("profiles").select("id, nombre"),
    ]);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.nombre]));

    const hostMap: Record<string, StreamerStat> = {};
    ((earnings as any[]) || []).forEach((e) => {
      if (!hostMap[e.host_id]) {
        hostMap[e.host_id] = {
          host_id: e.host_id,
          host_name: profileMap.get(e.host_id) || "Desconocido",
          total_streams: 0,
          total_viewers: 0,
          total_leads: 0,
          total_interactions: 0,
          avg_rating: 0,
          total_earnings: 0,
        };
      }
      const h = hostMap[e.host_id];
      h.total_streams += e.total_streams || 0;
      h.total_viewers += e.total_viewers || 0;
      h.total_leads += e.total_leads || 0;
      h.total_interactions += e.total_interactions || 0;
      h.total_earnings += Number(e.earnings_total) || 0;
      // Average rating across periods (simple avg of non-zero)
      if (e.avg_rating && e.avg_rating > 0) {
        h.avg_rating = h.avg_rating > 0 ? (h.avg_rating + Number(e.avg_rating)) / 2 : Number(e.avg_rating);
      }
    });

    const sorted = Object.values(hostMap).sort((a, b) => b.total_earnings - a.total_earnings);
    setStats(sorted);
    setLoading(false);
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">🥇 #1</Badge>;
    if (index === 1) return <Badge className="bg-gray-400/20 text-gray-500 border-gray-400/30">🥈 #2</Badge>;
    if (index === 2) return <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30">🥉 #3</Badge>;
    return <Badge variant="outline">#{index + 1}</Badge>;
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando estadísticas...</div>;
  }

  if (stats.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No hay estadísticas de streaming aún</p>
          <p className="text-sm text-muted-foreground mt-1">
            Las estadísticas se generan cuando un host con rol IB Externo finaliza un stream
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalStreams = stats.reduce((s, r) => s + r.total_streams, 0);
  const totalViewers = stats.reduce((s, r) => s + r.total_viewers, 0);
  const totalLeads = stats.reduce((s, r) => s + r.total_leads, 0);
  const totalEarnings = stats.reduce((s, r) => s + r.total_earnings, 0);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Radio className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{totalStreams}</p>
              <p className="text-sm text-muted-foreground">Total Streams</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10"><Users className="w-5 h-5 text-blue-500" /></div>
            <div>
              <p className="text-2xl font-bold">{totalViewers}</p>
              <p className="text-sm text-muted-foreground">Total Viewers</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10"><UserCheck className="w-5 h-5 text-accent" /></div>
            <div>
              <p className="text-2xl font-bold">{totalLeads}</p>
              <p className="text-sm text-muted-foreground">Leads Válidos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10"><DollarSign className="w-5 h-5 text-green-500" /></div>
            <div>
              <p className="text-2xl font-bold">${totalEarnings.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Pagos Generados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ranking Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" /> Ranking de Streamers
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Lead válido: presente desde el inicio (±2 min) hasta el final (±2 min) del stream
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Streamer</TableHead>
                <TableHead className="text-center">Streams</TableHead>
                <TableHead className="text-center">Viewers</TableHead>
                <TableHead className="text-center">Leads Válidos</TableHead>
                <TableHead className="text-center">Interacciones</TableHead>
                <TableHead className="text-center">Rating</TableHead>
                <TableHead className="text-right">Ganancias</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((s, i) => (
                <TableRow key={s.host_id}>
                  <TableCell>{getRankBadge(i)}</TableCell>
                  <TableCell className="font-medium">{s.host_name}</TableCell>
                  <TableCell className="text-center">{s.total_streams}</TableCell>
                  <TableCell className="text-center">{s.total_viewers}</TableCell>
                  <TableCell className="text-center font-semibold text-accent">{s.total_leads}</TableCell>
                  <TableCell className="text-center">{s.total_interactions}</TableCell>
                  <TableCell className="text-center">
                    <span className="flex items-center justify-center gap-1">
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      {s.avg_rating > 0 ? s.avg_rating.toFixed(1) : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-bold text-green-600">
                    ${s.total_earnings.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveStreamerStats;
