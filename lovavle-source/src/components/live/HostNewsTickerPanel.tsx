import { useState, useEffect, useCallback, useRef } from "react";
import { useSessionStorageState } from "@/hooks/useSessionStorageState";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/lib/toastUtils";
import { Newspaper, Loader2, RefreshCw } from "lucide-react";
import type { LocalParticipant } from "livekit-client";

interface HostNewsTickerPanelProps {
  localParticipant?: LocalParticipant | null;
  roomId?: string;
}

const NEWS_REFRESH_INTERVAL_MS = 60000;

const HostNewsTickerPanel = ({ localParticipant, roomId }: HostNewsTickerPanelProps) => {
  const room = useRoomContext();
  const [active, setActive] = useSessionStorageState("bullfy-news-ticker-active", false);
  // NOTE: removed "force off on mount" — ticker state now persists across tool switches
  const [fetching, setFetching] = useState(false);
  const [portalTickersAllowed, setPortalTickersAllowed] = useState<boolean | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localParticipantRef = useRef(localParticipant);
  const activeRef = useRef(active);
  const lastPayloadRef = useRef<object | null>(null);

  // Check portal tickers_enabled
  useEffect(() => {
    if (!roomId) { setPortalTickersAllowed(true); return; }
    const check = async () => {
      const { data: roomData } = await (supabase.from as any)("live_rooms")
        .select("portal_id")
        .eq("id", roomId)
        .maybeSingle();
      if (!roomData?.portal_id) { setPortalTickersAllowed(true); return; }
      const { data: portal } = await (supabase.from as any)("partner_portals")
        .select("tickers_enabled")
        .eq("id", roomData.portal_id)
        .maybeSingle();
      setPortalTickersAllowed(portal?.tickers_enabled ?? false);
    };
    check();
  }, [roomId]);

  useEffect(() => { localParticipantRef.current = localParticipant; }, [localParticipant]);
  useEffect(() => { activeRef.current = active; }, [active]);

  const sendDataMessage = useCallback((payload: object) => {
    const lp = localParticipantRef.current;
    if (!lp) return;
    try {
      const data = new TextEncoder().encode(JSON.stringify(payload));
      lp.publishData(data, { reliable: true });
    } catch (err) {
      console.error("News ticker sendDataMessage error:", err);
    }
  }, []);

  const fetchAndBroadcast = useCallback(async () => {
    const lp = localParticipantRef.current;
    if (!lp) return;
    setFetching(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const jwt = session?.session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/live-news-ticker-feed`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ category: "general", maxHeadlines: 10 }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error fetching news");

      const headlines = Array.isArray(json.headlines)
        ? json.headlines.filter((h: any) => h?.headline)
        : [];

      if (headlines.length === 0) {
        console.warn("News ticker: no headlines returned; keeping previous data");
        return;
      }

      const payload = {
        type: "news-ticker-update",
        action: "show",
        headlines,
      };
      lastPayloadRef.current = payload;
      sendDataMessage(payload);
      window.dispatchEvent(new CustomEvent("bullfy-news-ticker", { detail: payload }));
    } catch (err: any) {
      console.error("News ticker fetch error:", err);
    } finally {
      setFetching(false);
    }
  }, [sendDataMessage]);

  // Re-broadcast to newly connected participants
  useEffect(() => {
    const handleParticipantConnected = () => {
      if (activeRef.current && lastPayloadRef.current) {
        setTimeout(() => sendDataMessage(lastPayloadRef.current!), 600);
      }
    };
    const handleSyncRequest = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type !== "news-ticker-sync-request") return;
        if (activeRef.current && lastPayloadRef.current) {
          sendDataMessage(lastPayloadRef.current);
        } else {
          sendDataMessage({ type: "news-ticker-update", action: "hide" });
        }
      } catch {}
    };
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.DataReceived, handleSyncRequest);
    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.DataReceived, handleSyncRequest);
    };
  }, [room, sendDataMessage]);

  const startInterval = useCallback(() => {
    if (intervalRef.current) return;
    fetchAndBroadcast();
    intervalRef.current = setInterval(fetchAndBroadcast, NEWS_REFRESH_INTERVAL_MS);
  }, [fetchAndBroadcast]);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const toggleTicker = useCallback((on: boolean) => {
    if (!localParticipantRef.current) {
      toast.error("Conéctate al stream primero");
      return;
    }
    setActive(on);
    if (on) {
      startInterval();
      toast.success("Ticker de noticias activado");
    } else {
      stopInterval();
      lastPayloadRef.current = null;
      const payload = { type: "news-ticker-update", action: "hide" };
      sendDataMessage(payload);
      window.dispatchEvent(new CustomEvent("bullfy-news-ticker", { detail: payload }));
      toast.info("Ticker de noticias desactivado");
    }
  }, [startInterval, stopInterval, sendDataMessage, setActive]);

  useEffect(() => {
    if (active && localParticipant) {
      startInterval();
    }
    return () => { stopInterval(); };
  }, [active, !!localParticipant, startInterval, stopInterval]);

  // CRITICAL: When the panel unmounts (stream ended / host left),
  // forcibly disable the news ticker so it never keeps consuming credits.
  useEffect(() => {
    return () => {
      try {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        sessionStorage.removeItem("bullfy-news-ticker-active");
        sessionStorage.removeItem("bullfy-news-ticker-viewer");
        const lp = localParticipantRef.current;
        if (lp) {
          const payload = { type: "news-ticker-update", action: "hide" };
          const data = new TextEncoder().encode(JSON.stringify(payload));
          lp.publishData(data, { reliable: true });
        }
      } catch {}
    };
  }, []);

  if (portalTickersAllowed === null) {
    return (
      <Card className="w-full">
        <CardContent className="py-4 flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!portalTickersAllowed) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-primary" /> Ticker de Noticias
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Mostrar en stream</Label>
          <Switch checked={active} onCheckedChange={toggleTicker} />
        </div>

        {active && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchAndBroadcast}
              disabled={fetching}
              className="w-full gap-1 text-xs h-7"
            >
              <RefreshCw className={`w-3 h-3 ${fetching ? "animate-spin" : ""}`} />
              Actualizar noticias
            </Button>
            <p className="text-[10px] text-muted-foreground">
              Se actualiza automáticamente cada 60s
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default HostNewsTickerPanel;
