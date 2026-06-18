import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/lib/toastUtils";
import { Plus, Trash2, Loader2, Edit, Eye, Users, CheckCircle, Calendar, Upload, X, GripVertical, Play, Square, AlertTriangle, CalendarPlus } from "lucide-react";
import { parseEmailList } from "@/lib/timezones";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  promo_code: string | null;
  benefits: string | null;
  status: string;
  created_at: string;
  created_by: string | null;
  notify_user_id: string | null;
}

interface VentasUser {
  id: string;
  nombre: string;
  correo: string;
}

interface CampaignTask {
  id: string;
  campaign_id: string;
  day_number: number;
  title: string;
  instruction: string;
  content_type: string;
  file_urls: string[];
  display_order: number;
}

interface IBAssignment {
  id: string;
  campaign_id: string;
  ib_id: string;
  assigned_at: string;
}

interface IBOption {
  id: string;
  nombre_ib: string;
  correo_ib: string;
  alias: string | null;
}

interface TaskCompletion {
  task_id: string;
  assignment_id: string;
  completed_at: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Borrador", color: "bg-muted text-muted-foreground" },
  active: { label: "Activa", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  completed: { label: "Completada", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  stopped: { label: "Detenida", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  archived: { label: "Archivada", color: "bg-muted text-muted-foreground" },
};

const CONTENT_TYPES = ["Historia", "Video", "Post", "Historia (interacción)", "Historia (video)", "Documento", "Otro"];

const MarketingCampaigns = () => {
  const { user, isGlobalAdmin, isMarketing } = useAuth();
  const canDelete = isGlobalAdmin || isMarketing;
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);
  const [trackingCampaign, setTrackingCampaign] = useState<Campaign | null>(null);

  // Create/Edit form
  const [form, setForm] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: "",
    promo_code: "",
    benefits: "",
    status: "draft",
    notify_user_id: "",
    recipient_mode: "all" as "all" | "manual",
    manual_recipients_text: "",
    reminder_hour: 9,
    operative_hours_start: 6,
    operative_hours_end: 21,
  });
  const [tasks, setTasks] = useState<Omit<CampaignTask, "id" | "campaign_id">[]>([]);
  const [saving, setSaving] = useState(false);

  // Assignment
  const [showAssign, setShowAssign] = useState<string | null>(null);
  const [allIBs, setAllIBs] = useState<IBOption[]>([]);
  const [assignments, setAssignments] = useState<IBAssignment[]>([]);
  const [selectedIBs, setSelectedIBs] = useState<string[]>([]);

  // Tracking
  const [trackingAssignments, setTrackingAssignments] = useState<(IBAssignment & { ib_name: string })[]>([]);
  const [trackingTasks, setTrackingTasks] = useState<CampaignTask[]>([]);
  const [trackingCompletions, setTrackingCompletions] = useState<TaskCompletion[]>([]);

  // Stop dialog
  const [showStopDialog, setShowStopDialog] = useState<Campaign | null>(null);
  const [stopReason, setStopReason] = useState("");
  const [stopping, setStopping] = useState(false);

  // Delete dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Ventas users for notify selector
  const [ventasUsers, setVentasUsers] = useState<VentasUser[]>([]);

  const fetchVentasUsers = async () => {
    const { data } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["ventas", "admin_ventas", "marketing"]);
    if (data && data.length > 0) {
      const userIds = data.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nombre, correo")
        .in("id", userIds);
      setVentasUsers((profiles as any[]) ?? []);
    }
  };

  useEffect(() => { fetchVentasUsers(); }, []);

  const fetchCampaigns = async () => {
    const { data } = await supabase.from("marketing_campaigns").select("*").order("created_at", { ascending: false });
    setCampaigns((data as any[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchCampaigns(); }, []);

  const openCreate = () => {
    setForm({
      name: "", description: "", start_date: "", end_date: "", promo_code: "", benefits: "",
      status: "draft", notify_user_id: "",
      recipient_mode: "all", manual_recipients_text: "",
      reminder_hour: 9, operative_hours_start: 6, operative_hours_end: 21,
    });
    setTasks([]);
    setEditCampaign(null);
    setShowCreate(true);
  };

  const openEdit = async (c: Campaign) => {
    const cAny = c as any;
    setForm({
      name: c.name,
      description: c.description || "",
      start_date: c.start_date,
      end_date: c.end_date,
      promo_code: c.promo_code || "",
      benefits: c.benefits || "",
      status: c.status,
      notify_user_id: c.notify_user_id || "",
      recipient_mode: (cAny.recipient_mode === "manual" ? "manual" : "all"),
      manual_recipients_text: Array.isArray(cAny.manual_recipients) ? cAny.manual_recipients.join("\n") : "",
      reminder_hour: typeof cAny.reminder_hour === "number" ? cAny.reminder_hour : 9,
      operative_hours_start: typeof cAny.operative_hours_start === "number" ? cAny.operative_hours_start : 6,
      operative_hours_end: typeof cAny.operative_hours_end === "number" ? cAny.operative_hours_end : 21,
    });
    const { data } = await supabase.from("campaign_tasks").select("*").eq("campaign_id", c.id).order("display_order");
    setTasks((data as any[])?.map(({ id, campaign_id, ...rest }) => rest) ?? []);
    setEditCampaign(c);
    setShowCreate(true);
  };

  const openDetail = async (c: Campaign) => {
    setDetailCampaign(c);
    const { data } = await supabase.from("campaign_tasks").select("*").eq("campaign_id", c.id).order("display_order");
    setTasks((data as any[])?.map(({ id, campaign_id, ...rest }) => rest) ?? []);
  };

  const addTask = () => {
    setTasks([...tasks, { day_number: 1, title: "", instruction: "", content_type: "Historia", file_urls: [], display_order: tasks.length }]);
  };

  const updateTask = (idx: number, field: string, value: any) => {
    setTasks(tasks.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  const removeTask = (idx: number) => {
    setTasks(tasks.filter((_, i) => i !== idx));
  };

  const handleFileUpload = async (idx: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
      const path = `campaigns/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("campaign-assets").upload(path, file);
      if (!error) {
        const { data: urlData } = supabase.storage.from("campaign-assets").getPublicUrl(path);
        uploaded.push(urlData.publicUrl);
      }
    }
    updateTask(idx, "file_urls", [...(tasks[idx].file_urls || []), ...uploaded]);
  };

  const removeFileUrl = (taskIdx: number, fileIdx: number) => {
    const updated = [...tasks[taskIdx].file_urls];
    updated.splice(fileIdx, 1);
    updateTask(taskIdx, "file_urls", updated);
  };

  const saveCampaign = async () => {
    if (!form.name || !form.start_date || !form.end_date) {
      toast.error("Nombre y fechas son obligatorios");
      return;
    }

    let manualEmails: string[] = [];
    if (form.recipient_mode === "manual") {
      const parsed = parseEmailList(form.manual_recipients_text);
      if (parsed.invalid.length > 0) {
        toast.error(`Correos inválidos: ${parsed.invalid.slice(0, 3).join(", ")}${parsed.invalid.length > 3 ? "..." : ""}`);
        return;
      }
      if (parsed.valid.length === 0) {
        toast.error("Agrega al menos un correo válido para modo manual");
        return;
      }
      manualEmails = parsed.valid;
    }

    setSaving(true);
    try {
      let campaignId = editCampaign?.id;

      const baseFields: any = {
        name: form.name,
        description: form.description || null,
        start_date: form.start_date,
        end_date: form.end_date,
        promo_code: form.promo_code || null,
        benefits: form.benefits || null,
        status: form.status,
        notify_user_id: form.notify_user_id || null,
        recipient_mode: form.recipient_mode,
        manual_recipients: form.recipient_mode === "manual" ? manualEmails : [],
        reminder_hour: form.reminder_hour,
        operative_hours_start: form.operative_hours_start,
        operative_hours_end: form.operative_hours_end,
      };

      if (editCampaign) {
        const { error } = await supabase.from("marketing_campaigns").update(baseFields).eq("id", editCampaign.id);
        if (error) throw error;
        // Delete old tasks and re-insert
        await supabase.from("campaign_tasks").delete().eq("campaign_id", editCampaign.id);
      } else {
        const { data, error } = await supabase.from("marketing_campaigns").insert({
          ...baseFields,
          created_by: user?.id,
        }).select("id").single();
        if (error) throw error;
        campaignId = data.id;
      }

      // Insert tasks
      if (tasks.length > 0 && campaignId) {
        const { error: tErr } = await supabase.from("campaign_tasks").insert(
          tasks.map((t, i) => ({ ...t, campaign_id: campaignId, display_order: i }))
        );
        if (tErr) throw tErr;
      }

      toast.success(editCampaign ? "Campaña actualizada" : "Campaña creada");
      setShowCreate(false);
      fetchCampaigns();
    } catch (err: any) {
      toast.error("Error: " + (err.message || "desconocido"));
    } finally {
      setSaving(false);
    }
  };

  // Assignments
  const openAssign = async (campaignId: string) => {
    setShowAssign(campaignId);
    const [ibsRes, assignRes] = await Promise.all([
      supabase.from("ibs").select("id, nombre_ib, correo_ib, alias").eq("status", "configurado"),
      supabase.from("campaign_ib_assignments").select("*").eq("campaign_id", campaignId),
    ]);
    setAllIBs((ibsRes.data as any[]) ?? []);
    setAssignments((assignRes.data as any[]) ?? []);
    setSelectedIBs((assignRes.data as any[])?.map((a) => a.ib_id) ?? []);
  };

  const toggleIB = (ibId: string) => {
    setSelectedIBs((prev) => prev.includes(ibId) ? prev.filter((id) => id !== ibId) : [...prev, ibId]);
  };

  const saveAssignments = async () => {
    if (!showAssign) return;
    setSaving(true);
    try {
      // Remove unselected
      const toRemove = assignments.filter((a) => !selectedIBs.includes(a.ib_id));
      for (const a of toRemove) {
        await supabase.from("campaign_ib_assignments").delete().eq("id", a.id);
      }
      // Add new
      const existingIBs = assignments.map((a) => a.ib_id);
      const toAdd = selectedIBs.filter((id) => !existingIBs.includes(id));
      if (toAdd.length > 0) {
        const { error } = await supabase.from("campaign_ib_assignments").insert(
          toAdd.map((ib_id) => ({ campaign_id: showAssign, ib_id, assigned_by: user?.id }))
        );
        if (error) throw error;

        // Send notification to assigned IBs
        try {
          await supabase.functions.invoke("send-campaign-notification", {
            body: { campaign_id: showAssign, ib_ids: toAdd, type: "assignment" },
          });
        } catch (e) {
          console.warn("Notification send failed:", e);
        }
      }
      toast.success("Asignaciones actualizadas");
      setShowAssign(null);
    } catch (err: any) {
      toast.error("Error: " + (err.message || "desconocido"));
    } finally {
      setSaving(false);
    }
  };

  // Tracking
  const openTracking = async (c: Campaign) => {
    setTrackingCampaign(c);
    const [tasksRes, assignRes, completionsRes] = await Promise.all([
      supabase.from("campaign_tasks").select("*").eq("campaign_id", c.id).order("display_order"),
      supabase.from("campaign_ib_assignments").select("*").eq("campaign_id", c.id),
      supabase.from("campaign_task_completions").select("task_id, assignment_id, completed_at"),
    ]);
    setTrackingTasks((tasksRes.data as any[]) ?? []);
    const assignData = (assignRes.data as any[]) ?? [];

    // Fetch IB names
    const ibIds = assignData.map((a) => a.ib_id);
    let ibMap: Record<string, string> = {};
    if (ibIds.length > 0) {
      const { data: ibsData } = await supabase.from("ibs").select("id, nombre_ib, alias").in("id", ibIds);
      ibMap = Object.fromEntries((ibsData ?? []).map((ib: any) => [ib.id, ib.alias || ib.nombre_ib]));
    }

    setTrackingAssignments(assignData.map((a) => ({ ...a, ib_name: ibMap[a.ib_id] || "IB" })));

    // Filter completions for this campaign's tasks
    const taskIds = (tasksRes.data as any[])?.map((t) => t.id) ?? [];
    setTrackingCompletions(
      ((completionsRes.data as any[]) ?? []).filter((c) => taskIds.includes(c.task_id))
    );
  };

  const isTaskCompleted = (taskId: string, assignmentId: string) => {
    return trackingCompletions.some((c) => c.task_id === taskId && c.assignment_id === assignmentId);
  };

  const getCompletionDate = (taskId: string, assignmentId: string) => {
    const c = trackingCompletions.find((c) => c.task_id === taskId && c.assignment_id === assignmentId);
    return c ? format(new Date(c.completed_at), "dd MMM", { locale: es }) : null;
  };

  const activateCampaign = async (c: Campaign) => {
    try {
      const { error } = await supabase.from("marketing_campaigns").update({ status: "active" }).eq("id", c.id);
      if (error) throw error;

      // Get assigned IB ids and notify them
      const { data: assignData } = await supabase
        .from("campaign_ib_assignments")
        .select("ib_id")
        .eq("campaign_id", c.id);

      const ibIds = (assignData ?? []).map((a) => a.ib_id);

      if (ibIds.length > 0) {
        try {
          await supabase.functions.invoke("send-campaign-notification", {
            body: { campaign_id: c.id, ib_ids: ibIds, type: "activated" },
          });
        } catch (e) {
          console.warn("Notification send failed:", e);
        }
      }

      // Auto-disparar cronograma .ics a calendarios
      try {
        const { data: schedRes } = await supabase.functions.invoke("notify-campaign-schedule", {
          body: { campaignId: c.id },
        });
        if (schedRes?.ok && schedRes?.sent > 0) {
          toast.success(`Cronograma enviado a ${schedRes.sent} destinatario(s)`);
        }
      } catch (e) {
        console.warn("Calendar schedule send failed:", e);
      }

      toast.success("Campaña activada y IBs notificados");
      fetchCampaigns();
    } catch (err: any) {
      toast.error("Error: " + (err.message || "desconocido"));
    }
  };

  const resendSchedule = async (c: Campaign) => {
    try {
      toast.info("Enviando cronograma a calendarios…");
      const { data, error } = await supabase.functions.invoke("notify-campaign-schedule", {
        body: { campaignId: c.id },
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success(`Cronograma enviado: ${data.sent ?? 0} correo(s) a ${data.recipients ?? 0} destinatario(s)`);
      } else {
        toast.error(`Error: ${data?.error || "desconocido"}`);
      }
    } catch (err: any) {
      toast.error("Error: " + (err.message || "desconocido"));
    }
  };

  const stopCampaign = async () => {
    if (!showStopDialog || !stopReason.trim()) {
      toast.error("Debes ingresar un motivo para detener la campaña");
      return;
    }
    setStopping(true);
    try {
      const { error } = await supabase.from("marketing_campaigns").update({
        status: "stopped",
        stop_reason: stopReason.trim(),
      }).eq("id", showStopDialog.id);
      if (error) throw error;

      // Get assigned IB ids
      const { data: assignData } = await supabase
        .from("campaign_ib_assignments")
        .select("ib_id")
        .eq("campaign_id", showStopDialog.id);

      const ibIds = (assignData ?? []).map((a) => a.ib_id);

      if (ibIds.length > 0) {
        try {
          await supabase.functions.invoke("send-campaign-notification", {
            body: { campaign_id: showStopDialog.id, ib_ids: ibIds, type: "stopped", stop_reason: stopReason.trim() },
          });
        } catch (e) {
          console.warn("Notification send failed:", e);
        }
      }

      toast.success("Campaña detenida y IBs notificados");
      setShowStopDialog(null);
      setStopReason("");
      fetchCampaigns();
    } catch (err: any) {
      toast.error("Error: " + (err.message || "desconocido"));
    } finally {
      setStopping(false);
    }
  };

  const getIBProgress = (assignmentId: string) => {
    const completed = trackingCompletions.filter((c) => c.assignment_id === assignmentId).length;
    return { completed, total: trackingTasks.length, pct: trackingTasks.length > 0 ? Math.round((completed / trackingTasks.length) * 100) : 0 };
  };

  const deleteCampaign = async () => {
    if (!showDeleteDialog) return;
    if (!canDelete) {
      toast.error("No tienes permisos para eliminar campañas");
      return;
    }
    setDeleting(true);
    try {
      const campaignId = showDeleteDialog.id;
      // Delete dependents first (in case FKs lack cascade)
      await supabase.from("campaign_task_completions").delete().in(
        "task_id",
        (await supabase.from("campaign_tasks").select("id").eq("campaign_id", campaignId)).data?.map((t: any) => t.id) ?? []
      );
      await supabase.from("campaign_tasks").delete().eq("campaign_id", campaignId);
      await supabase.from("campaign_ib_assignments").delete().eq("campaign_id", campaignId);
      const { error } = await supabase.from("marketing_campaigns").delete().eq("id", campaignId);
      if (error) throw error;
      toast.success("Campaña eliminada");
      setShowDeleteDialog(null);
      fetchCampaigns();
    } catch (err: any) {
      toast.error("Error: " + (err.message || "desconocido"));
    } finally {
      setDeleting(false);
    }
  };


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Campañas para IBs</h3>
        <Button onClick={openCreate} className="gap-2" size="sm">
          <Plus className="w-4 h-4" /> Nueva Campaña
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : campaigns.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No hay campañas creadas aún.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const st = STATUS_LABELS[c.status] || STATUS_LABELS.draft;
            return (
              <Card key={c.id}>
                <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-foreground">{c.name}</h4>
                      <Badge variant="outline" className={st.color}>{st.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(c.start_date), "dd MMM yyyy", { locale: es })} → {format(new Date(c.end_date), "dd MMM yyyy", { locale: es })}
                      {c.promo_code && <span className="ml-2">· Código: <strong>{c.promo_code}</strong></span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 flex-wrap">
                    {c.status === "draft" && (
                      <Button variant="default" size="sm" onClick={() => activateCampaign(c)} className="gap-1 text-xs bg-green-600 hover:bg-green-700">
                        <Play className="w-3.5 h-3.5" />Activar
                      </Button>
                    )}
                    {c.status === "active" && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => resendSchedule(c)} className="gap-1 text-xs">
                          <CalendarPlus className="w-3.5 h-3.5" />Reenviar cronograma
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => { setShowStopDialog(c); setStopReason(""); }} className="gap-1 text-xs">
                          <Square className="w-3.5 h-3.5" />Detener
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => openDetail(c)} className="gap-1 text-xs"><Eye className="w-3.5 h-3.5" />Ver</Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)} className="gap-1 text-xs"><Edit className="w-3.5 h-3.5" />Editar</Button>
                    <Button variant="ghost" size="sm" onClick={() => openAssign(c.id)} className="gap-1 text-xs"><Users className="w-3.5 h-3.5" />Asignar</Button>
                    <Button variant="ghost" size="sm" onClick={() => openTracking(c)} className="gap-1 text-xs"><CheckCircle className="w-3.5 h-3.5" />Seguimiento</Button>
                    {canDelete && (
                      <Button variant="ghost" size="sm" onClick={() => setShowDeleteDialog(c)} className="gap-1 text-xs text-destructive hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />Eliminar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editCampaign ? "Editar Campaña" : "Nueva Campaña"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Dakar Experience" />
              </div>
              <div className="space-y-2">
                <Label>Código Promocional</Label>
                <Input value={form.promo_code} onChange={(e) => setForm({ ...form, promo_code: e.target.value })} placeholder="DAKAR[TUNOMBRE]" />
              </div>
              <div className="space-y-2">
                <Label>Fecha Inicio *</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Fecha Fin *</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Descripción</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Beneficios</Label>
                <Textarea value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} rows={2} placeholder="Comisiones, premios, etc." />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Borrador</SelectItem>
                    <SelectItem value="active">Activa</SelectItem>
                    <SelectItem value="completed">Completada</SelectItem>
                    <SelectItem value="stopped">Detenida</SelectItem>
                    <SelectItem value="archived">Archivada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notificar a (Ventas / Marketing)</Label>
                <Select value={form.notify_user_id || "__none__"} onValueChange={(v) => setForm({ ...form, notify_user_id: v === "__none__" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Sin usuario adicional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Ninguno</SelectItem>
                    {ventasUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.nombre} ({u.correo})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Este usuario recibirá notificaciones junto al creador cuando un IB complete tareas</p>
              </div>
            </div>

            {/* Bloque: Cronograma .ics y destinatarios */}
            <div className="border-t border-border pt-4 space-y-4">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <CalendarPlus className="w-4 h-4" /> Cronograma por correo (.ics)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Hora del recordatorio (organizador)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={form.reminder_hour}
                    onChange={(e) => setForm({ ...form, reminder_hour: Math.min(23, Math.max(0, parseInt(e.target.value) || 0)) })}
                  />
                  <p className="text-[10px] text-muted-foreground">Default 9 (09:00)</p>
                </div>
                <div className="space-y-2">
                  <Label>Ventana operativa - inicio</Label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={form.operative_hours_start}
                    onChange={(e) => setForm({ ...form, operative_hours_start: Math.min(23, Math.max(0, parseInt(e.target.value) || 0)) })}
                  />
                  <p className="text-[10px] text-muted-foreground">Hora local mínima del receptor</p>
                </div>
                <div className="space-y-2">
                  <Label>Ventana operativa - fin</Label>
                  <Input
                    type="number"
                    min={1}
                    max={24}
                    value={form.operative_hours_end}
                    onChange={(e) => setForm({ ...form, operative_hours_end: Math.min(24, Math.max(1, parseInt(e.target.value) || 0)) })}
                  />
                  <p className="text-[10px] text-muted-foreground">Hora local máxima del receptor</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Destinatarios del cronograma</Label>
                <Select value={form.recipient_mode} onValueChange={(v: "all" | "manual") => setForm({ ...form, recipient_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los usuarios registrados (IBs asignados + Sub-IBs + BDs)</SelectItem>
                    <SelectItem value="manual">Lista manual de correos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.recipient_mode === "manual" && (
                <div className="space-y-2">
                  <Label>Correos (separados por coma, espacio o salto de línea)</Label>
                  <Textarea
                    rows={4}
                    value={form.manual_recipients_text}
                    onChange={(e) => setForm({ ...form, manual_recipients_text: e.target.value })}
                    placeholder="ana@ejemplo.com, juan@ejemplo.com&#10;maria@ejemplo.com"
                  />
                  {(() => {
                    const p = parseEmailList(form.manual_recipients_text);
                    return (
                      <p className="text-[11px] text-muted-foreground">
                        ✓ {p.valid.length} válido(s){p.invalid.length > 0 && <span className="text-destructive"> · ✗ {p.invalid.length} inválido(s)</span>}
                      </p>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Tareas ({tasks.length})
                </h4>
                <Button variant="outline" size="sm" onClick={addTask} className="gap-1">
                  <Plus className="w-3.5 h-3.5" /> Agregar Tarea
                </Button>
              </div>
              <div className="space-y-4">
                {tasks.map((task, idx) => (
                  <Card key={idx} className="border-dashed">
                    <CardContent className="py-3 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-mono text-muted-foreground mt-1">#{idx + 1}</span>
                        <Button variant="ghost" size="sm" onClick={() => removeTask(idx)} className="text-destructive h-7 w-7 p-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Día</Label>
                          <Input type="number" min={1} value={task.day_number} onChange={(e) => updateTask(idx, "day_number", parseInt(e.target.value) || 1)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Título</Label>
                          <Input value={task.title} onChange={(e) => updateTask(idx, "title", e.target.value)} placeholder="Banner Personalizado" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Tipo</Label>
                          <Select value={task.content_type} onValueChange={(v) => updateTask(idx, "content_type", v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {CONTENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Instrucción</Label>
                        <Textarea value={task.instruction} onChange={(e) => updateTask(idx, "instruction", e.target.value)} rows={2} placeholder="Publica el banner con tu foto" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Archivos / Artes</Label>
                        <div className="flex flex-wrap gap-2">
                          {(task.file_urls || []).map((url, fi) => (
                            <div key={fi} className="flex items-center gap-1 bg-secondary rounded px-2 py-1 text-xs">
                              <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[150px]">
                                {url.split("/").pop()}
                              </a>
                              <button onClick={() => removeFileUrl(idx, fi)} className="text-destructive hover:text-destructive/80"><X className="w-3 h-3" /></button>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            multiple
                            className="text-xs"
                            onChange={(e) => handleFileUpload(idx, e.target.files)}
                          />
                          <Input
                            placeholder="o pega URL externa"
                            className="text-xs"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const val = (e.target as HTMLInputElement).value.trim();
                                if (val) {
                                  updateTask(idx, "file_urls", [...(task.file_urls || []), val]);
                                  (e.target as HTMLInputElement).value = "";
                                }
                              }
                            }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button onClick={saveCampaign} disabled={saving} className="gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editCampaign ? "Actualizar" : "Crear Campaña"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailCampaign} onOpenChange={() => setDetailCampaign(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailCampaign?.name}</DialogTitle>
          </DialogHeader>
          {detailCampaign && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Fechas:</span> {format(new Date(detailCampaign.start_date), "dd MMM", { locale: es })} → {format(new Date(detailCampaign.end_date), "dd MMM", { locale: es })}</div>
                {detailCampaign.promo_code && <div><span className="text-muted-foreground">Código:</span> <strong>{detailCampaign.promo_code}</strong></div>}
              </div>
              {detailCampaign.description && <p className="text-sm text-muted-foreground">{detailCampaign.description}</p>}
              {detailCampaign.benefits && (
                <div className="bg-primary/5 rounded-lg p-3 text-sm">
                  <strong className="text-primary">Beneficios:</strong>
                  <p className="mt-1 text-foreground whitespace-pre-wrap">{detailCampaign.benefits}</p>
                </div>
              )}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Tareas ({tasks.length})</h4>
                {tasks.map((t, i) => (
                  <div key={i} className="border border-border rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">Día {t.day_number}</Badge>
                      <span className="font-medium text-sm">{t.title}</span>
                      <Badge variant="secondary" className="text-[10px]">{t.content_type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{t.instruction}</p>
                    {(t.file_urls || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {t.file_urls.map((url, fi) => (
                          <a key={fi} href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline bg-primary/5 px-2 py-0.5 rounded">
                            📎 {url.split("/").pop()?.substring(0, 30)}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign IBs Dialog */}
      <Dialog open={!!showAssign} onOpenChange={() => setShowAssign(null)}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Asignar IBs a Campaña</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{selectedIBs.length} de {allIBs.length} seleccionados</p>
              <Button variant="outline" size="sm" onClick={() => setSelectedIBs(selectedIBs.length === allIBs.length ? [] : allIBs.map((ib) => ib.id))}>
                {selectedIBs.length === allIBs.length ? "Deseleccionar Todos" : "Seleccionar Todos"}
              </Button>
            </div>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {allIBs.map((ib) => (
                <label key={ib.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary cursor-pointer">
                  <input type="checkbox" checked={selectedIBs.includes(ib.id)} onChange={() => toggleIB(ib.id)} className="rounded" />
                  <div>
                    <p className="text-sm font-medium">{ib.alias || ib.nombre_ib}</p>
                    <p className="text-xs text-muted-foreground">{ib.correo_ib}</p>
                  </div>
                </label>
              ))}
              {allIBs.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No hay IBs activos.</p>}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAssign(null)}>Cancelar</Button>
              <Button onClick={saveAssignments} disabled={saving} className="gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tracking Dialog */}
      <Dialog open={!!trackingCampaign} onOpenChange={() => setTrackingCampaign(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Seguimiento: {trackingCampaign?.name}</DialogTitle>
          </DialogHeader>
          {trackingAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay IBs asignados a esta campaña.</p>
          ) : (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {trackingAssignments.map((a) => {
                  const prog = getIBProgress(a.id);
                  return (
                    <Card key={a.id}>
                      <CardContent className="py-3 text-center">
                        <p className="text-sm font-medium truncate">{a.ib_name}</p>
                        <p className="text-2xl font-bold text-primary">{prog.pct}%</p>
                        <p className="text-[10px] text-muted-foreground">{prog.completed}/{prog.total} tareas</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Detail table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Tarea</TableHead>
                      <TableHead className="text-xs">Día</TableHead>
                      {trackingAssignments.map((a) => (
                        <TableHead key={a.id} className="text-xs text-center">{a.ib_name}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trackingTasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="text-xs font-medium">{task.title}</TableCell>
                        <TableCell className="text-xs">Día {task.day_number}</TableCell>
                        {trackingAssignments.map((a) => {
                          const done = isTaskCompleted(task.id, a.id);
                          const date = getCompletionDate(task.id, a.id);
                          return (
                            <TableCell key={a.id} className="text-center">
                              {done ? (
                                <div className="flex flex-col items-center">
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                  <span className="text-[9px] text-muted-foreground">{date}</span>
                                </div>
                              ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 mx-auto" />
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Stop Campaign Dialog */}
      <Dialog open={!!showStopDialog} onOpenChange={() => setShowStopDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Detener Campaña
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Estás a punto de detener la campaña <strong>{showStopDialog?.name}</strong>. Todos los IBs asignados serán notificados por correo, notificación y push.
            </p>
            <div className="space-y-2">
              <Label>Motivo de detención *</Label>
              <Textarea
                value={stopReason}
                onChange={(e) => setStopReason(e.target.value)}
                rows={3}
                placeholder="Ej: Campaña finalizada exitosamente, cambio de estrategia, etc."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowStopDialog(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={stopCampaign} disabled={stopping || !stopReason.trim()} className="gap-2">
                {stopping && <Loader2 className="w-4 h-4 animate-spin" />}
                <Square className="w-4 h-4" /> Detener y Notificar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!showDeleteDialog} onOpenChange={(o) => !o && setShowDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar campaña?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la campaña <strong>{showDeleteDialog?.name}</strong>, junto con sus tareas, asignaciones y registros de cumplimiento. Esta operación no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); deleteCampaign(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MarketingCampaigns;
