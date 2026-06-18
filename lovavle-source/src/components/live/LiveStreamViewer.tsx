import { useState, useCallback, useEffect } from "react";
import { useViewerPresence } from "@/hooks/useViewerPresence";
import LiveStreamVoting from "./LiveStreamVoting";
import { LiveKitRoom, useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import CoStreamInviteDialog from "./CoStreamInviteDialog";
import "@livekit/components-styles";
import { supabase } from "@/integrations/supabase/client";
import WaitingRoomViewer from "./WaitingRoomViewer";
import MeetingViewerShell from "./MeetingViewerShell";
import CoHostShell from "./CoHostShell";
import SafeLiveKitGate from "./SafeLiveKitGate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toastUtils";
import { ArrowLeft, Eye } from "lucide-react";
import { useLiveKitReady } from "@/hooks/useLiveKitReady";

interface LiveStreamViewerProps {
  room: { id: string; title: string; livekit_room_name: string; status?: string; room_type?: string };
  userName: string;
  onLeave: () => void;
}

/** Inner content rendered inside LiveKitRoom for viewers */
const ViewerContent = ({
  showParticipants,
  isCoHost,
  onAcceptCoStream,
  onExitCoHost,
  roomId,
  roomTitle,
  roomType,
  onLeave,
}: {
  showParticipants: boolean;
  isCoHost: boolean;
  onAcceptCoStream: () => void;
  onExitCoHost: () => void;
  roomId: string;
  roomTitle: string;
  roomType: string;
  onLeave: () => void;
}) => {
  const [chatEnabled, setChatEnabled] = useState(true);
  const lkRoom = useRoomContext();
  const isLkReady = useLiveKitReady(lkRoom);

  useEffect(() => {
    if (!lkRoom || !isLkReady) return;

    const handleData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === "chat-toggle") {
          setChatEnabled(msg.enabled);
        }
        if (msg.type === "stream-ended") {
          toast.info("La transmisión ha finalizado.");
          setTimeout(() => {
            onLeave();
          }, 1500);
        }
        if (msg.type === "costream-revoke" && msg.targetIdentity === lkRoom.localParticipant?.identity) {
          toast.info("El host ha revocado tu co-transmisión. Volviendo a modo espectador...");
          window.dispatchEvent(new CustomEvent("bullfy-costream-revoke"));
        }
        if (msg.type === "host-mute-all") {
          try {
            lkRoom.localParticipant?.setMicrophoneEnabled(false);
            toast.info("🔇 El host silenció a todos los participantes");
          } catch {}
        }
        if (msg.type === "host-kick" && msg.targetIdentity === lkRoom.localParticipant?.identity) {
          toast.warning("Has sido removido de la sala por el host");
          setTimeout(() => { onLeave(); }, 1200);
        }
        if (msg.type === "host-lower-hands") {
          window.dispatchEvent(new CustomEvent("bullfy-lower-hand"));
        }
        if (msg.type === "breakout-assign" && msg.targetIdentity === lkRoom.localParticipant?.identity) {
          toast.info(`Te asignaron a un breakout: ${msg.breakoutName || "sala"}`);
        }
      } catch {}
    };
    lkRoom.on(RoomEvent.DataReceived, handleData);
    return () => { lkRoom.off(RoomEvent.DataReceived, handleData); };
  }, [lkRoom, isLkReady]);

  useEffect(() => {
    if (!lkRoom || !isLkReady) return;
    const channel = supabase.channel(`costream-signal-${roomId}`)
      .on("broadcast", { event: "costream-revoke" }, (payload: any) => {
        const msg = payload.payload;
        if (msg?.targetIdentity === lkRoom.localParticipant?.identity) {
          toast.info("El host ha revocado tu co-transmisión. Volviendo a modo espectador...");
          window.dispatchEvent(new CustomEvent("bullfy-costream-revoke"));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, lkRoom, isLkReady]);

  // Use the unified Broadcast Control Suite for ALL modes (meeting / webinar_pro / bullfy_family / broadcast)
  const shellMode: "meeting" | "webinar_pro" | "bullfy_family" | "broadcast" =
    roomType === "meeting" || roomType === "webinar_pro" || roomType === "bullfy_family"
      ? roomType
      : "broadcast";

  // Co-Host: shell idéntico al host (header azul + stage + footer azul con controles de media)
  if (isCoHost) {
    return (
      <>
        <CoStreamInviteDialog onAcceptCoStream={onAcceptCoStream} />
        <CoHostShell
          roomId={roomId}
          roomTitle={roomTitle}
          chatEnabled={chatEnabled}
          onExitCoHost={onExitCoHost}
        />
      </>
    );
  }

  return (
    <>
      <CoStreamInviteDialog onAcceptCoStream={onAcceptCoStream} />
      <MeetingViewerShell
        roomId={roomId}
        roomTitle={roomTitle}
        roomType={shellMode}
        isCoHost={isCoHost}
        chatEnabled={chatEnabled}
        onLeave={onLeave}
      />
    </>
  );
};

const LiveStreamViewer = ({ room, userName, onLeave }: LiveStreamViewerProps) => {
  const [token, setToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string>("");
  const [connecting, setConnecting] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [isCoHost, setIsCoHost] = useState(false);
  const [showVoting, setShowVoting] = useState(false);
  const [roomStatus, setRoomStatus] = useState(room.status || "live");

  // Listen for room status changes (waiting → live)
  useEffect(() => {
    const channel = supabase
      .channel(`room-status-${room.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "live_rooms",
        filter: `id=eq.${room.id}`,
      }, (payload: any) => {
        if (payload.new?.status) {
          setRoomStatus(payload.new.status);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [room.id]);

  useViewerPresence({
    roomId: room.id,
    userName,
    enabled: !!token,
  });

  const handleLeave = useCallback(() => {
    setShowVoting(true);
  }, []);

  const handleVotingClose = useCallback((open: boolean) => {
    setShowVoting(open);
    if (!open) onLeave();
  }, [onLeave]);

  const fetchToken = useCallback(async (role: "viewer" | "host") => {
    const { data: sessionData } = await supabase.auth.getSession();
    const jwt = sessionData?.session?.access_token;
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/livekit-token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          roomName: room.livekit_room_name,
          participantName: userName,
          role,
        }),
      }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error getting token");
    return json;
  }, [room, userName]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const json = await fetchToken("viewer");
      setToken(json.token);
      setLivekitUrl(json.url);
    } catch (err: any) {
      toast.error("Error al conectar: " + err.message);
    }
    setConnecting(false);
  }, [fetchToken]);

  const handleAcceptCoStream = useCallback(async () => {
    try {
      toast.info("Activando modo co-transmisor...");
      const json = await fetchToken("host");
      setToken(json.token);
      setLivekitUrl(json.url);
      setIsCoHost(true);
      toast.success("¡Modo co-transmisor activado! Puedes encender tu cámara y micrófono.");
    } catch (err: any) {
      toast.error("Error al activar co-transmisión: " + err.message);
    }
  }, [fetchToken]);

  const handleRevokeCoStream = useCallback(async () => {
    try {
      const json = await fetchToken("viewer");
      setToken(json.token);
      setLivekitUrl(json.url);
      setIsCoHost(false);
    } catch (err: any) {
      toast.error("Error al volver a modo espectador: " + err.message);
    }
  }, [fetchToken]);

  useEffect(() => {
    const handler = () => { handleRevokeCoStream(); };
    window.addEventListener("bullfy-costream-revoke", handler);
    return () => window.removeEventListener("bullfy-costream-revoke", handler);
  }, [handleRevokeCoStream]);

  // Note: el listener Realtime de costream-revoke vive ahora dentro de ViewerContent
  // (donde tenemos acceso al lkRoom.localParticipant.identity REAL para identity matching).

  if (!token) {
    // Show waiting room if status is "waiting"
    if (roomStatus === "waiting") {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-2">
            <Button variant="ghost" size="sm" onClick={onLeave}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Volver
            </Button>
            <h2 className="text-xl font-display font-bold">{room.title}</h2>
            <Badge className="animate-pulse text-xs bg-amber-600">SALA DE ESPERA</Badge>
          </div>
          <div style={{ height: "calc(100vh - 200px)" }} className="rounded-lg overflow-hidden border border-border">
            <WaitingRoomViewer roomId={room.id} />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onLeave}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver
          </Button>
          <h2 className="text-xl font-display font-bold">{room.title}</h2>
          <Badge variant="destructive" className="animate-pulse text-xs">LIVE</Badge>
        </div>
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Eye className="w-16 h-16 text-primary/50" />
          <p className="text-lg font-medium">Unirte al stream</p>
          <Button size="lg" onClick={connect} disabled={connecting}>
            {connecting ? "Conectando..." : "📺 Ver Stream"}
          </Button>
        </div>
      </div>
    );
  }

  // All modes now use the unified Broadcast Control Suite shell
  return (
    <div>
      <div style={{ height: "calc(100vh - 80px)" }}>
        <LiveKitRoom
          key={isCoHost ? "cohost" : "viewer"}
          serverUrl={livekitUrl}
          token={token}
          connect={true}
          style={{ height: "100%" }}
          options={{ adaptiveStream: true, dynacast: true }}
        >
          <SafeLiveKitGate>
            <ViewerContent
              showParticipants={showParticipants}
              isCoHost={isCoHost}
              onAcceptCoStream={handleAcceptCoStream}
              onExitCoHost={handleRevokeCoStream}
              roomId={room.id}
              roomTitle={room.title}
              roomType={room.room_type || "broadcast"}
              onLeave={handleLeave}
            />
          </SafeLiveKitGate>
        </LiveKitRoom>
      </div>
      <LiveStreamVoting
        roomId={room.id}
        roomTitle={room.title}
        open={showVoting}
        onOpenChange={handleVotingClose}
      />
    </div>
  );
};

export default LiveStreamViewer;
