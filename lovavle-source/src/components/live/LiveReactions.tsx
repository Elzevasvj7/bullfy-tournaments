import { useState, useEffect, useCallback, useRef } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { supabase } from "@/integrations/supabase/client";
import { useLiveKitReady } from "@/hooks/useLiveKitReady";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Heart, SmilePlus } from "lucide-react";

const EMOJI_GRID = [
  "❤️", "🔥", "👏", "😂", "🎉", "😍", "💪", "🚀",
  "💰", "📈", "🏆", "⭐", "💎", "🐂", "👑", "🤑",
  "😱", "🤔", "👀", "💯", "✨", "🎯", "💥", "🙌",
];

interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number;
  sender?: string;
}

interface LiveReactionsProps {
  roomId: string;
  isOverlay?: boolean;
  controlsOnly?: boolean;
}

// Max emojis shown simultaneously in the lane (compact, non-invasive)
const MAX_FLOATING = 6;

const LiveReactions = ({ roomId, isOverlay = false, controlsOnly = false }: LiveReactionsProps) => {
  const room = useRoomContext();
  const isLkReady = useLiveKitReady(room);
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const [likes, setLikes] = useState(0);
  const [likePulse, setLikePulse] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const throttleRef = useRef(false);
  const pulseTimerRef = useRef<number | null>(null);

  const triggerLikePulse = useCallback(() => {
    setLikePulse(true);
    if (pulseTimerRef.current) window.clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = window.setTimeout(() => setLikePulse(false), 250);
  }, []);

  const addFloatingEmoji = useCallback((emoji: string, sender?: string) => {
    const id = crypto.randomUUID();
    // x within the narrow lane (0–100% of a ~56px wide column)
    const x = Math.random() * 60 + 10;
    setFloatingEmojis(prev => [...prev.slice(-(MAX_FLOATING - 1)), { id, emoji, x, sender }]);
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => e.id !== id));
    }, 2000);
  }, []);

  // Listen for reaction data messages
  useEffect(() => {
    if (!room || !isLkReady) return;

    const handleData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === "reaction") {
          addFloatingEmoji(msg.emoji, msg.sender);
          if (msg.emoji === "❤️") {
            setLikes(l => l + 1);
            triggerLikePulse();
          }
        }
      } catch {}
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room, isLkReady, addFloatingEmoji, triggerLikePulse]);

  const sendReaction = useCallback((emoji: string) => {
    if (throttleRef.current) return;
    throttleRef.current = true;
    setTimeout(() => { throttleRef.current = false; }, 300);

    const sender = room.localParticipant.name || room.localParticipant.identity;
    const data = new TextEncoder().encode(JSON.stringify({
      type: "reaction", emoji, sender,
    }));
    room.localParticipant.publishData(data, { reliable: false });
    addFloatingEmoji(emoji, sender);
    if (emoji === "❤️") {
      setLikes(l => l + 1);
      triggerLikePulse();
    }

    // Persist to DB
    supabase.from("live_reactions").insert({
      room_id: roomId,
      user_name: sender,
      reaction_type: emoji === "❤️" ? "like" : "emoji",
      emoji,
    }).then();

    setEmojiOpen(false);
  }, [room, roomId, addFloatingEmoji, triggerLikePulse]);

  // Ultra-narrow lane — pinned bottom-right above controls, never invades stage
  const FloatingLane = (
    <div className="pointer-events-none absolute right-3 bottom-24 w-10 h-[26vh] overflow-visible z-40">
      {floatingEmojis.map(fe => (
        <div
          key={fe.id}
          className="absolute text-base will-change-transform drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
          style={{
            left: `${fe.x}%`,
            bottom: 0,
            animation: "floatUpNarrow 1.8s ease-out forwards",
          }}
        >
          {fe.emoji}
        </div>
      ))}
    </div>
  );

  // Overlay mode: just show floating emojis in the narrow lane
  if (isOverlay) {
    return FloatingLane;
  }

  // Controls mode
  return (
    <div className="relative flex items-center gap-1 rounded-full border border-white/10 bg-background/85 px-1.5 py-1 shadow-lg backdrop-blur-md">
      {/* Like button */}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => sendReaction("❤️")}
        className={`gap-1 h-8 text-xs hover:bg-destructive/10 hover:text-destructive transition-transform ${likePulse ? "scale-110" : "scale-100"}`}
      >
        <Heart className="w-4 h-4 text-destructive fill-destructive" />
        {likes > 0 && <span className="text-xs tabular-nums">{likes}</span>}
      </Button>

      {/* Emoji picker */}
      <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full">
            <SmilePlus className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" side="top" align="end">
          <div className="grid grid-cols-8 gap-1">
            {EMOJI_GRID.map(emoji => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                className="text-xl hover:bg-muted rounded p-1 transition-colors hover:scale-125"
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Floating lane overlay (right side, narrow) */}
      {!controlsOnly && FloatingLane}
    </div>
  );
};

export default LiveReactions;
