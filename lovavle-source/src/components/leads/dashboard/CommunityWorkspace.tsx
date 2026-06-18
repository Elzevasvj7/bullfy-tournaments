import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Hand, User, Phone, Mail, Loader2 } from "lucide-react";
import { toast } from "@/lib/toastUtils";
import { format } from "date-fns";
import LeadDetailDialog from "../LeadDetailDialog";
import CallButton from "../CallButton";
import WhatsAppButton from "../WhatsAppButton";

const LEAD_COLUMNS =
  "id, nombre, correo, telefono, opportunity_score, stream_count, pipeline_stage_id, assigned_to, taken_at, contact_attempts, is_duplicate, is_registered_partner, tags, partner_portal_id, source, created_at";

interface Props {
  portal: { id: string; display_name: string | null; nombre_portal: string };
  onBack: () => void;
}

const CommunityWorkspace = ({ portal, onBack }: Props) => {
  const qc = useQueryClient();
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin") || roles.includes("global_admin") || roles.includes("admin_ventas");
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const name = portal.display_name || portal.nombre_portal;

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["community-leads", portal.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stream_leads")
        .select(LEAD_COLUMNS)
        .eq("partner_portal_id", portal.id)
        .order("opportunity_score", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const takeLead = useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase
        .from("stream_leads")
        .update({ assigned_to: user!.id, taken_at: new Date().toISOString() })
        .eq("id", leadId)
        .is("assigned_to", null);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-leads", portal.id] });
      qc.invalidateQueries({ queryKey: ["lead-counts-by-portal"] });
      toast.success("Lead tomado");
    },
    onError: (e: any) => toast.error(e.message || "No se pudo tomar el lead"),
  });

  const buckets = useMemo(() => {
    const disponibles = leads.filter((l: any) => !l.assigned_to);
    const mios = leads.filter((l: any) => l.assigned_to === user?.id);
    const otros = leads.filter((l: any) => l.assigned_to && l.assigned_to !== user?.id);
    return { disponibles, mios, otros };
  }, [leads, user?.id]);

  const renderRow = (lead: any, showTake: boolean) => (
    <Card key={lead.id} className="bg-card/60 border-border hover:border-primary/40 transition-all">
      <CardContent className="p-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 grid place-items-center flex-shrink-0">
          <User className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedLead(lead)}
              className="text-sm font-semibold text-foreground hover:text-primary truncate"
            >
              {lead.nombre}
            </button>
            <Badge
              variant="outline"
              className={
                lead.opportunity_score >= 80
                  ? "border-green-500/40 text-green-500"
                  : lead.opportunity_score >= 50
                  ? "border-yellow-500/40 text-yellow-500"
                  : "border-muted text-muted-foreground"
              }
            >
              Score {lead.opportunity_score}
            </Badge>
            {lead.source && <Badge variant="secondary" className="text-[10px]">{lead.source}</Badge>}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            {lead.telefono && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" /> {lead.telefono}
              </span>
            )}
            {lead.correo && (
              <span className="flex items-center gap-1 truncate">
                <Mail className="w-3 h-3" /> {lead.correo}
              </span>
            )}
            <span>{format(new Date(lead.created_at), "dd/MM HH:mm")}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {showTake ? (
            <Button
              size="sm"
              onClick={() => takeLead.mutate(lead.id)}
              disabled={takeLead.isPending}
              className="gap-1"
            >
              {takeLead.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Hand className="w-3 h-3" />}
              Tomar Lead
            </Button>
          ) : (
            <>
              <CallButton lead={lead} size="sm" variant="outline" />
              <WhatsAppButton lead={lead} size="sm" variant="outline" />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Volver
          </Button>
          <div>
            <h3 className="text-lg font-semibold text-foreground">{name}</h3>
            <p className="text-xs text-muted-foreground">Workspace de comunidad · {leads.length} leads</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="disponibles">
        <TabsList className="bg-secondary/50 border border-border">
          <TabsTrigger value="disponibles" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            Disponibles ({buckets.disponibles.length})
          </TabsTrigger>
          <TabsTrigger value="mios" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            Mis leads ({buckets.mios.length})
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="otros" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              De otros closers ({buckets.otros.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="disponibles" className="space-y-2 mt-4">
          {isLoading ? (
            <p className="text-xs text-muted-foreground py-4">Cargando…</p>
          ) : buckets.disponibles.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No hay leads disponibles.</p>
          ) : (
            buckets.disponibles.map((l: any) => renderRow(l, true))
          )}
        </TabsContent>

        <TabsContent value="mios" className="space-y-2 mt-4">
          {buckets.mios.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Aún no has tomado leads.</p>
          ) : (
            buckets.mios.map((l: any) => renderRow(l, false))
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="otros" className="space-y-2 mt-4">
            {buckets.otros.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Sin leads asignados a otros.</p>
            ) : (
              buckets.otros.map((l: any) => renderRow(l, false))
            )}
          </TabsContent>
        )}
      </Tabs>

      {selectedLead && (
        <LeadDetailDialog
          lead={selectedLead}
          open={!!selectedLead}
          onClose={() => setSelectedLead(null)}
        />
      )}
    </div>
  );
};

export default CommunityWorkspace;
