import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Phone, PhoneCall, PhoneOff, Loader2, Globe } from "lucide-react";
import { toast } from "@/lib/toastUtils";
import { useAuth } from "@/hooks/useAuth";
import { useBrowserCall } from "@/hooks/useBrowserCall";
import PostCallForm from "./PostCallForm";

interface CallButtonProps {
  lead: { id: string; nombre: string; telefono?: string | null };
  size?: "sm" | "default" | "icon";
  variant?: "default" | "outline" | "ghost";
  showLabel?: boolean;
}

const CallButton = ({ lead, size = "icon", variant = "ghost", showLabel = false }: CallButtonProps) => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<string | null>(null);
  const [showPostCall, setShowPostCall] = useState(false);
  const browserCall = useBrowserCall();

  // Get agent preferences
  const { data: agentStatus } = useQuery({
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
  });

  const callMode = (agentStatus?.call_mode_preference as string) || "bridge";
  const isBrowserMode = callMode === "browser";

  // Initialize Twilio Device when agent uses browser mode (singleton, no destroy on unmount)
  useEffect(() => {
    if (isBrowserMode && agentStatus?.status === "available") {
      browserCall.initDevice();
    }
  }, [isBrowserMode, agentStatus?.status]);

  // Sync browser call state → callStatus
  useEffect(() => {
    if (!isBrowserMode) return;
    if (browserCall.state === "completed") {
      setShowPostCall(true);
    } else if (browserCall.state === "failed") {
      setTimeout(() => {
        setActiveCallId(null);
        setCallStatus(null);
      }, 3000);
    }
    if (browserCall.state !== "idle") {
      setCallStatus(browserCall.state);
    }
  }, [browserCall.state, isBrowserMode]);

  // Poll active call status (bridge mode only)
  useEffect(() => {
    if (!activeCallId || isBrowserMode) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("lead_calls")
        .select("status")
        .eq("id", activeCallId)
        .single();
      if (data) {
        setCallStatus(data.status);
        if (["completed", "failed", "no_answer", "busy"].includes(data.status)) {
          clearInterval(interval);
          if (data.status === "completed") {
            setShowPostCall(true);
          } else {
            setTimeout(() => {
              setActiveCallId(null);
              setCallStatus(null);
            }, 3000);
          }
          qc.invalidateQueries({ queryKey: ["lead-calls"] });
          qc.invalidateQueries({ queryKey: ["sales-agent-status"] });
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeCallId, qc, isBrowserMode]);

  // Bridge mode call
  const initiateBridgeCall = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("twilio-click-to-call", {
        body: { lead_id: lead.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setActiveCallId(data.call_id);
      setCallStatus("ringing");
      toast.success("Llamando... Recibirás la llamada en tu teléfono");
      qc.invalidateQueries({ queryKey: ["lead-calls"] });
      qc.invalidateQueries({ queryKey: ["lead-activities"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al iniciar llamada");
    },
  });

  // Browser mode: create call record first, then connect via SDK
  const initiateBrowserCall = useMutation({
    mutationFn: async () => {
      // Create call record
      const { data: callRecord, error } = await supabase
        .from("lead_calls")
        .insert({
          lead_id: lead.id,
          agent_id: user!.id,
          call_mode: "browser",
          status: "initiating",
        })
        .select()
        .single();
      if (error) throw error;

      // Update agent status
      await supabase
        .from("sales_agent_status")
        .update({ status: "on_call", current_lead_id: lead.id })
        .eq("user_id", user!.id);

      // Log activity
      await supabase.from("lead_activities").insert({
        lead_id: lead.id,
        performed_by: user!.id,
        activity_type: "call_initiated",
        details: "Llamada desde navegador",
      });

      return callRecord;
    },
    onSuccess: (callRecord) => {
      setActiveCallId(callRecord.id);
      setCallStatus("connecting");

      const welcomeMsg = (agentStatus as any)?.welcome_message || undefined;

      browserCall.makeCall({
        leadPhone: lead.telefono!,
        leadId: lead.id,
        callRecordId: callRecord.id,
        welcomeMessage: welcomeMsg,
      });

      toast.success("Conectando llamada desde el navegador...");
      qc.invalidateQueries({ queryKey: ["lead-calls"] });
      qc.invalidateQueries({ queryKey: ["lead-activities"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al iniciar llamada");
    },
  });

  const hangupCall = useMutation({
    mutationFn: async () => {
      if (isBrowserMode) {
        browserCall.hangup();
        // Update call record
        if (activeCallId) {
          await supabase
            .from("lead_calls")
            .update({ status: "completed", ended_at: new Date().toISOString() })
            .eq("id", activeCallId);
        }
        await supabase
          .from("sales_agent_status")
          .update({ status: "wrap_up", current_lead_id: null })
          .eq("user_id", user!.id);
        return {};
      }

      // Bridge mode hangup
      if (!activeCallId) throw new Error("No active call");
      const { data, error } = await supabase.functions.invoke("twilio-hangup-call", {
        body: { call_id: activeCallId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      setCallStatus("completed");
      setShowPostCall(true);
      toast.success("Llamada finalizada");
      qc.invalidateQueries({ queryKey: ["lead-calls"] });
      qc.invalidateQueries({ queryKey: ["sales-agent-status"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al cortar llamada");
    },
  });

  const handlePostCallComplete = useCallback(() => {
    setShowPostCall(false);
    setActiveCallId(null);
    setCallStatus(null);
    qc.invalidateQueries({ queryKey: ["lead-calls"] });
    qc.invalidateQueries({ queryKey: ["sales-agent-status"] });
  }, [qc]);

  const handleInitiateCall = () => {
    if (isBrowserMode) {
      initiateBrowserCall.mutate();
    } else {
      initiateBridgeCall.mutate();
    }
  };

  const isPending = initiateBridgeCall.isPending || initiateBrowserCall.isPending;

  if (!lead.telefono) {
    return (
      <Button size={size} variant={variant} disabled title="Lead sin teléfono">
        <Phone className="w-4 h-4 text-muted-foreground" />
        {showLabel && <span className="ml-2">Sin teléfono</span>}
      </Button>
    );
  }

  // Show post-call form
  if (showPostCall && activeCallId) {
    return (
      <PostCallForm
        callId={activeCallId}
        leadId={lead.id}
        onComplete={handlePostCallComplete}
      />
    );
  }

  // Active call - show hangup button
  if (callStatus && activeCallId) {
    const isCallActive = ["ringing", "in_progress", "initiating", "connecting"].includes(callStatus);

    const statusLabels: Record<string, string> = {
      initiating: "Iniciando...",
      connecting: "Conectando...",
      ringing: "Sonando...",
      in_progress: "En llamada",
      completed: "Finalizada",
      failed: "Fallida",
      no_answer: "Sin respuesta",
      busy: "Ocupado",
    };

    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          {callStatus === "in_progress" ? (
            <PhoneCall className="w-4 h-4 text-green-500 animate-pulse" />
          ) : ["ringing", "initiating", "connecting"].includes(callStatus) ? (
            <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />
          ) : (
            <PhoneOff className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="text-xs font-medium text-foreground">
            {statusLabels[callStatus] || callStatus}
          </span>
          {isBrowserMode && isCallActive && (
            <Globe className="w-3 h-3 text-primary" />
          )}
        </div>
        {isCallActive && (
          <Button
            size="sm"
            variant="destructive"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => hangupCall.mutate()}
            disabled={hangupCall.isPending}
          >
            <PhoneOff className="w-3 h-3" />
            Colgar
          </Button>
        )}
      </div>
    );
  }

  // Default - show call button
  return (
    <Button
      size={size}
      variant={variant}
      className="text-green-500 hover:text-green-600 hover:bg-green-500/10"
      title={`Llamar a ${lead.nombre} (${isBrowserMode ? "navegador" : "puente"})`}
      disabled={isPending}
      onClick={handleInitiateCall}
    >
      {isPending ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isBrowserMode ? (
        <Globe className="w-4 h-4" />
      ) : (
        <Phone className="w-4 h-4" />
      )}
      {showLabel && <span className="ml-2">Llamar</span>}
    </Button>
  );
};

export default CallButton;
