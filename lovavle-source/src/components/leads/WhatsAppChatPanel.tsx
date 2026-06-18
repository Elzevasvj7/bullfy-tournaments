import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/toastUtils";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import {
  Send, Loader2, FileText, Video, CheckCheck, Check, Clock, AlertCircle, Paperclip,
} from "lucide-react";

interface Props {
  lead: { id: string; nombre: string; telefono?: string | null };
}

const statusIcon = (status: string) => {
  switch (status) {
    case "delivered":
    case "read":
      return <CheckCheck className="w-3 h-3" />;
    case "sent":
      return <Check className="w-3 h-3" />;
    case "queued":
    case "sending":
      return <Clock className="w-3 h-3" />;
    case "failed":
    case "undelivered":
      return <AlertCircle className="w-3 h-3 text-destructive" />;
    default:
      return <Clock className="w-3 h-3" />;
  }
};

const WhatsAppChatPanel = ({ lead }: Props) => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedRoom, setSelectedRoom] = useState<string>("auto");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["whatsapp-messages", lead.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_whatsapp_messages" as any)
        .select("*")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates" as any)
        .select("*")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Agent's upcoming/active rooms (for "Invitar a Live")
  const { data: agentRooms = [] } = useQuery({
    queryKey: ["agent-live-rooms", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("live_rooms")
        .select("id, title, scheduled_at, status, started_at")
        .eq("host_id", user.id)
        .in("status", ["scheduled", "waiting", "live"])
        .order("scheduled_at", { ascending: true })
        .limit(10);
      if (error) return [];
      return data || [];
    },
    enabled: !!user?.id,
  });

  const defaultRoom = agentRooms[0] as any;

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`wa-messages-${lead.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lead_whatsapp_messages", filter: `lead_id=eq.${lead.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["whatsapp-messages", lead.id] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [lead.id, qc]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const sendMsg = useMutation({
    mutationFn: async (payload: { body?: string; template_id?: string }) => {
      if (!lead.telefono) throw new Error("Lead sin teléfono");
      const { data, error } = await supabase.functions.invoke("send-whatsapp-message", {
        body: {
          lead_id: lead.id,
          to_phone: lead.telefono,
          body: payload.body,
          template_id: payload.template_id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      setText("");
      setSelectedTemplate("");
      qc.invalidateQueries({ queryKey: ["whatsapp-messages", lead.id] });
      toast.success("Mensaje enviado");
    },
    onError: (err: Error) => toast.error(err.message || "Error al enviar"),
  });

  const handleSend = () => {
    if (!text.trim() && !selectedTemplate) return;
    if (selectedTemplate) {
      sendMsg.mutate({ template_id: selectedTemplate });
    } else {
      sendMsg.mutate({ body: text.trim() });
    }
  };

  const handleInviteToLive = () => {
    let room: any = defaultRoom;
    if (selectedRoom !== "auto") {
      room = agentRooms.find((r: any) => r.id === selectedRoom);
    }
    if (!room) {
      toast.error("No tienes salas activas o programadas");
      return;
    }
    const liveUrl = `${window.location.origin}/live/guest/${room.id}`;
    const inviteText = `🎙️ ¡Hola ${lead.nombre}! Te invito a mi sala en vivo "${room.title}". Únete aquí: ${liveUrl}`;
    sendMsg.mutate({ body: inviteText });
  };

  if (!lead.telefono) {
    return (
      <div className="p-4 bg-muted/30 rounded-lg text-sm text-muted-foreground text-center">
        Este lead no tiene número de teléfono registrado.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border border-border rounded-lg bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-emerald-500/5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-sm font-semibold">WhatsApp</span>
          <span className="text-xs text-muted-foreground">{lead.telefono}</span>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          {messages.length} mensajes
        </Badge>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="max-h-80 overflow-y-auto px-3 py-2 space-y-2 bg-[hsl(var(--muted))/0.2]">
        {isLoading && (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
            <Loader2 className="w-3 h-3 animate-spin" /> Cargando...
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">
            Aún no hay mensajes. Envía el primero para iniciar la conversación.
          </p>
        )}
        {messages.map((m: any) => {
          const isOut = m.direction === "outbound";
          return (
            <div key={m.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm ${
                  isOut
                    ? "bg-emerald-500/10 text-foreground border border-emerald-500/20"
                    : "bg-secondary text-foreground border border-border"
                }`}
              >
                {m.template_id && (
                  <Badge variant="outline" className="text-[9px] mb-1 gap-1">
                    <FileText className="w-2.5 h-2.5" /> Plantilla
                  </Badge>
                )}
                {m.media_url && (
                  <div className="mb-1">
                    {m.media_content_type?.startsWith("image/") ? (
                      <img src={m.media_url} alt="media" className="max-w-full rounded" />
                    ) : m.media_content_type?.startsWith("video/") ? (
                      <video src={m.media_url} controls className="max-w-full rounded" />
                    ) : (
                      <a href={m.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                        <Paperclip className="w-3 h-3" /> Adjunto
                      </a>
                    )}
                  </div>
                )}
                {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                <div className="flex items-center gap-1 justify-end mt-0.5 text-[10px] text-muted-foreground">
                  <span>{format(new Date(m.created_at), "HH:mm")}</span>
                  {isOut && statusIcon(m.status)}
                </div>
                {m.error_message && (
                  <p className="text-[10px] text-destructive mt-1">⚠ {m.error_message}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div className="px-3 py-2 border-t border-border space-y-2">
        {/* Template selector */}
        {templates.length > 0 && (
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="📄 Usar plantilla aprobada (opcional)" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t: any) => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="font-medium">{t.name}</span>{" "}
                  <span className="text-muted-foreground text-xs">— {t.body.substring(0, 40)}...</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Text */}
        <div className="flex gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={selectedTemplate ? "Plantilla seleccionada — el cuerpo va incluido" : "Escribe un mensaje..."}
            disabled={!!selectedTemplate}
            rows={2}
            className="text-sm resize-none flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={sendMsg.isPending || (!text.trim() && !selectedTemplate)}
            className="self-end gap-1"
          >
            {sendMsg.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Enviar
          </Button>
        </div>

        {/* Invite to Live */}
        <div className="flex items-center gap-2 pt-1 border-t border-border">
          <Video className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs text-muted-foreground">Invitar a Live:</span>
          <Select value={selectedRoom} onValueChange={setSelectedRoom}>
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue placeholder="Sala..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">
                {defaultRoom ? `🎯 Mi próxima sala: ${defaultRoom.title}` : "Sin salas disponibles"}
              </SelectItem>
              {agentRooms.map((r: any) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.status === "live" ? "🔴 " : "📅 "} {r.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={handleInviteToLive}
            disabled={sendMsg.isPending || agentRooms.length === 0}
          >
            <Send className="w-3 h-3" /> Invitar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppChatPanel;
