import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import {
  useLocalParticipant,
  useRoomContext,
  RoomAudioRenderer,
  ControlBar,
  useParticipants,
} from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Users,
  MessageSquare,
  BarChart3,
  Hand,
  Smile,
  DoorOpen,
  Eye,
  X,
} from "lucide-react";
import MeetingStage from "./MeetingStage";
import RiskCalculatorOverlay from "./RiskCalculatorOverlay";
import LiveChat, { type ChatMessage } from "./LiveChat";
import ParticipantsSidebar from "./ParticipantsSidebar";
import MeetingPolls from "./MeetingPolls";
import LiveReactions from "./LiveReactions";
import RaiseHandButton from "./RaiseHandButton";
import ViewerAudioToggle from "./ViewerAudioToggle";
import ViewerCTABanner from "./ViewerCTABanner";
import ViewerAdBanner from "./ViewerAdBanner";
import ViewerTickerStrip from "./ViewerTickerStrip";
import ViewerNewsTickerStrip from "./ViewerNewsTickerStrip";
import NextRedFolderBadge from "./NextRedFolderBadge";
import { OverlayDisplay } from "./OverlayManager";
import { TradingViewOverlayDisplay } from "./TradingViewOverlay";
import StageNotifications, { type StageNotification } from "./StageNotifications";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLiveKitReady } from "@/hooks/useLiveKitReady";
import { isMeetingRoomType, normalizeLiveRoomType } from "@/lib/liveRoomType";
import { supabase } from "@/integrations/supabase/client";
import ViewerTranslationOverlay from "./ViewerTranslationOverlay";
import MeetingTranslationPanel from "./MeetingTranslationPanel";

type ViewerToolKey = "participants" | "chat" | "polls" | "reactions";

interface MeetingViewerShellProps {
  roomId: string;
  roomTitle: string;
  roomType: "meeting" | "webinar_pro" | "bullfy_family" | "broadcast";
  isCoHost: boolean;
  chatEnabled: boolean;
  onLeave: () => void;
  portalId?: string | null;
  partnerUserId?: string | null;
  invitationButton?: ReactNode;
}

const TOOL_LABELS: Record<ViewerToolKey, { label: string; icon: typeof Users }> = {
  participants: { label: "Participantes", icon: Users },
  chat: { label: "Chat", icon: MessageSquare },
  polls: { label: "Encuestas", icon: BarChart3 },
  reactions: { label: "Reacciones", icon: Smile },
};

const MeetingViewerShell = ({
  roomId,
  roomTitle,
  roomType,
  isCoHost,
  chatEnabled,
  onLeave,
  portalId,
  partnerUserId,
  invitationButton,
}: MeetingViewerShellProps) => {
  const [activeTool, setActiveTool] = useState<ViewerToolKey | null>(null);
  const { isMicrophoneEnabled } = useLocalParticipant();
  const lkRoom = useRoomContext();
  const isLkReady = useLiveKitReady(lkRoom);
  const participants = useParticipants();
  const isMobile = useIsMobile();
  const normalizedRoomType = normalizeLiveRoomType(roomType);

  // ---- Chat state lifted to shell so messages persist across panel toggles ----
  const chatStorageKey = `bullfy-chat-${roomId}`;
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const raw = sessionStorage.getItem(chatStorageKey);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });
  const chatMessagesRef = useRef(chatMessages);
  useEffect(() => {
    chatMessagesRef.current = chatMessages;
    try {
      sessionStorage.setItem(chatStorageKey, JSON.stringify(chatMessages));
    } catch {}
  }, [chatMessages, chatStorageKey]);

  // Draft persistence so unsent text survives panel switches
  const draftStorageKey = `bullfy-chat-draft-${roomId}`;
  const [chatDraft, setChatDraft] = useState<string>(() => {
    try { return sessionStorage.getItem(draftStorageKey) ?? ""; } catch { return ""; }
  });
  useEffect(() => {
    try { sessionStorage.setItem(draftStorageKey, chatDraft); } catch {}
  }, [chatDraft, draftStorageKey]);

  // Stage notifications (chat / new poll received while panel closed)
  const [notifications, setNotifications] = useState<StageNotification[]>([]);
  const [unreadChat, setUnreadChat] = useState(0);
  const [unreadPolls, setUnreadPolls] = useState(0);
  const seenPollIdsRef = useRef<Set<string>>(new Set());
  const activeToolRef = useRef<ViewerToolKey | null>(null);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);

  const pushNotification = useCallback((n: Omit<StageNotification, "id" | "createdAt">) => {
    setNotifications((prev) => [
      ...prev,
      { ...n, id: crypto.randomUUID(), createdAt: Date.now() },
    ]);
  }, []);
  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Listen for new polls created while we are connected, to badge + notify viewers
  useEffect(() => {
    let cancelled = false;
    // Seed the seen set with existing polls so we don't notify on first load
    (async () => {
      const { data } = await supabase
        .from("live_meeting_polls")
        .select("id")
        .eq("room_id", roomId);
      if (!cancelled && data) {
        data.forEach((p: any) => seenPollIdsRef.current.add(p.id));
      }
    })();

    const channel = supabase
      .channel(`viewer-polls-${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_meeting_polls", filter: `room_id=eq.${roomId}` },
        (payload: any) => {
          const p = payload.new;
          if (!p?.id || seenPollIdsRef.current.has(p.id)) return;
          seenPollIdsRef.current.add(p.id);
          if (activeToolRef.current !== "polls") {
            setUnreadPolls((c) => c + 1);
            pushNotification({
              type: "poll",
              title: "Nueva encuesta del host",
              body: p.question || "Toca para responder",
            });
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId, pushNotification]);

  // Always-on listener for chat messages, independent from the chat panel mount state
  useEffect(() => {
    if (!lkRoom || !isLkReady) return;

    const handleData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === "chat") {
          setChatMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), sender: msg.sender, text: msg.text, timestamp: msg.timestamp },
          ]);
          const isSelf = msg.sender === (lkRoom.localParticipant?.name || lkRoom.localParticipant?.identity);
          if (!isSelf && activeToolRef.current !== "chat") {
            setUnreadChat((c) => c + 1);
            pushNotification({
              type: "chat",
              title: `Nuevo mensaje de ${msg.sender}`,
              body: msg.text,
            });
          }
        }
      } catch {}
    };
    lkRoom.on(RoomEvent.DataReceived, handleData);
    return () => { lkRoom.off(RoomEvent.DataReceived, handleData); };
  }, [lkRoom, isLkReady, pushNotification]);

  const handleSendChat = useCallback((text: string) => {
    if (!lkRoom.localParticipant) return;
    const payload = {
      type: "chat",
      sender: lkRoom.localParticipant.name || lkRoom.localParticipant.identity,
      text,
      timestamp: Date.now(),
    };
    const data = new TextEncoder().encode(JSON.stringify(payload));
    lkRoom.localParticipant.publishData(data, { reliable: true });
    setChatMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), sender: payload.sender, text, timestamp: payload.timestamp },
    ]);
  }, [lkRoom]);

  // Auto-open chat on desktop only by default
  useEffect(() => {
    if (!isMobile && activeTool === null) {
      setActiveTool("chat");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  const toggleTool = (key: ViewerToolKey) => {
    setActiveTool((prev) => {
      const next = prev === key ? null : key;
      if (next === "chat") setUnreadChat(0);
      if (next === "polls") setUnreadPolls(0);
      return next;
    });
  };

  const renderToolPanel = () => {
    switch (activeTool) {
      case "participants":
        return <ParticipantsSidebar />;
      case "chat":
        return (
          <div className="flex flex-col h-full">
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
            <MeetingPolls
              roomId={roomId}
              isHost={false}
              voterId={lkRoom.localParticipant?.identity}
            />
          </div>
        );
      case "reactions":
        return (
          <div className="p-3 overflow-y-auto h-full flex flex-col gap-3">
            <div className="flex justify-end">
              <LiveReactions roomId={roomId} controlsOnly />
            </div>
            {isMeetingRoomType(normalizedRoomType) && <MeetingTranslationPanel />}
          </div>
        );
      default:
        return null;
    }
  };

  // Webinar Pro & broadcast = no media controls for normal viewers (only co-hosts)
  // Meeting & bullfy_family = all viewers get camera/mic by default
  const showMediaControls = isCoHost || normalizedRoomType === "meeting" || normalizedRoomType === "bullfy_family";
  // Screen share follows same rule
  const allowScreenShare = isCoHost || normalizedRoomType === "meeting" || normalizedRoomType === "bullfy_family";
  const publishersOnly = !isMeetingRoomType(normalizedRoomType);

  return (
    <div className="flex flex-col h-full bg-[#031633] text-slate-100 rounded-lg overflow-hidden border border-white/10">
      <RoomAudioRenderer />

      {/* Header */}
      <header className="h-12 border-b border-white/10 bg-[#062B63]/40 flex items-center justify-between px-2 sm:px-4 shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="size-2 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="font-mono text-[10px] font-semibold tracking-widest text-red-400 shrink-0 hidden xs:inline sm:inline">EN VIVO</span>
          <div className="h-4 w-px bg-white/10 shrink-0 hidden sm:block" />
          <h1 className="text-xs sm:text-sm font-medium tracking-tight truncate">{roomTitle}</h1>
          {isCoHost && (
            <span className="hidden sm:inline-flex px-1.5 py-0.5 bg-primary/20 text-primary border border-primary/30 text-[9px] font-bold uppercase rounded">
              Co-Host
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Audio toggle (Habilitar/Deshabilitar audio del host) — crítico en iOS */}
          <ViewerAudioToggle />
          {isCoHost && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent("bullfy-guest-costream-revoke"))}
              className="h-8 text-xs gap-1.5 border-amber-400/40 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200 hidden sm:inline-flex"
              title="Salir de Co-Host"
            >
              Salir de Co-Host
            </Button>
          )}
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded bg-white/5 text-xs">
            <Eye className="w-3.5 h-3.5 text-white/60" />
            <span className="font-mono">{participants.length}</span>
          </div>
          {invitationButton}
          <Button variant="destructive" size="sm" onClick={onLeave} className="gap-1.5 h-8 text-xs px-2 sm:px-3">
            <DoorOpen className="w-3.5 h-3.5" /> <span className="hidden xs:inline sm:inline">Salir</span>
          </Button>
        </div>
      </header>

      {/* Main: stage + contextual panel (desktop only) */}
      <main className="flex-1 flex overflow-hidden min-h-0">
        <section className="flex-1 flex flex-col bg-black/40 min-w-0 relative">
          <div className="flex-1 min-h-0 relative">
            <MeetingStage view="auto" publishersOnly={publishersOnly} />
            <LiveReactions roomId={roomId} isOverlay />
            <ViewerTranslationOverlay roomId={roomId} />

            {activeTool === "reactions" && (
              <div className="absolute right-3 bottom-3 z-40 pointer-events-auto">
                <LiveReactions roomId={roomId} controlsOnly />
              </div>
            )}

            {/* Banners float ON TOP of the video on every viewport so the stream keeps full height */}
            {/* Order: Ads (top) → CTA → Overlay */}
            <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
              <div className="pointer-events-auto flex justify-center px-4">
                <div className="max-w-2xl w-full"><ViewerAdBanner /></div>
              </div>
              <div className="pointer-events-auto"><ViewerCTABanner /></div>
            </div>

            {/* Overlays (lower-third) */}
            <OverlayDisplay roomId={roomId} portalId={portalId} partnerUserId={partnerUserId} />
            <TradingViewOverlayDisplay roomId={roomId} />

            {/* Floating translucent chat — en móvil siempre visible (es el único chat). En desktop se oculta cuando el panel lateral está abierto. */}
            {(isMobile || activeTool !== "chat") && (
              <div className="absolute bottom-2 left-2 z-30 w-[55%] max-w-[220px] sm:w-[300px] sm:max-w-none h-[32vh] sm:h-[50vh] max-h-[440px] pointer-events-none">
                <div className="h-full pointer-events-auto">
                  <LiveChat
                    floating
                    chatEnabled={chatEnabled}
                    messages={chatMessages}
                    onSendMessage={handleSendChat}
                    draft={chatDraft}
                    onDraftChange={setChatDraft}
                  />
                </div>
              </div>
            )}

            <StageNotifications
              notifications={notifications}
              onDismiss={dismissNotification}
              onActivate={(n) => {
                if (n.type === "chat") {
                  if (!isMobile) setActiveTool("chat");
                  setUnreadChat(0);
                }
                else if (n.type === "poll") { setActiveTool("polls"); setUnreadPolls(0); }
                dismissNotification(n.id);
              }}
            />
            <ViewerTickerStrip />
            <ViewerNewsTickerStrip />
            <NextRedFolderBadge mode="viewer" />
          </div>
          <RiskCalculatorOverlay portalId={portalId} partnerUserId={partnerUserId} />
        </section>

        {/* Desktop side panel */}
        {!isMobile && activeTool && activeTool !== "reactions" && (
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
      </main>

      {/* Mobile bottom sheet */}
      {isMobile && activeTool !== "reactions" && (
        <Sheet open={activeTool !== null} onOpenChange={(o) => !o && setActiveTool(null)}>
          <SheetContent
            side="bottom"
            className="h-[65vh] p-0 bg-[#062B63] border-t border-white/10 text-slate-100"
          >
            <div className="h-10 px-4 border-b border-white/10 flex items-center justify-between bg-[#031633]">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-white/70">
                {activeTool && TOOL_LABELS[activeTool].label}
              </h2>
            </div>
            <div className="h-[calc(65vh-2.5rem)] overflow-hidden">{renderToolPanel()}</div>
          </SheetContent>
        </Sheet>
      )}

      {/* Bottom toolbar */}
      <footer className="min-h-[64px] w-full max-w-full bg-[#062B63] border-t border-white/10 shrink-0 overflow-x-auto overflow-y-hidden md:overflow-visible [&::-webkit-scrollbar]:hidden [scrollbar-width:none]" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}>
        <div className="inline-flex md:flex items-center gap-2 md:gap-4 px-2 md:px-4 py-2 w-max md:w-full md:justify-between flex-nowrap">
          {/* Media controls (only meeting/family/cohost) */}
          {showMediaControls ? (
            <div className="flex items-center gap-2 shrink-0">
              <div className="livekit-control-wrapper">
                <ControlBar
                  variation="minimal"
                  controls={{
                    camera: true,
                    microphone: true,
                    screenShare: allowScreenShare,
                    chat: false,
                    leave: false,
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <RaiseHandButton />
            </div>
          )}

          {/* Tool launcher */}
          <div className="flex items-center gap-1 flex-nowrap shrink-0">
            {showMediaControls && <RaiseHandButton />}
            {(Object.entries(TOOL_LABELS) as [ViewerToolKey, typeof TOOL_LABELS[ViewerToolKey]][])
              .filter(([key]) => !(isMobile && key === "chat"))
              .map(([key, meta]) => {
              const Icon = meta.icon;
              const isActive = activeTool === key;
              const badgeCount = key === "chat" ? unreadChat : key === "polls" ? unreadPolls : 0;
              return (
                <Button
                  key={key}
                  type="button"
                  onClick={() => toggleTool(key)}
                  size="sm"
                  className={`relative h-12 min-w-[48px] sm:min-w-[52px] px-2 rounded-lg flex flex-col items-center justify-center gap-0.5 border-b-2 transition-all ${
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
        </div>
      </footer>
    </div>
  );
};

export default MeetingViewerShell;
