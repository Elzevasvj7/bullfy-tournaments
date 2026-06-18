/**
 * EgressTickerStrip — Standalone financial ticker for the Egress compositor.
 *
 * IMPORTANT: This component is PASSIVE. It NEVER fetches prices on its own —
 * it only renders what the host broadcasts via DataChannel. This guarantees
 * that no API credits are consumed unless the host has explicitly enabled
 * the ticker. When the host turns it off (or the stream ends), the strip
 * disappears and stays dormant until the host re-activates.
 */
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

const EgressTickerStrip = () => {
  const room = useRoomContext();
  const isLkReady = useLiveKitReady(room);
  const [prices, setPrices] = useState<TickerPrice[]>([]);
  const [scrollSpeed, setScrollSpeed] = useState(30);
  const [visible, setVisible] = useState(false);
  const hasSentSyncRef = useRef(false);

  const handleTickerMsg = useCallback((msg: any) => {
    if (msg?.type !== "ticker-update") return;
    if (msg.action === "show") {
      const incoming = Array.isArray(msg.prices)
        ? msg.prices.filter((p: any) => p?.symbol && p?.price)
        : [];
      if (incoming.length === 0) return;
      setPrices((prev) =>
        incoming.map((p: any) => {
          const existing = prev.find((e) => e.symbol === p.symbol);
          return { symbol: p.symbol, price: String(p.price), prevPrice: existing?.price };
        })
      );
      setScrollSpeed(msg.scrollSpeed || 30);
      setVisible(true);
    } else if (msg.action === "hide") {
      setVisible(false);
      setPrices([]);
    }
  }, []);

  // Ask host to re-broadcast current state on mount
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
    if (!room || !isLkReady) return;
    const handleData = (payload: Uint8Array) => {
      try {
        handleTickerMsg(JSON.parse(new TextDecoder().decode(payload)));
      } catch {}
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room, isLkReady, handleTickerMsg]);

  if (!visible || prices.length === 0) return null;

  const getChangeColor = (p: TickerPrice) => {
    if (!p.prevPrice) return "text-white";
    const curr = parseFloat(p.price);
    const prev = parseFloat(p.prevPrice);
    if (curr > prev) return "text-emerald-400";
    if (curr < prev) return "text-red-400";
    return "text-white";
  };

  const getChangeIndicator = (p: TickerPrice) => {
    if (!p.prevPrice) return <Minus className="w-3 h-3 text-gray-400" />;
    const curr = parseFloat(p.price);
    const prev = parseFloat(p.prevPrice);
    if (curr > prev) return <TrendingUp className="w-3 h-3 text-emerald-400" />;
    if (curr < prev) return <TrendingDown className="w-3 h-3 text-red-400" />;
    return <Minus className="w-3 h-3 text-gray-400" />;
  };

  const tickerItems = [...prices, ...prices];

  return (
    <div className="absolute top-0 left-0 w-full bg-black/60 backdrop-blur-sm overflow-hidden z-40 h-[32px] flex items-center pointer-events-none">
      <div
        className="flex items-center whitespace-nowrap animate-ticker gap-8 px-4"
        style={{ ["--ticker-speed" as string]: `${scrollSpeed}s` }}
      >
        {tickerItems.map((p, idx) => (
          <div key={`${p.symbol}-${idx}`} className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-semibold text-blue-400 tracking-wide">{p.symbol}</span>
            <span className={`text-[11px] font-mono font-bold ${getChangeColor(p)}`}>
              {parseFloat(p.price).toFixed(p.symbol.includes("/") ? 5 : 2)}
            </span>
            {getChangeIndicator(p)}
            <span className="text-gray-500 mx-2">│</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EgressTickerStrip;
