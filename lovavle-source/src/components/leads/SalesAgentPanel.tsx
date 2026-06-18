import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, PhoneCall, Clock, Activity, Settings2 } from "lucide-react";
import { toast } from "@/lib/toastUtils";
import { useAuth } from "@/hooks/useAuth";

const SalesAgentPanel = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [modeInput, setModeInput] = useState<"browser" | "bridge">("bridge");
  

  const { data: agentStatus, isLoading } = useQuery({
    queryKey: ["sales-agent-status", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_agent_status")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (agentStatus) {
      setPhoneInput(agentStatus.telefono_trabajo || "");
      setModeInput(agentStatus.call_mode_preference as "browser" | "bridge");
    }
  }, [agentStatus]);

  // Realtime subscription for status changes
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`agent-status-${user.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "sales_agent_status",
        filter: `user_id=eq.${user.id}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ["sales-agent-status", user.id] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, qc]);

  const toggleStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!agentStatus) {
        // Create agent status record
        const { error } = await supabase.from("sales_agent_status").insert({
          user_id: user!.id,
          status: newStatus,
          telefono_trabajo: phoneInput || null,
          call_mode_preference: modeInput,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("sales_agent_status")
          .update({ status: newStatus, last_status_change: new Date().toISOString() })
          .eq("user_id", user!.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-agent-status"] });
    },
  });

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (!agentStatus) {
        const { error } = await supabase.from("sales_agent_status").insert({
          user_id: user!.id,
          status: "offline",
          telefono_trabajo: phoneInput || null,
          call_mode_preference: modeInput,
        } as any);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("sales_agent_status")
          .update({ telefono_trabajo: phoneInput || null, call_mode_preference: modeInput } as any)
          .eq("user_id", user!.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-agent-status"] });
      toast.success("Configuración guardada");
      setShowSettings(false);
    },
  });

  const currentStatus = agentStatus?.status || "offline";
  const isAvailable = currentStatus === "available";
  const isOnCall = currentStatus === "on_call";
  const isWrapUp = currentStatus === "wrap_up";

  const statusConfig: Record<string, { label: string; color: string; badgeClass: string }> = {
    available: { label: "Disponible", color: "bg-green-500", badgeClass: "bg-green-500/10 text-green-500 border-green-500/30" },
    on_call: { label: "En llamada", color: "bg-yellow-500", badgeClass: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30" },
    wrap_up: { label: "Post-llamada", color: "bg-orange-500", badgeClass: "bg-orange-500/10 text-orange-500 border-orange-500/30" },
    offline: { label: "Desconectado", color: "bg-muted-foreground", badgeClass: "bg-muted text-muted-foreground" },
  };

  const config = statusConfig[currentStatus] || statusConfig.offline;

  if (isLoading) return null;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Phone className="w-4 h-4 text-primary" />
            Panel de Agente
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowSettings(!showSettings)}>
            <Settings2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Status indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${config.color} ${isAvailable ? "animate-pulse" : ""}`} />
            <Badge variant="outline" className={config.badgeClass}>{config.label}</Badge>
          </div>
          <Switch
            checked={isAvailable}
            onCheckedChange={(checked) => {
              if (isOnCall) {
                toast.error("No puedes cambiar estado durante una llamada");
                return;
              }
              toggleStatus.mutate(checked ? "available" : "offline");
            }}
            disabled={isOnCall || toggleStatus.isPending}
          />
        </div>

        {/* Wrap-up action */}
        {isWrapUp && (
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs"
            onClick={() => toggleStatus.mutate("available")}
          >
            Volver a disponible
          </Button>
        )}

        {/* Daily metrics */}
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-secondary/30 rounded-lg p-2">
            <div className="text-lg font-bold text-foreground">{agentStatus?.daily_calls || 0}</div>
            <div className="text-[10px] text-muted-foreground">Llamadas hoy</div>
          </div>
          <div className="bg-secondary/30 rounded-lg p-2">
            <div className="text-lg font-bold text-foreground">
              {Math.round((agentStatus?.daily_duration_seconds || 0) / 60)}m
            </div>
            <div className="text-[10px] text-muted-foreground">Tiempo total</div>
          </div>
        </div>

        {/* Settings */}
        {showSettings && (
          <div className="space-y-3 border-t border-border pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Teléfono de trabajo (para bridge)</Label>
              <Input
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="+52 1234567890"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Modo de llamada preferido</Label>
              <Select value={modeInput} onValueChange={(v) => setModeInput(v as "browser" | "bridge")}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bridge">Puente telefónico</SelectItem>
                  <SelectItem value="browser">Desde navegador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="w-full" onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
              Guardar configuración
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SalesAgentPanel;
