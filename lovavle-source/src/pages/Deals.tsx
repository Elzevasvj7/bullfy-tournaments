import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Search, Filter, ChevronDown, ChevronUp, FileText, ScrollText,
  BarChart3, Eye, CheckCircle, Clock, FileEdit, Loader2, Download, ExternalLink, Users, Settings2, Send, Settings, Flame, Video,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BCEDashboard from "@/components/bce/BCEDashboard";
import { toast } from "@/hooks/use-toast";
import { generateTechnicalReportPDF } from "@/services/generateTechnicalReport";
import { generateAgreementPDF } from "@/services/generateAgreement";
import { generatePerformanceReportPDF } from "@/services/generatePerformanceReport";
import { getLogoBase64 } from "@/services/pdfLogoHelper";
import { loadIBFormData } from "@/services/loadIBFormData";
import { useOnboardingStore } from "@/stores/onboardingStore";
import type { OnboardingFormData } from "@/stores/onboardingStore";
import IBEditDialog from "@/components/admin/IBEditDialog";

interface IBRecord {
  id: string;
  nombre_ib: string;
  nombre_bd: string;
  correo_ib: string;
  modelo_negocio: string;
  tipo_acuerdo_brokeraje: string | null;
  lugar_operacion: string;
  status: string;
  created_at: string;
  updated_at: string;
  tiene_sub_ibs: boolean;
  tipo_persona: string;
  contacto_corporativo: string | null;
  representante_legal: string | null;
  tipo_id_representante: string | null;
  id_representante: string | null;
  negociaciones_especiales: string | null;
  direccion_empresa: string | null;
  kickoff_video_path: string | null;
  created_by: string | null;
}

interface ReportRecord {
  id: string;
  ib_id: string;
  report_type: string;
  report_number: string;
  nombre_ib: string;
  nombre_bd: string;
  data: any;
  created_at: string;
}

interface BDHistoryItem {
  bd_anterior_nombre: string;
  bd_nuevo_nombre: string;
  created_at: string;
}

interface DealRow {
  id: string;
  nombre: string;
  correo: string;
  nombre_bd: string;
  modelo_negocio: string;
  tipo_acuerdo_brokeraje: string | null;
  lugar_operacion: string;
  status: string;
  created_at: string;
  tipo: "IB" | "Sub IB";
  parent_ib_nombre?: string;
  parent_ib_correo?: string;
  ib_id: string;
  created_by?: string | null;
  tiene_sub_ibs: boolean;
  bd_history?: BDHistoryItem[];
  tipo_persona?: string;
  contacto_corporativo?: string | null;
  representante_legal?: string | null;
  tipo_id_representante?: string | null;
  id_representante?: string | null;
  negociaciones_especiales?: string | null;
  direccion_empresa?: string | null;
  kickoff_video_path?: string | null;
}

type SortField = "created_at" | "nombre" | "nombre_bd" | "status";
type SortDir = "asc" | "desc";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "draft", label: "Borrador" },
  { value: "submitted", label: "Enviado" },
  { value: "en_proceso", label: "En Proceso" },
  { value: "configurado", label: "Configurado" },
  { value: "active", label: "Activo" },
];

const MODEL_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "Brokeraje", label: "Brokeraje" },
  { value: "PropFirm", label: "PropFirm" },
  { value: "Ambos", label: "Ambos" },
];

const TYPE_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "IB", label: "IB" },
  { value: "Sub IB", label: "Sub IB" },
];

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: typeof CheckCircle }> = {
  active: { label: "Activo", variant: "default", icon: CheckCircle },
  draft: { label: "Borrador", variant: "secondary", icon: FileEdit },
  submitted: { label: "Enviado", variant: "outline", icon: Send },
  en_proceso: { label: "En Proceso", variant: "outline", icon: Clock },
  configurado: { label: "Configurado", variant: "outline", icon: Settings },
  pending: { label: "Pendiente", variant: "outline", icon: Clock },
};

const Deals = () => {
  const { user, profile, loading: authLoading, isAdmin, isOperaciones, isBD, isAdminBD } = useAuth();
  const navigate = useNavigate();
  const loadForEdit = useOnboardingStore((s) => s.loadForEdit);
  const [ibs, setIbs] = useState<IBRecord[]>([]);
  const [subIbs, setSubIbs] = useState<any[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [bdHistoryMap, setBdHistoryMap] = useState<Record<string, BDHistoryItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedDeal, setSelectedDeal] = useState<DealRow | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState<string | null>(null);
  const [editSubIb, setEditSubIb] = useState<any | null>(null);

  // BD can edit deals where they are currently the assigned BD (by name)
  const canBDEditDeal = (deal: DealRow) =>
    isBD && !!profile?.nombre && deal.nombre_bd?.trim().toLowerCase() === profile.nombre.trim().toLowerCase();

  const handleEditConditions = async (ibId: string) => {
    setLoadingEdit(ibId);
    try {
      const data = await loadIBFormData(ibId);
      loadForEdit(ibId, data);
      navigate("/ibs");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoadingEdit(null);
    }
  };
  useEffect(() => {
    if (authLoading || !user) return;
    const fetchData = async () => {
      setLoading(true);

      let ibsQuery = supabase
          .from("ibs")
          .select("id, nombre_ib, nombre_bd, correo_ib, modelo_negocio, tipo_acuerdo_brokeraje, lugar_operacion, status, created_at, updated_at, tiene_sub_ibs, tipo_persona, contacto_corporativo, representante_legal, tipo_id_representante, id_representante, negociaciones_especiales, direccion_empresa, kickoff_video_path, created_by")
          .order("created_at", { ascending: false });

      // BD users only see IBs currently assigned to them; Admin BD sees all
      if (isBD && !isAdminBD && !isAdmin && profile?.nombre) {
        ibsQuery = ibsQuery.eq("nombre_bd", profile.nombre);
      }

      const [ibsRes, reportsRes, bdHistRes, subIbsRes] = await Promise.all([
        ibsQuery,
        supabase
          .from("reports")
          .select("id, ib_id, report_type, report_number, nombre_ib, nombre_bd, data, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("ib_bd_history")
          .select("ib_id, bd_anterior_nombre, bd_nuevo_nombre, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("sub_ibs")
          .select("id, ib_id, nombre, correo, tipo_id, id_documento, dolares_por_lote, es_master_ib, master_ib_numero, created_at")
          .order("created_at", { ascending: false }),
      ]);

      const scopedIbs = ibsRes.data ?? [];
      const visibleIbIds = new Set(scopedIbs.map((ib) => ib.id));
      const scopedReports = (reportsRes.data ?? []).filter((r) => visibleIbIds.has(r.ib_id));
      const scopedBdHistory = (bdHistRes.data ?? []).filter((h: any) => visibleIbIds.has(h.ib_id));
      const scopedSubIbs = (subIbsRes.data ?? []).filter((s: any) => visibleIbIds.has(s.ib_id));

      setIbs(scopedIbs);
      setSubIbs(scopedSubIbs);
      setReports(scopedReports);

      // Group bd history by ib_id
      const histMap: Record<string, BDHistoryItem[]> = {};
      scopedBdHistory.forEach((h: any) => {
        if (!histMap[h.ib_id]) histMap[h.ib_id] = [];
        histMap[h.ib_id].push({
          bd_anterior_nombre: h.bd_anterior_nombre,
          bd_nuevo_nombre: h.bd_nuevo_nombre,
          created_at: h.created_at,
        });
      });
      setBdHistoryMap(histMap);
      setLoading(false);
    };
    fetchData();
  }, [authLoading, user?.id, isBD, isAdminBD, isAdmin, profile?.nombre]);

  // Build unified deal rows: IBs + Sub IBs from reports
  const dealRows = useMemo(() => {
    const rows: DealRow[] = [];

    // Add all IBs
    for (const ib of ibs) {
      rows.push({
        id: ib.id,
        nombre: ib.nombre_ib,
        correo: ib.correo_ib,
        nombre_bd: ib.nombre_bd,
        modelo_negocio: ib.modelo_negocio,
        tipo_acuerdo_brokeraje: ib.tipo_acuerdo_brokeraje,
        lugar_operacion: ib.lugar_operacion,
        status: ib.status,
        created_at: ib.created_at,
        tipo: "IB",
        ib_id: ib.id,
        tiene_sub_ibs: ib.tiene_sub_ibs,
        bd_history: bdHistoryMap[ib.id] || [],
        tipo_persona: ib.tipo_persona,
        contacto_corporativo: ib.contacto_corporativo,
        representante_legal: ib.representante_legal,
        tipo_id_representante: ib.tipo_id_representante,
        id_representante: ib.id_representante,
        negociaciones_especiales: ib.negociaciones_especiales,
        direccion_empresa: ib.direccion_empresa,
        kickoff_video_path: ib.kickoff_video_path,
        created_by: ib.created_by,
      });
    }

    // Add Sub IBs from sub_ibs table (DB source of truth)
    const addedSubIbKeys = new Set<string>();
    for (const sub of subIbs) {
      const parentIB = ibs.find(ib => ib.id === sub.ib_id);
      if (!parentIB) continue;
      const key = `${sub.ib_id}_${sub.correo}`;
      addedSubIbKeys.add(key);
      const masterLabel = sub.es_master_ib ? ` (Master IB${sub.master_ib_numero || ""})` : "";
      rows.push({
        id: `sub_${sub.id}`,
        nombre: sub.nombre + masterLabel,
        correo: sub.correo,
        nombre_bd: parentIB.nombre_bd,
        modelo_negocio: parentIB.modelo_negocio,
        tipo_acuerdo_brokeraje: parentIB.tipo_acuerdo_brokeraje,
        lugar_operacion: parentIB.lugar_operacion,
        status: parentIB.status,
        created_at: sub.created_at,
        tipo: "Sub IB",
        parent_ib_nombre: parentIB.nombre_ib,
        parent_ib_correo: parentIB.correo_ib,
        ib_id: sub.ib_id,
        tiene_sub_ibs: false,
      });
    }

    // Also include Sub IBs from reports that aren't already in sub_ibs table (legacy)
    for (const r of reports) {
      const data = r.data as any;
      if (data?._is_sub_ib) {
        const key = `${r.ib_id}_${data._sub_ib_correo || r.nombre_ib}`;
        if (!addedSubIbKeys.has(key)) {
          addedSubIbKeys.add(key);
          const parentIB = ibs.find(ib => ib.id === r.ib_id);
          rows.push({
            id: `sub_report_${r.ib_id}_${r.nombre_ib}`,
            nombre: r.nombre_ib,
            correo: data._sub_ib_correo || "",
            nombre_bd: r.nombre_bd,
            modelo_negocio: parentIB?.modelo_negocio || data.modelo_negocio || "",
            tipo_acuerdo_brokeraje: parentIB?.tipo_acuerdo_brokeraje || data.tipo_acuerdo_brokeraje || null,
            lugar_operacion: parentIB?.lugar_operacion || data.lugar_operacion || "",
            status: parentIB?.status || "draft",
            created_at: r.created_at,
            tipo: "Sub IB",
            parent_ib_nombre: data._parent_ib_name || parentIB?.nombre_ib || "",
            parent_ib_correo: data._parent_ib_correo || parentIB?.correo_ib || "",
            ib_id: r.ib_id,
            tiene_sub_ibs: false,
          });
        }
      }
    }

    return rows;
  }, [ibs, subIbs, reports, bdHistoryMap]);

  const getReportsForDeal = (deal: DealRow) => {
    if (deal.tipo === "IB") {
      // IB reports: all reports for this ib_id that are NOT sub IB reports
      return reports.filter(r => r.ib_id === deal.ib_id && !(r.data as any)?._is_sub_ib);
    }
    // Sub IB reports: reports for this ib_id where nombre_ib matches the sub IB name
    return reports.filter(r => r.ib_id === deal.ib_id && r.nombre_ib === deal.nombre && (r.data as any)?._is_sub_ib);
  };

  const reportTypeIcon = (type: string) => {
    switch (type) {
      case "technical": return <FileText className="w-3.5 h-3.5" />;
      case "agreement": return <ScrollText className="w-3.5 h-3.5" />;
      case "performance": return <BarChart3 className="w-3.5 h-3.5" />;
      default: return <FileText className="w-3.5 h-3.5" />;
    }
  };

  const reportTypeLabel = (type: string) => {
    switch (type) {
      case "technical": return "Technical Report";
      case "agreement": return "Agreement";
      case "performance": return "Performance Report";
      default: return type;
    }
  };

  const handleDownloadReport = async (report: ReportRecord) => {
    setGeneratingReport(report.id);
    try {
      const logo = await getLogoBase64();
      const formData = report.data as OnboardingFormData;
      let doc;
      let filename: string;

      switch (report.report_type) {
        case "technical":
          doc = generateTechnicalReportPDF(formData, report.report_number, report.ib_id, logo, !!report.data?._is_update);
          filename = `IB_Technical_Report_${report.nombre_ib.replace(/\s+/g, "_")}_${report.report_number}.pdf`;
          break;
        case "agreement":
          doc = generateAgreementPDF(formData, report.report_number, report.ib_id, logo);
          filename = `IB_Agreement_${report.nombre_ib.replace(/\s+/g, "_")}_${report.report_number}.pdf`;
          break;
        case "performance":
          doc = generatePerformanceReportPDF(formData, report.report_number, report.ib_id, logo);
          filename = `IB_Performance_${report.nombre_ib.replace(/\s+/g, "_")}_${report.report_number}.pdf`;
          break;
        default:
          throw new Error("Tipo de reporte desconocido");
      }

      doc.save(filename);
      toast({ title: "📄 PDF descargado", description: `${report.report_number}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingReport(null);
    }
  };

  const handlePreviewReport = async (report: ReportRecord) => {
    setGeneratingReport(report.id + "_preview");
    try {
      const logo = await getLogoBase64();
      const formData = report.data as OnboardingFormData;
      let doc;

      switch (report.report_type) {
        case "technical":
          doc = generateTechnicalReportPDF(formData, report.report_number, report.ib_id, logo, !!report.data?._is_update);
          break;
        case "agreement":
          doc = generateAgreementPDF(formData, report.report_number, report.ib_id, logo);
          break;
        case "performance":
          doc = generatePerformanceReportPDF(formData, report.report_number, report.ib_id, logo);
          break;
        default:
          throw new Error("Tipo de reporte desconocido");
      }

      const blobUrl = doc.output("bloburl");
      window.open(blobUrl as string, "_blank");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingReport(null);
    }
  };

  const handleStatusChange = async (ibId: string, newStatus: string) => {
    setUpdatingStatus(ibId);
    const { error } = await supabase.from("ibs").update({ status: newStatus }).eq("id", ibId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setIbs((prev) => prev.map((ib) => (ib.id === ibId ? { ...ib, status: newStatus } : ib)));
      toast({ title: "Estado actualizado", description: `IB marcado como ${statusConfig[newStatus]?.label || newStatus}` });
    }
    setUpdatingStatus(null);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  const filtered = useMemo(() => {
    let result = [...dealRows];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((d) =>
        d.nombre.toLowerCase().includes(q) ||
        d.nombre_bd.toLowerCase().includes(q) ||
        d.correo.toLowerCase().includes(q) ||
        (d.parent_ib_nombre?.toLowerCase().includes(q) ?? false)
      );
    }
    if (statusFilter !== "all") result = result.filter((d) => d.status === statusFilter);
    if (modelFilter !== "all") result = result.filter((d) => d.modelo_negocio === modelFilter);
    if (typeFilter !== "all") result = result.filter((d) => d.tipo === typeFilter);
    result.sort((a, b) => {
      const valA = a[sortField === "nombre" ? "nombre" : sortField];
      const valB = b[sortField === "nombre" ? "nombre" : sortField];
      const cmp = String(valA).localeCompare(String(valB));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [dealRows, search, statusFilter, modelFilter, typeFilter, sortField, sortDir]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });

  const [dealsTab, setDealsTab] = useState("deals");

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <Tabs value={dealsTab} onValueChange={setDealsTab}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="deals" className="gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Deals
            </TabsTrigger>
            {(isBD || isAdmin || isAdminBD) && (
              <TabsTrigger value="bce" className="gap-1.5">
                <Flame className="w-3.5 h-3.5" /> Closing Engine
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="bce" className="mt-4">
            <BCEDashboard />
          </TabsContent>

          <TabsContent value="deals" className="mt-4 space-y-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Deals</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Control y gestión de acuerdos con IBs — {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nombre, BD, correo o IB principal..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[120px]"><Users className="w-3.5 h-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
              <SelectContent>{TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><Filter className="w-3.5 h-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={modelFilter} onValueChange={setModelFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>{MODEL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-gradient-card rounded-xl border border-border shadow-card overflow-hidden">
          {loading ? (
            <div className="px-5 py-16 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando deals...
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm text-muted-foreground">
              {dealRows.length === 0 ? "No hay IBs registrados aún." : "No se encontraron resultados con los filtros aplicados."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-4 py-3 text-left font-semibold text-foreground text-xs uppercase tracking-wide">Tipo</th>
                    <th className="px-4 py-3 text-left">
                      <button onClick={() => toggleSort("nombre")} className="flex items-center gap-1 font-semibold text-foreground text-xs uppercase tracking-wide">Nombre <SortIcon field="nombre" /></button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button onClick={() => toggleSort("nombre_bd")} className="flex items-center gap-1 font-semibold text-foreground text-xs uppercase tracking-wide">BD <SortIcon field="nombre_bd" /></button>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground text-xs uppercase tracking-wide">Modelo</th>
                    <th className="px-4 py-3 text-left">
                      <button onClick={() => toggleSort("status")} className="flex items-center gap-1 font-semibold text-foreground text-xs uppercase tracking-wide">Estado <SortIcon field="status" /></button>
                    </th>
                    {!isOperaciones && <th className="px-4 py-3 text-left font-semibold text-foreground text-xs uppercase tracking-wide">Reportes</th>}
                    <th className="px-4 py-3 text-left">
                      <button onClick={() => toggleSort("created_at")} className="flex items-center gap-1 font-semibold text-foreground text-xs uppercase tracking-wide">Fecha <SortIcon field="created_at" /></button>
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground text-xs uppercase tracking-wide">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((deal) => {
                    const dealReports = getReportsForDeal(deal);
                    const sc = statusConfig[deal.status] || statusConfig.pending;
                    const StatusIcon = sc.icon;
                    return (
                      <tr key={deal.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3">
                          <Badge
                            variant={deal.tipo === "IB" ? "default" : "secondary"}
                            className="text-xs gap-1"
                          >
                            {deal.tipo === "Sub IB" && <Users className="w-3 h-3" />}
                            {deal.tipo}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{deal.nombre}</p>
                          <p className="text-xs text-muted-foreground">{deal.correo}</p>
                          {deal.tipo === "Sub IB" && deal.parent_ib_nombre && (
                            <p className="text-xs text-primary/70 mt-0.5">
                              IB: {deal.parent_ib_nombre}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs uppercase text-muted-foreground">{deal.nombre_bd}</p>
                          {deal.bd_history && deal.bd_history.length > 0 && (
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5" title="BD anterior">
                              Anterior: {deal.bd_history[0].bd_anterior_nombre}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono uppercase text-muted-foreground">{deal.modelo_negocio}</span>
                          {deal.tipo_acuerdo_brokeraje && <span className="block text-xs text-muted-foreground/60">{deal.tipo_acuerdo_brokeraje}</span>}
                        </td>
                        <td className="px-4 py-3">
                          {isAdmin && deal.tipo === "IB" ? (
                            <Select value={deal.status} onValueChange={(val) => handleStatusChange(deal.ib_id, val)} disabled={updatingStatus === deal.ib_id}>
                              <SelectTrigger className="h-7 w-[120px] text-xs">
                                <div className="flex items-center gap-1.5"><StatusIcon className="w-3 h-3" /><SelectValue /></div>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="draft">Borrador</SelectItem>
                                <SelectItem value="submitted">Enviado</SelectItem>
                                <SelectItem value="en_proceso">En Proceso</SelectItem>
                                <SelectItem value="configurado">Configurado</SelectItem>
                                <SelectItem value="active">Activo</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant={sc.variant} className="gap-1 text-xs"><StatusIcon className="w-3 h-3" />{sc.label}</Badge>
                          )}
                        </td>
                        {!isOperaciones && (
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 flex-wrap">
                            {dealReports.length === 0 ? (
                              <span className="text-xs text-muted-foreground/50">—</span>
                            ) : (
                              dealReports.map((r) => (
                                <Badge key={r.id} variant="outline" className="gap-1 text-xs cursor-default" title={`${reportTypeLabel(r.report_type)} — ${r.report_number}`}>
                                  {reportTypeIcon(r.report_type)}
                                  {r.report_number}
                                </Badge>
                              ))
                            )}
                          </div>
                        </td>
                        )}
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(deal.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedDeal(deal)} className="gap-1.5 text-xs">
                            <Eye className="w-3.5 h-3.5" /> Ver
                          </Button>
                          {(isAdmin || canBDEditDeal(deal)) && deal.tipo === "IB" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditConditions(deal.ib_id)}
                              disabled={loadingEdit === deal.ib_id}
                              className="gap-1.5 text-xs text-primary hover:text-primary"
                            >
                              {loadingEdit === deal.ib_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Settings2 className="w-3.5 h-3.5" />} Modificar
                            </Button>
                          )}
                          {(isAdmin || canBDEditDeal(deal)) && deal.tipo === "Sub IB" && deal.id.startsWith("sub_") && !deal.id.startsWith("sub_report_") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const realSubId = deal.id.replace(/^sub_/, "");
                                const sub = subIbs.find((s) => s.id === realSubId);
                                if (!sub) {
                                  toast({ title: "Error", description: "No se encontró el Sub IB", variant: "destructive" });
                                  return;
                                }
                                setEditSubIb({
                                  id: deal.ib_id,
                                  nombre_ib: sub.nombre,
                                  correo_ib: sub.correo,
                                  tipo_id: sub.tipo_id || "Cédula",
                                  id_ib: sub.id_documento || "",
                                  lugar_operacion: deal.lugar_operacion,
                                  _isSubIb: true,
                                  _realSubIbId: sub.id,
                                });
                              }}
                              className="gap-1.5 text-xs text-primary hover:text-primary"
                            >
                              <Settings2 className="w-3.5 h-3.5" /> Modificar
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail Dialog */}
        <Dialog open={!!selectedDeal} onOpenChange={() => setSelectedDeal(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display flex items-center gap-2">
                {selectedDeal?.nombre}
                {selectedDeal?.tipo === "Sub IB" && (
                  <Badge variant="secondary" className="text-xs gap-1"><Users className="w-3 h-3" />Sub IB</Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            {selectedDeal && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  {selectedDeal.tipo === "Sub IB" && selectedDeal.parent_ib_nombre && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">IB Principal</p>
                      <p className="font-medium text-primary">{selectedDeal.parent_ib_nombre} ({selectedDeal.parent_ib_correo})</p>
                    </div>
                  )}
                  <DetailItem label="Business Developer" value={selectedDeal.nombre_bd} />
                  <DetailItem label="Correo" value={selectedDeal.correo} />
                  <DetailItem label="Tipo Persona" value={selectedDeal.tipo_persona || "—"} />
                  <DetailItem label="Modelo" value={selectedDeal.modelo_negocio} />
                  <DetailItem label="Acuerdo" value={selectedDeal.tipo_acuerdo_brokeraje || "—"} />
                  <DetailItem label="Región" value={selectedDeal.lugar_operacion} />
                  <DetailItem label="Estado" value={statusConfig[selectedDeal.status]?.label || selectedDeal.status} />
                  <DetailItem label="Tipo" value={selectedDeal.tipo} />
                  <DetailItem label="Creado" value={formatDate(selectedDeal.created_at)} />
                  {selectedDeal.tipo_persona === "Empresa" && (
                    <>
                      {selectedDeal.direccion_empresa && <DetailItem label="Dirección Empresa" value={selectedDeal.direccion_empresa} />}
                      {selectedDeal.contacto_corporativo && <DetailItem label="Contacto Corporativo" value={selectedDeal.contacto_corporativo} />}
                      {selectedDeal.representante_legal && <DetailItem label="Representante Legal" value={selectedDeal.representante_legal} />}
                      {selectedDeal.tipo_id_representante && selectedDeal.id_representante && (
                        <DetailItem label={`ID Rep. (${selectedDeal.tipo_id_representante})`} value={selectedDeal.id_representante} />
                      )}
                    </>
                  )}
                  {selectedDeal.negociaciones_especiales?.trim() && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Negociaciones Especiales</p>
                      <p className="font-medium text-sm mt-0.5">{selectedDeal.negociaciones_especiales}</p>
                    </div>
                  )}
                </div>

                {/* Kickoff Video */}
                {selectedDeal.kickoff_video_path && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5" /> Video Kick-off
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-xs"
                      onClick={async () => {
                        const { data } = await supabase.storage
                          .from("kickoff-videos")
                          .createSignedUrl(selectedDeal.kickoff_video_path!, 3600);
                        if (data?.signedUrl) {
                          window.open(data.signedUrl, "_blank");
                        } else {
                          toast({ title: "Error", description: "No se pudo generar el enlace del video", variant: "destructive" });
                        }
                      }}
                    >
                      <Video className="w-3.5 h-3.5" /> Ver video de entrevista
                    </Button>
                  </div>
                )}

                {/* BD History */}
                {selectedDeal.bd_history && selectedDeal.bd_history.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Historial de BDs</p>
                    <div className="space-y-1.5">
                      {selectedDeal.bd_history.map((h, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded bg-secondary/40 border border-border/50 text-xs">
                          <span className="font-mono uppercase">{h.bd_anterior_nombre}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-mono uppercase">{h.bd_nuevo_nombre}</span>
                          <span className="ml-auto text-muted-foreground">{formatDate(h.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!isOperaciones && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Reportes generados</p>
                  {getReportsForDeal(selectedDeal).length === 0 ? (
                    <p className="text-xs text-muted-foreground/60">Sin reportes</p>
                  ) : (
                    <div className="space-y-2">
                      {getReportsForDeal(selectedDeal).map((r) => (
                        <div key={r.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-secondary/40 border border-border/50">
                          <div className="flex items-center gap-2">
                            {reportTypeIcon(r.report_type)}
                            <div>
                              <span className="text-xs font-medium">{reportTypeLabel(r.report_type)}</span>
                              <span className="block text-xs font-mono text-muted-foreground">{r.report_number}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground mr-2">{formatDate(r.created_at)}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePreviewReport(r)}
                              disabled={generatingReport === r.id + "_preview"}
                              className="h-7 w-7 p-0"
                              title="Ver en pantalla"
                            >
                              {generatingReport === r.id + "_preview" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadReport(r)}
                              disabled={generatingReport === r.id}
                              className="h-7 w-7 p-0"
                              title="Descargar PDF"
                            >
                              {generatingReport === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )}

                {/* Modify Conditions Button in detail dialog */}
                {(isAdmin || canBDEditDeal(selectedDeal)) && selectedDeal.tipo === "IB" && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const ibId = selectedDeal.ib_id;
                      setSelectedDeal(null);
                      handleEditConditions(ibId);
                    }}
                    disabled={loadingEdit === selectedDeal.ib_id}
                    className="w-full gap-2 mt-2"
                  >
                    {loadingEdit === selectedDeal.ib_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />} Modificar Condiciones
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Sub IB Edit Dialog */}
        {editSubIb && (
          <IBEditDialog
            ib={editSubIb}
            open={!!editSubIb}
            onOpenChange={(o) => { if (!o) setEditSubIb(null); }}
            onSaved={() => {
              // Refresh data
              setEditSubIb(null);
              // Re-trigger fetch by toggling loading
              (async () => {
                const { data } = await supabase
                  .from("sub_ibs")
                  .select("id, ib_id, nombre, correo, tipo_id, id_documento, dolares_por_lote, es_master_ib, master_ib_numero, created_at")
                  .order("created_at", { ascending: false });
                const visibleIbIds = new Set(ibs.map((ib) => ib.id));
                setSubIbs((data ?? []).filter((s: any) => visibleIbIds.has(s.ib_id)));
              })();
            }}
          />
        )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

const DetailItem = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="font-medium text-foreground">{value}</p>
  </div>
);

export default Deals;
