import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, TrendingUp, Users, Search, Star } from "lucide-react";

interface EarningRow {
  id: string;
  host_id: string;
  period_start: string;
  period_end: string;
  total_streams: number;
  total_viewers: number;
  total_leads: number;
  total_interactions: number;
  avg_rating: number;
  earnings_leads: number;
  earnings_bonuses: number;
  earnings_total: number;
  status: string;
}

interface StreamerSummary {
  host_id: string;
  host_name: string;
  host_email: string;
  total_earnings: number;
  total_leads_earnings: number;
  total_bonuses: number;
  total_streams: number;
  total_leads: number;
  periods: EarningRow[];
}

const LiveEarningsDashboard = () => {
  const { user, isAdmin, isGlobalAdmin } = useAuth();
  const [earnings, setEarnings] = useState<EarningRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, { nombre: string; correo: string }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedHost, setExpandedHost] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    let query = supabase
      .from("live_streamer_earnings")
      .select("*")
      .order("period_start", { ascending: false });

    if (!isAdmin && !isGlobalAdmin) {
      query = query.eq("host_id", user?.id);
    }

    const [{ data: earningsData }, { data: profilesData }] = await Promise.all([
      query,
      supabase.from("profiles").select("id, nombre, correo"),
    ]);

    const pMap = new Map<string, { nombre: string; correo: string }>();
    (profilesData || []).forEach((p: any) => pMap.set(p.id, { nombre: p.nombre || "", correo: p.correo || "" }));

    setProfiles(pMap);
    setEarnings((earningsData as unknown as EarningRow[]) || []);
    setLoading(false);
  };

  const streamerSummaries = useMemo(() => {
    const map: Record<string, StreamerSummary> = {};
    earnings.forEach((e) => {
      if (!map[e.host_id]) {
        const p = profiles.get(e.host_id);
        map[e.host_id] = {
          host_id: e.host_id,
          host_name: p?.nombre || "Desconocido",
          host_email: p?.correo || "",
          total_earnings: 0,
          total_leads_earnings: 0,
          total_bonuses: 0,
          total_streams: 0,
          total_leads: 0,
          periods: [],
        };
      }
      const s = map[e.host_id];
      s.total_earnings += Number(e.earnings_total);
      s.total_leads_earnings += Number(e.earnings_leads);
      s.total_bonuses += Number(e.earnings_bonuses);
      s.total_streams += e.total_streams;
      s.total_leads += e.total_leads;
      s.periods.push(e);
    });
    return Object.values(map).sort((a, b) => b.total_earnings - a.total_earnings);
  }, [earnings, profiles]);

  const filtered = useMemo(() => {
    if (!search.trim()) return streamerSummaries;
    const q = search.toLowerCase();
    return streamerSummaries.filter(
      (s) => s.host_name.toLowerCase().includes(q) || s.host_email.toLowerCase().includes(q)
    );
  }, [streamerSummaries, search]);

  const grandTotal = streamerSummaries.reduce((s, e) => s + e.total_earnings, 0);
  const grandLeads = streamerSummaries.reduce((s, e) => s + e.total_leads_earnings, 0);
  const grandBonuses = streamerSummaries.reduce((s, e) => s + e.total_bonuses, 0);

  if (loading) return <div className="text-center py-8 text-muted-foreground">Cargando ganancias...</div>;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10"><DollarSign className="w-5 h-5 text-green-500" /></div>
            <div>
              <p className="text-2xl font-bold">${grandTotal.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Ganancias Totales</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10"><Users className="w-5 h-5 text-blue-500" /></div>
            <div>
              <p className="text-2xl font-bold">${grandLeads.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Por Leads</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10"><TrendingUp className="w-5 h-5 text-yellow-500" /></div>
            <div>
              <p className="text-2xl font-bold">${grandBonuses.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Bonos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar streamer por nombre o correo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Per-Streamer Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" /> Ganancias por Streamer
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <DollarSign className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <p>No hay ganancias registradas</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Streamer</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead className="text-center">Streams</TableHead>
                  <TableHead className="text-center">Leads</TableHead>
                  <TableHead className="text-right">Leads $</TableHead>
                  <TableHead className="text-right">Bonos $</TableHead>
                  <TableHead className="text-right">Total $</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <>
                    <TableRow
                      key={s.host_id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedHost(expandedHost === s.host_id ? null : s.host_id)}
                    >
                      <TableCell className="font-medium">{s.host_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.host_email}</TableCell>
                      <TableCell className="text-center">{s.total_streams}</TableCell>
                      <TableCell className="text-center">{s.total_leads}</TableCell>
                      <TableCell className="text-right">${s.total_leads_earnings.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${s.total_bonuses.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-bold">${s.total_earnings.toFixed(2)}</TableCell>
                    </TableRow>
                    {expandedHost === s.host_id &&
                      s.periods.map((p) => (
                        <TableRow key={p.id} className="bg-muted/30 text-xs">
                          <TableCell colSpan={2} className="pl-8 text-muted-foreground">
                            {new Date(p.period_start).toLocaleDateString()} – {new Date(p.period_end).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-center">{p.total_streams}</TableCell>
                          <TableCell className="text-center">{p.total_leads}</TableCell>
                          <TableCell className="text-right">${Number(p.earnings_leads).toFixed(2)}</TableCell>
                          <TableCell className="text-right">${Number(p.earnings_bonuses).toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <span className="flex items-center justify-end gap-2">
                              ${Number(p.earnings_total).toFixed(2)}
                              <Badge variant={p.status === "paid" ? "default" : "secondary"} className="text-[10px]">
                                {p.status === "paid" ? "Pagado" : "Pendiente"}
                              </Badge>
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveEarningsDashboard;
