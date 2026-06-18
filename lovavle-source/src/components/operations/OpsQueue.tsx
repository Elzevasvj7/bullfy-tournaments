import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Play, CheckCircle2, Eye, UserPlus, StickyNote, Wrench, FileText, History, ScrollText, Loader2, Copy, XCircle } from "lucide-react";
import { DEAL_STATUSES, getStatusConfig } from "@/lib/dealStatuses";
import OpsViewDialog from "./OpsViewDialog";
import OpsRequestBitacora from "./OpsRequestBitacora";
import IBExternoDetailDialog from "./IBExternoDetailDialog";
import { generateSubIBAgreementPDF, type SubIBCompensation } from "@/services/generateAgreement";
import { getLogoBase64 } from "@/services/pdfLogoHelper";
import { loadIBFormData } from "@/services/loadIBFormData";
import type { SubIB } from "@/stores/onboardingStore";
import { useSessionStorageState } from "@/hooks/useSessionStorageState";

interface UnifiedItem {
  id: string;
  ib_id: string;
  status: string;
  assigned_to: string | null;
  created_at: string;
  taken_at: string | null;
  completed_at: string | null;
  notes: string | null;
  type: "deal" | "solicitud" | "ib_externo";
  // Deal fields
  ibs: {
    nombre_ib: string;
    nombre_bd: string;
    correo_ib: string;
    modelo_negocio: string;
    lugar_operacion: string;
    status: string;
  } | null;
  // Solicitud fields
  description?: string;
  created_by?: string;
  taken_by?: string | null;
  // IB externo fields
  request_type?: string;
  sub_ib_nombre?: string;
  sub_ib_correo?: string;
  sub_ib_tipo_id?: string;
  sub_ib_id_documento?: string;
  requested_by?: string;
  compensation_data?: any;
  attachments?: any;
}

interface OpsUser {
  id: string;
  nombre: string;
  correo: string;
}

const OPS_QUEUE_STATUSES = ["submitted", "nuevo", "en_proceso", "configurado", "rechazado"];
const OPS_STATUS_OPTIONS = DEAL_STATUSES.filter((s) =>
  ["submitted", "en_proceso", "configurado", "rechazado"].includes(s.value)
);
const STORAGE_KEY = "bullfy:operaciones:queue-state";

const OpsQueue = () => {
  const { user, isAdmin, isAdminOperaciones, isOperaciones } = useAuth();
  const [persistedState, setPersistedState] = useSessionStorageState(STORAGE_KEY, {
    filter: "all",
    typeFilter: "all",
    notesDialog: { open: false, itemId: "", notesText: "" },
    assignDialog: { open: false, itemId: "", selectedUserId: "" },
    viewDialog: { open: false, ibId: "", opsQueueId: "", ibName: "" },
    bitacora: { open: false, itemId: "" },
    ibExternoDetail: { open: false, itemId: "" },
  });
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notesDialog, setNotesDialog] = useState<{ open: boolean; item: UnifiedItem | null }>({ open: false, item: null });
  const [notesText, setNotesText] = useState(persistedState.notesDialog.notesText);
  const [filter, setFilter] = useState<string>(persistedState.filter);
  const [typeFilter, setTypeFilter] = useState<string>(persistedState.typeFilter);
  const [opsUsers, setOpsUsers] = useState<OpsUser[]>([]);
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; item: UnifiedItem | null }>({ open: false, item: null });
  const [selectedUserId, setSelectedUserId] = useState<string>(persistedState.assignDialog.selectedUserId);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [viewDialog, setViewDialog] = useState<{ open: boolean; ibId: string; opsQueueId: string; ibName: string }>(persistedState.viewDialog);
  const [bitacoraItem, setBitacoraItem] = useState<UnifiedItem | null>(null);
  const [showBitacora, setShowBitacora] = useState(persistedState.bitacora.open);
  const [ibExternoDetail, setIbExternoDetail] = useState<UnifiedItem | null>(null);
  const [generatingAgreement, setGeneratingAgreement] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; item: UnifiedItem | null }>({ open: false, item: null });
  const [rejectReason, setRejectReason] = useState("");

  const fetchAll = async () => {
    setLoading(true);
    const [queueRes, reqRes, ibExtRes] = await Promise.all([
      supabase
        .from("ops_queue")
        .select("*, ibs(nombre_ib, nombre_bd, correo_ib, modelo_negocio, lugar_operacion, status)")
        .order("created_at", { ascending: false }),
      supabase
        .from("ops_requests")
        .select("*, ibs(nombre_ib, nombre_bd, correo_ib, modelo_negocio)")
        .order("created_at", { ascending: false }),
      supabase
        .from("ib_external_requests")
        .select("*, ibs(nombre_ib, nombre_bd, correo_ib, modelo_negocio, lugar_operacion, status)")
        .order("created_at", { ascending: false }),
    ]);

    const dealItems: UnifiedItem[] = ((queueRes.data as any[]) ?? []).map((d) => ({
      id: d.id,
      ib_id: d.ib_id,
      status: d.status === "nuevo" ? "submitted" : d.status,
      assigned_to: d.assigned_to,
      created_at: d.created_at,
      taken_at: d.taken_at,
      completed_at: d.completed_at,
      notes: d.notes,
      type: "deal" as const,
      ibs: d.ibs,
    }));

    const reqItems: UnifiedItem[] = ((reqRes.data as any[]) ?? []).map((r) => ({
      id: r.id,
      ib_id: r.ib_id,
      status: r.status,
      assigned_to: r.assigned_to,
      created_at: r.created_at,
      taken_at: r.taken_at,
      completed_at: r.completed_at,
      notes: r.notes,
      type: "solicitud" as const,
      ibs: r.ibs ? { ...r.ibs, correo_ib: r.ibs.correo_ib || "", lugar_operacion: "", status: r.status } : null,
      description: r.description,
      created_by: r.created_by,
      taken_by: r.taken_by,
    }));

    const ibExtStatusMap: Record<string, string> = {
      pendiente_bd: "submitted",
      aprobado_bd: "submitted",
      en_proceso_ops: "en_proceso",
      completado: "configurado",
      rechazado: "configurado",
    };

    const ibExtItems: UnifiedItem[] = ((ibExtRes.data as any[]) ?? []).map((r) => ({
      id: r.id,
      ib_id: r.ib_id,
      status: ibExtStatusMap[r.status] || r.status,
      assigned_to: r.ops_assigned_to,
      created_at: r.created_at,
      taken_at: r.ops_taken_at,
      completed_at: r.ops_completed_at,
      notes: r.notes,
      type: "ib_externo" as const,
      ibs: r.ibs,
      request_type: r.request_type,
      sub_ib_nombre: r.sub_ib_nombre,
      sub_ib_correo: r.sub_ib_correo,
      sub_ib_tipo_id: r.sub_ib_tipo_id,
      sub_ib_id_documento: r.sub_ib_id_documento,
      requested_by: r.requested_by,
      compensation_data: r.compensation_data,
      attachments: r.attachments,
      description: r.request_type === "sub_ib"
        ? `Nuevo Sub IB: ${r.sub_ib_nombre} — $${r.dolares_por_lote_sub_ib}/lote`
        : r.notes || (r.compensation_data as any)?.descripcion || `${r.request_type}: ${r.sub_ib_nombre}`,
    }));

    const combined = [...dealItems, ...reqItems, ...ibExtItems].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    setItems(combined);
    setLoading(false);
  };

  const fetchOpsUsers = async () => {
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["operaciones", "admin_operaciones"]);

    if (!roleData || roleData.length === 0) return;
    const userIds = [...new Set(roleData.map((r) => r.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("id, nombre, correo").in("id", userIds);

    if (profiles) {
      setOpsUsers(profiles as OpsUser[]);
      const map: Record<string, string> = {};
      profiles.forEach((p: any) => { map[p.id] = p.nombre; });
      setProfilesMap((prev) => ({ ...prev, ...map }));
    }
  };

  const fetchAllProfiles = async () => {
    const { data } = await supabase.from("profiles").select("id, nombre");
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((p: any) => { map[p.id] = p.nombre; });
      setProfilesMap((prev) => ({ ...prev, ...map }));
    }
  };

  useEffect(() => {
    fetchAll();
    fetchOpsUsers();
    fetchAllProfiles();
    const ch1 = supabase.channel("queue_unified_q").on("postgres_changes", { event: "*", schema: "public", table: "ops_queue" }, () => fetchAll()).subscribe();
    const ch2 = supabase.channel("queue_unified_r").on("postgres_changes", { event: "*", schema: "public", table: "ops_requests" }, () => fetchAll()).subscribe();
    const ch3 = supabase.channel("queue_unified_ibe").on("postgres_changes", { event: "*", schema: "public", table: "ib_external_requests" }, () => fetchAll()).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); supabase.removeChannel(ch3); };
  }, []);

  useEffect(() => {
    if (!items.length) return;

    if (persistedState.notesDialog.open && persistedState.notesDialog.itemId) {
      const item = items.find((entry) => entry.id === persistedState.notesDialog.itemId);
      if (item) {
        setNotesDialog({ open: true, item });
      }
    }

    if (persistedState.assignDialog.open && persistedState.assignDialog.itemId) {
      const item = items.find((entry) => entry.id === persistedState.assignDialog.itemId);
      if (item) {
        setAssignDialog({ open: true, item });
      }
    }

    if (persistedState.bitacora.open && persistedState.bitacora.itemId) {
      const item = items.find((entry) => entry.id === persistedState.bitacora.itemId);
      if (item) {
        setBitacoraItem(item);
        setShowBitacora(true);
      }
    }

    if (persistedState.ibExternoDetail.open && persistedState.ibExternoDetail.itemId) {
      const item = items.find((entry) => entry.id === persistedState.ibExternoDetail.itemId);
      if (item) {
        setIbExternoDetail(item);
      }
    }
  }, [items, persistedState.assignDialog.itemId, persistedState.assignDialog.open, persistedState.bitacora.itemId, persistedState.bitacora.open, persistedState.ibExternoDetail.itemId, persistedState.ibExternoDetail.open, persistedState.notesDialog.itemId, persistedState.notesDialog.open]);

  useEffect(() => {
    setPersistedState((prev) => ({
      ...prev,
      filter,
      typeFilter,
      notesDialog: {
        open: notesDialog.open,
        itemId: notesDialog.item?.id || "",
        notesText,
      },
      assignDialog: {
        open: assignDialog.open,
        itemId: assignDialog.item?.id || "",
        selectedUserId,
      },
      viewDialog,
      bitacora: {
        open: showBitacora,
        itemId: bitacoraItem?.id || "",
      },
      ibExternoDetail: {
        open: !!ibExternoDetail,
        itemId: ibExternoDetail?.id || "",
      },
    }));
  }, [assignDialog, bitacoraItem, filter, ibExternoDetail, notesDialog, notesText, selectedUserId, setPersistedState, showBitacora, typeFilter, viewDialog]);

  const getTableForItem = (item: UnifiedItem) => {
    if (item.type === "deal") return "ops_queue" as const;
    if (item.type === "ib_externo") return "ib_external_requests" as const;
    return "ops_requests" as const;
  };

  const getIbExtStatusFromOps = (opsStatus: string) => {
    if (opsStatus === "submitted" || opsStatus === "nuevo") return "aprobado_bd";
    if (opsStatus === "en_proceso") return "en_proceso_ops";
    if (opsStatus === "configurado") return "completado";
    return opsStatus;
  };

  const updateItemStatus = async (item: UnifiedItem, newStatus: string) => {
    // Intercept "rechazado" to show reject dialog
    if (newStatus === "rechazado") {
      setRejectDialog({ open: true, item });
      setRejectReason("");
      return;
    }

    if (item.type === "ib_externo") {
      const ibExtStatus = getIbExtStatusFromOps(newStatus);
      const updates: Record<string, any> = { status: ibExtStatus };
      if (!item.assigned_to) {
        updates.ops_assigned_to = user?.id;
        updates.ops_taken_at = new Date().toISOString();
      }
      if (newStatus === "configurado") {
        updates.ops_completed_at = new Date().toISOString();
      }
      const { error } = await supabase.from("ib_external_requests").update(updates as any).eq("id", item.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }

      if (newStatus === "configurado" && item.request_type === "sub_ib" && item.compensation_data) {
        const cd = item.compensation_data;
        const { error: subIbError } = await supabase.from("sub_ibs").insert({
          ib_id: item.ib_id,
          nombre: item.sub_ib_nombre || "",
          correo: item.sub_ib_correo || "",
          tipo_id: item.sub_ib_tipo_id || "",
          id_documento: item.sub_ib_id_documento || "",
          dolares_por_lote: cd.sub_ib_dolar_lote ?? 0,
          es_master_ib: false,
          parent_sub_ib_id: cd.parent_sub_ib_id || null,
        });
        if (subIbError) {
          toast({ title: "Advertencia", description: "Sub IB completado pero no se pudo registrar automáticamente: " + subIbError.message, variant: "destructive" });
        } else {
          toast({ title: "Sub IB registrado", description: `${item.sub_ib_nombre} fue agregado a la base de datos.` });
        }
      }

      const cfg = getStatusConfig(newStatus);
      toast({ title: "Actualizado", description: `Marcado como ${cfg.label}` });
      fetchAll();
      return;
    }

    const updates: Record<string, any> = { status: newStatus };
    if (!item.assigned_to) {
      updates.assigned_to = user?.id;
      updates.taken_at = new Date().toISOString();
      if (item.type === "solicitud") updates.taken_by = user?.id;
    }
    if (newStatus === "configurado") {
      updates.completed_at = new Date().toISOString();
    }

    const table = getTableForItem(item);
    const { error } = await supabase.from(table).update(updates as any).eq("id", item.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    if (item.type === "deal") {
      const { error: ibsError } = await supabase.from("ibs").update({ status: newStatus }).eq("id", item.ib_id);
      if (ibsError) {
        toast({ title: "Advertencia", description: "Falló sincronización con Deals: " + ibsError.message, variant: "destructive" });
      }
    }

    const cfg = getStatusConfig(newStatus);
    toast({ title: "Actualizado", description: `Marcado como ${cfg.label}` });
    fetchAll();
  };

  const handleReject = async () => {
    if (!rejectDialog.item || rejectReason.trim().length < 10) return;
    const item = rejectDialog.item;

    if (item.type === "ib_externo") {
      const updates: Record<string, any> = {
        status: "rechazado",
        bd_rejection_reason: rejectReason.trim(),
      };
      if (!item.assigned_to) {
        updates.ops_assigned_to = user?.id;
        updates.ops_taken_at = new Date().toISOString();
      }
      const { error } = await supabase.from("ib_external_requests").update(updates as any).eq("id", item.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Rechazado", description: `La solicitud fue rechazada.` });
        fetchAll();
      }
    } else {
      const table = getTableForItem(item);
      const updates: Record<string, any> = {
        status: "rechazado",
        rejection_reason: rejectReason.trim(),
      };
      if (!item.assigned_to) {
        updates.assigned_to = user?.id;
        updates.taken_at = new Date().toISOString();
        if (item.type === "solicitud") updates.taken_by = user?.id;
      }
      const { error } = await supabase.from(table).update(updates as any).eq("id", item.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        if (item.type === "deal") {
          await supabase.from("ibs").update({ status: "rechazado" }).eq("id", item.ib_id);
        }
        toast({ title: "Rechazado", description: `El ticket fue rechazado.` });
        fetchAll();
      }
    }

    setRejectDialog({ open: false, item: null });
    setRejectReason("");
  };

  const handleAssign = async () => {
    if (!selectedUserId || !assignDialog.item) return;
    const item = assignDialog.item;

    if (item.type === "ib_externo") {
      const { error } = await supabase.from("ib_external_requests").update({
        ops_assigned_to: selectedUserId,
        status: "en_proceso_ops",
        ops_taken_at: new Date().toISOString(),
      }).eq("id", item.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        const assignedName = profilesMap[selectedUserId] || "usuario";
        toast({ title: "Asignado", description: `Asignado a ${assignedName}` });
        fetchAll();
      }
      setAssignDialog({ open: false, item: null });
      setSelectedUserId("");
      return;
    }

    const table = getTableForItem(item);
    const updates: Record<string, any> = {
      assigned_to: selectedUserId,
      status: "en_proceso",
      taken_at: new Date().toISOString(),
    };
    if (item.type === "solicitud") updates.taken_by = selectedUserId;

    const { error } = await supabase.from(table).update(updates as any).eq("id", item.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      if (item.type === "deal") {
        await supabase.from("ibs").update({ status: "en_proceso" }).eq("id", item.ib_id);
      }
      const assignedName = profilesMap[selectedUserId] || "usuario";
      toast({ title: "Asignado", description: `Asignado a ${assignedName}` });
      fetchAll();
    }
    setAssignDialog({ open: false, item: null });
    setSelectedUserId("");
  };

  const handleSaveNotes = async () => {
    if (!notesDialog.item) return;
    const table = getTableForItem(notesDialog.item);
    const { error } = await supabase.from(table).update({ notes: notesText }).eq("id", notesDialog.item.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Notas guardadas" });
      fetchAll();
    }
    setNotesDialog({ open: false, item: null });
  };

  const formatTime = (from: string, to?: string | null) => {
    const start = new Date(from);
    const end = to ? new Date(to) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const statusBadge = (status: string) => {
    const cfg = getStatusConfig(status);
    const colorMap: Record<string, string> = {
      submitted: "bg-primary/20 text-primary border-primary/30",
      nuevo: "bg-primary/20 text-primary border-primary/30",
      en_proceso: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      configurado: "bg-accent/20 text-accent border-accent/30",
      rechazado: "bg-destructive/20 text-destructive border-destructive/30",
    };
    return <Badge className={colorMap[status] || ""}>{cfg.label}</Badge>;
  };

  const typeBadge = (type: "deal" | "solicitud" | "ib_externo", requestType?: string) => {
    if (type === "deal") {
      return <Badge variant="outline" className="text-xs gap-1 border-primary/30 text-primary"><Wrench className="w-3 h-3" />Deal</Badge>;
    }
    if (type === "ib_externo") {
      if (requestType === "sub_ib") {
        return <Badge variant="outline" className="text-xs gap-1 border-emerald-500/30 text-emerald-400"><UserPlus className="w-3 h-3" />Nuevo Sub IB</Badge>;
      }
      return <Badge variant="outline" className="text-xs gap-1 border-purple-500/30 text-purple-400"><FileText className="w-3 h-3" />Especial</Badge>;
    }
    return <Badge variant="outline" className="text-xs gap-1 border-amber-500/30 text-amber-400"><FileText className="w-3 h-3" />Solicitud</Badge>;
  };

  const canManage = isAdmin || isAdminOperaciones || isOperaciones;
  const canAssign = isAdminOperaciones || isAdmin;
  const canChangeStatusForItem = (item: UnifiedItem) => {
    if (isAdmin || isAdminOperaciones) return true;
    if (isOperaciones) {
      const assignee = item.type === "solicitud" ? (item.taken_by || item.assigned_to) : item.assigned_to;
      return assignee === user?.id;
    }
    return false;
  };

  const handleGenerateSubIBAgreement = async (item: UnifiedItem) => {
    if (!item.compensation_data || !item.sub_ib_nombre) return;
    setGeneratingAgreement(item.id);
    try {
      const [logo, masterFormData] = await Promise.all([
        getLogoBase64(),
        loadIBFormData(item.ib_id),
      ]);

      const subIB: SubIB = {
        nombre: item.sub_ib_nombre || "",
        correo: item.sub_ib_correo || "",
        tipo_id: item.sub_ib_tipo_id || "",
        id_documento: item.sub_ib_id_documento || "",
        es_master_ib: false,
        master_ib_numero: null,
        dolares_por_lote: item.compensation_data.sub_ib_dolar_lote ?? 0,
      };

      const subIBCompensation: SubIBCompensation = {
        dolares_por_lote: item.compensation_data.sub_ib_dolar_lote ?? 0,
        cpa_allocation: [],
        hybrid_lote: 0,
        hybrid_cpa_allocation: [],
        propfirm_comision: 0,
      };

      // Save report to DB
      const { data: reportData, error: reportError } = await supabase
        .from("reports")
        .insert({
          ib_id: item.ib_id,
          report_type: "agreement",
          nombre_bd: masterFormData.nombre_bd,
          nombre_ib: item.sub_ib_nombre || "",
          data: {
            ...masterFormData,
            _is_sub_ib: true,
            _sub_ib_agreement_for: item.sub_ib_nombre,
            _sub_ib_correo: item.sub_ib_correo,
            _parent_ib_name: masterFormData.nombre_ib,
            _parent_ib_correo: masterFormData.correo_ib,
            _sub_ib_dolares_lote: item.compensation_data.sub_ib_dolar_lote,
            _source: "ib_externo",
          } as any,
          report_number: "TEMP",
        })
        .select("id, report_number")
        .single();

      if (reportError) throw new Error(reportError.message);

      const doc = generateSubIBAgreementPDF(masterFormData, subIB, reportData.report_number, item.ib_id, logo, subIBCompensation);
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `IB_Agreement_SubIB_${(item.sub_ib_nombre || "").replace(/\s+/g, "_")}_${reportData.report_number}.pdf`;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      toast({ title: "📜 Agreement generado", description: `Agreement ${reportData.report_number} descargado.` });
    } catch (err: any) {
      toast({ title: "Error generando Agreement", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingAgreement(null);
    }
  };

  // Filter out completed and rejected items
  const workItems = items.filter((i) => i.status !== "configurado" && i.status !== "rechazado");
  const byType = typeFilter === "all" ? workItems : workItems.filter((i) => i.type === typeFilter);
  const filtered = filter === "all" ? byType : byType.filter((i) => i.status === filter || (filter === "submitted" && i.status === "nuevo"));

  const statusCounts = {
    all: byType.length,
    submitted: byType.filter((i) => i.status === "submitted" || i.status === "nuevo").length,
    en_proceso: byType.filter((i) => i.status === "en_proceso").length,
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 flex-wrap">
          {[
            { value: "all", label: "Todos" },
            { value: "deal", label: "Deals" },
            { value: "solicitud", label: "Solicitudes" },
            { value: "ib_externo", label: "IB Externo" },
          ].map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={typeFilter === f.value ? "default" : "outline"}
              onClick={() => setTypeFilter(f.value)}
              className={typeFilter === f.value ? "bg-gradient-gold text-primary-foreground" : ""}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { value: "all", label: "Todos", count: statusCounts.all },
            { value: "submitted", label: "Pendientes", count: statusCounts.submitted },
            { value: "en_proceso", label: "En Proceso", count: statusCounts.en_proceso },
          ].map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={filter === f.value ? "default" : "outline"}
              onClick={() => setFilter(f.value)}
            >
              {f.label} ({f.count})
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando cola de trabajo...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No hay elementos en la cola</p>
        </div>
      ) : (
        <div className="bg-gradient-card rounded-xl border border-border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-muted-foreground font-medium">Tipo</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">IB</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Detalle</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Estado</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Asignado a</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">T. Espera</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">T. Proceso</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={`${item.type}-${item.id}`} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="p-4">{typeBadge(item.type, item.request_type)}</td>
                    <td className="p-4">
                      <div>
                        <p className="text-foreground font-medium">
                          {item.type === "ib_externo" && item.requested_by
                            ? (profilesMap[item.requested_by] || item.ibs?.nombre_ib || "—")
                            : (item.ibs?.nombre_ib || "—")}
                        </p>
                        {/* Email del IB o Sub IB con botón copiar */}
                        {(() => {
                          const email = item.type === "ib_externo" ? (item.sub_ib_correo || item.ibs?.correo_ib) : item.ibs?.correo_ib;
                          if (!email) return null;
                          return (
                            <div className="flex items-center gap-1 mt-0.5">
                              <p className="text-xs text-muted-foreground truncate max-w-[160px]" title={email}>{email}</p>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(email);
                                  toast({ title: "Correo copiado", description: email });
                                }}
                                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                title="Copiar correo"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })()}
                        {item.type === "ib_externo" && (
                          <p className="text-xs text-muted-foreground">Línea: {item.ibs?.nombre_ib || "—"}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      {item.type === "deal" ? (
                        <div>
                          <p className="text-muted-foreground">{item.ibs?.nombre_bd || "—"}</p>
                          <p className="text-xs text-muted-foreground capitalize">{item.ibs?.modelo_negocio}</p>
                        </div>
                      ) : item.type === "ib_externo" ? (
                        <div>
                          <p className="text-muted-foreground text-sm max-w-[250px]">{item.description}</p>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm max-w-[200px] truncate" title={item.description}>{item.description}</p>
                      )}
                    </td>
                    <td className="p-4">
                      {canChangeStatusForItem(item) ? (
                        <Select value={item.status} onValueChange={(val) => updateItemStatus(item, val)}>
                          <SelectTrigger className="h-7 w-[140px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OPS_STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        statusBadge(item.status)
                      )}
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-muted-foreground">
                        {item.assigned_to ? (profilesMap[item.assigned_to] || "—") : "Sin asignar"}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-xs">{formatTime(item.created_at, item.taken_at)}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {item.taken_at ? (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-xs">{formatTime(item.taken_at, item.completed_at)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1.5 flex-wrap">
                        {/* Ver - only for deals */}
                        {item.type === "deal" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setViewDialog({ open: true, ibId: item.ib_id, opsQueueId: item.id, ibName: item.ibs?.nombre_ib || "IB" })}
                            className="text-primary hover:text-primary gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> Ver
                          </Button>
                        )}

                        {/* Ver detalle - IB externo */}
                        {item.type === "ib_externo" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setIbExternoDetail(item)}
                            className="text-primary hover:text-primary gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> Ver
                          </Button>
                        )}

                        {/* Bitácora - only for solicitudes */}
                        {item.type === "solicitud" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setBitacoraItem(item); setShowBitacora(true); }}
                            className="text-primary hover:text-primary gap-1"
                          >
                            <History className="w-3.5 h-3.5" /> Bitácora
                          </Button>
                        )}

                        {/* Notas - only ops/admin */}
                        {canManage && (
                        <Button
                          size="sm"
                          variant="ghost"
                           onClick={() => { setNotesDialog({ open: true, item }); setNotesText(item.notes || ""); }}
                          className="text-amber-400 hover:text-amber-300 gap-1"
                        >
                          <StickyNote className="w-3.5 h-3.5" />
                        </Button>
                        )}

                        {/* Tomar - only ops/admin */}
                        {canManage && (item.status === "submitted" || item.status === "nuevo") && !item.assigned_to && (
                          <Button size="sm" variant="ghost" onClick={() => updateItemStatus(item, "en_proceso")} className="text-sky-400 hover:text-sky-300 gap-1">
                            <Play className="w-3.5 h-3.5" /> Tomar
                          </Button>
                        )}

                        {/* Completar - only if assigned to current user (ops) or admin */}
                        {item.status === "en_proceso" && canChangeStatusForItem(item) && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => updateItemStatus(item, "configurado")} className="text-accent hover:text-accent gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Completar
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => updateItemStatus(item, "rechazado")} className="text-destructive hover:text-destructive gap-1">
                              <XCircle className="w-3.5 h-3.5" /> Rechazar
                            </Button>
                          </>
                        )}

                        {/* Agreement - for completed ib_externo sub_ib requests */}
                        {item.type === "ib_externo" && item.request_type === "sub_ib" && item.status === "configurado" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleGenerateSubIBAgreement(item)}
                            disabled={generatingAgreement === item.id}
                            className="text-primary hover:text-primary gap-1"
                          >
                            {generatingAgreement === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScrollText className="w-3.5 h-3.5" />}
                            Agreement
                          </Button>
                        )}


                        {canAssign && item.status !== "configurado" && (
                          <Button
                            size="sm"
                            variant="ghost"
                             onClick={() => { setAssignDialog({ open: true, item }); setSelectedUserId(""); }}
                            className="text-sky-400 hover:text-sky-300 gap-1"
                          >
                            <UserPlus className="w-3.5 h-3.5" /> {item.assigned_to ? "Reasignar" : "Asignar"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View Dialog (deals) */}
      <OpsViewDialog
        open={viewDialog.open}
          onOpenChange={(open) => setViewDialog((prev) => open ? prev : { open: false, ibId: "", opsQueueId: "", ibName: "" })}
        ibId={viewDialog.ibId}
        opsQueueId={viewDialog.opsQueueId}
        ibName={viewDialog.ibName}
        userId={user?.id}
      />

      {/* Bitácora Dialog (solicitudes) */}
      {bitacoraItem && (
        <OpsRequestBitacora
          open={showBitacora}
          onOpenChange={(open) => {
            setShowBitacora(open);
            if (!open) setBitacoraItem(null);
          }}
          request={{
            id: bitacoraItem.id,
            ib_id: bitacoraItem.ib_id,
            description: bitacoraItem.description || "",
            status: bitacoraItem.status,
            created_by: bitacoraItem.created_by || "",
            assigned_to: bitacoraItem.assigned_to,
            taken_by: bitacoraItem.taken_by || null,
            created_at: bitacoraItem.created_at,
            taken_at: bitacoraItem.taken_at,
            completed_at: bitacoraItem.completed_at,
            notes: bitacoraItem.notes,
            ibs: bitacoraItem.ibs ? { nombre_ib: bitacoraItem.ibs.nombre_ib, nombre_bd: bitacoraItem.ibs.nombre_bd, modelo_negocio: bitacoraItem.ibs.modelo_negocio } : null,
          }}
          profilesMap={new Map(Object.entries(profilesMap))}
          opsUsersMap={new Map(Object.entries(profilesMap))}
        />
      )}

      {/* IB Externo Detail Dialog */}
      {ibExternoDetail && (
        <IBExternoDetailDialog
          open={!!ibExternoDetail}
          onOpenChange={(open) => { if (!open) setIbExternoDetail(null); }}
          requestType={ibExternoDetail.request_type || "sub_ib"}
          subIbNombre={ibExternoDetail.sub_ib_nombre || ""}
          subIbCorreo={ibExternoDetail.sub_ib_correo}
          compensationData={ibExternoDetail.compensation_data || {}}
          notes={ibExternoDetail.notes}
          requesterName={ibExternoDetail.requested_by ? profilesMap[ibExternoDetail.requested_by] : undefined}
          ibId={ibExternoDetail.ib_id}
          attachments={Array.isArray(ibExternoDetail.attachments) ? ibExternoDetail.attachments : []}
        />
      )}

      {/* Assign Dialog */}
      <Dialog open={assignDialog.open} onOpenChange={(open) => setAssignDialog(open ? assignDialog : { open: false, item: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar {assignDialog.item?.type === "deal" ? "Deal" : assignDialog.item?.type === "ib_externo" ? "Solicitud IB Externo" : "Solicitud"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Selecciona el usuario de operaciones:</p>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar usuario..." />
              </SelectTrigger>
              <SelectContent>
                {opsUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nombre} ({u.correo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog({ open: false, item: null })}>Cancelar</Button>
            <Button onClick={handleAssign} disabled={!selectedUserId} className="bg-gradient-gold text-primary-foreground">Asignar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notes Dialog */}
      <Dialog open={notesDialog.open} onOpenChange={(open) => setNotesDialog(open ? notesDialog : { open: false, item: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notas — {notesDialog.item?.ibs?.nombre_ib}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="Agrega notas..."
            className="min-h-[120px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialog({ open: false, item: null })}>Cancelar</Button>
            <Button onClick={handleSaveNotes} className="bg-gradient-gold text-primary-foreground">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(open) => { if (!open) { setRejectDialog({ open: false, item: null }); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <XCircle className="w-5 h-5" /> Rechazar {rejectDialog.item?.type === "deal" ? "Deal" : rejectDialog.item?.type === "ib_externo" ? "Solicitud IB Externo" : "Solicitud"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Explica el motivo del rechazo. Esta nota será enviada al solicitante por correo y notificación.
            </p>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Escribe el motivo del rechazo (mínimo 10 caracteres)..."
              className="min-h-[120px] border-destructive/30 focus-visible:ring-destructive"
            />
            {rejectReason.length > 0 && rejectReason.trim().length < 10 && (
              <p className="text-xs text-destructive">Mínimo 10 caracteres ({rejectReason.trim().length}/10)</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialog({ open: false, item: null }); setRejectReason(""); }}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectReason.trim().length < 10}>
              <XCircle className="w-4 h-4 mr-1" /> Confirmar Rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OpsQueue;
