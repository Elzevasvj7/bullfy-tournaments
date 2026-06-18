import { useEffect, useState, useMemo, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import StatCard from "@/components/StatCard";
import { Users, Handshake, TrendingUp, UserPlus, FileDown, Upload, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface DashboardStats {
  totalIBs: number;
  activeIBs: number;
  draftIBs: number;
  newThisMonth: number;
  reportsGenerated: number;
}

interface IBRow {
  id: string;
  nombre_ib: string;
  status: string;
  created_at: string;
  modelo_negocio: string;
  lugar_operacion: string;
}

interface ReportRow {
  id: string;
  report_type: string;
  created_at: string;
}

interface DocItem {
  id: string;
  nombre: string;
  archivo_path: string;
  created_at: string;
}

const CHART_COLORS = [
  "hsl(142, 71%, 45%)",   // green (trading buy)
  "hsl(0, 72%, 51%)",     // red (trading sell)
  "hsl(142, 60%, 30%)",   // dark green
  "hsl(142, 50%, 60%)",   // light green
  "hsl(210, 15%, 68%)",   // gray
];

const Index = () => {
  const { user, isAdmin } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalIBs: 0, activeIBs: 0, draftIBs: 0, newThisMonth: 0, reportsGenerated: 0,
  });
  const [allIBs, setAllIBs] = useState<IBRow[]>([]);
  const [allReports, setAllReports] = useState<ReportRow[]>([]);
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchDashboard = async () => {
      try {
        const [ibsRes, reportsRes, docsRes] = await Promise.all([
          supabase.from("ibs")
            .select("id, nombre_ib, status, created_at, modelo_negocio, lugar_operacion")
            .order("created_at", { ascending: false }),
          supabase.from("reports")
            .select("id, report_type, created_at")
            .order("created_at", { ascending: false }),
          supabase.from("documents")
            .select("id, nombre, archivo_path, created_at")
            .order("created_at", { ascending: false }),
        ]);

        const ibs = ibsRes.data ?? [];
        const reports = reportsRes.data ?? [];
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        setAllIBs(ibs);
        setAllReports(reports);
        setDocuments(docsRes.data ?? []);
        setStats({
          totalIBs: ibs.length,
          activeIBs: ibs.filter((ib) => ib.status === "active" || ib.status === "draft").length,
          draftIBs: ibs.filter((ib) => ib.status === "draft").length,
          newThisMonth: ibs.filter((ib) => ib.created_at >= startOfMonth).length,
          reportsGenerated: reports.length,
        });
      } catch (err) {
        console.error("Error fetching dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [user]);

  // ─── Chart data ───
  const modelDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    allIBs.forEach((ib) => { counts[ib.modelo_negocio] = (counts[ib.modelo_negocio] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [allIBs]);

  const regionDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    allIBs.forEach((ib) => { counts[ib.lugar_operacion] = (counts[ib.lugar_operacion] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [allIBs]);

  const monthlyActivity = useMemo(() => {
    const months: Record<string, { ibs: number; reports: number }> = {};
    const now = new Date();
    // Last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" });
      months[key] = { ibs: 0, reports: 0 };
    }

    allIBs.forEach((ib) => {
      const d = new Date(ib.created_at);
      const key = d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" });
      if (months[key] !== undefined) months[key].ibs++;
    });

    allReports.forEach((r) => {
      const d = new Date(r.created_at);
      const key = d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" });
      if (months[key] !== undefined) months[key].reports++;
    });

    return Object.entries(months).map(([month, data]) => ({ month, ...data }));
  }, [allIBs, allReports]);

  const reportTypeDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    const labels: Record<string, string> = { technical: "Technical", agreement: "Agreement", performance: "Performance" };
    allReports.forEach((r) => {
      const label = labels[r.report_type] || r.report_type;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [allReports]);

  const statusLabel = (s: string) => {
    switch (s) {
      case "active": return "Activo";
      case "draft": return "Borrador";
      case "pending": return "Pendiente";
      default: return s;
    }
  };

  const statusClass = (s: string) => {
    switch (s) {
      case "active": return "bg-accent/15 text-accent";
      case "draft": return "bg-primary/15 text-primary";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });

  const handleDownload = (doc: DocItem) => {
    const { data } = supabase.storage.from("documents").getPublicUrl(doc.archivo_path);
    const link = document.createElement("a");
    link.href = data.publicUrl;
    link.download = doc.nombre;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const safeName = file.name.replace(/\s+/g, "_");
      const path = `${Date.now()}_${safeName}`;
      const { error: uploadErr } = await supabase.storage.from("documents").upload(path, file);
      if (uploadErr) throw uploadErr;

      const { error: dbErr } = await supabase.from("documents").insert({
        nombre: file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
        archivo_path: path,
        uploaded_by: user.id,
      });
      if (dbErr) throw dbErr;

      // Refresh documents
      const { data: docs } = await supabase.from("documents").select("id, nombre, archivo_path, created_at").order("created_at", { ascending: false });
      setDocuments(docs ?? []);
      toast({ title: "✅ Documento subido" });
    } catch (err: any) {
      toast({ title: "Error al subir", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteDoc = async (doc: DocItem) => {
    setDeletingDocId(doc.id);
    try {
      await supabase.storage.from("documents").remove([doc.archivo_path]);
      const { error } = await supabase.from("documents").delete().eq("id", doc.id);
      if (error) throw error;
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      toast({ title: "Documento eliminado" });
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" });
    } finally {
      setDeletingDocId(null);
    }
  };

  const recentIBs = allIBs.slice(0, 5);

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Resumen del sistema de IBs — Bullfy Limited
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} title="IBs Totales" value={loading ? "—" : stats.totalIBs} subtitle={`${stats.draftIBs} borradores`} trend="neutral" />
          <StatCard icon={Handshake} title="Reportes" value={loading ? "—" : stats.reportsGenerated} subtitle="Generados" trend="neutral" />
          <StatCard icon={TrendingUp} title="IBs Activos" value={loading ? "—" : stats.activeIBs} subtitle="Con acuerdo" trend="up" />
          <StatCard icon={UserPlus} title="Nuevos este mes" value={loading ? "—" : stats.newThisMonth} subtitle={new Date().toLocaleString("es-ES", { month: "long", year: "numeric" })} trend="up" />
        </div>

        {/* Charts Grid */}
        {!loading && allIBs.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Monthly Activity */}
            <div className="bg-gradient-card rounded-xl border border-border shadow-card p-5">
              <h3 className="font-display font-semibold text-foreground text-sm mb-4">Actividad Mensual</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlyActivity}>
                  <defs>
                    <linearGradient id="gradIBs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradReports" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 60%, 30%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(142, 60%, 30%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--foreground))" }}
                    labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="ibs" name="IBs" stroke="hsl(142, 71%, 45%)" fill="url(#gradIBs)" strokeWidth={2} />
                  <Area type="monotone" dataKey="reports" name="Reportes" stroke="hsl(142, 60%, 30%)" fill="url(#gradReports)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Model Distribution */}
            <div className="bg-gradient-card rounded-xl border border-border shadow-card p-5">
              <h3 className="font-display font-semibold text-foreground text-sm mb-4">Distribución por Modelo</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={modelDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {modelDistribution.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--foreground))" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Region Distribution */}
            {regionDistribution.length > 0 && (
              <div className="bg-gradient-card rounded-xl border border-border shadow-card p-5">
                <h3 className="font-display font-semibold text-foreground text-sm mb-4">IBs por Región</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={regionDistribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" width={120} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--foreground))" }}
                    />
                    <Bar dataKey="value" name="IBs" fill="hsl(142, 71%, 45%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Report Types */}
            {reportTypeDistribution.length > 0 && (
              <div className="bg-gradient-card rounded-xl border border-border shadow-card p-5">
                <h3 className="font-display font-semibold text-foreground text-sm mb-4">Reportes por Tipo</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={reportTypeDistribution}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--foreground))" }}
                    />
                    <Bar dataKey="value" name="Cantidad" radius={[4, 4, 0, 0]}>
                      {reportTypeDistribution.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Documentos Importantes */}
        <div className="bg-gradient-card rounded-xl border border-border shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-display font-semibold text-foreground">Documentos Importantes</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Actualizados</span>
              {isAdmin && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleUploadDoc}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.pptx,.txt,.csv"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="gap-1.5 text-xs h-7"
                  >
                    {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {uploading ? "Subiendo..." : "Subir"}
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="divide-y divide-border">
            {loading ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">Cargando...</div>
            ) : documents.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">No hay documentos disponibles.</div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="px-5 py-3.5 flex items-center justify-between hover:bg-secondary/40 transition-colors"
                >
                  <button
                    onClick={() => handleDownload(doc)}
                    className="flex items-center gap-3 text-left flex-1 min-w-0"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <FileDown className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary underline underline-offset-2 truncate">{doc.nombre}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(doc.created_at)}</p>
                    </div>
                  </button>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteDoc(doc)}
                      disabled={deletingDocId === doc.id}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0 ml-2"
                    >
                      {deletingDocId === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* IBs Recientes */}
        <div className="bg-gradient-card rounded-xl border border-border shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-display font-semibold text-foreground">IBs Recientes</h3>
            <span className="text-xs text-muted-foreground">Últimos registros</span>
          </div>
          <div className="divide-y divide-border">
            {loading ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">Cargando...</div>
            ) : recentIBs.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">No hay IBs registrados aún.</div>
            ) : (
              recentIBs.map((ib) => (
                <div key={ib.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-secondary/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">{ib.nombre_ib.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{ib.nombre_ib}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(ib.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-mono uppercase text-muted-foreground">{ib.modelo_negocio}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClass(ib.status)}`}>
                      {statusLabel(ib.status)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
