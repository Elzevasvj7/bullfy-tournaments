import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, User, Phone, Mail, ArrowRight, Activity, Radio } from "lucide-react";
import { toast } from "@/lib/toastUtils";
import LeadDetailDialog from "./LeadDetailDialog";
import CallButton from "./CallButton";
import WhatsAppButton from "./WhatsAppButton";
import TelegramButton from "./TelegramButton";
import { useAuth } from "@/hooks/useAuth";

// Only columns rendered by the card — avoids select("*") on a growing table.
const LEAD_COLUMNS =
  "id, nombre, correo, telefono, opportunity_score, stream_count, pipeline_stage_id, assigned_to, is_duplicate, is_registered_partner, duplicate_portal_ids, tags, partner_portal_id, source, bullfy_referral_link, created_at, partner_portals:partner_portal_id(id, display_name, nombre_portal)";

const LeadKanban = () => {
  const qc = useQueryClient();
  const { roles, user } = useAuth();
  const isAdminVentas = roles.includes("admin_ventas");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dropTargetStageId, setDropTargetStageId] = useState<string | null>(null);

  // Debounce search input → avoids re-rendering all cards on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: stages = [] } = useQuery({
    queryKey: ["lead-pipeline-stages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lead_pipeline_stages").select("*").order("display_order");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["stream-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stream_leads")
        .select(LEAD_COLUMNS)
        .order("opportunity_score", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
    staleTime: 30 * 1000,
  });

  // Realtime: patch local cache instead of refetching the entire table.
  // Debounce-invalidate as fallback (e.g. for deletes / stage moves we may miss).
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const scheduleRefetch = () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["stream-leads"] });
      }, 1500);
    };

    const channel = supabase
      .channel("stream_leads_kanban")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "stream_leads" },
        (payload: any) => {
          const next = payload.new;
          if (!next?.id) return scheduleRefetch();
          qc.setQueryData<any[]>(["stream-leads"], (old) => {
            if (!old) return old;
            const idx = old.findIndex((l) => l.id === next.id);
            if (idx === -1) return old;
            const merged = [...old];
            merged[idx] = { ...old[idx], ...next };
            return merged;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "stream_leads" },
        () => scheduleRefetch()
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "stream_leads" },
        (payload: any) => {
          const oldId = payload.old?.id;
          if (!oldId) return scheduleRefetch();
          qc.setQueryData<any[]>(["stream-leads"], (old) => old?.filter((l) => l.id !== oldId));
        }
      )
      .subscribe();

    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const { data: ventasUsers = [] } = useQuery({
    queryKey: ["ventas-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id").in("role", ["ventas", "admin_ventas"]);
      if (error) throw error;
      if (!data.length) return [];
      const ids = data.map((r: any) => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("id, nombre, correo").in("id", ids);
      return profiles || [];
    },
    enabled: isAdminVentas,
    staleTime: 5 * 60 * 1000,
  });

  const moveStage = useMutation({
    mutationFn: async ({ leadId, stageId }: { leadId: string; stageId: string }) => {
      const { error } = await supabase.from("stream_leads").update({ pipeline_stage_id: stageId }).eq("id", leadId);
      if (error) throw error;
      const stage = stages.find((s: any) => s.id === stageId);
      await supabase.from("lead_activities").insert({
        lead_id: leadId,
        performed_by: user?.id,
        activity_type: "stage_change",
        details: `Movido a ${stage?.name || "nueva etapa"}`,
      });
    },
    onSuccess: (_data, vars) => {
      // Local patch — realtime will reconcile if needed.
      qc.setQueryData<any[]>(["stream-leads"], (old) =>
        old?.map((l) => (l.id === vars.leadId ? { ...l, pipeline_stage_id: vars.stageId } : l))
      );
      toast.success("Lead actualizado");
    },
  });

  const assignLead = useMutation({
    mutationFn: async ({ leadId, userId }: { leadId: string; userId: string }) => {
      const { error } = await supabase.from("stream_leads").update({
        assigned_to: userId,
        assigned_by: user?.id,
        assigned_at: new Date().toISOString(),
      }).eq("id", leadId);
      if (error) throw error;
      const assignedUser = ventasUsers.find((u: any) => u.id === userId);
      await supabase.from("lead_activities").insert({
        lead_id: leadId,
        performed_by: user?.id,
        activity_type: "assigned",
        details: `Asignado a ${assignedUser?.nombre || "usuario"}`,
      });
    },
    onSuccess: (_data, vars) => {
      qc.setQueryData<any[]>(["stream-leads"], (old) =>
        old?.map((l) => (l.id === vars.leadId ? { ...l, assigned_to: vars.userId } : l))
      );
      toast.success("Lead asignado");
    },
  });

  // Memoize filter + group-by-stage so we don't recompute on every render.
  const leadsByStage = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? leads.filter((l: any) =>
          l.nombre?.toLowerCase().includes(q) || l.correo?.toLowerCase().includes(q)
        )
      : leads;
    const map = new Map<string, any[]>();
    for (const l of filtered) {
      const key = (l as any).pipeline_stage_id || "__none__";
      const arr = map.get(key);
      if (arr) arr.push(l);
      else map.set(key, [l]);
    }
    return { map, total: filtered.length };
  }, [leads, search]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    if (score >= 25) return "text-orange-500";
    return "text-muted-foreground";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar leads..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="secondary" className="text-xs">{leadsByStage.total} leads</Badge>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Cargando...</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage: any) => {
            const stageLeads = leadsByStage.map.get(stage.id) || [];
            const isDropTarget = dropTargetStageId === stage.id;
            return (
              <div
                key={stage.id}
                className={`min-w-[280px] max-w-[300px] flex-shrink-0 rounded-lg transition-all duration-200 ${isDropTarget ? "ring-2 ring-primary bg-primary/5" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDropTargetStageId(stage.id);
                }}
                onDragLeave={() => setDropTargetStageId(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropTargetStageId(null);
                  const leadId = e.dataTransfer.getData("text/plain");
                  if (leadId && draggedLeadId) {
                    const lead = leads.find((l: any) => l.id === leadId);
                    if (lead && (lead as any).pipeline_stage_id !== stage.id) {
                      moveStage.mutate({ leadId, stageId: stage.id });
                    }
                  }
                  setDraggedLeadId(null);
                }}
              >
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                  <h3 className="text-sm font-semibold text-foreground">{stage.name}</h3>
                  <Badge variant="outline" className="text-xs ml-auto">{stageLeads.length}</Badge>
                </div>
                <div className="space-y-2 min-h-[100px]">
                  {stageLeads.map((lead: any) => (
                    <Card
                      key={lead.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", lead.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDraggedLeadId(lead.id);
                      }}
                      onDragEnd={() => {
                        setDraggedLeadId(null);
                        setDropTargetStageId(null);
                      }}
                      className={`bg-card hover:bg-secondary/30 transition-all cursor-grab active:cursor-grabbing border-l-4 ${draggedLeadId === lead.id ? "opacity-40 scale-95" : ""}`}
                      style={{ borderLeftColor: stage.color, borderTopColor: "transparent", borderRightColor: "transparent", borderBottomColor: "transparent" }}
                      onClick={() => setSelectedLead(lead)}
                    >
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium text-foreground truncate">{lead.nombre}</span>
                          </div>
                          <span className={`text-xs font-bold ${getScoreColor(lead.opportunity_score)}`}>
                            {lead.opportunity_score}pts
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3" /> {lead.correo}
                        </div>
                        {lead.telefono && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3" /> {lead.telefono}
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Activity className="w-3 h-3" /> {lead.stream_count} streams
                          </div>
                          <div className="flex items-center gap-1">
                            <div onClick={(e) => e.stopPropagation()}>
                              <CallButton lead={lead} size="icon" variant="ghost" />
                            </div>
                            <div onClick={(e) => e.stopPropagation()}>
                              <WhatsAppButton lead={lead} size="icon" variant="ghost" />
                            </div>
                            <div onClick={(e) => e.stopPropagation()}>
                              <TelegramButton lead={lead} size="icon" variant="ghost" />
                            </div>
                            {lead.is_duplicate && (
                              <Badge className="text-[10px] bg-destructive text-destructive-foreground animate-pulse">⚠ DUPLICADO</Badge>
                            )}
                            {lead.is_registered_partner && (
                              <Badge variant="secondary" className="text-[10px]">Partner</Badge>
                            )}
                            {Array.isArray((lead as any).tags) && (lead as any).tags.map((t: string) => (
                              <Badge key={t} variant="outline" className="text-[10px] border-primary/40 text-primary">{t}</Badge>
                            ))}
                          </div>
                        </div>
                        {lead.partner_portals && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Radio className="w-3 h-3 text-primary" />
                            <span className="truncate">{(lead.partner_portals as any).display_name || (lead.partner_portals as any).nombre_portal}</span>
                          </div>
                        )}

                        {/* Stage move dropdown */}
                        <div className="flex items-center gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <Select onValueChange={(v) => moveStage.mutate({ leadId: lead.id, stageId: v })}>
                            <SelectTrigger className="h-7 text-xs flex-1">
                              <SelectValue placeholder="Mover a..." />
                            </SelectTrigger>
                            <SelectContent>
                              {stages.filter((s: any) => s.id !== stage.id).map((s: any) => (
                                <SelectItem key={s.id} value={s.id}>
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                    {s.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Assignment for admin_ventas */}
                        {isAdminVentas && (
                          <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                            <Select value={lead.assigned_to || ""} onValueChange={(v) => assignLead.mutate({ leadId: lead.id, userId: v })}>
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="Asignar a..." />
                              </SelectTrigger>
                              <SelectContent>
                                {ventasUsers.map((u: any) => (
                                  <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {stageLeads.length === 0 && (
                    <div className={`text-center py-8 text-xs text-muted-foreground border border-dashed rounded-lg transition-colors ${isDropTarget ? "border-primary bg-primary/10" : "border-border"}`}>
                      {isDropTarget ? "Soltar aquí" : "Sin leads"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedLead && (
        <LeadDetailDialog lead={selectedLead} open={!!selectedLead} onClose={() => setSelectedLead(null)} />
      )}
    </div>
  );
};

export default LeadKanban;
