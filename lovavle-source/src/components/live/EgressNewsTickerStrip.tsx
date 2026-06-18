/**
 * EgressNewsTickerStrip — Standalone news ticker for the Egress compositor.
 *
 * IMPORTANT: This component is PASSIVE. It NEVER fetches headlines on its own —
 * it only renders what the host broadcasts via DataChannel. This guarantees
 * that no API credits are consumed unless the host has explicitly enabled
 * the news ticker. When the host turns it off (or the stream ends), the
 * strip disappears and stays dormant until the host re-activates.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { Newspaper } from "lucide-react";
import { useLiveKitReady } from "@/hooks/useLiveKitReady";

interface NewsHeadline {
  headline: string;
  source: string;
  impact?: string | null;
}

const EgressNewsTickerStrip = () => {
  const room = useRoomContext();
  const isLkReady = useLiveKitReady(room);
  const [headlines, setHeadlines] = useState<NewsHeadline[]>([]);
  const [visible, setVisible] = useState(false);
  const hasSentSyncRef = useRef(false);

  const handleMsg = useCallback((msg: any) => {
    if (msg?.type !== "news-ticker-update") return;
    if (msg.action === "show") {
      const incoming = Array.isArray(msg.headlines)
        ? msg.headlines.filter((h: any) => h?.headline)
        : [];
      if (incoming.length === 0) return;
      setHeadlines(
        incoming.map((d: any) => ({
          headline: d.headline,
          source: d.source || "News",
          impact: d.impact || null,
        }))
      );
      setVisible(true);
    } else if (msg.action === "hide") {
      setVisible(false);
      setHeadlines([]);
    }
  }, []);

  // Ask host to re-broadcast current state on mount
  useEffect(() => {
    if (hasSentSyncRef.current || !room || !isLkReady) return;
    hasSentSyncRef.current = true;
    const timer = setTimeout(() => {
      try {
        const data = new TextEncoder().encode(JSON.stringify({ type: "news-ticker-sync-request" }));
        room.localParticipant.publishData(data, { reliable: true });
      } catch {}
    }, 1200);
    return () => clearTimeout(timer);
  }, [room, isLkReady]);

  useEffect(() => {
    if (!room || !isLkReady) return;
    const handleData = (payload: Uint8Array) => {
      try {
        handleMsg(JSON.parse(new TextDecoder().decode(payload)));
      } catch {}
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room, isLkReady, handleMsg]);

  if (!visible || headlines.length === 0) return null;

  const tickerItems = [...headlines, ...headlines];

  return (
    <div className="absolute bottom-0 left-0 z-40 flex h-[28px] w-full items-center overflow-hidden bg-background/85 backdrop-blur-sm pointer-events-none">
      <div
        className="flex items-center whitespace-nowrap animate-ticker gap-10 px-4"
        style={{ ["--ticker-speed" as string]: "90s" }}
      >
        {tickerItems.map((h, idx) => (
          <div key={idx} className="flex items-center gap-1.5 shrink-0">
            <Newspaper className="w-3 h-3 text-primary shrink-0" />
            <span className="text-[10px] font-semibold text-primary/80 uppercase tracking-wide shrink-0">
              {h.source}
            </span>
            {h.impact === "high" && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-destructive shrink-0">
                Carpeta roja
              </span>
            )}
            <span className="text-[11px] text-foreground font-medium">
              {h.headline.length > 80 ? h.headline.slice(0, 80) + "…" : h.headline}
            </span>
            <span className="text-muted-foreground mx-3">│</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EgressNewsTickerStrip;
