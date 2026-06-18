import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { User, Mail, Phone, Activity, Calendar, MessageSquare, StickyNote, Clock, Trash2, MessageCircle, ExternalLink } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useState, lazy, Suspense } from "react";
import { toast } from "@/lib/toastUtils";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import CallButton from "./CallButton";
import WhatsAppButton from "./WhatsAppButton";
import TelegramButton from "./TelegramButton";
import CallHistory from "./CallHistory";

// Lazy-load heavy panels — each one fetches data + subscriptions on mount.
const WhatsAppChatPanel = lazy(() => import("./WhatsAppChatPanel"));
const StreamContextPanel = lazy(() => import("./StreamContextPanel"));
const KeywordAlertsPanel = lazy(() => import("./KeywordAlertsPanel"));

const PanelFallback = () => (
  <p className="text-xs text-muted-foreground py-2">Cargando…</p>
);

interface Props {
  lead: any;
  open: boolean;
  onClose: () => void;
}

const LeadDetailDialog = ({ lead, open, onClose }: Props) => {
  const qc = useQueryClient();
  const { user, profile, isGlobalAdmin } = useAuth();
  const [note, setNote] = useState("");

  const { data: activities = [] } = useQuery({
    queryKey: ["lead-activities", lead.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_activities")
        .select("*")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: open,
    staleTime: 30 * 1000,
  });

  const { data: participations = [] } = useQuery({
    queryKey: ["lead-participations", lead.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stream_lead_participations")
        .select("*, live_rooms(title, started_at)")
        .eq("lead_id", lead.id)
        .order("joined_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: open,
    staleTime: 30 * 1000,
  });

  const { data: leadNotes = [] } = useQuery({
    queryKey: ["lead-notes", lead.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_notes")
        .select("*")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: open,
    staleTime: 30 * 1000,
  });

  const { data: presenceRecords = [] } = useQuery({
    queryKey: ["lead-presence", lead.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_viewer_presence")
        .select("*, live_rooms:room_id(title)")
        .eq("stream_lead_id", lead.id)
        .order("joined_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: open,
    staleTime: 30 * 1000,
  });


  const addNote = useMutation({
    mutationFn: async () => {
      if (!note.trim()) return;
      // Insert into lead_notes for persistent tracking
      const { error } = await supabase.from("lead_notes").insert({
        lead_id: lead.id,
        user_id: user?.id,
        author_name: profile?.nombre || "Usuario",
        content: note.trim(),
      });
      if (error) throw error;
      // Also log as activity
      await supabase.from("lead_activities").insert({
        lead_id: lead.id,
        performed_by: user?.id,
        activity_type: "note",
        details: note.trim(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-notes", lead.id] });
      qc.invalidateQueries({ queryKey: ["lead-activities", lead.id] });
      setNote("");
      toast.success("Nota agregada");
    },
  });

  const deleteLead = useMutation({
    mutationFn: async () => {
      await Promise.all([
        supabase.from("lead_notes").delete().eq("lead_id", lead.id),
        supabase.from("lead_activities").delete().eq("lead_id", lead.id),
      ]);
      const { error } = await supabase.from("stream_leads").delete().eq("id", lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stream-leads"] });
      toast.success("Lead eliminado");
      onClose();
    },
    onError: () => toast.error("Error al eliminar lead"),
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-500/10 text-green-500 border-green-500/20";
    if (score >= 50) return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    if (score >= 25) return "bg-orange-500/10 text-orange-500 border-orange-500/20";
    return "bg-muted text-muted-foreground";
  };

  const activityIcon = (type: string) => {
    switch (type) {
      case "note": return <MessageSquare className="w-3 h-3" />;
      case "stage_change": return <Activity className="w-3 h-3" />;
      case "assigned": return <User className="w-3 h-3" />;
      default: return <Calendar className="w-3 h-3" />;
    }
  };

  const totalPresenceSeconds = presenceRecords.reduce((sum: number, p: any) => sum + (p.duration_seconds || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <User className="w-5 h-5 text-primary" />
              {lead.nombre}
            </DialogTitle>
            <div className="flex items-center gap-1">
              <CallButton lead={lead} size="default" variant="outline" showLabel />
              <WhatsAppButton lead={lead} size="default" variant="outline" showLabel />
              <TelegramButton lead={lead} size="default" variant="outline" showLabel />
              {isGlobalAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar lead?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se eliminará permanentemente a <strong>{lead.nombre}</strong> y todas sus notas y actividades asociadas. Esta acción no se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteLead.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          {/* Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" /> {lead.correo || "Sin correo"}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" /> {lead.telefono || "Sin teléfono"}
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getScoreColor(lead.opportunity_score)}>
                Score: {lead.opportunity_score}
              </Badge>
              {lead.is_registered_partner && <Badge variant="secondary">Partner registrado</Badge>}
            </div>
            {lead.is_duplicate && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-1">
                <span className="text-sm font-bold text-destructive">⚠️ LEAD DUPLICADO</span>
                <p className="text-xs text-destructive/80">
                  Este usuario está registrado en múltiples portales
                  {lead.duplicate_portal_ids?.length > 0 && ` (${lead.duplicate_portal_ids.length} portales)`}
                </p>
              </div>
            )}
            {lead.bullfy_referral_link && (
              <div className="bg-primary/5 border border-primary/30 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <ExternalLink className="w-3 h-3" /> Atribución IB Bullfy
                </div>
                <a
                  href={lead.bullfy_referral_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline break-all"
                >
                  {lead.bullfy_referral_link}
                </a>
                <p className="text-[10px] text-muted-foreground">
                  Lead capturado desde un stream público del portal de este IB.
                </p>
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              <Activity className="w-3 h-3 inline mr-1" />
              {lead.stream_count} streams atendidos · Fuente: {lead.source}
            </div>
            {totalPresenceSeconds > 0 && (
              <div className="text-xs text-muted-foreground">
                <Clock className="w-3 h-3 inline mr-1" />
                Tiempo total de presencia: {Math.round(totalPresenceSeconds / 60)} min
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Creado: {format(new Date(lead.created_at), "dd/MM/yyyy HH:mm")}
            </div>
          </div>

          {/* Stream participations */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Historial de Streams</h4>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {participations.length === 0 && <p className="text-xs text-muted-foreground">Sin participaciones</p>}
              {participations.map((p: any) => (
                <div key={p.id} className="text-xs bg-secondary/50 rounded px-2 py-1.5">
                  <span className="font-medium">{p.live_rooms?.title || "Stream"}</span>
                  <span className="text-muted-foreground ml-2">
                    {p.joined_at ? format(new Date(p.joined_at), "dd/MM HH:mm") : ""}
                  </span>
                  {p.duration_seconds > 0 && (
                    <span className="text-muted-foreground ml-1">({Math.round(p.duration_seconds / 60)}min)</span>
                  )}
                </div>
              ))}
            </div>

            {/* Viewer presence records */}
            {presenceRecords.length > 0 && (
              <div className="mt-2">
                <h4 className="text-sm font-semibold">Presencia en Streams</h4>
                <div className="max-h-24 overflow-y-auto space-y-1 mt-1">
                  {presenceRecords.map((p: any) => (
                    <div key={p.id} className="text-xs bg-primary/5 rounded px-2 py-1.5 flex items-center gap-2">
                      <Clock className="w-3 h-3 text-primary" />
                      <span className="font-medium">{(p.live_rooms as any)?.title || "Stream"}</span>
                      <span className="text-muted-foreground">
                        {p.joined_at ? format(new Date(p.joined_at), "dd/MM HH:mm") : ""}
                      </span>
                      {p.duration_seconds > 0 && (
                        <span className="text-primary font-medium ml-auto">{Math.round(p.duration_seconds / 60)}min</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stream Context (AI Analysis) */}
        {presenceRecords.length > 0 && (
          <Suspense fallback={<PanelFallback />}>
            <StreamContextPanel roomIds={[...new Set(presenceRecords.map((p: any) => p.room_id).filter(Boolean))]} />
            <KeywordAlertsPanel roomIds={[...new Set(presenceRecords.map((p: any) => p.room_id).filter(Boolean))]} />
          </Suspense>
        )}

        {/* WhatsApp Chat */}
        {lead.telefono && (
          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <MessageCircle className="w-4 h-4 text-emerald-500" /> WhatsApp
            </h4>
            <Suspense fallback={<PanelFallback />}>
              <WhatsAppChatPanel lead={lead} />
            </Suspense>
          </div>
        )}

        {/* Call History */}
        <div className="border-t border-border pt-4">
          <CallHistory leadId={lead.id} />
        </div>

        {/* Notes section */}
        <div className="space-y-3 border-t border-border pt-4">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-primary" /> Notas de Seguimiento
          </h4>
          <div className="flex gap-2">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Escribe una nota de seguimiento..." rows={2} className="flex-1" />
            <Button size="sm" onClick={() => addNote.mutate()} disabled={!note.trim() || addNote.isPending} className="self-end">
              Guardar
            </Button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {leadNotes.length === 0 && <p className="text-xs text-muted-foreground">Sin notas de seguimiento</p>}
            {leadNotes.map((n: any) => (
              <div key={n.id} className="bg-secondary/30 rounded-lg px-3 py-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">{n.author_name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(n.created_at), "dd/MM/yyyy HH:mm")}
                  </span>
                </div>
                <p className="text-sm text-foreground/80">{n.content}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Activity timeline */}
        <div className="space-y-2 border-t border-border pt-4">
          <h4 className="text-sm font-semibold">Actividad</h4>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {activities.length === 0 && <p className="text-xs text-muted-foreground">Sin actividad registrada</p>}
            {activities.map((a: any) => (
              <div key={a.id} className="flex items-start gap-2 text-xs">
                <div className="mt-0.5 text-muted-foreground">{activityIcon(a.activity_type)}</div>
                <div className="flex-1">
                  <span className="font-medium capitalize">{a.activity_type.replace("_", " ")}</span>
                  {a.details && <span className="text-muted-foreground ml-1">— {a.details}</span>}
                  <div className="text-muted-foreground/60">
                    {format(new Date(a.created_at), "dd/MM/yyyy HH:mm")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeadDetailDialog;
