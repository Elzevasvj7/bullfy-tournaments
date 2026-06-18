import { useState, useEffect, useCallback, useRef } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useLiveKitReady } from "@/hooks/useLiveKitReady";

interface TickerPrice {
  symbol: string;
  price: string;
  prevPrice?: string;
}

const SS_KEY = "bullfy-ticker-viewer";

function loadPersistedTicker(): { prices: TickerPrice[]; visible: boolean; scrollSpeed: number } {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { prices: [], visible: false, scrollSpeed: 30 };
}

function persistTicker(prices: TickerPrice[], visible: boolean, scrollSpeed: number) {
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify({ prices, visible, scrollSpeed }));
  } catch {}
}

const ViewerTickerStrip = () => {
  const room = useRoomContext();
  const isLkReady = useLiveKitReady(room);
  const persisted = useRef(loadPersistedTicker());
  const [prices, setPrices] = useState<TickerPrice[]>(persisted.current.prices);
  const [scrollSpeed, setScrollSpeed] = useState(persisted.current.scrollSpeed);
  // ALWAYS start hidden; only the host can turn it on via DataChannel
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasSentSyncRef = useRef(false);

  const handleTickerMsg = useCallback((msg: any) => {
    if (msg.type !== "ticker-update") return;
    if (msg.action === "show") {
      const incomingPrices = Array.isArray(msg.prices)
        ? msg.prices.filter((price: any) => price?.symbol && price?.price)
        : [];

      if (incomingPrices.length === 0) return;

      const speed = msg.scrollSpeed || 30;

      setPrices((prev) => {
        const newPrices: TickerPrice[] = incomingPrices.map((p: any) => {
          const existing = prev.find((e) => e.symbol === p.symbol);
          return {
            symbol: p.symbol,
            price: p.price,
            prevPrice: existing?.price,
          };
        });
        persistTicker(newPrices, true, speed);
        return newPrices;
      });
      setScrollSpeed(speed);
      setVisible(true);
    } else if (msg.action === "hide") {
      setVisible(false);
      persistTicker([], false, 30);
    }
  }, []);

  // Send sync request on mount so host re-sends current state
  useEffect(() => {
    if (hasSentSyncRef.current || !room || !isLkReady) return;
    hasSentSyncRef.current = true;
    const timer = setTimeout(() => {
      try {
        const data = new TextEncoder().encode(JSON.stringify({ type: "ticker-sync-request" }));
        room.localParticipant.publishData(data, { reliable: true });
      } catch {}
    }, 1000);
    return () => clearTimeout(timer);
  }, [room, isLkReady]);

  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      try {
        handleTickerMsg(JSON.parse(new TextDecoder().decode(payload)));
      } catch {}
    };
    const handleLocal = (e: Event) => {
      handleTickerMsg((e as CustomEvent).detail);
    };
    if (room && isLkReady) {
      room.on(RoomEvent.DataReceived, handleData);
    }
    window.addEventListener("bullfy-ticker", handleLocal);
    return () => {
      if (room && isLkReady) {
        room.off(RoomEvent.DataReceived, handleData);
      }
      window.removeEventListener("bullfy-ticker", handleLocal);
    };
  }, [room, isLkReady, handleTickerMsg]);

  if (!visible || prices.length === 0) return null;

  const getChangeIndicator = (p: TickerPrice) => {
    if (!p.prevPrice) return <Minus className="w-3 h-3 text-muted-foreground" />;
    const curr = parseFloat(p.price);
    const prev = parseFloat(p.prevPrice);
    if (curr > prev) return <TrendingUp className="w-3 h-3 text-emerald-500" />;
    if (curr < prev) return <TrendingDown className="w-3 h-3 text-destructive" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  const getChangeColor = (p: TickerPrice) => {
    if (!p.prevPrice) return "text-foreground";
    const curr = parseFloat(p.price);
    const prev = parseFloat(p.prevPrice);
    if (curr > prev) return "text-emerald-500";
    if (curr < prev) return "text-destructive";
    return "text-foreground";
  };

  const tickerItems = [...prices, ...prices];

  return (
    <div className="absolute top-0 left-0 w-full bg-black/60 backdrop-blur-sm overflow-hidden z-40 h-[32px] flex items-center pointer-events-none">
      <div
        ref={containerRef}
        className="flex items-center whitespace-nowrap animate-ticker gap-8 px-4"
        style={{ ["--ticker-speed" as string]: `${scrollSpeed}s` }}
      >
        {tickerItems.map((p, idx) => (
          <div key={`${p.symbol}-${idx}`} className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-semibold text-primary tracking-wide">{p.symbol}</span>
            <span className={`text-[11px] font-mono font-bold ${getChangeColor(p)}`}>
              {parseFloat(p.price).toFixed(p.symbol.includes("/") ? 5 : 2)}
            </span>
            {getChangeIndicator(p)}
            <span className="text-muted-foreground mx-2">│</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ViewerTickerStrip;
