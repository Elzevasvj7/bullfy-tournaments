import { useState, useEffect, useRef, useCallback } from "react";
import { useRoomContext } from "@livekit/components-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageCircleOff } from "lucide-react";

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
}

interface LiveChatProps {
  chatEnabled?: boolean;
  messages?: ChatMessage[];
  onSendMessage?: (text: string) => void;
  /** Controlled draft text. When provided together with onDraftChange the input
   *  is fully controlled by the parent so it survives panel toggles. */
  draft?: string;
  onDraftChange?: (text: string) => void;
  /** Floating translucent style overlaid on top of the video (TikTok / IG Live look). */
  floating?: boolean;
}

/**
 * Presentational chat panel.
 * If `messages` and `onSendMessage` are provided, the component is fully controlled
 * (used by MeetingViewerShell to keep messages alive across panel toggles).
 * Otherwise it falls back to its own local state for backwards compatibility.
 */
const LiveChat = ({
  chatEnabled = true,
  messages: messagesProp,
  onSendMessage,
  draft,
  onDraftChange,
  floating = false,
}: LiveChatProps) => {
  const room = useRoomContext();
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [localInput, setLocalInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const isControlled = messagesProp !== undefined;
  const messages = isControlled ? messagesProp! : localMessages;
  const isDraftControlled = draft !== undefined && onDraftChange !== undefined;
  const input = isDraftControlled ? draft! : localInput;
  const setInput = isDraftControlled ? onDraftChange! : setLocalInput;

  // Fallback listener only when uncontrolled (controlled mode listens at parent level)
  useEffect(() => {
    if (isControlled) return;
    const handleData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === "chat") {
          setLocalMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), sender: msg.sender, text: msg.text, timestamp: msg.timestamp },
          ]);
        }
      } catch {}
    };
    // Lazy-import to keep the same behavior
    import("livekit-client").then(({ RoomEvent }) => {
      room.on(RoomEvent.DataReceived, handleData);
    });
    return () => {
      import("livekit-client").then(({ RoomEvent }) => {
        room.off(RoomEvent.DataReceived, handleData);
      });
    };
  }, [room, isControlled]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || !chatEnabled) return;

    if (isControlled && onSendMessage) {
      onSendMessage(text);
      setInput("");
      return;
    }

    if (!room.localParticipant) return;
    const payload = {
      type: "chat",
      sender: room.localParticipant.name || room.localParticipant.identity,
      text,
      timestamp: Date.now(),
    };
    const data = new TextEncoder().encode(JSON.stringify(payload));
    room.localParticipant.publishData(data, { reliable: true });
    setLocalMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), sender: payload.sender, text, timestamp: payload.timestamp },
    ]);
    setInput("");
  }, [input, room, chatEnabled, isControlled, onSendMessage, setInput]);

  if (floating) {
    // TikTok / IG Live style: translucent overlay anchored to bottom-left of video
    return (
      <div className="flex flex-col h-full w-full pointer-events-none">
        {/* Recent messages list — fades older ones, no solid background */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-end px-2 pb-1">
          <div className="flex flex-col gap-1 max-h-full overflow-hidden">
            {messages.slice(-8).map((m, idx, arr) => (
              <div
                key={m.id}
                className="text-xs leading-tight px-2 py-1 rounded-lg bg-black/45 backdrop-blur-sm w-fit max-w-full break-words"
                style={{ opacity: Math.max(0.5, (idx + 1) / arr.length) }}
              >
                <span className="font-semibold text-[#83CBFF] drop-shadow">{m.sender}: </span>
                <span className="text-white drop-shadow">{m.text}</span>
              </div>
            ))}
          </div>
        </div>
        {chatEnabled ? (
          <div className="pointer-events-auto flex gap-1 px-2 pb-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Escribe un mensaje..."
              className="h-9 text-sm bg-black/55 backdrop-blur-md border-white/20 text-white placeholder:text-white/60 rounded-full px-4"
            />
            <Button
              size="icon"
              onClick={send}
              className="h-9 w-9 shrink-0 rounded-full bg-primary/80 hover:bg-primary text-white backdrop-blur-md"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="pointer-events-auto flex items-center gap-2 px-3 py-2 mx-2 mb-2 rounded-full bg-black/55 backdrop-blur-md w-fit">
            <MessageCircleOff className="w-3.5 h-3.5 text-white/60" />
            <span className="text-xs text-white/70">Chat deshabilitado</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border-t border-white/10 bg-black/90">
      <div className="px-3 py-1.5 border-b border-white/10">
        <span className="text-xs font-semibold text-white">💬 Chat en Vivo</span>
      </div>
      <ScrollArea className="flex-1 px-3 py-2">
        {messages.length === 0 && (
          <p className="text-xs text-white/40 text-center py-4">Sin mensajes aún</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="mb-1.5">
            <span className="text-xs font-semibold text-[#83CBFF]">{m.sender}: </span>
            <span className="text-xs text-white">{m.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </ScrollArea>
      {chatEnabled ? (
        <div className="flex gap-1 px-3 py-2 border-t border-white/10">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Escribe un mensaje..."
            className="h-8 text-sm bg-background text-white placeholder:text-white/50"
          />
          <Button size="icon" variant="ghost" onClick={send} className="h-8 w-8 shrink-0 text-white hover:text-white/80">
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-white/10">
          <MessageCircleOff className="w-3.5 h-3.5 text-white/40" />
          <span className="text-xs text-white/40">El chat está deshabilitado</span>
        </div>
      )}
    </div>
  );
};

export default LiveChat;
