import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FileBarChart, Users, Radio, DollarSign, Phone, Mail, User } from "lucide-react";

interface Streamer {
  id: string;
  nombre: string;
  correo: string;
}

interface StreamerStats {
  totalStreams: number;
  totalViewers: number;
  totalLeads: number;
  totalEarnings: number;
}

interface LeadRow {
  id: string;
  nombre: string;
  correo: string;
  telefono: string;
  stage_name: string;
  stage_color: string;
  opportunity_score: number;
  created_at: string;
}

const LiveStreamerReports = () => {
  const [streamers, setStreamers] = useState<Streamer[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState<StreamerStats | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStreamers();
  }, []);

  const fetchStreamers = async () => {
    // Get all unique host_ids from live_rooms
    const { data: rooms } = await supabase
      .from("live_rooms")
      .select("host_id")
      .eq("status", "ended");

    const uniqueIds = [...new Set((rooms || []).map((r: any) => r.host_id))];
    if (uniqueIds.length === 0) {
      setStreamers([]);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nombre, correo")
      .in("id", uniqueIds);

    setStreamers(
      (profiles || []).map((p: any) => ({ id: p.id, nombre: p.nombre || "Sin nombre", correo: p.correo || "" }))
    );
  };

  const filteredStreamers = useMemo(() => {
    if (!search.trim()) return streamers;
    const q = search.toLowerCase();
    return streamers.filter(
      (s) => s.nombre.toLowerCase().includes(q) || s.correo.toLowerCase().includes(q)
    );
  }, [streamers, search]);

  useEffect(() => {
    if (selectedId) fetchReport(selectedId);
  }, [selectedId]);

  const fetchReport = async (hostId: string) => {
    setLoading(true);

    // 1. Stats from earnings table
    const { data: earningsData } = await supabase
      .from("live_streamer_earnings")
      .select("*")
      .eq("host_id", hostId);

    const earnings = (earningsData as any[]) || [];
    const totalEarnings = earnings.reduce((s, e) => s + Number(e.earnings_total), 0);
    const totalStreams = earnings.reduce((s, e) => s + (e.total_streams || 0), 0);
    const totalViewers = earnings.reduce((s, e) => s + (e.total_viewers || 0), 0);
    const totalLeads = earnings.reduce((s, e) => s + (e.total_leads || 0), 0);

    setStats({ totalStreams, totalViewers, totalLeads, totalEarnings });

    // 2. Get rooms for this host
    const { data: hostRooms } = await supabase
      .from("live_rooms")
      .select("id")
      .eq("host_id", hostId)
      .eq("status", "ended");

    const roomIds = (hostRooms || []).map((r: any) => r.id);

    if (roomIds.length === 0) {
      setLeads([]);
      setLoading(false);
      return;
    }

    // 3. Get stream_lead_ids from viewer_presence
    const { data: presence } = await supabase
      .from("live_viewer_presence")
      .select("stream_lead_id")
      .in("room_id", roomIds)
      .not("stream_lead_id", "is", null);

    const leadIds = [...new Set((presence || []).map((p: any) => p.stream_lead_id).filter(Boolean))];

    if (leadIds.length === 0) {
      setLeads([]);
      setLoading(false);
      return;
    }

    // 4. Get leads with pipeline stage
    const { data: leadsData } = await supabase
      .from("stream_leads")
      .select("id, nombre, correo, telefono, opportunity_score, pipeline_stage_id, created_at")
      .in("id", leadIds);

    // 5. Get pipeline stages
    const { data: stages } = await supabase.from("lead_pipeline_stages").select("id, name, color");

    const stageMap = new Map((stages || []).map((s: any) => [s.id, { name: s.name, color: s.color }]));

    const mappedLeads: LeadRow[] = ((leadsData as any[]) || []).map((l) => {
      const stage = stageMap.get(l.pipeline_stage_id);
      return {
        id: l.id,
        nombre: l.nombre || "—",
        correo: l.correo || "—",
        telefono: l.telefono || "—",
        stage_name: stage?.name || "Sin etapa",
        stage_color: stage?.color || "#888",
        opportunity_score: l.opportunity_score || 0,
        created_at: l.created_at,
      };
    });

    setLeads(mappedLeads.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* Streamer Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileBarChart className="w-5 h-5 text-primary" /> Reportes por Streamer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar streamer por nombre o correo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="max-w-md">
              <SelectValue placeholder="Selecciona un streamer" />
            </SelectTrigger>
            <SelectContent>
              {filteredStreamers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nombre} — {s.correo}
                </SelectItem>
              ))}
              {filteredStreamers.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</div>
              )}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading && <div className="text-center py-8 text-muted-foreground">Cargando reporte...</div>}

      {!loading && selectedId && stats && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Radio className="w-5 h-5 text-primary" /></div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalStreams}</p>
                  <p className="text-sm text-muted-foreground">Streams</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10"><Users className="w-5 h-5 text-blue-500" /></div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalViewers}</p>
                  <p className="text-sm text-muted-foreground">Viewers</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10"><User className="w-5 h-5 text-accent" /></div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalLeads}</p>
                  <p className="text-sm text-muted-foreground">Leads Generados</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10"><DollarSign className="w-5 h-5 text-green-500" /></div>
                <div>
                  <p className="text-2xl font-bold">${stats.totalEarnings.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">Ganancias</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Leads Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" /> Leads Generados ({leads.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leads.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Users className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                  <p>Este streamer no tiene leads registrados aún</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Correo</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Estado en Pipeline</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-muted-foreground" /> {l.nombre}
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-muted-foreground" /> {l.correo}</span>
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-muted-foreground" /> {l.telefono}</span>
                        </TableCell>
                        <TableCell className="text-center">{l.opportunity_score}</TableCell>
                        <TableCell>
                          <Badge style={{ backgroundColor: `${l.stage_color}20`, color: l.stage_color, borderColor: `${l.stage_color}40` }} variant="outline">
                            {l.stage_name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(l.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!loading && !selectedId && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileBarChart className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Selecciona un streamer para ver su reporte detallado</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LiveStreamerReports;
