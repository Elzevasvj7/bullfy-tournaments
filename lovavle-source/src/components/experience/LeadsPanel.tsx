import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, Search, Eye, TrendingUp, Star, UserCheck, Clock, Download,
  ChevronLeft, ChevronRight, BarChart3, History, XCircle, Timer, FileText, UserPlus
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, formatDistanceToNow, differenceInSeconds } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "@/lib/toastUtils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface Lead {
  id: string;
  session_id: string;
  nombre: string | null;
  correo: string | null;
  telefono: string | null;
  empresa: string | null;
  pais: string | null;
  tamano_comunidad: string | null;
  interes: string | null;
  comentario: string | null;
  level: string | null;
  badges: string[] | null;
  tools_used: string[] | null;
  opportunity_score: number | null;
  progress_stage: number | null;
  status: string;
  assigned_bd: string | null;
  assigned_at: string | null;
  assigned_by: string | null;
  converted_at: string | null;
  discarded_at: string | null;
  notas_bd: string | null;
  created_at: string;
  updated_at: string;
}

interface BDProfile {
  id: string;
  nombre: string;
}

interface HistoryEntry {
  id: string;
  lead_id: string;
  action: string;
  details: string | null;
  performed_by: string | null;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: "nuevo", label: "Nuevo", color: "bg-chart-1/10 text-chart-1 border-chart-1/20" },
  { value: "contactado", label: "Contactado", color: "bg-chart-2/10 text-chart-2 border-chart-2/20" },
  { value: "calificado", label: "Calificado", color: "bg-primary/10 text-primary border-primary/20" },
  { value: "en_negociacion", label: "En Negociación", color: "bg-chart-4/10 text-chart-4 border-chart-4/20" },
  { value: "convertido", label: "Convertido", color: "bg-chart-5/10 text-chart-5 border-chart-5/20" },
  { value: "descartado", label: "Descartado", color: "bg-destructive/10 text-destructive border-destructive/20" },
];

// Colors mapped to STATUS_OPTIONS order: nuevo, contactado, calificado, en_negociacion, convertido, descartado
const PIE_COLORS: Record<string, string> = {
  nuevo: "hsl(207 100% 76%)",       // light blue - new leads
  contactado: "hsl(216 92% 52%)",    // blue - contacted
  calificado: "hsl(45 93% 55%)",     // amber - qualified
  en_negociacion: "hsl(32 95% 50%)", // orange - negotiating
  convertido: "hsl(142 72% 42%)",    // green - converted
  descartado: "hsl(0 72% 51%)",      // red - discarded
};

const statusColor = (status: string) =>
  STATUS_OPTIONS.find(s => s.value === status)?.color ?? "bg-muted text-muted-foreground border-border";

const statusLabel = (status: string) =>
  STATUS_OPTIONS.find(s => s.value === status)?.label ?? status;

const PAGE_SIZES = [10, 25, 50];

// Format elapsed time as readable string
const formatElapsed = (fromISO: string, toISO?: string | null) => {
  const from = new Date(fromISO).getTime();
  const to = toISO ? new Date(toISO).getTime() : Date.now();
  const totalSeconds = Math.max(0, Math.floor((to - from) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

const LiveTimer = ({ fromISO }: { fromISO: string }) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);
  return <span>{formatElapsed(fromISO)}</span>;
};

const LeadsPanel = () => {
  const { user, isAdmin, isAdminBD, isGlobalAdmin, isBD } = useAuth();
  const canAssign = isAdmin || isAdminBD || isGlobalAdmin;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [bdList, setBdList] = useState<BDProfile[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [bdFilter, setBdFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [detail, setDetail] = useState<Lead | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editBD, setEditBD] = useState("");
  const [editNotas, setEditNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [activeTab, setActiveTab] = useState("todos");

  // History dialog
  const [historyLead, setHistoryLead] = useState<Lead | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Quick assign dialog
  const [assignLead, setAssignLead] = useState<Lead | null>(null);
  const [assignBDValue, setAssignBDValue] = useState("none");
  const [assignSaving, setAssignSaving] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const loadData = useCallback(async () => {
    const [leadsRes, rolesRes] = await Promise.all([
      supabase.from("experience_leads").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role").in("role", ["bd", "admin_bd"]),
    ]);
    setLeads((leadsRes.data as Lead[]) ?? []);

    const bdUserIds = [...new Set((rolesRes.data ?? []).map(r => r.user_id))];
    const map: Record<string, string> = {};

    if (bdUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nombre")
        .in("id", bdUserIds)
        .order("nombre");
      const list = (profiles as BDProfile[]) ?? [];
      setBdList(list);
      list.forEach(p => { map[p.id] = p.nombre; });
    } else {
      setBdList([]);
    }

    // Fetch profiles for assigned_by AND assigned_bd users not already in map
    const extraIds = [...new Set(
      (leadsRes.data ?? [])
        .flatMap((l: any) => [l.assigned_by, l.assigned_bd])
        .filter((id: string | null) => id && !map[id])
    )];
    // Also include current user
    if (user?.id && !map[user.id]) {
      extraIds.push(user.id);
    }
    if (extraIds.length > 0) {
      const { data: extraProfiles } = await supabase
        .from("profiles")
        .select("id, nombre")
        .in("id", extraIds);
      (extraProfiles ?? []).forEach((p: any) => { map[p.id] = p.nombre; });
    }

    setProfilesMap(map);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load additional profile names for assigned_by columns
  useEffect(() => {
    const missingIds = leads
      .map(l => l.assigned_by)
      .filter((id): id is string => !!id && !profilesMap[id]);
    const unique = [...new Set(missingIds)];
    if (unique.length === 0) return;
    supabase.from("profiles").select("id, nombre").in("id", unique).then(({ data }) => {
      if (!data) return;
      const map: Record<string, string> = {};
      data.forEach((p: any) => { map[p.id] = p.nombre; });
      setProfilesMap(prev => ({ ...prev, ...map }));
    });
  }, [leads]);

  const filtered = useMemo(() => {
    let list = leads;

    // Tab filter
    if (activeTab === "descartados") {
      list = list.filter(l => l.status === "descartado");
    } else if (activeTab === "todos") {
      // Show all except filter overrides
    }

    if (activeTab !== "descartados" && statusFilter !== "all") list = list.filter(l => l.status === statusFilter);
    if (scoreFilter === "high") list = list.filter(l => (l.opportunity_score ?? 0) >= 60);
    else if (scoreFilter === "medium") list = list.filter(l => { const s = l.opportunity_score ?? 0; return s >= 30 && s < 60; });
    else if (scoreFilter === "low") list = list.filter(l => (l.opportunity_score ?? 0) < 30);
    if (bdFilter !== "all") {
      if (bdFilter === "none") list = list.filter(l => !l.assigned_bd);
      else list = list.filter(l => l.assigned_bd === bdFilter);
    }
    if (dateFrom) list = list.filter(l => l.created_at >= dateFrom);
    if (dateTo) list = list.filter(l => l.created_at <= dateTo + "T23:59:59");
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        (l.nombre ?? "").toLowerCase().includes(q) ||
        (l.correo ?? "").toLowerCase().includes(q) ||
        (l.empresa ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [leads, activeTab, statusFilter, scoreFilter, bdFilter, dateFrom, dateTo, search]);

  useEffect(() => { setPage(0); }, [activeTab, statusFilter, scoreFilter, bdFilter, dateFrom, dateTo, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const kpis = useMemo(() => ({
    total: leads.length,
    nuevos: leads.filter(l => l.status === "nuevo").length,
    highScore: leads.filter(l => (l.opportunity_score ?? 0) >= 60).length,
    convertidos: leads.filter(l => l.status === "convertido").length,
    descartados: leads.filter(l => l.status === "descartado").length,
    sinAsignar: leads.filter(l => !l.assigned_bd).length,
  }), [leads]);

  const statusChartData = useMemo(() =>
    STATUS_OPTIONS.map(s => ({ name: s.label, value: leads.filter(l => l.status === s.value).length, key: s.value })).filter(d => d.value > 0),
  [leads]);

  const toolsChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach(l => l.tools_used?.forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [leads]);

  const openDetail = (lead: Lead) => {
    setDetail(lead);
    setEditStatus(lead.status);
    setEditBD(lead.assigned_bd ?? "none");
    setEditNotas(lead.notas_bd ?? "");
  };

  const openHistory = async (lead: Lead) => {
    setHistoryLead(lead);
    setLoadingHistory(true);
    const { data } = await supabase
      .from("experience_lead_history")
      .select("*")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false });
    setHistory((data as HistoryEntry[]) ?? []);

    // Load profile names for history
    const ids = [...new Set((data ?? []).map((h: any) => h.performed_by).filter(Boolean))];
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, nombre").in("id", ids);
      if (profs) {
        const map: Record<string, string> = {};
        profs.forEach((p: any) => { map[p.id] = p.nombre; });
        setProfilesMap(prev => ({ ...prev, ...map }));
      }
    }
    setLoadingHistory(false);
  };

  const openAssign = (lead: Lead) => {
    setAssignLead(lead);
    setAssignBDValue("none");
  };

  const saveAssign = async () => {
    if (!assignLead || !user || assignBDValue === "none") return;
    setAssignSaving(true);
    const now = new Date().toISOString();
    const previousBd = assignLead.assigned_bd;
    const isReassign = !!previousBd;

    const { error } = await supabase.from("experience_leads").update({
      assigned_bd: assignBDValue,
      assigned_at: now,
      assigned_by: user.id,
    }).eq("id", assignLead.id);

    if (error) {
      toast.error("Error al asignar lead");
      setAssignSaving(false);
      return;
    }

    const leadName = assignLead.nombre || "Lead sin nombre";
    const bdName = profilesMap[assignBDValue] ?? "BD";
    const prevBdName = previousBd ? (profilesMap[previousBd] ?? "BD anterior") : "Sin asignar";

    // Insert history
    await supabase.from("experience_lead_history").insert({
      lead_id: assignLead.id,
      action: isReassign ? "Reasignación de BD" : "Asignación de BD",
      details: `${prevBdName} → ${bdName}`,
      performed_by: user.id,
    });

    // Send notification
    supabase.functions.invoke("experience-lead-action", {
      body: {
        action: "assigned",
        lead_id: assignLead.id,
        lead_name: leadName,
        assigned_bd_id: assignBDValue,
        previous_bd_id: previousBd,
        performed_by: user.id,
      },
    });

    toast.success(isReassign ? `Lead reasignado a ${bdName}` : `Lead asignado a ${bdName}`);
    setAssignLead(null);
    loadData();
    setAssignSaving(false);
  };

  const saveChanges = async () => {
    if (!detail || !user) return;
    setSaving(true);

    const prevStatus = detail.status;
    const prevBD = detail.assigned_bd;
    const now = new Date().toISOString();

    const updates: Record<string, unknown> = {
      status: editStatus,
      notas_bd: editNotas || null,
    };

    // Track timestamps
    if (editStatus === "convertido" && prevStatus !== "convertido") updates.converted_at = now;
    if (editStatus === "descartado" && prevStatus !== "descartado") updates.discarded_at = now;

    // BD assignment (only admin_bd)
    const bdChanged = canAssign && editBD !== (detail.assigned_bd ?? "none");
    if (canAssign) {
      const newBdVal = editBD !== "none" ? editBD : null;
      updates.assigned_bd = newBdVal;
      if (bdChanged && newBdVal) {
        updates.assigned_at = now;
        updates.assigned_by = user.id;
      }
      if (bdChanged && !newBdVal) {
        updates.assigned_at = null;
        updates.assigned_by = null;
      }
    }

    const { error } = await supabase.from("experience_leads").update(updates as any).eq("id", detail.id);
    if (error) {
      toast.error("Error al actualizar lead");
      setSaving(false);
      return;
    }

    // Insert history entries
    const historyEntries: { lead_id: string; action: string; details: string; performed_by: string }[] = [];
    const leadName = detail.nombre || "Lead sin nombre";

    if (bdChanged) {
      const prevBdName = prevBD ? (profilesMap[prevBD] ?? "BD anterior") : "Sin asignar";
      const newBdName = editBD !== "none" ? (profilesMap[editBD] ?? "BD") : "Sin asignar";
      historyEntries.push({
        lead_id: detail.id,
        action: prevBD ? "Reasignación de BD" : "Asignación de BD",
        details: `${prevBdName} → ${newBdName}`,
        performed_by: user.id,
      });

      // Send notification for assignment
      supabase.functions.invoke("experience-lead-action", {
        body: {
          action: "assigned",
          lead_id: detail.id,
          lead_name: leadName,
          assigned_bd_id: editBD !== "none" ? editBD : null,
          previous_bd_id: prevBD,
          performed_by: user.id,
        },
      });
    }

    if (prevStatus !== editStatus) {
      historyEntries.push({
        lead_id: detail.id,
        action: "Cambio de status",
        details: `${statusLabel(prevStatus)} → ${statusLabel(editStatus)}${editNotas ? `. Nota: ${editNotas}` : ""}`,
        performed_by: user.id,
      });

      // Send notification for status change
      supabase.functions.invoke("experience-lead-action", {
        body: {
          action: "status_change",
          lead_id: detail.id,
          lead_name: leadName,
          assigned_bd_id: detail.assigned_bd,
          performed_by: user.id,
          status: editStatus,
          notas: editNotas,
        },
      });
    }

    if (editNotas !== (detail.notas_bd ?? "") && prevStatus === editStatus && !bdChanged) {
      historyEntries.push({
        lead_id: detail.id,
        action: "Nota actualizada",
        details: editNotas || "Nota eliminada",
        performed_by: user.id,
      });
    }

    if (historyEntries.length > 0) {
      await supabase.from("experience_lead_history").insert(historyEntries);
    }

    toast.success("Lead actualizado");
    setDetail(null);
    loadData();
    setSaving(false);
  };

  const exportCSV = () => {
    const headers = ["Nombre", "Correo", "Empresa", "País", "Score", "Nivel", "Status", "BD Asignado", "Asignado por", "Herramientas", "Notas", "Fecha", "Tiempo sin asignar", "Tiempo resolución"];
    const rows = filtered.map(l => [
      l.nombre ?? "", l.correo ?? "", l.empresa ?? "", l.pais ?? "",
      String(l.opportunity_score ?? 0), l.level ?? "",
      statusLabel(l.status),
      bdList.find(b => b.id === l.assigned_bd)?.nombre ?? "",
      l.assigned_by ? (profilesMap[l.assigned_by] ?? "") : "",
      (l.tools_used ?? []).join("; "),
      l.notas_bd ?? "",
      format(new Date(l.created_at), "yyyy-MM-dd HH:mm"),
      l.assigned_at ? formatElapsed(l.created_at, l.assigned_at) : "Sin asignar",
      (l.converted_at || l.discarded_at) && l.assigned_at
        ? formatElapsed(l.assigned_at, l.converted_at || l.discarded_at)
        : "—",
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_experience_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} leads exportados`);
  };

  const requireNotesForStatus = editStatus === "descartado" || editStatus === "convertido";

  // BD can only edit if the lead is assigned to them; Admin BD/Admin/Global Admin can always edit
  const canEditDetail = detail
    ? canAssign || (detail.assigned_bd === user?.id)
    : false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Leads del Experience</h1>
          <p className="text-sm text-muted-foreground">Gestiona los leads generados por IB Bullfy Experience</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCharts(!showCharts)} className="gap-1.5">
            <BarChart3 className="w-4 h-4" />
            {showCharts ? "Ocultar" : "Gráficos"}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
            <Download className="w-4 h-4" />
            CSV
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 text-center">
            <Users className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{kpis.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 text-center">
            <Clock className="w-5 h-5 text-chart-1 mx-auto mb-1" />
            <p className="text-2xl font-bold">{kpis.nuevos}</p>
            <p className="text-xs text-muted-foreground">Nuevos</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 text-center">
            <Star className="w-5 h-5 text-chart-4 mx-auto mb-1" />
            <p className="text-2xl font-bold">{kpis.highScore}</p>
            <p className="text-xs text-muted-foreground">Score ≥ 60</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 text-center">
            <UserCheck className="w-5 h-5 text-chart-2 mx-auto mb-1" />
            <p className="text-2xl font-bold">{kpis.sinAsignar}</p>
            <p className="text-xs text-muted-foreground">Sin asignar</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-5 h-5 text-chart-5 mx-auto mb-1" />
            <p className="text-2xl font-bold">{kpis.convertidos}</p>
            <p className="text-xs text-muted-foreground">Convertidos</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 text-center">
            <XCircle className="w-5 h-5 text-destructive mx-auto mb-1" />
            <p className="text-2xl font-bold">{kpis.descartados}</p>
            <p className="text-xs text-muted-foreground">Descartados</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {showCharts && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4">
              <p className="text-sm font-semibold mb-3">Leads por Status</p>
              {statusChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={statusChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`} labelLine={false} stroke="none">
                      {statusChartData.map((entry, i) => <Cell key={i} fill={PIE_COLORS[(entry as any).key] ?? "hsl(var(--muted))"} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>}
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4">
              <p className="text-sm font-semibold mb-3">Top Herramientas Usadas</p>
              {toolsChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={toolsChartData} layout="vertical" margin={{ left: 60 }}>
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={55} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="todos">Todos los Leads</TabsTrigger>
          <TabsTrigger value="descartados" className="gap-1.5">
            <XCircle className="w-3.5 h-3.5" />
            Descartados ({kpis.descartados})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="todos" className="space-y-4 mt-4">
          <LeadFilters
            search={search} setSearch={setSearch}
            statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            scoreFilter={scoreFilter} setScoreFilter={setScoreFilter}
            bdFilter={bdFilter} setBdFilter={setBdFilter}
            dateFrom={dateFrom} setDateFrom={setDateFrom}
            dateTo={dateTo} setDateTo={setDateTo}
            canAssign={canAssign} bdList={bdList}
          />
          <LeadTable
            loading={loading} leads={leads} filtered={filtered} paged={paged}
            page={page} setPage={setPage} totalPages={totalPages}
            pageSize={pageSize} setPageSize={setPageSize}
            bdList={bdList} profilesMap={profilesMap}
            openDetail={openDetail} openHistory={openHistory}
            openAssign={openAssign} canAssign={canAssign}
            showTimers
          />
        </TabsContent>

        <TabsContent value="descartados" className="space-y-4 mt-4">
          <LeadFilters
            search={search} setSearch={setSearch}
            statusFilter="descartado" setStatusFilter={() => {}}
            scoreFilter={scoreFilter} setScoreFilter={setScoreFilter}
            bdFilter={bdFilter} setBdFilter={setBdFilter}
            dateFrom={dateFrom} setDateFrom={setDateFrom}
            dateTo={dateTo} setDateTo={setDateTo}
            canAssign={canAssign} bdList={bdList}
            hideStatusFilter
          />
          <LeadTable
            loading={loading} leads={leads} filtered={filtered} paged={paged}
            page={page} setPage={setPage} totalPages={totalPages}
            pageSize={pageSize} setPageSize={setPageSize}
            bdList={bdList} profilesMap={profilesMap}
            openDetail={openDetail} openHistory={openHistory}
            openAssign={openAssign} canAssign={canAssign}
            showTimers showNotes
          />
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-primary" />
                  {detail.nombre ?? "Lead sin nombre"}
                </DialogTitle>
                <DialogDescription>Detalle y gestión del lead</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <InfoField label="Correo" value={detail.correo} />
                  <InfoField label="Teléfono" value={detail.telefono} />
                  <InfoField label="Empresa" value={detail.empresa} />
                  <InfoField label="País" value={detail.pais} />
                  <InfoField label="Comunidad" value={detail.tamano_comunidad} />
                  <InfoField label="Interés" value={detail.interes} />
                </div>

                {detail.comentario && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Comentario del lead</p>
                    <p className="text-sm bg-secondary/30 rounded-lg p-3 border border-border/50">{detail.comentario}</p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-2xl font-bold text-primary">{detail.opportunity_score ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Score</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-secondary/30 border border-border/50">
                    <p className="text-sm font-bold">{detail.level ?? "Explorer"}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Nivel</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-secondary/30 border border-border/50">
                    <p className="text-sm font-bold">{detail.tools_used?.length ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Herramientas</p>
                  </div>
                </div>

                {/* Timer section */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-chart-1/5 border border-chart-1/20">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Timer className="w-3.5 h-3.5 text-chart-1" />
                      <p className="text-[10px] text-muted-foreground uppercase">Creación → Asignación</p>
                    </div>
                    <p className="text-sm font-bold">
                      {detail.assigned_at
                        ? formatElapsed(detail.created_at, detail.assigned_at)
                        : <LiveTimer fromISO={detail.created_at} />
                      }
                    </p>
                    {!detail.assigned_at && <p className="text-[10px] text-chart-1">⏳ Pendiente de asignar</p>}
                  </div>
                  <div className="p-3 rounded-lg bg-chart-5/5 border border-chart-5/20">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Timer className="w-3.5 h-3.5 text-chart-5" />
                      <p className="text-[10px] text-muted-foreground uppercase">Asignación → Resolución</p>
                    </div>
                    <p className="text-sm font-bold">
                      {!detail.assigned_at
                        ? "—"
                        : (detail.converted_at || detail.discarded_at)
                          ? formatElapsed(detail.assigned_at, detail.converted_at || detail.discarded_at)
                          : <LiveTimer fromISO={detail.assigned_at} />
                      }
                    </p>
                    {detail.assigned_at && !detail.converted_at && !detail.discarded_at && (
                      <p className="text-[10px] text-chart-5">⏳ En proceso</p>
                    )}
                  </div>
                </div>

                {/* Assignment info */}
                {detail.assigned_bd && (
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Asignación</p>
                    <p className="text-sm">
                      <span className="font-medium">{profilesMap[detail.assigned_bd] ?? "BD"}</span>
                      {detail.assigned_by && (
                        <span className="text-muted-foreground"> — asignado por {profilesMap[detail.assigned_by] ?? "Admin"}</span>
                      )}
                      {detail.assigned_at && (
                        <span className="text-muted-foreground"> el {format(new Date(detail.assigned_at), "dd MMM yyyy, HH:mm", { locale: es })}</span>
                      )}
                    </p>
                  </div>
                )}

                {(detail.badges?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Badges</p>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.badges?.map(b => <Badge key={b} variant="outline" className="text-xs">{b}</Badge>)}
                    </div>
                  </div>
                )}

                {!canEditDetail && (
                  <div className="p-3 rounded-lg bg-chart-1/5 border border-chart-1/20">
                    <p className="text-xs text-chart-1 font-medium">
                      {!detail.assigned_bd
                        ? "⏳ Este lead aún no ha sido asignado. Solo un Admin BD puede asignarlo."
                        : "🔒 Este lead no está asignado a ti. Solo puedes visualizarlo."}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Status</p>
                    <Select value={editStatus} onValueChange={setEditStatus} disabled={!canEditDetail}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {canAssign && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">BD Asignado</p>
                      <Select value={editBD} onValueChange={setEditBD}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin asignar</SelectItem>
                          {bdList.map(bd => <SelectItem key={bd.id} value={bd.id}>{bd.nombre}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {!canAssign && detail.assigned_bd && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">BD Asignado</p>
                      <p className="text-sm font-medium">{profilesMap[detail.assigned_bd] ?? "—"}</p>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
                    Notas del BD
                    {requireNotesForStatus && <span className="text-destructive ml-1">*</span>}
                  </p>
                  <Textarea
                    value={editNotas}
                    onChange={e => setEditNotas(e.target.value)}
                    disabled={!canEditDetail}
                    placeholder={
                      !canEditDetail
                        ? "Solo lectura"
                        : editStatus === "descartado"
                          ? "Indica por qué se descarta este lead (requerido)..."
                          : editStatus === "convertido"
                            ? "Describe el resultado de la conversión (requerido)..."
                            : "Notas de seguimiento..."
                    }
                    rows={3}
                  />
                  {requireNotesForStatus && !editNotas.trim() && (
                    <p className="text-xs text-destructive mt-1">Se requiere una nota para este status</p>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Creado: {format(new Date(detail.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                  {" · "}Actualizado: {format(new Date(detail.updated_at), "dd MMM yyyy, HH:mm", { locale: es })}
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetail(null)}>{canEditDetail ? "Cancelar" : "Cerrar"}</Button>
                {canEditDetail && (
                  <Button
                    onClick={saveChanges}
                    disabled={saving || (requireNotesForStatus && !editNotas.trim())}
                    className="bg-gradient-brand shadow-brand"
                  >
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* History Dialog (Bitácora) */}
      <Dialog open={!!historyLead} onOpenChange={() => setHistoryLead(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          {historyLead && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  Bitácora: {historyLead.nombre ?? "Lead"}
                </DialogTitle>
                <DialogDescription>Historial de acciones sobre este lead</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                {loadingHistory ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : history.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sin historial registrado</p>
                ) : (
                  history.map(h => (
                    <div key={h.id} className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-xs">{h.action}</Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(h.created_at), "dd MMM yy, HH:mm", { locale: es })}
                        </span>
                      </div>
                      {h.details && <p className="text-sm mt-1">{h.details}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Por: {h.performed_by ? (profilesMap[h.performed_by] ?? "Usuario") : "Sistema"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Assign Dialog */}
      <Dialog open={!!assignLead} onOpenChange={() => setAssignLead(null)}>
        <DialogContent className="max-w-sm">
          {assignLead && (() => {
              const isReassign = !!assignLead.assigned_bd;
              const currentBdName = assignLead.assigned_bd ? (profilesMap[assignLead.assigned_bd] ?? "BD") : null;
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-primary" />
                      {isReassign ? "Reasignar Lead" : "Asignar Lead"}
                    </DialogTitle>
                    <DialogDescription>
                      {isReassign
                        ? <>Reasigna el lead <strong>{assignLead.nombre ?? "sin nombre"}</strong> (actualmente con <strong>{currentBdName}</strong>)</>
                        : <>Asigna un Business Developer al lead <strong>{assignLead.nombre ?? "sin nombre"}</strong></>
                      }
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-2">
                    {isReassign && (
                      <div className="p-3 rounded-lg bg-chart-4/5 border border-chart-4/20">
                        <p className="text-xs text-chart-4 font-medium">
                          BD actual: <strong>{currentBdName}</strong>
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
                        {isReassign ? "Nuevo BD" : "Seleccionar BD"}
                      </p>
                      <Select value={assignBDValue} onValueChange={setAssignBDValue}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar BD..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" disabled>Seleccionar BD...</SelectItem>
                          {bdList.filter(bd => bd.id !== assignLead.assigned_bd).map(bd => (
                            <SelectItem key={bd.id} value={bd.id}>{bd.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAssignLead(null)}>Cancelar</Button>
                    <Button
                      onClick={saveAssign}
                      disabled={assignSaving || assignBDValue === "none"}
                      className="bg-gradient-brand shadow-brand gap-1.5"
                    >
                      <UserPlus className="w-4 h-4" />
                      {assignSaving ? (isReassign ? "Reasignando..." : "Asignando...") : (isReassign ? "Reasignar" : "Asignar")}
                    </Button>
                  </DialogFooter>
                </>
              );
            })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* Sub-components */

interface FilterProps {
  search: string; setSearch: (v: string) => void;
  statusFilter: string; setStatusFilter: (v: string) => void;
  scoreFilter: string; setScoreFilter: (v: string) => void;
  bdFilter: string; setBdFilter: (v: string) => void;
  dateFrom: string; setDateFrom: (v: string) => void;
  dateTo: string; setDateTo: (v: string) => void;
  canAssign: boolean; bdList: BDProfile[];
  hideStatusFilter?: boolean;
}

const LeadFilters = ({
  search, setSearch, statusFilter, setStatusFilter, scoreFilter, setScoreFilter,
  bdFilter, setBdFilter, dateFrom, setDateFrom, dateTo, setDateTo,
  canAssign, bdList, hideStatusFilter,
}: FilterProps) => (
  <div className="flex flex-col gap-3">
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por nombre, correo o empresa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>
      {!hideStatusFilter && (
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los status</SelectItem>
            {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <Select value={scoreFilter} onValueChange={setScoreFilter}>
        <SelectTrigger className="sm:w-44"><SelectValue placeholder="Score" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los scores</SelectItem>
          <SelectItem value="high">Alto (≥60)</SelectItem>
          <SelectItem value="medium">Medio (30-59)</SelectItem>
          <SelectItem value="low">Bajo (&lt;30)</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div className="flex flex-col sm:flex-row gap-3">
      {canAssign && (
        <Select value={bdFilter} onValueChange={setBdFilter}>
          <SelectTrigger className="sm:w-48"><SelectValue placeholder="BD Asignado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los BDs</SelectItem>
            <SelectItem value="none">Sin asignar</SelectItem>
            {bdList.map(bd => <SelectItem key={bd.id} value={bd.id}>{bd.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <div className="flex gap-2 items-center">
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[150px]" />
        <span className="text-muted-foreground text-xs">a</span>
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[150px]" />
      </div>
    </div>
  </div>
);

interface LeadTableProps {
  loading: boolean;
  leads: Lead[];
  filtered: Lead[];
  paged: Lead[];
  page: number; setPage: (v: number | ((p: number) => number)) => void;
  totalPages: number;
  pageSize: number; setPageSize: (v: number) => void;
  bdList: BDProfile[];
  profilesMap: Record<string, string>;
  openDetail: (lead: Lead) => void;
  openHistory: (lead: Lead) => void;
  openAssign?: (lead: Lead) => void;
  canAssign?: boolean;
  showTimers?: boolean;
  showNotes?: boolean;
}

const LeadTable = ({
  loading, leads, filtered, paged, page, setPage, totalPages,
  pageSize, setPageSize, bdList, profilesMap, openDetail, openHistory,
  openAssign, canAssign, showTimers, showNotes,
}: LeadTableProps) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-12 text-center space-y-2">
          <Users className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="font-medium">Sin leads</p>
          <p className="text-sm text-muted-foreground">
            {leads.length === 0 ? "Aún no hay leads generados." : "No hay leads que coincidan con tu filtro."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/50 bg-card/50 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>BD Asignado</TableHead>
                <TableHead>Asignado por</TableHead>
                {showTimers && <TableHead>Tiempo</TableHead>}
                {showNotes && <TableHead>Notas</TableHead>}
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map(lead => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.nombre ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{lead.correo ?? "—"}</TableCell>
                  <TableCell className="text-center">
                    <span className={`font-bold ${(lead.opportunity_score ?? 0) >= 60 ? "text-primary" : (lead.opportunity_score ?? 0) >= 30 ? "text-chart-4" : "text-muted-foreground"}`}>
                      {lead.opportunity_score ?? 0}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColor(lead.status)}>
                      {statusLabel(lead.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {lead.assigned_bd ? (profilesMap[lead.assigned_bd] ?? "—") : <span className="text-muted-foreground">Sin asignar</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {lead.assigned_by ? (profilesMap[lead.assigned_by] ?? "—") : "—"}
                  </TableCell>
                  {showTimers && (
                    <TableCell className="text-xs">
                      {!lead.assigned_at ? (
                        <span className="text-chart-1 flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          <LiveTimer fromISO={lead.created_at} />
                        </span>
                      ) : (lead.converted_at || lead.discarded_at) ? (
                        <span className="text-muted-foreground">
                          {formatElapsed(lead.assigned_at, lead.converted_at || lead.discarded_at)}
                        </span>
                      ) : (
                        <span className="text-chart-5 flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          <LiveTimer fromISO={lead.assigned_at} />
                        </span>
                      )}
                    </TableCell>
                  )}
                  {showNotes && (
                    <TableCell className="text-xs max-w-[200px] truncate" title={lead.notas_bd ?? ""}>
                      {lead.notas_bd || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  )}
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(lead.created_at), "dd MMM yy", { locale: es })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {canAssign && openAssign && !lead.assigned_bd && (
                        <Button size="sm" variant="default" onClick={() => openAssign(lead)} className="gap-1 text-xs h-7 px-2">
                          <UserPlus className="w-3.5 h-3.5" />
                          Asignar
                        </Button>
                      )}
                      {canAssign && openAssign && lead.assigned_bd && (
                        <Button size="sm" variant="outline" onClick={() => openAssign(lead)} className="gap-1 text-xs h-7 px-2">
                          <UserPlus className="w-3.5 h-3.5" />
                          Reasignar
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => openDetail(lead)} className="gap-1">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openHistory(lead)} className="gap-1" title="Bitácora">
                        <History className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{filtered.length} leads</span>
          <span>·</span>
          <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(0); }}>
            <SelectTrigger className="h-8 w-[70px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map(s => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <span>por página</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm px-2">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );
};

const InfoField = ({ label, value }: { label: string; value: string | null }) => (
  <div>
    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
    <p className="text-sm font-medium">{value ?? "—"}</p>
  </div>
);

export default LeadsPanel;
