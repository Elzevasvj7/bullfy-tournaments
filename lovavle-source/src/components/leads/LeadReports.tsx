import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Slider } from "@/components/ui/slider";
import DateRangePicker, { DateRangeValue } from "@/components/atfx/DateRangePicker";
import {
  BarChart3, Users, Trophy, Target, Download, Building2, Radio, UserCheck, Clock, TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  FunnelChart, Funnel, LabelList, Cell,
} from "recharts";
import { format, differenceInDays, subDays } from "date-fns";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getLogoBase64, addLogoToHeader } from "@/services/pdfLogoHelper";

interface Lead {
  id: string;
  nombre: string;
  correo: string;
  telefono: string | null;
  source: string;
  pipeline_stage_id: string | null;
  assigned_to: string | null;
  closed_by: string | null;
  closed_at: string | null;
  opportunity_score: number;
  partner_portal_id: string | null;
  created_at: string;
  tags: string[];
}

interface Stage { id: string; name: string; color: string; is_won: boolean; is_closed: boolean; display_order: number; }
interface Portal { id: string; nombre_portal: string; display_name: string | null; }
interface Profile { id: string; nombre: string | null; correo: string | null; }

const AGE_BUCKETS = [
  { id: "all", label: "Todas" },
  { id: "lt1d", label: "< 24h", min: 0, max: 1 },
  { id: "1to7", label: "1–7 días", min: 1, max: 7 },
  { id: "8to30", label: "8–30 días", min: 8, max: 30 },
  { id: "31to90", label: "31–90 días", min: 31, max: 90 },
  { id: "gt90", label: "> 90 días", min: 91, max: 99999 },
];

const SOURCES = ["all", "stream", "fake_live", "experience", "registro_anonimo", "manual"];

export default function LeadReports() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [portals, setPortals] = useState<Portal[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [leadStreamer, setLeadStreamer] = useState<Map<string, string>>(new Map()); // lead_id -> host_id
  const [streamerOptions, setStreamerOptions] = useState<Profile[]>([]);
  const [closerOptions, setCloserOptions] = useState<Profile[]>([]);

  // Filters
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: subDays(new Date(), 29), to: new Date() });
  const [ageBucket, setAgeBucket] = useState("all");
  const [portalId, setPortalId] = useState("all");
  const [streamerId, setStreamerId] = useState("all");
  const [closerId, setCloserId] = useState("all");
  const [stageId, setStageId] = useState("all");
  const [source, setSource] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);

    const [leadsRes, stagesRes, portalsRes] = await Promise.all([
      supabase.from("stream_leads").select("id, nombre, correo, telefono, source, pipeline_stage_id, assigned_to, closed_by, closed_at, opportunity_score, partner_portal_id, created_at, tags").order("created_at", { ascending: false }),
      supabase.from("lead_pipeline_stages").select("id, name, color, is_won, is_closed, display_order").order("display_order"),
      supabase.from("partner_portals").select("id, nombre_portal, display_name"),
    ]);

    const leadsData = (leadsRes.data as Lead[]) || [];
    setLeads(leadsData);
    setStages((stagesRes.data as Stage[]) || []);
    setPortals((portalsRes.data as Portal[]) || []);

    // Profiles needed (assigned_to + closed_by)
    const userIds = new Set<string>();
    leadsData.forEach(l => {
      if (l.assigned_to) userIds.add(l.assigned_to);
      if (l.closed_by) userIds.add(l.closed_by);
    });

    // Lead → streamer mapping via presence
    const leadIds = leadsData.map(l => l.id);
    const leadStreamerMap = new Map<string, string>();
    const hostIds = new Set<string>();

    if (leadIds.length) {
      // Chunked to avoid URL limits
      const chunks: string[][] = [];
      for (let i = 0; i < leadIds.length; i += 200) chunks.push(leadIds.slice(i, i + 200));

      for (const c of chunks) {
        const { data: pres } = await supabase
          .from("live_viewer_presence")
          .select("stream_lead_id, room_id")
          .in("stream_lead_id", c)
          .not("stream_lead_id", "is", null);

        const roomIds = [...new Set((pres || []).map((p: any) => p.room_id))];
        if (!roomIds.length) continue;

        const { data: rooms } = await supabase
          .from("live_rooms")
          .select("id, host_id")
          .in("id", roomIds);

        const roomHost = new Map((rooms || []).map((r: any) => [r.id, r.host_id]));
        (pres || []).forEach((p: any) => {
          if (!leadStreamerMap.has(p.stream_lead_id)) {
            const host = roomHost.get(p.room_id);
            if (host) {
              leadStreamerMap.set(p.stream_lead_id, host);
              hostIds.add(host);
            }
          }
        });
      }
    }

    hostIds.forEach(h => userIds.add(h));

    const profMap = new Map<string, Profile>();
    if (userIds.size) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nombre, correo")
        .in("id", [...userIds]);
      (profs || []).forEach((p: any) => profMap.set(p.id, p));
    }

    setProfiles(profMap);
    setLeadStreamer(leadStreamerMap);
    setStreamerOptions([...hostIds].map(id => profMap.get(id) || { id, nombre: "—", correo: "" }));

    const closerIds = new Set<string>();
    leadsData.forEach(l => { if (l.assigned_to) closerIds.add(l.assigned_to); if (l.closed_by) closerIds.add(l.closed_by); });
    setCloserOptions([...closerIds].map(id => profMap.get(id) || { id, nombre: "—", correo: "" }));

    setLoading(false);
  };

  // Apply filters
  const filtered = useMemo(() => {
    const now = new Date();
    const bucket = AGE_BUCKETS.find(b => b.id === ageBucket);
    const searchLower = search.toLowerCase().trim();
    return leads.filter(l => {
      const created = new Date(l.created_at);
      if (dateRange.from && created < dateRange.from) return false;
      if (dateRange.to) {
        const end = new Date(dateRange.to); end.setHours(23, 59, 59, 999);
        if (created > end) return false;
      }
      if (bucket && bucket.id !== "all") {
        const days = differenceInDays(now, created);
        if (days < (bucket.min ?? 0) || days > (bucket.max ?? 99999)) return false;
      }
      if (portalId !== "all" && l.partner_portal_id !== portalId) return false;
      if (stageId !== "all" && l.pipeline_stage_id !== stageId) return false;
      if (source !== "all" && l.source !== source) return false;
      if (closerId !== "all" && l.assigned_to !== closerId && l.closed_by !== closerId) return false;
      if (streamerId !== "all" && leadStreamer.get(l.id) !== streamerId) return false;
      if (l.opportunity_score < minScore) return false;
      if (searchLower) {
        const hay = `${l.nombre} ${l.correo} ${l.telefono ?? ""}`.toLowerCase();
        if (!hay.includes(searchLower)) return false;
      }
      return true;
    });
  }, [leads, dateRange, ageBucket, portalId, stageId, source, closerId, streamerId, minScore, search, leadStreamer]);

  // Derived data
  const stageMap = useMemo(() => new Map(stages.map(s => [s.id, s])), [stages]);
  const portalMap = useMemo(() => new Map(portals.map(p => [p.id, p])), [portals]);
  const wonStageIds = useMemo(() => new Set(stages.filter(s => s.is_won).map(s => s.id)), [stages]);

  // KPIs
  const kpis = useMemo(() => {
    const total = filtered.length;
    const won = filtered.filter(l => l.pipeline_stage_id && wonStageIds.has(l.pipeline_stage_id)).length;
    const closed = filtered.filter(l => {
      const s = l.pipeline_stage_id ? stageMap.get(l.pipeline_stage_id) : null;
      return s?.is_closed;
    }).length;
    const conversion = total ? (won / total) * 100 : 0;
    const avgScore = total ? filtered.reduce((s, l) => s + l.opportunity_score, 0) / total : 0;
    const closedLeads = filtered.filter(l => l.closed_at && l.created_at);
    const avgTimeToClose = closedLeads.length
      ? closedLeads.reduce((s, l) => s + differenceInDays(new Date(l.closed_at!), new Date(l.created_at)), 0) / closedLeads.length
      : 0;
    return { total, won, closed, conversion, avgScore, avgTimeToClose };
  }, [filtered, wonStageIds, stageMap]);

  // Time series
  const timeSeries = useMemo(() => {
    const map = new Map<string, { date: string; creados: number; ganados: number }>();
    filtered.forEach(l => {
      const day = format(new Date(l.created_at), "yyyy-MM-dd");
      if (!map.has(day)) map.set(day, { date: day, creados: 0, ganados: 0 });
      map.get(day)!.creados += 1;
      if (l.pipeline_stage_id && wonStageIds.has(l.pipeline_stage_id)) map.get(day)!.ganados += 1;
    });
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered, wonStageIds]);

  // Funnel
  const funnelData = useMemo(() => {
    return stages.map(s => ({
      name: s.name,
      value: filtered.filter(l => l.pipeline_stage_id === s.id).length,
      fill: s.color,
    })).filter(d => d.value > 0);
  }, [stages, filtered]);

  // Breakdown helpers
  const breakdownBy = (keyFn: (l: Lead) => string | null, labelFn: (k: string) => string) => {
    const m = new Map<string, { key: string; label: string; leads: number; ganados: number }>();
    filtered.forEach(l => {
      const k = keyFn(l) || "—";
      if (!m.has(k)) m.set(k, { key: k, label: labelFn(k), leads: 0, ganados: 0 });
      const row = m.get(k)!;
      row.leads += 1;
      if (l.pipeline_stage_id && wonStageIds.has(l.pipeline_stage_id)) row.ganados += 1;
    });
    return [...m.values()].sort((a, b) => b.leads - a.leads);
  };

  const byPortal = useMemo(() => breakdownBy(
    l => l.partner_portal_id,
    k => portalMap.get(k)?.display_name || portalMap.get(k)?.nombre_portal || "Sin comunidad",
  ), [filtered, portalMap, wonStageIds]);

  const byStreamer = useMemo(() => breakdownBy(
    l => leadStreamer.get(l.id) || null,
    k => profiles.get(k)?.nombre || "Sin streamer",
  ), [filtered, leadStreamer, profiles, wonStageIds]);

  const byCloser = useMemo(() => breakdownBy(
    l => l.assigned_to,
    k => profiles.get(k)?.nombre || "Sin asignar",
  ), [filtered, profiles, wonStageIds]);

  const byAge = useMemo(() => {
    const now = new Date();
    const m = new Map<string, { label: string; leads: number; ganados: number }>();
    AGE_BUCKETS.filter(b => b.id !== "all").forEach(b => m.set(b.id, { label: b.label, leads: 0, ganados: 0 }));
    filtered.forEach(l => {
      const days = differenceInDays(now, new Date(l.created_at));
      const b = AGE_BUCKETS.find(x => x.id !== "all" && days >= (x.min ?? 0) && days <= (x.max ?? 99999));
      if (!b) return;
      const row = m.get(b.id)!;
      row.leads += 1;
      if (l.pipeline_stage_id && wonStageIds.has(l.pipeline_stage_id)) row.ganados += 1;
    });
    return [...m.values()];
  }, [filtered, wonStageIds]);

  const buildDetailRows = () => {
    const now = new Date();
    return filtered.map(l => {
      const portal = l.partner_portal_id ? portalMap.get(l.partner_portal_id) : null;
      const streamerHost = leadStreamer.get(l.id);
      const streamer = streamerHost ? profiles.get(streamerHost)?.nombre : "";
      const closer = l.assigned_to ? profiles.get(l.assigned_to)?.nombre : "";
      const stage = l.pipeline_stage_id ? stageMap.get(l.pipeline_stage_id)?.name : "";
      const age = differenceInDays(now, new Date(l.created_at));
      return {
        Nombre: l.nombre,
        Correo: l.correo,
        Telefono: l.telefono ?? "",
        Origen: l.source,
        Comunidad: portal?.display_name || portal?.nombre_portal || "",
        Streamer: streamer || "",
        Closer: closer || "",
        Stage: stage || "Sin stage",
        Score: l.opportunity_score,
        AntiguedadDias: age,
        Creado: format(new Date(l.created_at), "yyyy-MM-dd HH:mm"),
      };
    });
  };

  const buildSummary = () => {
    // Por stage
    const byStage = new Map<string, number>();
    filtered.forEach(l => {
      const name = l.pipeline_stage_id ? (stageMap.get(l.pipeline_stage_id)?.name || "Sin stage") : "Sin stage";
      byStage.set(name, (byStage.get(name) || 0) + 1);
    });
    const stageRows = stages
      .map(s => ({ Stage: s.name, Leads: byStage.get(s.name) || 0 }))
      .concat(byStage.has("Sin stage") ? [{ Stage: "Sin stage", Leads: byStage.get("Sin stage")! }] : []);

    // Por fecha
    const byDate = new Map<string, { total: number; ganados: number }>();
    filtered.forEach(l => {
      const day = format(new Date(l.created_at), "yyyy-MM-dd");
      if (!byDate.has(day)) byDate.set(day, { total: 0, ganados: 0 });
      const row = byDate.get(day)!;
      row.total += 1;
      if (l.pipeline_stage_id && wonStageIds.has(l.pipeline_stage_id)) row.ganados += 1;
    });
    const dateRows = [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ Fecha: date, Leads: v.total, Ganados: v.ganados }));

    return { stageRows, dateRows };
  };

  const exportXLSX = () => {
    const detail = buildDetailRows();
    const { stageRows, dateRows } = buildSummary();
    const dateLabel = `${dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : "—"} a ${dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : "—"}`;

    const summaryAoA: (string | number)[][] = [
      ["Reporte de Leads — Bullfy System"],
      ["Generado", format(new Date(), "yyyy-MM-dd HH:mm")],
      ["Rango de fechas", dateLabel],
      [],
      ["TOTALES"],
      ["Total leads", kpis.total],
      ["Ganados", kpis.won],
      ["Cerrados", kpis.closed],
      ["Conversión (%)", Number(kpis.conversion.toFixed(2))],
      ["Score promedio", Number(kpis.avgScore.toFixed(1))],
      ["Días promedio al cierre", Number(kpis.avgTimeToClose.toFixed(1))],
      [],
      ["LEADS POR ESTADO DE PIPELINE"],
      ["Stage", "Leads"],
      ...stageRows.map(r => [r.Stage, r.Leads] as (string | number)[]),
      [],
      ["LEADS POR FECHA"],
      ["Fecha", "Leads", "Ganados"],
      ...dateRows.map(r => [r.Fecha, r.Leads, r.Ganados] as (string | number)[]),
    ];

    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoA);
    wsSummary["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");

    const wsDetail = XLSX.utils.json_to_sheet(detail);
    wsDetail["!cols"] = [
      { wch: 24 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 22 },
      { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 8 }, { wch: 14 }, { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, wsDetail, "Detalle");

    XLSX.writeFile(wb, `reporte-leads-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const exportPDF = async () => {
    const detail = buildDetailRows();
    const { stageRows, dateRows } = buildSummary();
    const dateLabel = `${dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : "—"} a ${dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : "—"}`;

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const logo = await getLogoBase64();
    addLogoToHeader(doc, logo);

    doc.setFontSize(14);
    doc.text("Reporte de Leads - Bullfy System", 40, 28);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Generado: ${format(new Date(), "yyyy-MM-dd HH:mm")}  |  Rango: ${dateLabel}`, 40, 44);
    doc.setTextColor(0);

    // KPIs
    autoTable(doc, {
      startY: 60,
      head: [["Totales", "Valor"]],
      body: [
        ["Total leads", String(kpis.total)],
        ["Ganados", String(kpis.won)],
        ["Cerrados", String(kpis.closed)],
        ["Conversion (%)", kpis.conversion.toFixed(2)],
        ["Score promedio", kpis.avgScore.toFixed(1)],
        ["Dias promedio al cierre", kpis.avgTimeToClose.toFixed(1)],
      ],
      theme: "grid",
      headStyles: { fillColor: [20, 110, 245] },
      styles: { fontSize: 9 },
      margin: { left: 40, right: 40 },
      tableWidth: 280,
    });

    // Stage breakdown
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 16,
      head: [["Estado del pipeline", "Leads"]],
      body: stageRows.map(r => [r.Stage, String(r.Leads)]),
      theme: "grid",
      headStyles: { fillColor: [20, 110, 245] },
      styles: { fontSize: 9 },
      margin: { left: 40, right: 40 },
      tableWidth: 280,
    });

    // Por fecha
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 16,
      head: [["Fecha", "Leads", "Ganados"]],
      body: dateRows.map(r => [r.Fecha, String(r.Leads), String(r.Ganados)]),
      theme: "grid",
      headStyles: { fillColor: [20, 110, 245] },
      styles: { fontSize: 9 },
      margin: { left: 40, right: 40 },
      tableWidth: 280,
    });

    // Detalle
    doc.addPage();
    doc.setFontSize(12);
    doc.text("Detalle de Leads", 40, 28);
    autoTable(doc, {
      startY: 40,
      head: [["Nombre", "Correo", "Telefono", "Origen", "Comunidad", "Streamer", "Closer", "Stage", "Score", "Dias", "Creado"]],
      body: detail.map(r => [r.Nombre, r.Correo, r.Telefono, r.Origen, r.Comunidad, r.Streamer, r.Closer, r.Stage, String(r.Score), String(r.AntiguedadDias), r.Creado]),
      theme: "striped",
      headStyles: { fillColor: [20, 110, 245] },
      styles: { fontSize: 7, cellPadding: 3 },
      margin: { left: 20, right: 20 },
    });

    doc.save(`reporte-leads-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const resetFilters = () => {
    setDateRange({ from: subDays(new Date(), 29), to: new Date() });
    setAgeBucket("all"); setPortalId("all"); setStreamerId("all"); setCloserId("all");
    setStageId("all"); setSource("all"); setMinScore(0); setSearch("");
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" /> Reportes de Leads
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Fechas</label>
              <DateRangePicker value={dateRange} onChange={setDateRange} />
            </div>

            <div className="min-w-[150px]">
              <label className="text-xs text-muted-foreground block mb-1">Antigüedad</label>
              <Select value={ageBucket} onValueChange={setAgeBucket}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AGE_BUCKETS.map(b => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[180px]">
              <label className="text-xs text-muted-foreground block mb-1">Comunidad</label>
              <Select value={portalId} onValueChange={setPortalId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {portals.map(p => <SelectItem key={p.id} value={p.id}>{p.display_name || p.nombre_portal}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[180px]">
              <label className="text-xs text-muted-foreground block mb-1">Streamer</label>
              <Select value={streamerId} onValueChange={setStreamerId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {streamerOptions.map(s => <SelectItem key={s.id} value={s.id}>{s.nombre || s.correo || s.id.slice(0, 6)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[180px]">
              <label className="text-xs text-muted-foreground block mb-1">Closer / Ventas</label>
              <Select value={closerId} onValueChange={setCloserId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {closerOptions.map(s => <SelectItem key={s.id} value={s.id}>{s.nombre || s.correo || s.id.slice(0, 6)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[160px]">
              <label className="text-xs text-muted-foreground block mb-1">Stage</label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[140px]">
              <label className="text-xs text-muted-foreground block mb-1">Origen</label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCES.map(s => <SelectItem key={s} value={s}>{s === "all" ? "Todos" : s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[180px]">
              <label className="text-xs text-muted-foreground block mb-1">Score mínimo: {minScore}</label>
              <Slider value={[minScore]} onValueChange={(v) => setMinScore(v[0])} min={0} max={100} step={5} />
            </div>

            <div className="min-w-[180px] flex-1">
              <label className="text-xs text-muted-foreground block mb-1">Buscar</label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, correo, teléfono..." />
            </div>

            <Button variant="outline" onClick={resetFilters}>Limpiar</Button>
            <Button variant="outline" onClick={exportXLSX} disabled={!filtered.length}>
              <Download className="w-4 h-4 mr-1" /> Excel
            </Button>
            <Button onClick={exportPDF} disabled={!filtered.length}>
              <Download className="w-4 h-4 mr-1" /> PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={<Users className="w-4 h-4 text-primary" />} label="Total Leads" value={kpis.total.toString()} />
        <KpiCard icon={<Trophy className="w-4 h-4 text-green-500" />} label="Ganados" value={kpis.won.toString()} />
        <KpiCard icon={<Target className="w-4 h-4 text-blue-500" />} label="Conversión" value={`${kpis.conversion.toFixed(1)}%`} />
        <KpiCard icon={<BarChart3 className="w-4 h-4 text-accent" />} label="Score Promedio" value={kpis.avgScore.toFixed(0)} />
        <KpiCard icon={<Clock className="w-4 h-4 text-orange-500" />} label="Días a Cierre" value={kpis.avgTimeToClose.toFixed(1)} />
        <KpiCard icon={<TrendingUp className="w-4 h-4 text-purple-500" />} label="Cerrados" value={kpis.closed.toString()} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Leads creados vs Ganados</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={timeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                <Line type="monotone" dataKey="creados" stroke="hsl(var(--primary))" strokeWidth={2} />
                <Line type="monotone" dataKey="ganados" stroke="#10B981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Embudo por Pipeline</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <FunnelChart>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Funnel dataKey="value" data={funnelData} isAnimationActive>
                  <LabelList position="right" fill="hsl(var(--foreground))" stroke="none" dataKey="name" />
                  {funnelData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Breakdowns + Table */}
      <Tabs defaultValue="table">
        <TabsList className="bg-secondary/50 border border-border">
          <TabsTrigger value="table"><Users className="w-4 h-4 mr-1" />Detalle ({filtered.length})</TabsTrigger>
          <TabsTrigger value="portal"><Building2 className="w-4 h-4 mr-1" />Por Comunidad</TabsTrigger>
          <TabsTrigger value="streamer"><Radio className="w-4 h-4 mr-1" />Por Streamer</TabsTrigger>
          <TabsTrigger value="closer"><UserCheck className="w-4 h-4 mr-1" />Por Closer</TabsTrigger>
          <TabsTrigger value="age"><Clock className="w-4 h-4 mr-1" />Por Antigüedad</TabsTrigger>
        </TabsList>

        <TabsContent value="table">
          <Card>
            <CardContent className="pt-4">
              {loading ? (
                <p className="text-center py-8 text-muted-foreground">Cargando...</p>
              ) : filtered.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Sin resultados con los filtros actuales</p>
              ) : (
                <div className="max-h-[600px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Comunidad</TableHead>
                        <TableHead>Streamer</TableHead>
                        <TableHead>Closer</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Antigüedad</TableHead>
                        <TableHead>Creado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.slice(0, 200).map(l => {
                        const portal = l.partner_portal_id ? portalMap.get(l.partner_portal_id) : null;
                        const streamerHost = leadStreamer.get(l.id);
                        const streamer = streamerHost ? profiles.get(streamerHost) : null;
                        const closer = l.assigned_to ? profiles.get(l.assigned_to) : null;
                        const stage = l.pipeline_stage_id ? stageMap.get(l.pipeline_stage_id) : null;
                        const age = differenceInDays(new Date(), new Date(l.created_at));
                        return (
                          <TableRow key={l.id}>
                            <TableCell>
                              <div className="font-medium">{l.nombre}</div>
                              <div className="text-xs text-muted-foreground">{l.correo}</div>
                            </TableCell>
                            <TableCell className="text-sm">{portal?.display_name || portal?.nombre_portal || "—"}</TableCell>
                            <TableCell className="text-sm">{streamer?.nombre || "—"}</TableCell>
                            <TableCell className="text-sm">{closer?.nombre || "—"}</TableCell>
                            <TableCell>
                              {stage ? (
                                <Badge variant="outline" style={{ backgroundColor: `${stage.color}20`, color: stage.color, borderColor: `${stage.color}40` }}>
                                  {stage.name}
                                </Badge>
                              ) : "—"}
                            </TableCell>
                            <TableCell className="text-center font-medium">{l.opportunity_score}</TableCell>
                            <TableCell className="text-sm">{age}d</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{format(new Date(l.created_at), "dd MMM yyyy")}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {filtered.length > 200 && (
                    <p className="text-center text-xs text-muted-foreground py-3">
                      Mostrando 200 de {filtered.length}. Exporta el CSV para ver todos.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="portal"><BreakdownTable rows={byPortal} dimLabel="Comunidad" /></TabsContent>
        <TabsContent value="streamer"><BreakdownTable rows={byStreamer} dimLabel="Streamer" /></TabsContent>
        <TabsContent value="closer"><BreakdownTable rows={byCloser} dimLabel="Closer" /></TabsContent>
        <TabsContent value="age">
          <Card>
            <CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={byAge}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                  <Bar dataKey="leads" fill="hsl(var(--primary))" />
                  <Bar dataKey="ganados" fill="#10B981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function BreakdownTable({ rows, dimLabel }: { rows: { label: string; leads: number; ganados: number }[]; dimLabel: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        {rows.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">Sin datos</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{dimLabel}</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Ganados</TableHead>
                <TableHead className="text-right">Conversión</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.label}>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  <TableCell className="text-right">{r.leads}</TableCell>
                  <TableCell className="text-right">{r.ganados}</TableCell>
                  <TableCell className="text-right">{r.leads ? ((r.ganados / r.leads) * 100).toFixed(1) : "0.0"}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
