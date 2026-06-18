import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, User, Phone, Mail, Building2, Globe, Plus, ArrowRight } from "lucide-react";
import { toast } from "@/lib/toastUtils";
import { useAuth } from "@/hooks/useAuth";
import NewBDProspectDialog from "./NewBDProspectDialog";

const BDProspectKanban = () => {
  const qc = useQueryClient();
  const { user, isAdmin, isGlobalAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [filterBD, setFilterBD] = useState<string>("all");

  const { data: stages = [] } = useQuery({
    queryKey: ["lead-pipeline-stages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lead_pipeline_stages").select("*").order("display_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: prospects = [], isLoading } = useQuery({
    queryKey: ["bd-prospects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bd_prospects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // For admin filter: list of BD users who have prospects
  const { data: bdUsers = [] } = useQuery({
    queryKey: ["bd-prospect-users"],
    queryFn: async () => {
      const uniqueIds = [...new Set(prospects.map((p: any) => p.bd_user_id))];
      if (!uniqueIds.length) return [];
      const { data } = await supabase.from("profiles").select("id, nombre").in("id", uniqueIds);
      return data || [];
    },
    enabled: (isAdmin || isGlobalAdmin) && prospects.length > 0,
  });

  const moveStage = useMutation({
    mutationFn: async ({ prospectId, stageId }: { prospectId: string; stageId: string }) => {
      const { error } = await supabase.from("bd_prospects").update({ pipeline_stage_id: stageId }).eq("id", prospectId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bd-prospects"] });
      toast.success("Prospecto actualizado");
    },
  });

  const filtered = prospects.filter((p: any) => {
    if (search && !p.nombre?.toLowerCase().includes(search.toLowerCase()) && !p.correo?.toLowerCase().includes(search.toLowerCase())) return false;
    if ((isAdmin || isGlobalAdmin) && filterBD !== "all" && p.bd_user_id !== filterBD) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar prospectos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {(isAdmin || isGlobalAdmin) && bdUsers.length > 0 && (
          <Select value={filterBD} onValueChange={setFilterBD}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por BD" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los BDs</SelectItem>
              {bdUsers.map((u: any) => (
                <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Badge variant="secondary" className="text-xs">{filtered.length} prospectos</Badge>
        <Button size="sm" onClick={() => setShowNew(true)} className="gap-1 ml-auto">
          <Plus className="w-4 h-4" /> Nuevo Lead
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Cargando...</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage: any) => {
            const stageProspects = filtered.filter((p: any) => p.pipeline_stage_id === stage.id);
            const isDrop = dropTarget === stage.id;
            return (
              <div
                key={stage.id}
                className={`min-w-[280px] max-w-[300px] flex-shrink-0 rounded-lg transition-all duration-200 ${isDrop ? "ring-2 ring-primary bg-primary/5" : ""}`}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropTarget(stage.id); }}
                onDragLeave={() => setDropTarget(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropTarget(null);
                  const pid = e.dataTransfer.getData("text/plain");
                  if (pid && draggedId) {
                    const p = prospects.find((x: any) => x.id === pid);
                    if (p && p.pipeline_stage_id !== stage.id) {
                      moveStage.mutate({ prospectId: pid, stageId: stage.id });
                    }
                  }
                  setDraggedId(null);
                }}
              >
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                  <h3 className="text-sm font-semibold text-foreground">{stage.name}</h3>
                  <Badge variant="outline" className="text-xs ml-auto">{stageProspects.length}</Badge>
                </div>
                <div className="space-y-2 min-h-[100px]">
                  {stageProspects.map((prospect: any) => (
                    <Card
                      key={prospect.id}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData("text/plain", prospect.id); e.dataTransfer.effectAllowed = "move"; setDraggedId(prospect.id); }}
                      onDragEnd={() => { setDraggedId(null); setDropTarget(null); }}
                      className={`bg-card hover:bg-secondary/30 transition-all cursor-grab active:cursor-grabbing border-l-4 ${draggedId === prospect.id ? "opacity-40 scale-95" : ""}`}
                      style={{ borderLeftColor: stage.color, borderTopColor: "transparent", borderRightColor: "transparent", borderBottomColor: "transparent" }}
                    >
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground truncate">{prospect.nombre}</span>
                        </div>
                        {prospect.correo && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Mail className="w-3 h-3" /> {prospect.correo}
                          </div>
                        )}
                        {prospect.telefono && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3" /> {prospect.telefono}
                          </div>
                        )}
                        {prospect.empresa && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Building2 className="w-3 h-3" /> {prospect.empresa}
                          </div>
                        )}
                        {prospect.pais && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Globe className="w-3 h-3" /> {prospect.pais}
                          </div>
                        )}
                        {prospect.notas && (
                          <p className="text-xs text-muted-foreground line-clamp-2 italic">"{prospect.notas}"</p>
                        )}
                        {/* Stage move dropdown */}
                        <div className="flex items-center gap-1 pt-1">
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <Select onValueChange={(v) => moveStage.mutate({ prospectId: prospect.id, stageId: v })}>
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
                      </CardContent>
                    </Card>
                  ))}
                  {stageProspects.length === 0 && (
                    <div className={`text-center py-8 text-xs text-muted-foreground border border-dashed rounded-lg transition-colors ${isDrop ? "border-primary bg-primary/10" : "border-border"}`}>
                      {isDrop ? "Soltar aquí" : "Sin prospectos"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NewBDProspectDialog open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
};

export default BDProspectKanban;
