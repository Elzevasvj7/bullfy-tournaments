import { useState, useEffect, useRef, useCallback } from "react";
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
import { Users, MessageSquare, BarChart3, Hand, Smile, LogOut, X, Eye } from "lucide-react";
import MeetingStage from "./MeetingStage";
import LiveChat, { type ChatMessage } from "./LiveChat";
import ParticipantsSidebar from "./ParticipantsSidebar";
import MeetingPolls from "./MeetingPolls";
import LiveReactions from "./LiveReactions";
import RaiseHandButton from "./RaiseHandButton";
import ViewerAudioToggle from "./ViewerAudioToggle";
import ViewerCTABanner from "./ViewerCTABanner";
import ViewerTickerStrip from "./ViewerTickerStrip";
import ViewerNewsTickerStrip from "./ViewerNewsTickerStrip";
import NextRedFolderBadge from "./NextRedFolderBadge";
import { OverlayDisplay } from "./OverlayManager";
import { TradingViewOverlayDisplay } from "./TradingViewOverlay";
import StageNotifications, { type StageNotification } from "./StageNotifications";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useHostPortalContext } from "@/hooks/useHostPortalContext";

type ToolKey = "participants" | "chat" | "polls" | "reactions";

const TOOL_LABELS: Record<ToolKey, { label: string; icon: typeof Users }> = {
  participants: { label: "Participantes", icon: Users },
  chat: { label: "Chat", icon: MessageSquare },
  polls: { label: "Encuestas", icon: BarChart3 },
  reactions: { label: "Reacciones", icon: Smile },
};

interface CoHostShellProps {
  roomId: string;
  roomTitle: string;
  chatEnabled: boolean;
  onExitCoHost: () => void;
}

/**
 * CoHostShell — visualmente idéntico al shell del Host (header azul oscuro + stage +
 * footer azul con controles de media), pero limitado a herramientas colaborativas.
 * Sin: CTA, ticker, grabar, YouTube, fondos/overlay admin, breakout admin.
 */
const CoHostShell = ({ roomId, roomTitle, chatEnabled, onExitCoHost }: CoHostShellProps) => {
  const [activeTool, setActiveTool] = useState<ToolKey | null>("chat");
  const lkRoom = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const isMobile = useIsMobile();
  const { portalId: hostPortalId, partnerUserId: hostPartnerUserId } = useHostPortalContext(roomId);

  // ── Chat state with sessionStorage persistence (mismo patrón que el host) ──
  const chatStorageKey = `bullfy-chat-cohost-${roomId}`;
  const draftStorageKey = `bullfy-chat-draft-cohost-${roomId}`;
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const raw = sessionStorage.getItem(chatStorageKey);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });
  const [chatDraft, setChatDraft] = useState<string>(() => {
    try { return sessionStorage.getItem(draftStorageKey) ?? ""; } catch { return ""; }
  });
  useEffect(() => {
    try { sessionStorage.setItem(chatStorageKey, JSON.stringify(chatMessages)); } catch {}
  }, [chatMessages, chatStorageKey]);
  useEffect(() => {
    try { sessionStorage.setItem(draftStorageKey, chatDraft); } catch {}
  }, [chatDraft, draftStorageKey]);

  const [unreadChat, setUnreadChat] = useState(0);
  const [unreadPolls, setUnreadPolls] = useState(0);
  const seenPollIdsRef = useRef<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<StageNotification[]>([]);
  const activeToolRef = useRef<ToolKey | null>(activeTool);
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

  // Listen for new polls created by the host while we are connected
  useEffect(() => {
    let cancelled = false;
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
      .channel(`cohost-polls-${roomId}`)
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

  // Listen for chat messages
  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === "chat") {
          setChatMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), sender: msg.sender, text: msg.text, timestamp: msg.timestamp },
          ]);
          const isSelf = msg.sender === (localParticipant?.name || localParticipant?.identity);
          if (!isSelf && activeToolRef.current !== "chat") {
            setUnreadChat((c) => c + 1);
            pushNotification({ type: "chat", title: `Nuevo mensaje de ${msg.sender}`, body: msg.text });
          }
        }
      } catch {}
    };
    lkRoom.on(RoomEvent.DataReceived, handleData);
    return () => { lkRoom.off(RoomEvent.DataReceived, handleData); };
  }, [lkRoom, localParticipant, pushNotification]);

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
              voterId={localParticipant?.identity}
            />
          </div>
        );
      case "reactions":
        return (
          <div className="p-3 overflow-y-auto h-full flex justify-end">
            <LiveReactions roomId={roomId} controlsOnly />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#031633] text-slate-100 rounded-lg overflow-hidden border border-white/10">
      <RoomAudioRenderer />

      {/* Header — mismo estilo que el host */}
      <header className="h-12 border-b border-white/10 bg-[#062B63]/40 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-2 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="font-mono text-[10px] font-semibold tracking-widest text-red-400 shrink-0">EN VIVO</span>
          <div className="h-4 w-px bg-white/10 shrink-0" />
          <h1 className="text-sm font-medium tracking-tight truncate">{roomTitle}</h1>
          <span className="hidden sm:inline-flex px-1.5 py-0.5 bg-primary/20 text-primary border border-primary/30 text-[9px] font-bold uppercase rounded">
            Co-Host
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded bg-white/5 text-xs">
            <Eye className="w-3.5 h-3.5 text-white/60" />
            <span className="font-mono">{participants.length}</span>
          </div>
          <Button variant="destructive" size="sm" onClick={onExitCoHost} className="gap-1.5 h-8 text-xs">
            <LogOut className="w-3.5 h-3.5" /> Salir de Co-Host
          </Button>
        </div>
      </header>

      {/* Main: stage + contextual panel */}
      <main className="flex-1 flex overflow-hidden min-h-0">
        <section className="flex-1 flex flex-col bg-black/40 min-w-0 relative">
          <ViewerCTABanner />
          <OverlayDisplay roomId={roomId} portalId={hostPortalId} partnerUserId={hostPartnerUserId} />
          <TradingViewOverlayDisplay roomId={roomId} />
          <div className="flex-1 min-h-0 relative">
            <MeetingStage view="auto" publishersOnly={true} isHost={true} />
            <LiveReactions roomId={roomId} isOverlay />
            {activeTool === "reactions" && (
              <div className="absolute right-3 bottom-3 z-40 pointer-events-auto">
                <LiveReactions roomId={roomId} controlsOnly />
              </div>
            )}
            <StageNotifications
              notifications={notifications}
              onDismiss={dismissNotification}
              onActivate={(n) => {
                if (n.type === "chat") { setActiveTool("chat"); setUnreadChat(0); }
                else if (n.type === "poll") { setActiveTool("polls"); setUnreadPolls(0); }
                dismissNotification(n.id);
              }}
            />
            <ViewerTickerStrip />
            <ViewerNewsTickerStrip />
            <NextRedFolderBadge mode="viewer" />
          </div>
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
          <SheetContent side="bottom" className="h-[65vh] p-0 bg-[#062B63] border-t border-white/10 text-slate-100">
            <div className="h-10 px-4 border-b border-white/10 flex items-center justify-between bg-[#031633]">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-white/70">
                {activeTool && TOOL_LABELS[activeTool].label}
              </h2>
            </div>
            <div className="h-[calc(65vh-2.5rem)] overflow-hidden">{renderToolPanel()}</div>
          </SheetContent>
        </Sheet>
      )}

      {/* Footer azul — mismos controles de media que el host */}
      <footer className="min-h-[64px] w-full max-w-full bg-[#062B63] border-t border-white/10 shrink-0 overflow-x-auto overflow-y-hidden md:overflow-visible [&::-webkit-scrollbar]:hidden [scrollbar-width:none]" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}>
        <div className="inline-flex md:flex items-center gap-2 md:gap-4 px-2 md:px-4 py-2 w-max md:w-full md:justify-between flex-nowrap">
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
            <div className="hidden sm:block w-px h-10 bg-white/10 mx-1" />
            <ViewerAudioToggle />
          </div>

          <div className="flex items-center gap-1 flex-nowrap shrink-0">
            <RaiseHandButton />
            {(Object.entries(TOOL_LABELS) as [ToolKey, typeof TOOL_LABELS[ToolKey]][]).map(([key, meta]) => {
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

export default CoHostShell;
