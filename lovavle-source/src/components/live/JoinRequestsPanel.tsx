import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Check, X, DoorOpen, CheckCheck, Zap } from "lucide-react";
import { toast } from "@/lib/toastUtils";

interface JoinRequest {
  id: string;
  room_id: string;
  requester_name: string;
  requester_email: string | null;
  requester_session_id: string;
  status: string;
  created_at: string;
}

const JoinRequestsPanel = ({ roomId }: { roomId: string }) => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [autoApprove, setAutoApprove] = useState<boolean>(false);
  const [loadingAuto, setLoadingAuto] = useState(false);

  // Initial load: pending requests + room.auto_approve setting
  useEffect(() => {
    (async () => {
      const [reqRes, roomRes] = await Promise.all([
        supabase
          .from("live_room_join_requests" as any)
          .select("*")
          .eq("room_id", roomId)
          .eq("status", "pending")
          .order("created_at", { ascending: true }),
        supabase
          .from("live_rooms")
          .select("auto_approve_join_requests")
          .eq("id", roomId)
          .single(),
      ]);
      setRequests((reqRes.data as unknown as JoinRequest[]) || []);
      setAutoApprove(!!(roomRes.data as any)?.auto_approve_join_requests);
    })();

    const channel = supabase
      .channel(`join-requests-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_room_join_requests", filter: `room_id=eq.${roomId}` },
        async (payload: any) => {
          if (payload.eventType === "INSERT" && payload.new?.status === "pending") {
            // Auto-approve immediately if toggle is on
            const { data: r } = await supabase
              .from("live_rooms")
              .select("auto_approve_join_requests")
              .eq("id", roomId)
              .single();
            if ((r as any)?.auto_approve_join_requests) {
              await supabase
                .from("live_room_join_requests" as any)
                .update({
                  status: "approved",
                  decided_by: user?.id,
                  decided_at: new Date().toISOString(),
                } as any)
                .eq("id", payload.new.id);
              return;
            }
            toast.info(`✋ ${payload.new.requester_name} quiere entrar`);
          }
          // Refresh
          const { data } = await supabase
            .from("live_room_join_requests" as any)
            .select("*")
            .eq("room_id", roomId)
            .eq("status", "pending")
            .order("created_at", { ascending: true });
          setRequests((data as unknown as JoinRequest[]) || []);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, user?.id]);

  const decide = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase
      .from("live_room_join_requests" as any)
      .update({ status, decided_by: user?.id, decided_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) toast.error("Error: " + error.message);
    else toast.success(status === "approved" ? "Invitado aprobado" : "Solicitud rechazada");
  };

  const approveAll = async () => {
    if (requests.length === 0) return;
    const ids = requests.map((r) => r.id);
    const { error } = await supabase
      .from("live_room_join_requests" as any)
      .update({ status: "approved", decided_by: user?.id, decided_at: new Date().toISOString() } as any)
      .in("id", ids);
    if (error) toast.error("Error: " + error.message);
    else toast.success(`${ids.length} invitado(s) aprobados`);
  };

  const toggleAutoApprove = async (val: boolean) => {
    setLoadingAuto(true);
    const { error } = await supabase
      .from("live_rooms")
      .update({ auto_approve_join_requests: val } as any)
      .eq("id", roomId);
    if (error) {
      toast.error("Error: " + error.message);
    } else {
      setAutoApprove(val);
      toast.success(val ? "Auto-aceptar activado" : "Auto-aceptar desactivado");
      // If turned on, approve any current pending immediately
      if (val && requests.length > 0) await approveAll();
    }
    setLoadingAuto(false);
  };

  return (
    <Card className={autoApprove ? "border-emerald-500/40 bg-emerald-500/5" : "border-border"}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <DoorOpen className={`w-3.5 h-3.5 ${requests.length > 0 ? "text-primary" : "text-muted-foreground"}`} />
            Sala de espera
          </span>
          {requests.length > 0 && (
            <Badge variant="default" className="text-xs">{requests.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Auto-approve toggle */}
        <div className="flex items-center justify-between gap-2 p-2 rounded-md border border-border bg-background">
          <div className="flex items-center gap-2 min-w-0">
            <Zap className={`w-3.5 h-3.5 shrink-0 ${autoApprove ? "text-emerald-500" : "text-muted-foreground"}`} />
            <div className="min-w-0">
              <p className="text-xs font-medium">Auto-aceptar siempre</p>
              <p className="text-[10px] text-muted-foreground truncate">
                Aprueba a todos los que entren con el link
              </p>
            </div>
          </div>
          <Switch
            checked={autoApprove}
            onCheckedChange={toggleAutoApprove}
            disabled={loadingAuto}
          />
        </div>

        {/* Pending list */}
        {requests.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 text-center">
            {autoApprove ? "Auto-aceptando entradas." : "Sin solicitudes pendientes"}
          </p>
        ) : (
          <>
            <Button
              size="sm"
              variant="default"
              className="w-full gap-1.5 h-8"
              onClick={approveAll}
            >
              <CheckCheck className="w-3.5 h-3.5" /> Aceptar todos los pendientes ({requests.length})
            </Button>

            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {requests.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-1.5 p-2 rounded border border-border bg-background"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{r.requester_name}</p>
                    {r.requester_email && (
                      <p className="text-[10px] text-muted-foreground truncate">{r.requester_email}</p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="default"
                    className="h-7 w-7"
                    onClick={() => decide(r.id, "approved")}
                    title="Aprobar"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => decide(r.id, "rejected")}
                    title="Rechazar"
                  >
                    <X className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default JoinRequestsPanel;
