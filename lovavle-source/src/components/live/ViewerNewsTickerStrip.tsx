import { useState, useEffect, useCallback, useRef } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { Newspaper } from "lucide-react";
import { useLiveKitReady } from "@/hooks/useLiveKitReady";

interface NewsHeadline {
  headline: string;
  source: string;
  impact?: string;
  country?: string;
}

const SS_KEY = "bullfy-news-ticker-viewer";

function loadPersisted(): { headlines: NewsHeadline[]; visible: boolean } {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { headlines: [], visible: false };
}

function persist(headlines: NewsHeadline[], visible: boolean) {
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify({ headlines, visible }));
  } catch {}
}

const ViewerNewsTickerStrip = () => {
  const room = useRoomContext();
  const isLkReady = useLiveKitReady(room);
  const persisted = useRef(loadPersisted());
  const [headlines, setHeadlines] = useState<NewsHeadline[]>(persisted.current.headlines);
  // ALWAYS start hidden; only the host can turn it on via DataChannel
  const [visible, setVisible] = useState(false);
  const hasSentSyncRef = useRef(false);

  const handleMsg = useCallback((msg: any) => {
    if (msg.type !== "news-ticker-update") return;
    if (msg.action === "show") {
      const incoming = Array.isArray(msg.headlines)
        ? msg.headlines.filter((h: any) => h?.headline)
        : [];
      if (incoming.length === 0) return;
      setHeadlines(incoming);
      setVisible(true);
      persist(incoming, true);
    } else if (msg.action === "hide") {
      setVisible(false);
      persist([], false);
    }
  }, []);

  // Send sync request on mount so host re-sends current state
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
    const handleData = (payload: Uint8Array) => {
      try {
        handleMsg(JSON.parse(new TextDecoder().decode(payload)));
      } catch {}
    };
    const handleLocal = (e: Event) => {
      handleMsg((e as CustomEvent).detail);
    };
    if (room && isLkReady) {
      room.on(RoomEvent.DataReceived, handleData);
    }
    window.addEventListener("bullfy-news-ticker", handleLocal);
    return () => {
      if (room && isLkReady) {
        room.off(RoomEvent.DataReceived, handleData);
      }
      window.removeEventListener("bullfy-news-ticker", handleLocal);
    };
  }, [room, isLkReady, handleMsg]);

  if (!visible || headlines.length === 0) return null;

  const tickerItems = [...headlines, ...headlines];

  return (
    <div className="absolute bottom-0 left-0 w-full bg-black/70 backdrop-blur-sm overflow-hidden z-40 h-[28px] flex items-center pointer-events-none">
      <div
        className="flex items-center whitespace-nowrap animate-ticker gap-10 px-4"
        style={{ ["--ticker-speed" as string]: "90s" }}
      >
        {tickerItems.map((h, idx) => (
          <div key={`${idx}`} className="flex items-center gap-1.5 shrink-0">
            <Newspaper className="w-3 h-3 text-primary shrink-0" />
            <span className="text-[10px] font-semibold text-primary/80 uppercase tracking-wide shrink-0">
              {h.source}
            </span>
            {h.impact === "high" && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-destructive shrink-0">
                Carpeta roja
              </span>
            )}
            <span className="text-[11px] text-white/90 font-medium">
              {h.headline.length > 80 ? h.headline.slice(0, 80) + "…" : h.headline}
            </span>
            <span className="text-muted-foreground mx-3">│</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ViewerNewsTickerStrip;
