import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { LiveKitRoom, useLocalParticipant, useRoomContext, useTracks, VideoTrack, RoomAudioRenderer, ControlBar } from "@livekit/components-react";
import { RoomEvent, Track, LocalVideoTrack } from "livekit-client";
import "@livekit/components-styles";
import { supabase } from "@/integrations/supabase/client";
import logoSrc from "@/assets/logo-bullfy.png";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toastUtils";
import { PhoneOff, Radio, Users, PanelRightClose, PanelRightOpen, MessageCircle, MessageCircleOff, Brain, BrainCircuit } from "lucide-react";
import InviteCodeManager from "./InviteCodeManager";
import InvitationButton from "./InvitationButton";
import JoinRequestsPanel from "./JoinRequestsPanel";
import WaitingRoomConfig from "./WaitingRoomConfig";
import WaitingRoomViewer from "./WaitingRoomViewer";
import HostCTAPanel from "./HostCTAPanel";
import HostCTAFilesPanel from "./HostCTAFilesPanel";
import LiveChat from "./LiveChat";
import ParticipantsSidebar from "./ParticipantsSidebar";
import StreamRecorder from "./StreamRecorder";
import LiveReactions from "./LiveReactions";
import ViewerCTABanner from "./ViewerCTABanner";
import { OverlayManagerHost, OverlayDisplay } from "./OverlayManager";
import SharedVideoStage from "./SharedVideoStage";
import VirtualBackgroundSelector from "./VirtualBackgroundSelector";
import HostTickerPanel from "./HostTickerPanel";
import HostNewsTickerPanel from "./HostNewsTickerPanel";
import ViewerTickerStrip from "./ViewerTickerStrip";
import ViewerNewsTickerStrip from "./ViewerNewsTickerStrip";
import YouTubeRestreamPanel from "./YouTubeRestreamPanel";
import AutoStreamTranscription from "./AutoStreamTranscription";
import MeetingStage from "./MeetingStage";
import HostControlPanel from "./HostControlPanel";
import BreakoutRoomsManager from "./BreakoutRoomsManager";
import EgressRecordingPanel from "./EgressRecordingPanel";
import MeetingPolls from "./MeetingPolls";
import MeetingHostShell from "./MeetingHostShell";
import HostPreStreamLobby from "./HostPreStreamLobby";
import SafeLiveKitGate from "./SafeLiveKitGate";
/** Small wrapper that extracts localParticipant inside LiveKitRoom context */
const ConnectedCTAPanel = () => {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  return <HostCTAPanel localParticipant={localParticipant} />;
};

const ConnectedTickerPanel = ({ roomId }: { roomId: string }) => {
  const { localParticipant } = useLocalParticipant();
  return <HostTickerPanel localParticipant={localParticipant} roomId={roomId} />;
};

const ConnectedNewsTickerPanel = ({ roomId }: { roomId: string }) => {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  return <HostNewsTickerPanel localParticipant={localParticipant} roomId={roomId} />;
};


/** Inner component rendered inside LiveKitRoom — has access to room context */
const ConnectedHostContent = ({
  showParticipants,
  roomId,
  hostId,
  userName,
  chatEnabled,
  onToggleChat,
  onEndStream,
  isPublicStream,
  roomType,
  roomTitle,
}: {
  showParticipants: boolean;
  roomId: string;
  hostId: string;
  userName: string;
  chatEnabled: boolean;
  onToggleChat: () => void;
  onEndStream: () => void;
  isPublicStream: boolean;
  roomType: string;
  roomTitle: string;
}) => {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const isInternalStream = isPublicStream; // is_public_stream in DB = internal team stream
  const [transcriptionEnabled, setTranscriptionEnabled] = useState(!isInternalStream);
  const [raisedHands, setRaisedHands] = useState<Map<string, string>>(new Map());
  const [pinnedIdentity, setPinnedIdentity] = useState<string | null>(null);
  const lkRoom = useRoomContext();
  
  // Get local video track for virtual backgrounds
  const videoTracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const localVideoTrack = videoTracks.find(
    t => t.participant.identity === localParticipant.identity && t.source === Track.Source.Camera
  )?.publication?.track as LocalVideoTrack | undefined;
  // Listen for co-stream accept / decline / hand-raise / hand-lower from viewers
  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === "costream-accept") {
          toast.success(`${msg.viewerName} aceptó la invitación a co-transmitir 🎉`);
          setRaisedHands(prev => { const n = new Map(prev); n.delete(msg.viewerName ? undefined : msg.identity); return n; });
        }
        if (msg.type === "costream-decline") {
          toast.info(`${msg.viewerName} rechazó la invitación`);
        }
        if (msg.type === "hand-raise") {
          setRaisedHands(prev => new Map(prev).set(msg.identity, msg.name));
          toast.info(`✋ ${msg.name} ha levantado la mano`);
        }
        if (msg.type === "hand-lower") {
          setRaisedHands(prev => { const n = new Map(prev); n.delete(msg.identity); return n; });
        }
      } catch {}
    };
    lkRoom.on(RoomEvent.DataReceived, handleData);
    return () => {
      lkRoom.off(RoomEvent.DataReceived, handleData);
    };
  }, [lkRoom]);

  const handleInviteCoStream = useCallback(
    (participantIdentity: string) => {
      const hostName = localParticipant.name || localParticipant.identity;
      const data = new TextEncoder().encode(
        JSON.stringify({
          type: "costream-invite",
          targetIdentity: participantIdentity,
          hostName,
        })
      );
      localParticipant.publishData(data, { reliable: true });
      toast.info(`Invitación enviada a ${participantIdentity}`);
    },
    [localParticipant]
  );

  const handleRevokeCoStream = useCallback(
    async (participantIdentity: string) => {
      console.log("[REVOKE-CO-HOST] Starting revoke", {
        participantIdentity,
        livekitRoomName: lkRoom.name,
        roomId,
        hostIdentity: localParticipant.identity,
      });

      // 1) LiveKit DataChannel (avisa al cliente para volver a viewer mode)
      try {
        const data = new TextEncoder().encode(
          JSON.stringify({
            type: "costream-revoke",
            targetIdentity: participantIdentity,
          })
        );
        localParticipant.publishData(data, { reliable: true });
        console.log("[REVOKE-CO-HOST] DataChannel sent OK");
      } catch (e) {
        console.warn("[REVOKE-CO-HOST] DataChannel revoke failed:", e);
      }

      // 2) Supabase Realtime broadcast (fallback de notificación)
      supabase.channel(`costream-signal-${roomId}`)
        .send({
          type: "broadcast",
          event: "costream-revoke",
          payload: { targetIdentity: participantIdentity },
        })
        .then(() => console.log("[REVOKE-CO-HOST] Realtime broadcast sent"))
        .catch((e: any) => console.warn("[REVOKE-CO-HOST] Realtime revoke error:", e));

      // 3) Server-side AUTORITATIVO: revoca permisos via LiveKit Server API
      try {
        console.log("[REVOKE-CO-HOST] Invoking edge function with:", {
          roomName: lkRoom.name,
          targetIdentity: participantIdentity,
        });
        const { data, error } = await supabase.functions.invoke("livekit-revoke-publisher", {
          body: {
            roomName: lkRoom.name,
            targetIdentity: participantIdentity,
          },
        });
        console.log("[REVOKE-CO-HOST] Edge function response:", { data, error });
        if (error || !data?.success) {
          throw new Error(error?.message || data?.error || "Failed to revoke");
        }
        toast.success(`Co-transmisión revocada (${participantIdentity})`);
      } catch (err: any) {
        console.error("[REVOKE-CO-HOST] Server-side revoke failed:", err);
        toast.error("Error al revocar co-transmisión: " + (err?.message || "desconocido"));
      }
    },
    [localParticipant, roomId, lkRoom]
  );

  const broadcastChatToggle = useCallback((enabled: boolean) => {
    const data = new TextEncoder().encode(JSON.stringify({ type: "chat-toggle", enabled }));
    localParticipant.publishData(data, { reliable: true });
  }, [localParticipant]);

  const handleToggleChat = useCallback(() => {
    const newState = !chatEnabled;
    broadcastChatToggle(newState);
    onToggleChat();
  }, [chatEnabled, broadcastChatToggle, onToggleChat]);

  const handleBroadcastEndAndLeave = useCallback(() => {
    try {
      const data = new TextEncoder().encode(JSON.stringify({ type: "stream-ended" }));
      localParticipant.publishData(data, { reliable: true });
    } catch {}
    setTimeout(() => onEndStream(), 400);
  }, [localParticipant, onEndStream]);

  // Listen for end-stream custom event from the outer button
  useEffect(() => {
    const handler = () => handleBroadcastEndAndLeave();
    window.addEventListener("bullfy-end-stream", handler);
    return () => window.removeEventListener("bullfy-end-stream", handler);
  }, [handleBroadcastEndAndLeave]);

  // Use the unified Broadcast Control Suite for ALL modes (meeting / bullfy_family / webinar_pro / broadcast)
  const shellMode = (roomType === "meeting" || roomType === "webinar_pro" || roomType === "bullfy_family")
    ? roomType
    : "broadcast";
  const isMeetingMode = shellMode !== "broadcast";
  return (
    <MeetingHostShell
      roomId={roomId}
      roomTitle={roomTitle}
      hostId={hostId}
      userName={userName}
      livekitRoomName={lkRoom.name || ""}
      isInternalStream={isInternalStream}
      chatEnabled={chatEnabled}
      onToggleChat={handleToggleChat}
      onEndStream={handleBroadcastEndAndLeave}
      onInviteCoStream={handleInviteCoStream}
      onRevokeCoStream={handleRevokeCoStream}
      raisedHands={raisedHands}
      pinnedIdentity={pinnedIdentity}
      onPinChange={setPinnedIdentity}
      invitationButton={isMeetingMode ? <InvitationButton roomId={roomId} /> : <InviteCodeManager roomId={roomId} />}
      mode={shellMode}
    />
  );
};

interface LiveStreamHostProps {
  room: { id: string; title: string; livekit_room_name: string; is_public_stream?: boolean; room_type?: string };
  userName: string;
  onEnd: () => void;
}

const LiveStreamHost = ({ room, userName, onEnd }: LiveStreamHostProps) => {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string>("");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);
  const [chatEnabled, setChatEnabled] = useState(true);

  // Heartbeat: update room's updated_at every 2 minutes to prevent auto-close
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(async () => {
      await supabase
        .from("live_rooms")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", room.id);
    }, 2 * 60 * 1000); // every 2 minutes
    return () => clearInterval(interval);
  }, [connected, room.id]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      // Set room to live
      await supabase.from("live_rooms").update({ status: "live", started_at: new Date().toISOString() }).eq("id", room.id);

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
            role: "host",
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error getting token");
      setToken(json.token);
      setLivekitUrl(json.url);
    } catch (err: any) {
      toast.error("Error al conectar: " + err.message);
    }
    setConnecting(false);
  }, [room, userName]);

  // Before connecting - meeting modes use the new pre-stream lobby with join requests
  if (!token) {
    const isMeetingMode = room.room_type === "meeting" || room.room_type === "webinar_pro" || room.room_type === "bullfy_family";
    if (isMeetingMode) {
      return (
        <div style={{ height: "calc(100vh - 120px)" }}>
          <HostPreStreamLobby
            roomId={room.id}
            roomTitle={room.title}
            roomType={room.room_type as "meeting" | "webinar_pro" | "bullfy_family"}
            starting={connecting}
            onStart={connect}
            onCancel={onEnd}
            invitationButton={<InvitationButton roomId={room.id} />}
          />
        </div>
      );
    }
    // Legacy broadcast prep screen (educational / public streams)
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-3 py-2">
          <span className="text-2xl font-bold tracking-tight" style={{ color: "#146EF5", fontFamily: "Figtree, sans-serif" }}>
            Bullfy Live System
          </span>
          <img src={logoSrc} alt="Bullfy" className="h-8 w-auto" />
        </div>
        <div className="flex gap-4" style={{ height: "calc(100vh - 250px)" }}>
          {/* Main area — waiting room preview */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-display font-bold text-foreground">{room.title}</h2>
                <p className="text-sm text-muted-foreground">Los espectadores ven la sala de espera</p>
              </div>
              <div className="flex gap-2">
                <InviteCodeManager roomId={room.id} />
                <Button variant="outline" onClick={onEnd}>Cancelar</Button>
              </div>
            </div>
            {/* Waiting room preview */}
            <div className="flex-1 rounded-lg overflow-hidden border border-border relative">
              <WaitingRoomViewer roomId={room.id} />
              {/* Overlay button */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
                <Button size="lg" onClick={connect} disabled={connecting} className="shadow-lg">
                  {connecting ? "Conectando..." : "🔴 Iniciar Transmisión en Vivo"}
                </Button>
              </div>
            </div>
          </div>
          {/* Side panel — waiting config + CTA file library (CTA broadcast panel only works inside LiveKitRoom) */}
          <div className="w-72 shrink-0 overflow-y-auto space-y-4">
            <WaitingRoomConfig roomId={room.id} />
            <HostCTAFilesPanel />
          </div>
        </div>
      </div>
    );
  }

  // All modes now use the unified Broadcast Control Suite shell — no external header needed
  return (
    <div className="space-y-0">
      <div style={{ height: "calc(100vh - 80px)" }}>
        <LiveKitRoom
          serverUrl={livekitUrl}
          token={token}
          connect={true}
          onConnected={() => setConnected(true)}
          onDisconnected={() => setConnected(false)}
          style={{ height: "100%" }}
        >
          <SafeLiveKitGate label="Iniciando transmisión...">
            <ConnectedHostContent
              showParticipants={showParticipants}
              roomId={room.id}
              hostId={user?.id || ""}
              userName={userName}
              chatEnabled={chatEnabled}
              onToggleChat={() => setChatEnabled(prev => !prev)}
              onEndStream={onEnd}
              isPublicStream={room.is_public_stream ?? false}
              roomType={room.room_type || "broadcast"}
              roomTitle={room.title}
            />
          </SafeLiveKitGate>
        </LiveKitRoom>
      </div>
    </div>
  );
};

export default LiveStreamHost;
