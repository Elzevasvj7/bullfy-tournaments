import { useState, useCallback, useEffect, useRef } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, X, Move, Maximize2 } from "lucide-react";
import { useLiveKitReady } from "@/hooks/useLiveKitReady";

/**
 * TradingView overlay – sincronización estricta host→viewers.
 *
 * Host broadcastea símbolo, temporalidad, opacidad, tamaño y posición vía
 * LiveKit DataChannel. Cada viewer carga su propio iframe con la MISMA
 * configuración (no hay modo "mi gráfico").
 *
 * Nota: dibujos, indicadores y zoom NO se replican porque el widget público
 * de TradingView no expone esa API. Para réplica 1:1 se requiere integrar
 * TradingView Charting Library (pendiente, requiere licencia).
 */

type Position = "tl" | "tr" | "bl" | "br" | "center";
type Size = "sm" | "md" | "lg" | "xl";

interface TVState {
  visible: boolean;
  symbol: string;
  interval: string;
  opacity: number; // 0.3 - 1
  position: Position;
  size: Size;
}

const DEFAULT_STATE: TVState = {
  visible: false,
  symbol: "OANDA:XAUUSD",
  interval: "15",
  opacity: 0.75,
  position: "br",
  size: "md",
};

const PRESET_SYMBOLS: { label: string; value: string }[] = [
  { label: "Oro (XAUUSD)", value: "OANDA:XAUUSD" },
  { label: "EUR/USD", value: "OANDA:EURUSD" },
  { label: "GBP/USD", value: "OANDA:GBPUSD" },
  { label: "USD/JPY", value: "OANDA:USDJPY" },
  { label: "BTC/USD", value: "BITSTAMP:BTCUSD" },
  { label: "ETH/USD", value: "BITSTAMP:ETHUSD" },
  { label: "Nasdaq (US100)", value: "OANDA:NAS100USD" },
  { label: "S&P 500 (US500)", value: "OANDA:SPX500USD" },
  { label: "Petróleo (WTI)", value: "TVC:USOIL" },
];

const INTERVALS = [
  { label: "1m", value: "1" },
  { label: "5m", value: "5" },
  { label: "15m", value: "15" },
  { label: "1h", value: "60" },
  { label: "4h", value: "240" },
  { label: "1D", value: "D" },
];

const SIZE_CLASSES: Record<Size, string> = {
  sm: "w-[280px] h-[180px]",
  md: "w-[420px] h-[260px]",
  lg: "w-[560px] h-[340px]",
  xl: "w-[720px] h-[440px]",
};

const POSITION_CLASSES: Record<Position, string> = {
  tl: "top-4 left-4",
  tr: "top-4 right-4",
  bl: "bottom-24 left-4",
  br: "bottom-24 right-4",
  center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
};

const buildTVUrl = (s: TVState) => {
  const config = {
    symbol: s.symbol,
    interval: s.interval,
    timezone: "Etc/UTC",
    theme: "dark",
    style: "1",
    locale: "es",
    toolbar_bg: "#0a0a0a",
    enable_publishing: false,
    hide_side_toolbar: false,
    hide_top_toolbar: false,
    hide_legend: false,
    withdateranges: true,
    allow_symbol_change: true,
    save_image: false,
    studies: [],
    autosize: true,
  };
  return `https://www.tradingview-widget.com/embed-widget/advanced-chart/?locale=es#${encodeURIComponent(
    JSON.stringify(config),
  )}`;
};

// ─────────── HOST PANEL ───────────
interface HostPanelProps {
  roomId: string;
}

export const TradingViewOverlayHost = ({ roomId }: HostPanelProps) => {
  const room = useRoomContext();
  const storageKey = `bullfy-tv-overlay-${roomId}`;
  const [state, setState] = useState<TVState>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_STATE;
  });
  const [customSymbol, setCustomSymbol] = useState("");

  const broadcast = useCallback((next: TVState) => {
    try {
      const data = new TextEncoder().encode(
        JSON.stringify({ type: "tv_overlay", state: next }),
      );
      room?.localParticipant?.publishData(data, { reliable: true });
    } catch {}
    window.dispatchEvent(
      new CustomEvent("bullfy-tv-overlay", { detail: { type: "tv_overlay", state: next } }),
    );
    try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
  }, [room, storageKey]);

  // Re-broadcast state when room/participant becomes available so late joiners get current value
  useEffect(() => {
    if (!room?.localParticipant) return;
    const id = setTimeout(() => broadcast(state), 800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.localParticipant]);

  // Respond to viewer "request current state" pings
  useEffect(() => {
    if (!room) return;
    const onData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg?.type === "tv_overlay_request") broadcast(state);
      } catch {}
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => { room.off(RoomEvent.DataReceived, onData); };
  }, [room, state, broadcast]);

  const update = (patch: Partial<TVState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      broadcast(next);
      return next;
    });
  };

  const applyCustom = () => {
    const sym = customSymbol.trim().toUpperCase();
    if (!sym) return;
    update({ symbol: sym });
    setCustomSymbol("");
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <LineChart className="w-4 h-4 text-primary" /> Gráfico TradingView
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2 p-2 rounded border border-border">
          <Label htmlFor="tv-visible" className="text-xs cursor-pointer flex-1">
            Mostrar overlay en stream
          </Label>
          <Switch
            id="tv-visible"
            checked={state.visible}
            onCheckedChange={(v) => update({ visible: v })}
          />
        </div>

        <p className="text-[10px] text-muted-foreground leading-tight px-1">
          Los viewers verán el mismo símbolo, temporalidad y posición que configures aquí.
          Los dibujos e indicadores son locales del widget y no se replican.
        </p>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Símbolo</Label>
          <Select value={state.symbol} onValueChange={(v) => update({ symbol: v })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESET_SYMBOLS.map((s) => (
                <SelectItem key={s.value} value={s.value} className="text-xs">
                  {s.label}
                </SelectItem>
              ))}
              {!PRESET_SYMBOLS.find((p) => p.value === state.symbol) && (
                <SelectItem value={state.symbol} className="text-xs">
                  {state.symbol} (personalizado)
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          <div className="flex gap-1.5 pt-1">
            <Input
              value={customSymbol}
              onChange={(e) => setCustomSymbol(e.target.value)}
              placeholder="Ej: NASDAQ:AAPL"
              className="h-8 text-xs"
              onKeyDown={(e) => { if (e.key === "Enter") applyCustom(); }}
            />
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={applyCustom}>
              Usar
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Temporalidad</Label>
          <div className="grid grid-cols-6 gap-1">
            {INTERVALS.map((i) => (
              <Button
                key={i.value}
                size="sm"
                variant={state.interval === i.value ? "default" : "outline"}
                className="h-7 text-[10px] px-0"
                onClick={() => update({ interval: i.value })}
              >
                {i.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Opacidad</span>
            <span className="font-mono">{Math.round(state.opacity * 100)}%</span>
          </Label>
          <Slider
            min={30}
            max={100}
            step={5}
            value={[Math.round(state.opacity * 100)]}
            onValueChange={(v) => update({ opacity: (v[0] ?? 75) / 100 })}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Maximize2 className="w-3 h-3" /> Tamaño
          </Label>
          <div className="grid grid-cols-4 gap-1">
            {(["sm", "md", "lg", "xl"] as Size[]).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={state.size === s ? "default" : "outline"}
                className="h-7 text-[10px] uppercase"
                onClick={() => update({ size: s })}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Move className="w-3 h-3" /> Posición
          </Label>
          <div className="grid grid-cols-3 gap-1">
            <Button size="sm" variant={state.position === "tl" ? "default" : "outline"} className="h-7 text-[10px]" onClick={() => update({ position: "tl" })}>↖</Button>
            <Button size="sm" variant="ghost" className="h-7 text-[10px] opacity-30" disabled>·</Button>
            <Button size="sm" variant={state.position === "tr" ? "default" : "outline"} className="h-7 text-[10px]" onClick={() => update({ position: "tr" })}>↗</Button>
            <Button size="sm" variant="ghost" className="h-7 text-[10px] opacity-30" disabled>·</Button>
            <Button size="sm" variant={state.position === "center" ? "default" : "outline"} className="h-7 text-[10px]" onClick={() => update({ position: "center" })}>●</Button>
            <Button size="sm" variant="ghost" className="h-7 text-[10px] opacity-30" disabled>·</Button>
            <Button size="sm" variant={state.position === "bl" ? "default" : "outline"} className="h-7 text-[10px]" onClick={() => update({ position: "bl" })}>↙</Button>
            <Button size="sm" variant="ghost" className="h-7 text-[10px] opacity-30" disabled>·</Button>
            <Button size="sm" variant={state.position === "br" ? "default" : "outline"} className="h-7 text-[10px]" onClick={() => update({ position: "br" })}>↘</Button>
          </div>
        </div>

        {state.visible && (
          <Button
            size="sm"
            variant="ghost"
            className="w-full gap-1 text-xs text-destructive"
            onClick={() => update({ visible: false })}
          >
            <X className="w-3 h-3" /> Ocultar overlay
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

// ─────────── DISPLAY (host echo + viewers) ───────────
interface DisplayProps {
  roomId: string;
}

export const TradingViewOverlayDisplay = ({ roomId: _roomId }: DisplayProps) => {
  const room = useRoomContext();
  const isLkReady = useLiveKitReady(room);
  const [hostState, setHostState] = useState<TVState | null>(null);
  const requestedRef = useRef(false);

  // Listen for host state broadcasts
  useEffect(() => {
    const apply = (msg: any) => {
      if (msg?.type === "tv_overlay" && msg.state) {
        setHostState({ ...DEFAULT_STATE, ...msg.state });
      }
    };
    const onData = (payload: Uint8Array) => {
      try { apply(JSON.parse(new TextDecoder().decode(payload))); } catch {}
    };
    const onLocal = (e: Event) => apply((e as CustomEvent).detail);

    if (room && isLkReady) room.on(RoomEvent.DataReceived, onData);
    window.addEventListener("bullfy-tv-overlay", onLocal);
    return () => {
      if (room && isLkReady) room.off(RoomEvent.DataReceived, onData);
      window.removeEventListener("bullfy-tv-overlay", onLocal);
    };
  }, [room, isLkReady]);

  // Request current state on mount (late joiners)
  useEffect(() => {
    if (requestedRef.current || !room || !isLkReady) return;
    requestedRef.current = true;
    const t = setTimeout(() => {
      try {
        const data = new TextEncoder().encode(JSON.stringify({ type: "tv_overlay_request" }));
        room.localParticipant?.publishData(data, { reliable: true });
      } catch {}
    }, 1500);
    return () => clearTimeout(t);
  }, [room, isLkReady]);

  if (!hostState?.visible) return null;

  return (
    <div
      className={`absolute z-30 ${POSITION_CLASSES[hostState.position]} ${SIZE_CLASSES[hostState.size]} pointer-events-none`}
      style={{ opacity: hostState.opacity }}
    >
      <div className="w-full h-full rounded-lg overflow-hidden border border-white/20 shadow-2xl bg-black/30 backdrop-blur-[1px]">
        <iframe
          key={`${hostState.symbol}-${hostState.interval}`}
          src={buildTVUrl(hostState)}
          title="TradingView"
          className="w-full h-full pointer-events-auto"
          frameBorder={0}
          allowTransparency
          scrolling="no"
        />
      </div>
    </div>
  );
};
