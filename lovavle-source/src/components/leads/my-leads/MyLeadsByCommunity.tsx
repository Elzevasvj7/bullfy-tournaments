import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Phone, Mail, Users as UsersIcon } from "lucide-react";
import { format } from "date-fns";
import LeadDetailDialog from "../LeadDetailDialog";
import CallButton from "../CallButton";
import WhatsAppButton from "../WhatsAppButton";

const COLS =
  "id, nombre, correo, telefono, opportunity_score, pipeline_stage_id, assigned_to, partner_portal_id, source, taken_at, created_at, partner_portals:partner_portal_id(id, display_name, nombre_portal)";

const MyLeadsByCommunity = () => {
  const { user } = useAuth();
  const [selected, setSelected] = useState<any>(null);
  const [activePortal, setActivePortal] = useState<string | "all">("all");

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["my-leads", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("stream_leads")
        .select(COLS)
        .eq("assigned_to", user.id)
        .order("opportunity_score", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  // Agrupar por portal
  const groups = useMemo(() => {
    const m = new Map<string, { name: string; leads: any[] }>();
    for (const l of leads) {
      const pid = l.partner_portal_id || "__torneos__";
      const pname =
        l.partner_portal_id
          ? (l.partner_portals as any)?.display_name || (l.partner_portals as any)?.nombre_portal || "Comunidad"
          : "Torneos";
      const cur = m.get(pid) || { name: pname, leads: [] };
      cur.leads.push(l);
      m.set(pid, cur);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].leads.length - a[1].leads.length);
  }, [leads]);

  const visibleLeads = useMemo(() => {
    if (activePortal === "all") return leads;
    return leads.filter((l: any) => (l.partner_portal_id || "__torneos__") === activePortal);
  }, [leads, activePortal]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <UsersIcon className="w-5 h-5 text-primary" />
        <div>
          <h3 className="text-lg font-semibold text-foreground">Mis Leads</h3>
          <p className="text-xs text-muted-foreground">
            Tus leads agrupados por comunidad. Total: <strong>{leads.length}</strong>
          </p>
        </div>
      </div>

      {/* Chips por comunidad */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activePortal === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setActivePortal("all")}
        >
          Todos ({leads.length})
        </Button>
        {groups.map(([pid, g]) => (
          <Button
            key={pid}
            variant={activePortal === pid ? "default" : "outline"}
            size="sm"
            onClick={() => setActivePortal(pid)}
            className="gap-1"
          >
            {g.name}
            <Badge variant="secondary" className="ml-1 h-4 text-[10px] px-1">{g.leads.length}</Badge>
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <p className="text-xs text-muted-foreground py-4">Cargando…</p>
        ) : visibleLeads.length === 0 ? (
          <Card className="bg-card/60 border-border">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No tienes leads en esta vista. Ve al Dashboard para tomar leads de tus comunidades asignadas.
            </CardContent>
          </Card>
        ) : (
          visibleLeads.map((lead: any) => (
            <Card key={lead.id} className="bg-card/60 border-border hover:border-primary/40 transition-all">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 grid place-items-center flex-shrink-0">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setSelected(lead)}
                      className="text-sm font-semibold text-foreground hover:text-primary truncate"
                    >
                      {lead.nombre}
                    </button>
                    <Badge variant="outline" className="text-[10px]">
                      {(lead.partner_portals as any)?.display_name ||
                        (lead.partner_portals as any)?.nombre_portal ||
                        (lead.source === "tournament" ? "Torneo" : "—")}
                    </Badge>
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
                  <CallButton lead={lead} size="sm" variant="outline" />
                  <WhatsAppButton lead={lead} size="sm" variant="outline" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {selected && (
        <LeadDetailDialog lead={selected} open={!!selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
};

export default MyLeadsByCommunity;
