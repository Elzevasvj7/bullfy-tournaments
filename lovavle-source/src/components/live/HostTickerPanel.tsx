import { useState, useEffect, useCallback, useRef } from "react";
import { useSessionStorageState } from "@/hooks/useSessionStorageState";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toastUtils";
import { TrendingUp, Loader2, RefreshCw } from "lucide-react";
import type { LocalParticipant } from "livekit-client";

interface HostTickerPanelProps {
  localParticipant?: LocalParticipant | null;
  roomId?: string;
}

interface TickerConfig {
  enabled: boolean;
  symbols: string[];
  scroll_speed: number;
}

const TICKER_REFRESH_INTERVAL_MS = 120_000; // 120s to conserve API credits

const HostTickerPanel = ({ localParticipant, roomId }: HostTickerPanelProps) => {
  const room = useRoomContext();
  const [config, setConfig] = useState<TickerConfig | null>(null);
  const [active, setActive] = useSessionStorageState("bullfy-ticker-active", false);
  // NOTE: removed "force off on mount" — ticker state now persists across tool switches
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [portalTickersAllowed, setPortalTickersAllowed] = useState<boolean | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPayloadRef = useRef<object | null>(null);

  const configRef = useRef(config);
  const localParticipantRef = useRef(localParticipant);
  const activeRef = useRef(active);

  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { localParticipantRef.current = localParticipant; }, [localParticipant]);
  useEffect(() => { activeRef.current = active; }, [active]);

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

  // Load integration settings
  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase.from as any)("integration_settings")
        .select("config, enabled")
        .eq("service_name", "twelvedata")
        .maybeSingle();

      if (data?.enabled) {
        setConfig({
          enabled: data.enabled,
          symbols: data.config?.symbols || [],
          scroll_speed: data.config?.scroll_speed || 30,
        });
      }
      setLoading(false);
    };
    load();
  }, []);

  const sendDataMessage = useCallback((payload: object) => {
    const lp = localParticipantRef.current;
    if (!lp) return;
    try {
      const data = new TextEncoder().encode(JSON.stringify(payload));
      lp.publishData(data, { reliable: true });
    } catch (err) {
      console.error("Ticker sendDataMessage error:", err);
    }
  }, []);

  const fetchAndBroadcast = useCallback(async () => {
    const cfg = configRef.current;
    const lp = localParticipantRef.current;
    if (!cfg || !lp) return;
    setFetching(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const jwt = session?.session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/live-ticker-feed`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ symbols: cfg.symbols }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error fetching prices");

      const prices = Array.isArray(json.prices)
        ? json.prices.filter((price: any) => price?.symbol && price?.price)
        : [];

      if (prices.length === 0) {
        console.warn("Ticker fetch returned no prices; keeping ticker visible with previous data");
        return;
      }

      const payload = {
        type: "ticker-update",
        action: "show",
        prices,
        scrollSpeed: cfg.scroll_speed,
      };
      lastPayloadRef.current = payload;
      sendDataMessage(payload);
      window.dispatchEvent(new CustomEvent("bullfy-ticker", { detail: payload }));
    } catch (err: any) {
      console.error("Ticker fetch error:", err);
    } finally {
      setFetching(false);
    }
  }, [sendDataMessage]);

  // Re-broadcast to newly connected participants
  useEffect(() => {
    const handleParticipantConnected = () => {
      if (activeRef.current && lastPayloadRef.current) {
        setTimeout(() => sendDataMessage(lastPayloadRef.current!), 500);
      }
    };
    const handleSyncRequest = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type !== "ticker-sync-request") return;
        if (activeRef.current && lastPayloadRef.current) {
          sendDataMessage(lastPayloadRef.current);
        } else {
          // Host está OFF → indica al viewer que oculte cualquier ticker cacheado
          sendDataMessage({ type: "ticker-update", action: "hide" });
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
    intervalRef.current = setInterval(fetchAndBroadcast, TICKER_REFRESH_INTERVAL_MS);
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
      toast.success("Ticker financiero activado");
    } else {
      stopInterval();
      lastPayloadRef.current = null;
      const payload = { type: "ticker-update", action: "hide" };
      sendDataMessage(payload);
      window.dispatchEvent(new CustomEvent("bullfy-ticker", { detail: payload }));
      toast.info("Ticker desactivado");
    }
  }, [startInterval, stopInterval, sendDataMessage, setActive]);

  useEffect(() => {
    if (active && config?.enabled && localParticipant) {
      startInterval();
    }
    return () => { stopInterval(); };
  }, [active, config?.enabled, !!localParticipant, startInterval, stopInterval]);

  // When the panel unmounts (host switches tools), stop the local
  // refresh interval to conserve TwelveData API credits. Do NOT send
  // hide to viewers — they should keep seeing the last snapshot.
  useEffect(() => {
    return () => {
      try {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } catch {}
    };
  }, []);

  if (loading || portalTickersAllowed === null) {
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

  if (!config?.enabled) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" /> Ticker Financiero
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            No configurado. Actívalo en Configuración → Integraciones.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> Ticker Financiero
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Mostrar en stream</Label>
          <Switch checked={active} onCheckedChange={toggleTicker} />
        </div>

        {active && (
          <>
            <div className="flex flex-wrap gap-1">
              {config.symbols.map((sym) => (
                <Badge key={sym} variant="outline" className="text-[10px]">{sym}</Badge>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchAndBroadcast}
              disabled={fetching}
              className="w-full gap-1 text-xs h-7"
            >
              <RefreshCw className={`w-3 h-3 ${fetching ? "animate-spin" : ""}`} />
              Actualizar precios
            </Button>
            <p className="text-[10px] text-muted-foreground">
              Se actualiza automáticamente cada 30s
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default HostTickerPanel;
