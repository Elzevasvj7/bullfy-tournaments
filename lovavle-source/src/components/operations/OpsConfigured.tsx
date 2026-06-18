import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Eye, StickyNote, CheckCircle, ScrollText, Loader2, Search, Timer, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import IBExternoDetailDialog from "./IBExternoDetailDialog";
import { getStatusConfig } from "@/lib/dealStatuses";
import OpsViewDialog from "./OpsViewDialog";
import { generateSubIBAgreementPDF, type SubIBCompensation } from "@/services/generateAgreement";
import { getLogoBase64 } from "@/services/pdfLogoHelper";
import { loadIBFormData } from "@/services/loadIBFormData";
import type { SubIB } from "@/stores/onboardingStore";
import { useSessionStorageState } from "@/hooks/useSessionStorageState";

interface CompletedItem {
  id: string;
  ib_id: string;
  source: "ops_queue" | "ops_requests" | "ib_external_requests";
  status: string;
  assigned_to: string | null;
  created_at: string | null;
  taken_at: string | null;
  completed_at: string | null;
  notes: string | null;
  ib_name: string;
  bd_name: string;
  correo_ib: string;
  modelo_negocio: string;
  description?: string;
  sub_ib_nombre?: string;
  sub_ib_correo?: string;
  sub_ib_tipo_id?: string;
  sub_ib_id_documento?: string;
  requested_by?: string;
  request_type?: string;
  compensation_data?: any;
  attachments?: any;
}

const formatDuration = (ms: number | null): string => {
  if (ms === null || isNaN(ms) || ms < 0) return "—";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "<1m";
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days >= 1) return `${days}d ${hours % 24}h`;
  if (hours >= 1) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
};

const durationColor = (ms: number | null): string => {
  if (ms === null || isNaN(ms) || ms < 0) return "text-muted-foreground/50";
  const hours = ms / 3600000;
  if (hours < 1) return "text-emerald-400";
  if (hours < 24) return "text-amber-400";
  return "text-destructive";
};

const STORAGE_KEY = "bullfy:operaciones:configured-state";

const OpsConfigured = () => {
  const { user, isAdmin, isAdminOperaciones, isOperaciones } = useAuth();
  const [persistedState, setPersistedState] = useSessionStorageState(STORAGE_KEY, {
    notesDialog: { open: false, itemId: "", source: "", notes: "", notesText: "" },
    viewDialog: { open: false, ibId: "", opsQueueId: "", ibName: "" },
  });
  const [items, setItems] = useState<CompletedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [notesDialog, setNotesDialog] = useState<{ open: boolean; itemId: string; source: string; notes: string }>(persistedState.notesDialog);
  const [notesText, setNotesText] = useState(persistedState.notesDialog.notesText);
  const [viewDialog, setViewDialog] = useState<{ open: boolean; ibId: string; opsQueueId: string; ibName: string }>(persistedState.viewDialog);
  const [generatingAgreement, setGeneratingAgreement] = useState<string | null>(null);
  const [ibExternoDialog, setIbExternoDialog] = useState<{ open: boolean; item: CompletedItem | null }>({ open: false, item: null });
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const filteredItems = items.filter((it) => {
    const q = search.trim().toLowerCase();
    if (q && !it.ib_name.toLowerCase().includes(q) && !it.bd_name.toLowerCase().includes(q)) return false;
    if (dateFrom || dateTo) {
      if (!it.created_at) return false;
      const t = new Date(it.created_at).getTime();
      if (dateFrom && t < new Date(dateFrom + "T00:00:00").getTime()) return false;
      if (dateTo && t > new Date(dateTo + "T23:59:59").getTime()) return false;
    }
    return true;
  });

  const fetchItems = async () => {
    setLoading(true);

    const [queueRes, reqRes, ibExtRes, allProfilesRes] = await Promise.all([
      supabase
        .from("ops_queue")
        .select("*, ibs(nombre_ib, nombre_bd, correo_ib, modelo_negocio)")
        .eq("status", "configurado")
        .order("completed_at", { ascending: false }),
      supabase
        .from("ops_requests")
        .select("*, ibs(nombre_ib, nombre_bd, correo_ib, modelo_negocio)")
        .eq("status", "configurado")
        .order("completed_at", { ascending: false }),
      supabase
        .from("ib_external_requests")
        .select("*, ibs(nombre_ib, nombre_bd, correo_ib, modelo_negocio)")
        .in("status", ["completado", "rechazado"])
        .order("ops_completed_at", { ascending: false }),
      supabase.from("profiles").select("id, nombre"),
    ]);

    // Build profiles map from all profiles
    const allPMap: Record<string, string> = {};
    if (allProfilesRes.data) {
      allProfilesRes.data.forEach((p: any) => { allPMap[p.id] = p.nombre; });
      setProfilesMap(allPMap);
    }

    const merged: CompletedItem[] = [];

    if (queueRes.data) {
      for (const q of queueRes.data) {
        merged.push({
          id: q.id,
          ib_id: q.ib_id,
          source: "ops_queue",
          status: q.status,
          assigned_to: q.assigned_to,
          created_at: q.created_at,
          taken_at: q.taken_at,
          completed_at: q.completed_at,
          notes: q.notes,
          ib_name: (q.ibs as any)?.nombre_ib || "—",
          bd_name: (q.ibs as any)?.nombre_bd || "—",
          correo_ib: (q.ibs as any)?.correo_ib || "",
          modelo_negocio: (q.ibs as any)?.modelo_negocio || "—",
        });
      }
    }

    if (reqRes.data) {
      for (const r of reqRes.data) {
        merged.push({
          id: r.id,
          ib_id: r.ib_id,
          source: "ops_requests",
          status: r.status,
          assigned_to: r.taken_by || r.assigned_to,
          created_at: r.created_at,
          taken_at: r.taken_at,
          completed_at: r.completed_at,
          notes: r.notes,
          ib_name: (r.ibs as any)?.nombre_ib || "—",
          bd_name: (r.ibs as any)?.nombre_bd || "—",
          correo_ib: (r.ibs as any)?.correo_ib || "",
          modelo_negocio: (r.ibs as any)?.modelo_negocio || "—",
          description: r.description,
        });
      }
    }

    if (ibExtRes.data) {
      for (const e of ibExtRes.data) {
        merged.push({
          id: e.id,
          ib_id: e.ib_id,
          source: "ib_external_requests",
          status: e.status,
          assigned_to: e.ops_assigned_to,
          created_at: e.created_at,
          taken_at: e.ops_taken_at,
          completed_at: e.ops_completed_at,
          notes: e.notes,
          ib_name: (e.ibs as any)?.nombre_ib || "—",
          bd_name: (e.ibs as any)?.nombre_bd || "—",
          correo_ib: (e.ibs as any)?.correo_ib || "",
          modelo_negocio: (e.ibs as any)?.modelo_negocio || "—",
          sub_ib_nombre: e.sub_ib_nombre,
          sub_ib_correo: e.sub_ib_correo,
          sub_ib_tipo_id: e.sub_ib_tipo_id,
          sub_ib_id_documento: e.sub_ib_id_documento,
          requested_by: e.requested_by,
          request_type: e.request_type,
          compensation_data: e.compensation_data,
          attachments: e.attachments,
        });
      }
    }

    // Sort by completed_at desc
    merged.sort((a, b) => {
      const da = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const db = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      return db - da;
    });

    setItems(merged);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
    const ch1 = supabase.channel("ops_configured_q").on("postgres_changes", { event: "*", schema: "public", table: "ops_queue" }, () => fetchItems()).subscribe();
    const ch2 = supabase.channel("ops_configured_r").on("postgres_changes", { event: "*", schema: "public", table: "ops_requests" }, () => fetchItems()).subscribe();
    const ch3 = supabase.channel("ops_configured_e").on("postgres_changes", { event: "*", schema: "public", table: "ib_external_requests" }, () => fetchItems()).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); supabase.removeChannel(ch3); };
  }, []);

  useEffect(() => {
    if (!items.length) return;

    if (persistedState.notesDialog.open && persistedState.notesDialog.itemId) {
      const item = items.find((entry) => entry.id === persistedState.notesDialog.itemId && entry.source === persistedState.notesDialog.source);
      if (item) {
        setNotesDialog({
          open: true,
          itemId: item.id,
          source: item.source,
          notes: item.notes || "",
        });
      }
    }

    if (persistedState.viewDialog.open && persistedState.viewDialog.ibId && persistedState.viewDialog.opsQueueId) {
      setViewDialog(persistedState.viewDialog);
    }
  }, [items, persistedState.notesDialog.itemId, persistedState.notesDialog.open, persistedState.notesDialog.source, persistedState.viewDialog]);

  useEffect(() => {
    setPersistedState({
      notesDialog: {
        open: notesDialog.open,
        itemId: notesDialog.itemId,
        source: notesDialog.source,
        notes: notesDialog.notes,
        notesText,
      },
      viewDialog,
    });
  }, [notesDialog, notesText, setPersistedState, viewDialog]);

  const handleSaveNotes = async () => {
    const table = notesDialog.source === "ops_queue" ? "ops_queue"
      : notesDialog.source === "ops_requests" ? "ops_requests"
      : "ib_external_requests";
    const { error } = await supabase.from(table).update({ notes: notesText }).eq("id", notesDialog.itemId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Notas guardadas" });
      fetchItems();
    }
    setNotesDialog({ open: false, itemId: "", source: "", notes: "" });
  };

  const sourceLabel = (source: string) => {
    if (source === "ops_queue") return "Deal";
    if (source === "ops_requests") return "Solicitud";
    return "IB Externo";
  };

  const statusBadge = (item: CompletedItem) => {
    const label = item.status === "completado" ? "Completado"
      : item.status === "rechazado" ? "Rechazado"
      : getStatusConfig(item.status).label;
    const isRejected = item.status === "rechazado";
    return (
      <Badge className={isRejected
        ? "bg-destructive/20 text-destructive border-destructive/30"
        : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"}>
        <CheckCircle className="w-3 h-3 mr-1" />{label}
      </Badge>
    );
  };

  const handleGenerateSubIBAgreement = async (item: CompletedItem) => {
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por IB o BD..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Desde (ingreso)</label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[170px]" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Hasta (ingreso)</label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[170px]" />
        </div>
        {(dateFrom || dateTo || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); }}>
            Limpiar
          </Button>
        )}
      </div>
      {loading ? (
        <p className="text-muted-foreground">Cargando tickets completados...</p>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>{items.length === 0 ? "No hay tickets completados" : "Sin resultados para esa búsqueda"}</p>
          {items.length === 0 && <p className="text-xs mt-1">Los tickets aparecerán aquí cuando se completen en la Cola de trabajo</p>}
        </div>
      ) : (
        <div className="bg-gradient-card rounded-xl border border-border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-muted-foreground font-medium">Tipo</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">IB</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">BD</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Detalle</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Estado</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Completado por</th>
                  <th className="text-left p-4 text-muted-foreground font-medium"><span className="inline-flex items-center gap-1"><Timer className="w-3.5 h-3.5" />T. en tomar</span></th>
                  <th className="text-left p-4 text-muted-foreground font-medium"><span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />T. en resolver</span></th>
                  <th className="text-left p-4 text-muted-foreground font-medium">F. Ingreso</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">F. Resolución</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const takeMs = item.taken_at && item.created_at ? new Date(item.taken_at).getTime() - new Date(item.created_at).getTime() : null;
                  const resolveMs = item.completed_at && item.taken_at ? new Date(item.completed_at).getTime() - new Date(item.taken_at).getTime() : null;
                  return (
                  <tr key={`${item.source}-${item.id}`} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="p-4">
                      <Badge variant="outline" className="text-xs">{sourceLabel(item.source)}</Badge>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="text-foreground font-medium">
                          {item.source === "ib_external_requests" && item.requested_by
                            ? (profilesMap[item.requested_by] || item.ib_name)
                            : item.ib_name}
                        </p>
                        {item.source !== "ib_external_requests" && (
                          <p className="text-xs text-muted-foreground">{item.correo_ib}</p>
                        )}
                        {item.source === "ib_external_requests" && (
                          <p className="text-xs text-muted-foreground">Línea: {item.ib_name}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground">{item.bd_name}</td>
                    <td className="p-4 text-muted-foreground text-xs max-w-[200px] truncate">
                      {item.sub_ib_nombre
                        ? `Sub IB: ${item.sub_ib_nombre}`
                        : item.description
                        ? item.description
                        : item.modelo_negocio}
                    </td>
                    <td className="p-4">{statusBadge(item)}</td>
                    <td className="p-4">
                      <span className="text-sm text-muted-foreground">
                        {item.assigned_to ? (profilesMap[item.assigned_to] || "—") : "—"}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs font-medium ${durationColor(takeMs)}`}>{formatDuration(takeMs)}</span>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs font-medium ${durationColor(resolveMs)}`}>{formatDuration(resolveMs)}</span>
                    </td>
                    <td className="p-4">
                      {item.created_at ? (
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      {item.completed_at ? (
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.completed_at).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1.5 flex-wrap">
                        {item.source === "ops_queue" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setViewDialog({ open: true, ibId: item.ib_id, opsQueueId: item.id, ibName: item.ib_name })}
                            className="text-primary hover:text-primary gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> Ver
                          </Button>
                        )}
                        {item.source === "ib_external_requests" && item.request_type === "sub_ib" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setIbExternoDialog({ open: true, item })}
                            className="text-primary hover:text-primary gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> Ver
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setNotesDialog({ open: true, itemId: item.id, source: item.source, notes: item.notes || "" }); setNotesText(item.notes || ""); }}
                          className="text-amber-400 hover:text-amber-300 gap-1"
                        >
                          <StickyNote className="w-3.5 h-3.5" /> Notas
                        </Button>
                        {/* Agreement - for completed ib_externo sub_ib requests */}
                        {item.source === "ib_external_requests" && item.request_type === "sub_ib" && item.status === "completado" && (
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
                      </div>
                    </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <OpsViewDialog
        open={viewDialog.open}
         onOpenChange={(open) => setViewDialog(open ? viewDialog : { open: false, ibId: "", opsQueueId: "", ibName: "" })}
        ibId={viewDialog.ibId}
        opsQueueId={viewDialog.opsQueueId}
        ibName={viewDialog.ibName}
        userId={user?.id}
      />

      <Dialog open={notesDialog.open} onOpenChange={(open) => setNotesDialog(open ? notesDialog : { open: false, itemId: "", source: "", notes: "" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notas de operación</DialogTitle>
          </DialogHeader>
          <Textarea
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="Agrega notas sobre la configuración..."
            className="min-h-[120px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialog({ open: false, itemId: "", source: "", notes: "" })}>Cancelar</Button>
            <Button onClick={handleSaveNotes} className="bg-gradient-gold text-primary-foreground">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ibExternoDialog.item && (
        <IBExternoDetailDialog
          open={ibExternoDialog.open}
          onOpenChange={(open) => setIbExternoDialog(open ? ibExternoDialog : { open: false, item: null })}
          requestType={ibExternoDialog.item.request_type || "sub_ib"}
          subIbNombre={ibExternoDialog.item.sub_ib_nombre || ""}
          subIbCorreo={ibExternoDialog.item.sub_ib_correo}
          compensationData={ibExternoDialog.item.compensation_data || {}}
          notes={ibExternoDialog.item.notes}
          requesterName={ibExternoDialog.item.requested_by ? profilesMap[ibExternoDialog.item.requested_by] : undefined}
          ibId={ibExternoDialog.item.ib_id}
          attachments={Array.isArray((ibExternoDialog.item as any).attachments) ? (ibExternoDialog.item as any).attachments : []}
        />
      )}
    </div>
  );
};

export default OpsConfigured;
