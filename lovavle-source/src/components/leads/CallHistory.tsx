import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Phone, PhoneCall, PhoneOff, Clock, Play, Square, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toastUtils";
import CallAnalysisPanel from "./CallAnalysisPanel";

interface CallHistoryProps {
  leadId: string;
}

const CallHistory = ({ leadId }: CallHistoryProps) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);

  const { data: calls = [] } = useQuery({
    queryKey: ["lead-calls", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_calls")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch agent names separately since there's no FK
      const agentIds = [...new Set(data?.map((c: any) => c.agent_id).filter(Boolean))];
      let agentMap: Record<string, string> = {};
      if (agentIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nombre")
          .in("id", agentIds);
        profiles?.forEach((p: any) => { agentMap[p.id] = p.nombre; });
      }

      return (data || []).map((c: any) => ({ ...c, agent_name: agentMap[c.agent_id] || null }));
      return data;
    },
  });

  const playRecording = async (callId: string, recordingSid: string) => {
    // Stop current playback
    if (audioEl) {
      audioEl.pause();
      audioEl.src = "";
      setAudioEl(null);
    }

    if (playingId === callId) {
      setPlayingId(null);
      return;
    }

    setLoadingId(callId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        toast.error("Sesión expirada");
        return;
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/twilio-recording-proxy?recording_sid=${recordingSid}`;

      const audio = new Audio();
      audio.crossOrigin = "anonymous";

      // We need to fetch with auth header since Audio element can't set headers
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Error al cargar grabación");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      audio.src = objectUrl;

      audio.onended = () => {
        setPlayingId(null);
        setAudioEl(null);
        URL.revokeObjectURL(objectUrl);
      };

      audio.onerror = () => {
        toast.error("Error al reproducir grabación");
        setPlayingId(null);
        setAudioEl(null);
        URL.revokeObjectURL(objectUrl);
      };

      await audio.play();
      setPlayingId(callId);
      setAudioEl(audio);
    } catch (err: any) {
      toast.error(err.message || "Error al cargar grabación");
    } finally {
      setLoadingId(null);
    }
  };

  if (calls.length === 0) return null;

  const dispositionLabels: Record<string, { label: string; emoji: string }> = {
    interested: { label: "Interesado", emoji: "✅" },
    callback: { label: "Reagendar", emoji: "📅" },
    not_interested: { label: "No interesado", emoji: "❌" },
    no_answer: { label: "Sin respuesta", emoji: "📵" },
    wrong_number: { label: "Número incorrecto", emoji: "🚫" },
    voicemail: { label: "Buzón de voz", emoji: "📨" },
  };

  const statusColors: Record<string, string> = {
    completed: "bg-green-500/10 text-green-500",
    failed: "bg-destructive/10 text-destructive",
    no_answer: "bg-orange-500/10 text-orange-500",
    busy: "bg-yellow-500/10 text-yellow-500",
    in_progress: "bg-blue-500/10 text-blue-500",
    ringing: "bg-yellow-500/10 text-yellow-500",
    initiating: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <Phone className="w-4 h-4 text-primary" /> Historial de Llamadas
      </h4>
      <div className="max-h-48 overflow-y-auto space-y-2">
        {calls.map((call: any) => {
          const disp = call.disposition ? dispositionLabels[call.disposition] : null;
          const isPlaying = playingId === call.id;
          const isLoading = loadingId === call.id;

          return (
            <div key={call.id} className="bg-secondary/30 rounded-lg px-3 py-2 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {call.status === "completed" ? (
                    <PhoneCall className="w-3 h-3 text-green-500" />
                  ) : (
                    <PhoneOff className="w-3 h-3 text-muted-foreground" />
                  )}
                  <span className="text-xs font-medium">
                    {call.agent_name || "Agente"}
                  </span>
                  <Badge variant="outline" className={`text-[10px] ${statusColors[call.status] || ""}`}>
                    {call.call_mode === "bridge" ? "📱" : "🖥️"} {call.status}
                  </Badge>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(call.created_at), "dd/MM/yyyy HH:mm")}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {call.duration_seconds != null && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {Math.floor(call.duration_seconds / 60)}:{(call.duration_seconds % 60).toString().padStart(2, "0")}
                  </span>
                )}
                {disp && (
                  <span>{disp.emoji} {disp.label}</span>
                )}
                {call.recording_sid && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-5 px-1 text-xs gap-1 ${isPlaying ? "text-primary" : ""}`}
                    onClick={() => playRecording(call.id, call.recording_sid)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : isPlaying ? (
                      <Square className="w-3 h-3" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    {isPlaying ? "Detener" : "Grabación"}
                  </Button>
                )}
              </div>
              {call.notes && (
                <p className="text-xs text-foreground/70 mt-1">{call.notes}</p>
              )}
              {call.status === "completed" && (
                <CallAnalysisPanel callId={call.id} compact />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CallHistory;
