import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useLocalParticipant, useRoomContext, RoomAudioRenderer, useTracks, ControlBar } from "@livekit/components-react";
import { Track, RoomEvent, type LocalVideoTrack } from "livekit-client";
import { Button } from "@/components/ui/button";
import {
  Users,
  MessageSquare,
  Megaphone,
  BarChart3,
  Hand,
  ScrollText,
  Settings,
  Video,
  DoorOpen,
  Layers,
  Youtube,
  X,
  Brain,
  LineChart,
} from "lucide-react";
import MeetingStage from "./MeetingStage";
import RiskCalculatorOverlay from "./RiskCalculatorOverlay";
import RiskCalculatorHostToggle from "./RiskCalculatorHostToggle";
import HostAudioToggle from "./HostAudioToggle";
import HostControlPanel from "./HostControlPanel";
import HostCTAPanel from "./HostCTAPanel";
import HostCTAFilesPanel from "./HostCTAFilesPanel";
import HostTickerPanel from "./HostTickerPanel";
import HostNewsTickerPanel from "./HostNewsTickerPanel";
import LiveChat, { type ChatMessage } from "./LiveChat";
import ParticipantsSidebar from "./ParticipantsSidebar";
import StreamRecorder from "./StreamRecorder";
import RecordingStatusPanel from "./RecordingStatusPanel";
import VirtualBackgroundSelector from "./VirtualBackgroundSelector";
import YouTubeRestreamPanel from "./YouTubeRestreamPanel";
import EgressRecordingPanel from "./EgressRecordingPanel";
import MeetingPolls from "./MeetingPolls";
import BreakoutRoomsManager from "./BreakoutRoomsManager";
import JoinRequestsPanel from "./JoinRequestsPanel";
import AutoStreamTranscription from "./AutoStreamTranscription";
import { OverlayManagerHost, OverlayDisplay } from "./OverlayManager";
import LiveReactions from "./LiveReactions";
import ViewerCTABanner from "./ViewerCTABanner";
import ViewerTickerStrip from "./ViewerTickerStrip";
import ViewerNewsTickerStrip from "./ViewerNewsTickerStrip";
import NextRedFolderBadge from "./NextRedFolderBadge";
import StageNotifications, { type StageNotification } from "./StageNotifications";
import { supabase } from "@/integrations/supabase/client";
import HostTranslationToggle from "./HostTranslationToggle";
import MeetingTranslationPanel from "./MeetingTranslationPanel";
import { TradingViewOverlayHost, TradingViewOverlayDisplay } from "./TradingViewOverlay";
import { useTranslationPublisher } from "@/hooks/useTranslationPublisher";
import { useHostPortalContext } from "@/hooks/useHostPortalContext";

type ToolKey =
  | "participants"
  | "chat"
  | "polls"
  | "cta"
  | "ticker"
  | "recording"
  | "requests"
  | "breakout"
  | "youtube"
  | "settings"
  | "transcription"
  | "tradingview";

interface MeetingHostShellProps {
  roomId: string;
  roomTitle: string;
  hostId: string;
  userName: string;
  livekitRoomName: string;
  isInternalStream: boolean;
  chatEnabled: boolean;
  onToggleChat: () => void;
  onEndStream: () => void;
  onInviteCoStream: (identity: string) => void;
  onRevokeCoStream: (identity: string) => void;
  raisedHands: Map<string, string>;
  pinnedIdentity: string | null;
  onPinChange: (identity: string | null) => void;
  invitationButton: ReactNode;
  mode?: "meeting" | "webinar_pro" | "bullfy_family" | "broadcast";
}

const TOOL_LABELS: Record<ToolKey, { label: string; icon: typeof Users }> = {
  participants: { label: "Participantes", icon: Users },
  chat: { label: "Chat", icon: MessageSquare },
  polls: { label: "Encuestas", icon: BarChart3 },
  cta: { label: "CTA", icon: Megaphone },
  ticker: { label: "Ticker", icon: ScrollText },
  recording: { label: "Grabar", icon: Video },
  requests: { label: "Solicitudes", icon: Hand },
  breakout: { label: "Salas", icon: Layers },
  youtube: { label: "YouTube", icon: Youtube },
  settings: { label: "Fondos/Overlay", icon: Settings },
  transcription: { label: "IA", icon: Brain },
  tradingview: { label: "Gráfico", icon: LineChart },
};

const ignoreStorageError = () => undefined;

const MeetingHostShell = ({
  roomId,
  roomTitle,
  hostId,
  userName,
  livekitRoomName,
  isInternalStream,
  chatEnabled,
  onToggleChat,
  onEndStream,
  onInviteCoStream,
  onRevokeCoStream,
  raisedHands,
  pinnedIdentity,
  onPinChange,
  invitationButton,
  mode = "meeting",
}: MeetingHostShellProps) => {
  const isBroadcast = mode === "broadcast";
  const [activeTool, setActiveTool] = useState<ToolKey | null>(isBroadcast ? "chat" : "participants");
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const lkRoom = useRoomContext();
  const videoTracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const localVideoTrack = videoTracks.find(
    (t) => t.participant.identity === localParticipant.identity && t.source === Track.Source.Camera
  )?.publication?.track as LocalVideoTrack | undefined;

  // ── Lifted chat state with sessionStorage persistence ──
  const chatStorageKey = `bullfy-chat-host-${roomId}`;
  const draftStorageKey = `bullfy-chat-draft-host-${roomId}`;
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const raw = sessionStorage.getItem(chatStorageKey);
      if (raw) return JSON.parse(raw);
    } catch { ignoreStorageError(); }
    return [];
  });
  const [chatDraft, setChatDraft] = useState<string>(() => {
    try { return sessionStorage.getItem(draftStorageKey) ?? ""; } catch { return ""; }
  });
  const activeToolRef = useRef<ToolKey | null>(null);
  const [unreadChat, setUnreadChat] = useState(0);
  const [unreadRequests, setUnreadRequests] = useState(0);
  const [notifications, setNotifications] = useState<StageNotification[]>([]);
  const seenHandsRef = useRef<Set<string>>(new Set());
  const translationStorageKey = `bullfy-live-translation-host-${roomId}`;
  const [translationEnabled, setTranslationEnabled] = useState<boolean>(() => {
    try { return sessionStorage.getItem(translationStorageKey) === "true"; } catch { return false; }
  });
  const translationPublisher = useTranslationPublisher({ roomId, hostId, enabled: translationEnabled });
  const { portalId: hostPortalId, partnerUserId: hostPartnerUserId } = useHostPortalContext(roomId);

  useEffect(() => {
    try { sessionStorage.setItem(chatStorageKey, JSON.stringify(chatMessages)); } catch { ignoreStorageError(); }
  }, [chatMessages, chatStorageKey]);
  useEffect(() => {
    try { sessionStorage.setItem(draftStorageKey, chatDraft); } catch { ignoreStorageError(); }
  }, [chatDraft, draftStorageKey]);
  useEffect(() => {
    try { sessionStorage.setItem(translationStorageKey, String(translationEnabled)); } catch { ignoreStorageError(); }
  }, [translationEnabled, translationStorageKey]);

  const pushNotification = useCallback((n: Omit<StageNotification, "id" | "createdAt">) => {
    setNotifications((prev) => [
      ...prev,
      { ...n, id: crypto.randomUUID(), createdAt: Date.now() },
    ]);
  }, []);
  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === "chat") {
          setChatMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), sender: msg.sender, text: msg.text, timestamp: msg.timestamp },
          ]);
          const isSelf = msg.sender === (localParticipant.name || localParticipant.identity);
          if (!isSelf && activeToolRef.current !== "chat") {
            setUnreadChat((c) => c + 1);
            pushNotification({
              type: "chat",
              title: `Nuevo mensaje de ${msg.sender}`,
              body: msg.text,
            });
          }
        }
      } catch { ignoreStorageError(); }
    };
    lkRoom.on(RoomEvent.DataReceived, handleData);
    return () => { lkRoom.off(RoomEvent.DataReceived, handleData); };
  }, [lkRoom, localParticipant, pushNotification]);

  // Detect new raised hands → toast
  useEffect(() => {
    raisedHands.forEach((name, identity) => {
      if (!seenHandsRef.current.has(identity)) {
        seenHandsRef.current.add(identity);
        if (activeToolRef.current !== "requests") {
          pushNotification({ type: "hand", title: `${name} levantó la mano` });
        }
      }
    });
    seenHandsRef.current.forEach((id) => {
      if (!raisedHands.has(id)) seenHandsRef.current.delete(id);
    });
  }, [raisedHands, pushNotification]);

  // Subscribe to join requests for notification badge
  useEffect(() => {
    const channel = supabase
      .channel(`host-shell-join-${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_room_join_requests", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const req = payload.new as { status?: string; requester_name?: string };
          if (req?.status !== "pending") return;
          if (activeToolRef.current !== "requests") {
            setUnreadRequests((c) => c + 1);
            pushNotification({
              type: "join",
              title: "Nueva solicitud para entrar",
              body: req.requester_name,
            });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, pushNotification]);

  const handleSendChat = useCallback((text: string) => {
    if (!localParticipant) return;
    const payload = {
      type: "chat",
      sender: localParticipant.name || localParticipant.identity,
      text,
      timestamp: Date.now(),
    };
    const data = new TextEncoder().encode(JSON.stringify(payload));
    localParticipant.publishData(data, { reliable: true });
    setChatMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), sender: payload.sender, text, timestamp: payload.timestamp },
    ]);
  }, [localParticipant]);

  const toggleTool = (key: ToolKey) => {
    setActiveTool((prev) => {
      const next = prev === key ? null : key;
      if (next === "chat") setUnreadChat(0);
      if (next === "requests") setUnreadRequests(0);
      return next;
    });
  };
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);

  const renderToolPanel = () => {
    switch (activeTool) {
      case "participants":
        return (
          <ParticipantsSidebar
            isHost
            onInviteCoStream={onInviteCoStream}
            onRevokeCoStream={onRevokeCoStream}
            raisedHands={raisedHands}
          />
        );
      case "chat":
        return (
          <div className="flex flex-col h-full">
            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{chatEnabled ? "Chat activo" : "Chat deshabilitado"}</span>
              <Button variant="ghost" size="sm" onClick={onToggleChat} className="h-7 text-xs">
                {chatEnabled ? "Desactivar" : "Activar"}
              </Button>
            </div>
            <div className="flex-1 min-h-0">
              <LiveChat
                chatEnabled={chatEnabled}
                messages={chatMessages}
                onSendMessage={handleSendChat}
                draft={chatDraft}
                onDraftChange={setChatDraft}
              />
            </div>
          </div>
        );
      case "polls":
        return (
          <div className="p-3 overflow-y-auto h-full">
            <MeetingPolls roomId={roomId} isHost />
          </div>
        );
      case "cta":
        return (
          <div className="p-3 overflow-y-auto h-full space-y-4">
            <HostCTAPanel localParticipant={localParticipant} />
            <HostCTAFilesPanel localParticipant={localParticipant} />
            <RiskCalculatorHostToggle localParticipant={localParticipant} />
          </div>
        );
      case "ticker":
        return (
          <div className="p-3 overflow-y-auto h-full space-y-4">
            <HostTickerPanel localParticipant={localParticipant} roomId={roomId} />
            <HostNewsTickerPanel localParticipant={localParticipant} roomId={roomId} />
          </div>
        );
      case "recording":
        // Actual UI rendered persistently below (see "Persistent recording mount").
        // Returning null here lets the persistent mount fill the panel via CSS.
        return null;
      case "requests":
        return (
          <div className="p-3 overflow-y-auto h-full space-y-3">
            <JoinRequestsPanel roomId={roomId} />
            <HostControlPanel pinnedIdentity={pinnedIdentity} onPinChange={onPinChange} />
          </div>
        );
      case "breakout":
        return (
          <div className="p-3 overflow-y-auto h-full">
            <BreakoutRoomsManager parentRoomId={roomId} hostId={hostId} />
          </div>
        );
      case "youtube":
        return (
          <div className="p-3 overflow-y-auto h-full">
            <YouTubeRestreamPanel roomName={lkRoom.name || ""} />
          </div>
        );
      case "transcription":
        return (
          <div className="p-3 overflow-y-auto h-full space-y-3">
            <div className="bg-card border border-border rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                🎙️ Transcripción IA activa
              </h4>
              <p className="text-xs text-muted-foreground">
                La transcripción se ejecuta automáticamente en segundo plano cuando enciendes tu micrófono.
                Al finalizar el stream, el análisis se enviará al Lead System.
              </p>
            </div>
            <HostTranslationToggle
              roomId={roomId}
              hostId={hostId}
              enabled={translationEnabled}
              onEnabledChange={setTranslationEnabled}
              {...translationPublisher}
            />
            {mode !== "broadcast" && <MeetingTranslationPanel />}
          </div>
        );
      case "tradingview":
        return (
          <div className="p-3 overflow-y-auto h-full">
            <TradingViewOverlayHost roomId={roomId} />
          </div>
        );
      case "settings":
        return (
          <div className="p-3 overflow-y-auto h-full space-y-3">
            <VirtualBackgroundSelector videoTrack={localVideoTrack} />
            <OverlayManagerHost />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#031633] text-slate-100 rounded-lg overflow-hidden border border-white/10">
      <RoomAudioRenderer />

      {/* Header */}
      <header className="h-12 border-b border-white/10 bg-[#062B63]/40 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-2 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="font-mono text-[10px] font-semibold tracking-widest text-red-400 shrink-0">EN VIVO</span>
          <div className="h-4 w-px bg-white/10 shrink-0" />
          <h1 className="text-sm font-medium tracking-tight truncate">{roomTitle}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {invitationButton}
          <Button
            variant="destructive"
            size="sm"
            onClick={onEndStream}
            className="gap-1.5 h-8 text-xs"
          >
            <DoorOpen className="w-3.5 h-3.5" /> Finalizar
          </Button>
        </div>
      </header>

      {/* Headless auto-transcription: only in Stream (broadcast) mode.
          Stays mounted across tool switches; activates with mic. */}
      {isBroadcast && !isInternalStream && (
        <div className="hidden" aria-hidden="true">
          <AutoStreamTranscription roomId={roomId} hostId={hostId} isActive={isMicrophoneEnabled} />
        </div>
      )}

      {/* Main: stage + contextual panel */}
      <main className="flex-1 flex overflow-hidden min-h-0">
        <section className="flex-1 flex flex-col bg-black/40 min-w-0 relative">
          <ViewerCTABanner />
          <OverlayDisplay roomId={roomId} portalId={hostPortalId} partnerUserId={hostPartnerUserId} />
          <TradingViewOverlayDisplay roomId={roomId} />
          <LiveReactions roomId="" isOverlay />
          <div className="flex-1 min-h-0 relative">
            <MeetingStage
              view="auto"
              pinnedIdentity={pinnedIdentity}
              isHost
              publishersOnly={mode === "broadcast"}
            />
            <StageNotifications
              notifications={notifications}
              onDismiss={dismissNotification}
              onActivate={(n) => {
                if (n.type === "chat") { setActiveTool("chat"); setUnreadChat(0); }
                else if (n.type === "hand" || n.type === "join") { setActiveTool("requests"); setUnreadRequests(0); }
                dismissNotification(n.id);
              }}
            />
            <ViewerTickerStrip />
            <ViewerNewsTickerStrip />
            <NextRedFolderBadge mode="host" />
          </div>
          <RiskCalculatorOverlay isHost />
        </section>

        {activeTool && activeTool !== "recording" && (
          <aside className="w-[320px] shrink-0 bg-[#062B63]/80 border-l border-white/10 flex flex-col">
            <div className="h-10 px-4 border-b border-white/10 flex items-center justify-between bg-[#031633]">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-white/70">
                {TOOL_LABELS[activeTool].label}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTool(null)}
                className="h-6 w-6 p-0 text-white/60 hover:text-white hover:bg-white/10"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">{renderToolPanel()}</div>
          </aside>
        )}

        {/* Persistent recording panel — ALWAYS mounted so finalizing the stream
            uploads the in-browser recording even if the user switched tabs or
            closed the sidebar. Acts as the sidebar when "recording" tool is active. */}
        <aside
          className={
            activeTool === "recording"
              ? "w-[320px] shrink-0 bg-[#062B63]/80 border-l border-white/10 flex flex-col"
              : "w-0 h-0 overflow-hidden opacity-0 pointer-events-none absolute"
          }
          aria-hidden={activeTool !== "recording"}
        >
          {activeTool === "recording" && (
            <div className="h-10 px-4 border-b border-white/10 flex items-center justify-between bg-[#031633]">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-white/70">
                {TOOL_LABELS["recording"].label}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTool(null)}
                className="h-6 w-6 p-0 text-white/60 hover:text-white hover:bg-white/10"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
            <StreamRecorder roomId={roomId} userName={userName} />
            <EgressRecordingPanel roomId={roomId} livekitRoomName={livekitRoomName} />
            <RecordingStatusPanel roomId={roomId} />
          </div>
        </aside>
      </main>

      {/* Bottom toolbar */}
      <footer className="h-20 bg-[#062B63] border-t border-white/10 px-4 flex items-center justify-between shrink-0 gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <div className="livekit-control-wrapper">
            <ControlBar
              variation="minimal"
              controls={{
                camera: true,
                microphone: true,
                screenShare: true,
                chat: false,
                leave: false,
              }}
            />
          </div>
          <div className="w-px h-10 bg-white/10 mx-1" />
          <HostAudioToggle />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto">
          {(Object.entries(TOOL_LABELS) as [ToolKey, typeof TOOL_LABELS[ToolKey]][]).map(([key, meta]) => {
            // "transcription" tab also hosts the live translation toggle, so it should always be available
            const Icon = meta.icon;
            const isActive = activeTool === key;
            let badgeCount = 0;
            if (key === "requests") badgeCount = raisedHands.size + unreadRequests;
            else if (key === "chat") badgeCount = unreadChat;
            return (
              <Button
                key={key}
                type="button"
                onClick={() => toggleTool(key)}
                size="sm"
                className={`relative h-12 min-w-[52px] px-2 rounded-lg flex flex-col items-center justify-center gap-0.5 border-b-2 transition-all ${
                  isActive
                    ? "bg-primary text-white border-white/20 shadow-[0_0_10px_hsl(var(--primary)/0.4)]"
                    : "bg-white/5 hover:bg-white/10 text-white/70 border-white/5"
                }`}
                title={meta.label}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[8px] font-bold uppercase tracking-tight leading-none">{meta.label}</span>
                {badgeCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-amber-400 text-[9px] font-bold text-black flex items-center justify-center">
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      </footer>
    </div>
  );
};

export default MeetingHostShell;
