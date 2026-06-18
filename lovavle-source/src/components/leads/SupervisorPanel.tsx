import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Phone, UserCheck, Zap } from "lucide-react";
import { toast } from "@/lib/toastUtils";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

const SupervisorPanel = () => {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: agents = [] } = useQuery({
    queryKey: ["all-agent-statuses"],
    queryFn: async () => {
      const { data: statuses, error } = await supabase
        .from("sales_agent_status")
        .select("*, profiles:user_id(nombre, correo)")
        .order("status");
      if (error) throw error;
      return statuses || [];
    },
    refetchInterval: 5000,
  });

  const { data: unassignedLeads = [] } = useQuery({
    queryKey: ["unassigned-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stream_leads")
        .select("id, nombre, correo, opportunity_score, telefono")
        .is("assigned_to", null)
        .not("telefono", "is", null)
        .order("opportunity_score", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  // Realtime for agent status changes
  useEffect(() => {
    const channel = supabase
      .channel("supervisor-agents")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "sales_agent_status",
      }, () => {
        qc.invalidateQueries({ queryKey: ["all-agent-statuses"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const assignLead = useMutation({
    mutationFn: async ({ leadId, agentId }: { leadId: string; agentId: string }) => {
      // Create assignment record
      const { error: assignError } = await supabase.from("lead_assignments").insert({
        lead_id: leadId,
        agent_id: agentId,
        assigned_by: user?.id,
        assignment_type: "manual",
        status: "pending",
      });
      if (assignError) throw assignError;

      // Update stream_leads assigned_to
      const { error: updateError } = await supabase
        .from("stream_leads")
        .update({
          assigned_to: agentId,
          assigned_by: user?.id,
          assigned_at: new Date().toISOString(),
        })
        .eq("id", leadId);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unassigned-leads"] });
      qc.invalidateQueries({ queryKey: ["stream-leads"] });
      toast.success("Lead asignado al agente");
    },
    onError: () => toast.error("Error al asignar lead"),
  });

  const autoAssign = useMutation({
    mutationFn: async () => {
      const availableAgents = agents.filter((a: any) => a.status === "available");
      if (availableAgents.length === 0) throw new Error("No hay agentes disponibles");
      if (unassignedLeads.length === 0) throw new Error("No hay leads sin asignar");

      // Round-robin: assign top leads to available agents
      const assignments = [];
      for (let i = 0; i < Math.min(availableAgents.length, unassignedLeads.length); i++) {
        assignments.push({
          leadId: unassignedLeads[i].id,
          agentId: availableAgents[i].user_id,
        });
      }

      for (const a of assignments) {
        await assignLead.mutateAsync(a);
      }
      return assignments.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} leads asignados automáticamente`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const statusConfig: Record<string, { color: string; label: string }> = {
    available: { color: "bg-green-500", label: "Disponible" },
    on_call: { color: "bg-yellow-500", label: "En llamada" },
    wrap_up: { color: "bg-orange-500", label: "Post-llamada" },
    offline: { color: "bg-muted-foreground", label: "Desconectado" },
  };

  const availableCount = agents.filter((a: any) => a.status === "available").length;
  const onCallCount = agents.filter((a: any) => a.status === "on_call").length;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{agents.length}</div>
            <div className="text-xs text-muted-foreground">Agentes totales</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-500">{availableCount}</div>
            <div className="text-xs text-muted-foreground">Disponibles</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-500">{onCallCount}</div>
            <div className="text-xs text-muted-foreground">En llamada</div>
          </CardContent>
        </Card>
      </div>

      {/* Auto-assign button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Agentes</h3>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={() => autoAssign.mutate()}
          disabled={autoAssign.isPending || availableCount === 0 || unassignedLeads.length === 0}
        >
          <Zap className="w-3.5 h-3.5" />
          Auto-asignar ({unassignedLeads.length} pendientes)
        </Button>
      </div>

      {/* Agent list */}
      <div className="space-y-2">
        {agents.map((agent: any) => {
          const sc = statusConfig[agent.status] || statusConfig.offline;
          const profile = agent.profiles as any;
          return (
            <Card key={agent.id} className="border-border">
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${sc.color} ${agent.status === "available" ? "animate-pulse" : ""}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{profile?.nombre || "Agente"}</div>
                  <div className="text-xs text-muted-foreground">{profile?.correo}</div>
                </div>
                <Badge variant="outline" className="text-[10px]">{sc.label}</Badge>
                <div className="text-xs text-muted-foreground text-right">
                  <div>{agent.daily_calls} llamadas</div>
                  <div>{Math.round(agent.daily_duration_seconds / 60)}min</div>
                </div>
                {/* Manual assign dropdown */}
                {agent.status === "available" && unassignedLeads.length > 0 && (
                  <Select
                    onValueChange={(leadId) => assignLead.mutate({ leadId, agentId: agent.user_id })}
                  >
                    <SelectTrigger className="h-7 w-32 text-xs">
                      <SelectValue placeholder="Asignar lead" />
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedLeads.slice(0, 10).map((lead: any) => (
                        <SelectItem key={lead.id} value={lead.id} className="text-xs">
                          {lead.nombre} ({lead.opportunity_score}pts)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </CardContent>
            </Card>
          );
        })}
        {agents.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No hay agentes registrados. Los agentes deben activar su panel en la pestaña Leads.
          </p>
        )}
      </div>
    </div>
  );
};

export default SupervisorPanel;
