import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/lib/toastUtils";
import { useLiveKitReady } from "@/hooks/useLiveKitReady";
import { Sticker, Upload, Trash2, Play, X, Film, Eye, EyeOff, TrendingUp, TrendingDown } from "lucide-react";

interface OverlayAsset {
  id: string;
  name: string;
  asset_type: string;
  file_path: string;
  thumbnail_path?: string | null;
  duration_seconds?: number | null;
}

interface ActiveOverlay {
  url: string;
  type: "sticker" | "video";
  name: string;
}

interface ActiveTradeOverlay {
  symbol: string;
}

interface OverlayDisplayProps {
  roomId?: string;
  portalId?: string | null;
  partnerUserId?: string | null;
}

/** Host panel to manage & trigger overlays */
const OverlayManagerHost = () => {
  const room = useRoomContext();
  const [assets, setAssets] = useState<OverlayAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) return;
    const { data } = await supabase
      .from("live_overlay_assets")
      .select("*")
      .eq("uploaded_by", session.session.user.id)
      .order("created_at", { ascending: false });
    if (data) setAssets(data as OverlayAsset[]);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) {
      toast.error("Solo se permiten imágenes o videos");
      return;
    }

    setUploading(true);
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) { setUploading(false); return; }

    const ext = file.name.split(".").pop();
    const path = `${session.session.user.id}/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage.from("live-overlays").upload(path, file);
    if (error) { toast.error("Error subiendo archivo"); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from("live-overlays").getPublicUrl(path);

    await supabase.from("live_overlay_assets").insert({
      name: file.name.replace(/\.[^.]+$/, ""),
      asset_type: isVideo ? "video" : "sticker",
      file_path: urlData.publicUrl,
      uploaded_by: session.session.user.id,
    });

    await loadAssets();
    setUploading(false);
    toast.success("Overlay subido");
    if (fileRef.current) fileRef.current.value = "";
  };

  const triggerOverlay = useCallback((asset: OverlayAsset) => {
    if (!room.localParticipant) return;
    const payload = {
      type: "overlay",
      action: "show",
      url: asset.file_path,
      overlayType: asset.asset_type,
      name: asset.name,
    };
    const data = new TextEncoder().encode(JSON.stringify(payload));
    room.localParticipant.publishData(data, { reliable: true });
    // Echo locally so host sees it too
    window.dispatchEvent(new CustomEvent("bullfy-overlay", { detail: payload }));
    toast.success(`Overlay "${asset.name}" enviado`);
  }, [room]);

  const hideOverlay = useCallback(() => {
    if (!room.localParticipant) return;
    const payload = { type: "overlay", action: "hide" };
    const data = new TextEncoder().encode(JSON.stringify(payload));
    room.localParticipant.publishData(data, { reliable: true });
    window.dispatchEvent(new CustomEvent("bullfy-overlay", { detail: payload }));
  }, [room]);

  const deleteAsset = async (id: string) => {
    await supabase.from("live_overlay_assets").delete().eq("id", id);
    setAssets(prev => prev.filter(a => a.id !== id));
    toast.success("Asset eliminado");
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sticker className="w-4 h-4 text-primary" /> Overlays
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} />
          <Button size="sm" variant="outline" className="w-full gap-1 text-xs" disabled={uploading}
            onClick={() => fileRef.current?.click()}>
            <Upload className="w-3 h-3" /> {uploading ? "Subiendo..." : "Subir Sticker / Video"}
          </Button>
        </div>

        <Button size="sm" variant="ghost" className="w-full gap-1 text-xs text-destructive" onClick={hideOverlay}>
          <X className="w-3 h-3" /> Ocultar Overlay Activo
        </Button>

        <ScrollArea className="max-h-[400px]">
          {assets.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">Sin overlays</p>
          )}
          {assets.map(asset => (
            <div key={asset.id} className="flex items-center gap-2 p-2 rounded border border-border mb-1.5 group">
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 bg-primary/10 hover:bg-primary/20" onClick={() => triggerOverlay(asset)}>
                <Play className="w-4 h-4 text-primary" />
              </Button>
              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                {asset.asset_type === "video" ? (
                  <Film className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <img src={asset.file_path} alt="" className="w-8 h-8 object-cover rounded" />
                )}
              </div>
              <div className="flex-1 min-w-0 overflow-x-auto">
                <p className="text-xs font-medium whitespace-nowrap">{asset.name}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{asset.asset_type}</p>
              </div>
              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => deleteAsset(asset.id)}>
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

interface StreamPosition {
  id: string;
  symbol: string;
  type?: string | number | null;
  action?: string | number | null;
  order_type?: string | number | null;
  side?: string | number | null;
  volume: number | null;
  open_price: number | null;
  current_price: number | null;
  profit: number | null;
  opened_at: string | null;
}

/** Viewer overlay display */
const OverlayDisplay = ({ roomId, portalId, partnerUserId }: OverlayDisplayProps) => {
  const room = useRoomContext();
  const isLkReady = useLiveKitReady(room);
  const [overlay, setOverlay] = useState<ActiveOverlay | null>(null);
  const [tradeOverlay, setTradeOverlay] = useState<ActiveTradeOverlay | null>(null);
  const [sendingOrder, setSendingOrder] = useState<"buy" | "sell" | null>(null);
  const [viewerLotSize, setViewerLotSize] = useState("0.10");
  const [viewerStopLoss, setViewerStopLoss] = useState("");
  const [viewerTakeProfit, setViewerTakeProfit] = useState("");
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionResult, setPredictionResult] = useState<{
    symbol?: string;
    trend: string;
    confidence: string;
    summary: string;
    newsAlert: string | null;
    redFolderEvents: Array<{ title: string; country: string; time_label: string }>;
    fromHost?: boolean;
  } | null>(null);
  const [showPrediction, setShowPrediction] = useState(true);
  // Host controls whether viewers can generate their own prediction. Default OFF until host says otherwise.
  const [viewerPredictionAllowed, setViewerPredictionAllowed] = useState(false);

  // Real MT5 positions opened during this stream (room)
  const [streamPositions, setStreamPositions] = useState<StreamPosition[]>([]);
  const [accountBalance, setAccountBalance] = useState<number | null>(null);
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null);
  const confettiFiredRef = useRef<Set<string>>(new Set());
  const videoRef = useRef<HTMLVideoElement>(null);

  const applyOverlayMsg = useCallback((msg: any) => {
    if (msg.type === "overlay") {
      if (msg.action === "show") {
        setOverlay({ url: msg.url, type: msg.overlayType, name: msg.name });
      } else if (msg.action === "hide") {
        setOverlay(null);
      }
      return;
    }

    if (msg.type === "trade_cta") {
      if (msg.action === "show") {
        setTradeOverlay({ symbol: msg.symbol || "XAUUSD" });
        setViewerLotSize("0.10");
        setViewerStopLoss("");
        setViewerTakeProfit("");
      } else if (msg.action === "hide") {
        setTradeOverlay(null);
      }
      return;
    }

    if (msg.type === "trend_prediction") {
      if (msg.action === "show" && msg.prediction) {
        setPredictionResult({
          symbol: msg.symbol,
          trend: msg.prediction.trend ?? "neutral",
          confidence: msg.prediction.confidence ?? "media",
          summary: msg.prediction.summary ?? "",
          newsAlert: msg.prediction.newsAlert ?? msg.prediction.news_alert ?? null,
          redFolderEvents: Array.isArray(msg.prediction.redFolderEvents)
            ? msg.prediction.redFolderEvents
            : Array.isArray(msg.prediction.red_folder_events)
              ? msg.prediction.red_folder_events
              : [],
          fromHost: msg.broadcastedBy === "host",
        });
        setShowPrediction(true);
      } else if (msg.action === "hide") {
        setPredictionResult(null);
      }
      return;
    }

    if (msg.type === "viewer_prediction_permission") {
      setViewerPredictionAllowed(!!msg.allowed);
      return;
    }
  }, []);

  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      try {
        applyOverlayMsg(JSON.parse(new TextDecoder().decode(payload)));
      } catch {}
    };
    const handleLocal = (e: Event) => {
      applyOverlayMsg((e as CustomEvent).detail);
    };
    if (room && isLkReady) {
      room.on(RoomEvent.DataReceived, handleData);
    }
    window.addEventListener("bullfy-overlay", handleLocal);
    return () => {
      if (room && isLkReady) {
        room.off(RoomEvent.DataReceived, handleData);
      }
      window.removeEventListener("bullfy-overlay", handleLocal);
    };
  }, [room, isLkReady, applyOverlayMsg]);

  // Ask host for current viewer-prediction permission once on mount
  const hasSentPredPermSyncRef = useRef(false);
  useEffect(() => {
    if (hasSentPredPermSyncRef.current || !room || !isLkReady) return;
    hasSentPredPermSyncRef.current = true;
    const t = setTimeout(() => {
      try {
        const data = new TextEncoder().encode(JSON.stringify({ type: "viewer_prediction_permission_request" }));
        room.localParticipant.publishData(data, { reliable: true });
      } catch {}
    }, 1300);
    return () => clearTimeout(t);
  }, [room, isLkReady]);

  useEffect(() => {
    if (overlay?.type === "video" && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [overlay]);

  // ── Adaptive polling for real MT5 stream positions ──────────────
  const lastEmptyAtRef = useRef<number | null>(null);
  // When the Bridge realtime channel is delivering fresh snapshots we skip
  // the normal HTTP polling (Bridge accounts only). MetaApi accounts still
  // poll at the regular cadence because they have no realtime backing yet.
  const realtimeFreshAtRef = useRef<number>(0);

  // Subscribe to Bridge MT5 snapshot pushes (1s ticks via cron poller).
  useEffect(() => {
    if (!partnerUserId) return;
    const channel = supabase
      .channel(`bridge-snap-${partnerUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bridge_account_snapshot", filter: `partner_user_id=eq.${partnerUserId}` },
        (payload: any) => {
          const row = payload.new as { open_positions?: StreamPosition[]; balance?: number | null } | null;
          if (!row) return;
          realtimeFreshAtRef.current = Date.now();
          const positions = Array.isArray(row.open_positions) ? row.open_positions : [];
          setStreamPositions(positions);
          if (typeof row.balance === "number") setAccountBalance(row.balance);
          lastEmptyAtRef.current = positions.length === 0 ? (lastEmptyAtRef.current ?? Date.now()) : null;
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [partnerUserId]);

  const refreshStreamPositions = useCallback(async () => {
    if (!portalId || !partnerUserId) return null;
    const { data } = await supabase.functions.invoke("trading-room-client", {
      body: {
        action: "get_stream_positions",
        portal_id: portalId,
        partner_user_id: partnerUserId,
        room_id: roomId ?? null,
        include_all: true,
      },
    });

    if (!data?.ok) return null;

    const positions: StreamPosition[] = Array.isArray(data.positions) ? data.positions : [];
    setStreamPositions(positions);
    if (typeof data.balance === "number") setAccountBalance(data.balance);

    if (positions.length === 0) {
      if (lastEmptyAtRef.current === null) lastEmptyAtRef.current = Date.now();
    } else {
      lastEmptyAtRef.current = null;
    }

    return positions;
  }, [portalId, partnerUserId, roomId]);

  useEffect(() => {
    if (!portalId || !partnerUserId) return;
    let cancelled = false;
    let timer: number | null = null;

    const tick = async () => {
      // If realtime delivered a snapshot in the last 4s (Bridge), skip HTTP poll.
      const realtimeFresh = Date.now() - realtimeFreshAtRef.current < 4000;
      let positions: StreamPosition[] | null = null;
      if (!realtimeFresh) {
        try {
          positions = await refreshStreamPositions();
          if (cancelled) return;
        } catch { /* swallow */ }
      } else {
        positions = streamPositions;
      }

      if (cancelled) return;
      const count = positions?.length ?? 0;
      const idleMs = lastEmptyAtRef.current ? Date.now() - lastEmptyAtRef.current : 0;
      // Realtime ON: heartbeat every 8s. Realtime OFF (MetaApi): 1.5/5/15s adaptive.
      const nextDelay = realtimeFresh
        ? 8_000
        : count > 0 ? 1500 : (idleMs > 30_000 ? 15_000 : 5_000);
      timer = window.setTimeout(tick, nextDelay);
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [portalId, partnerUserId, refreshStreamPositions]);

  // Confetti when any single position reaches >= +1% of balance
  useEffect(() => {
    if (!accountBalance || accountBalance <= 0) return;
    for (const pos of streamPositions) {
      if (pos.profit === null) continue;
      const pct = (pos.profit / accountBalance) * 100;
      if (pct >= 1 && !confettiFiredRef.current.has(pos.id)) {
        confettiFiredRef.current.add(pos.id);
        const fire = (ratio: number, opts: confetti.Options) =>
          confetti({
            ...opts,
            origin: { x: 0.5, y: 0.4 },
            particleCount: Math.floor(200 * ratio),
            spread: 70,
            startVelocity: 45,
            zIndex: 9999,
          });
        fire(0.5, { spread: 80 });
        fire(0.3, { spread: 120, decay: 0.92, scalar: 1.2 });
        fire(0.2, { spread: 140, startVelocity: 30, decay: 0.94, scalar: 0.9 });
        toast.success(`🎉 ¡${pos.symbol} +${pct.toFixed(2)}% sobre tu balance!`);
      }
    }
  }, [streamPositions, accountBalance]);

  const submitTradeIntent = async (side: "buy" | "sell") => {
    if (!tradeOverlay || !portalId || !partnerUserId) {
      toast.error("Trading disponible solo para viewers autenticados del portal");
      return;
    }

    setSendingOrder(side);
    try {
      const { data, error } = await supabase.functions.invoke("trading-room-client", {
        body: {
          action: "create_intent",
          portal_id: portalId,
          partner_user_id: partnerUserId,
          side,
          source: "stream_overlay",
          symbol: tradeOverlay.symbol,
          lot_size: Number(viewerLotSize),
          stop_loss: viewerStopLoss ? Number(viewerStopLoss) : null,
          take_profit: viewerTakeProfit ? Number(viewerTakeProfit) : null,
          room_id: roomId ?? null,
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "No se pudo registrar la orden");
      toast.success(`Orden ${side === "buy" ? "BUY" : "SELL"} enviada`);

      // Force a quick refresh of positions from the same MT5 account used by the stream order
      lastEmptyAtRef.current = null;
      window.setTimeout(() => void refreshStreamPositions(), 1200);
    } catch (err: any) {
      toast.error(err.message || "Error enviando orden");
    } finally {
      setSendingOrder(null);
    }
  };

  const closeStreamPosition = async (positionId: string) => {
    if (!portalId || !partnerUserId) return;
    setClosingPositionId(positionId);
    try {
      const { data, error } = await supabase.functions.invoke("trading-room-client", {
        body: {
          action: "close_position",
          portal_id: portalId,
          partner_user_id: partnerUserId,
          position_id: positionId,
          room_id: roomId ?? null,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "No se pudo cerrar la operación");
      toast.success("Operación cerrada en MT5");
      // Optimistic remove
      setStreamPositions((prev) => prev.filter((p) => p.id !== positionId));
      confettiFiredRef.current.delete(positionId);
    } catch (err: any) {
      toast.error(err.message || "No se pudo cerrar la operación");
    } finally {
      setClosingPositionId(null);
    }
  };

  const requestTrendPrediction = async () => {
    if (!tradeOverlay || !portalId || !partnerUserId) {
      toast.error("Predicción disponible solo para viewers autenticados del portal");
      return;
    }

    setPredictionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("live-trend-prediction", {
        body: {
          portal_id: portalId,
          partner_user_id: partnerUserId,
          symbol: tradeOverlay.symbol,
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "No se pudo generar la predicción");

      setPredictionResult({
        symbol: tradeOverlay.symbol,
        trend: data.prediction?.trend || "neutral",
        confidence: data.prediction?.confidence || "media",
        summary: data.prediction?.summary || "Sin resumen disponible",
        newsAlert: data.prediction?.news_alert || null,
        redFolderEvents: Array.isArray(data.prediction?.red_folder_events) ? data.prediction.red_folder_events : [],
        fromHost: false,
      });
      setShowPrediction(true);
      toast.success("Predicción de tendencia generada");
    } catch (err: any) {
      toast.error(err.message || "Error generando la predicción");
    } finally {
      setPredictionLoading(false);
    }
  };

  const hasStreamPositions = streamPositions.length > 0;
  if (!overlay && !tradeOverlay && !predictionResult && !hasStreamPositions) return null;

  const renderPositionPnL = (pos: StreamPosition) => {
    const profit = pos.profit ?? 0;
    const positive = profit >= 0;
    const pct = accountBalance && accountBalance > 0 ? (profit / accountBalance) * 100 : null;
    const rawType = String(pos.type ?? pos.action ?? pos.order_type ?? pos.side ?? "").trim().toUpperCase();
    const isSell =
      rawType.includes("SELL") || rawType === "1" || rawType === "SHORT" || rawType === "S" || rawType === "ORDER_TYPE_SELL";
    const isBuy =
      rawType.includes("BUY") || rawType === "0" || rawType === "LONG" || rawType === "B" || rawType === "ORDER_TYPE_BUY";
    const sideLabel = isSell ? "SELL" : isBuy ? "BUY" : rawType.replace("POSITION_TYPE_", "") || "—";
    // BUY/SELL son señales semánticas universales de trading: usar verde/rojo fijos,
    // NO tokens del design system (que son sobreescritos por el branding de cada portal).
    const sideClass = isSell
      ? "bg-rose-600 text-white border-rose-700"
      : isBuy
        ? "bg-emerald-600 text-white border-emerald-700"
        : "bg-muted text-foreground border-border";
    return (
      <div
        key={pos.id}
        className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 border ${
          positive ? "bg-emerald-500/15 border-emerald-500/40" : "bg-rose-500/15 border-rose-500/40"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {positive ? (
            <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <TrendingDown className="w-4 h-4 text-rose-500 shrink-0" />
          )}
          <div className="text-xs leading-tight">
            <div className="font-semibold flex items-center gap-1.5 flex-wrap">
              <span>{pos.symbol}</span>
              <span className={`inline-flex min-w-10 items-center justify-center px-2 py-0.5 rounded border text-[10px] font-bold ${sideClass}`}>
                {sideLabel}
              </span>
              <span className="text-muted-foreground font-normal">· {pos.volume ?? "—"} lot</span>
            </div>
            <div className={positive ? "text-emerald-400" : "text-rose-400"}>
              {pos.profit !== null
                ? `${profit >= 0 ? "+" : ""}${profit.toFixed(2)} USD${pct !== null ? ` (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)` : ""}`
                : "Calculando…"}
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1"
          disabled={closingPositionId === pos.id}
          onClick={() => closeStreamPosition(pos.id)}
        >
          <X className="w-3 h-3" /> {closingPositionId === pos.id ? "Cerrando…" : "Cerrar"}
        </Button>
      </div>
    );
  };

  return (
    <div className="absolute inset-x-0 bottom-20 sm:bottom-24 z-40 flex flex-col items-center gap-3 pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-300">
      {overlay && (overlay.type === "video" ? (
        <video
          ref={videoRef}
          src={overlay.url}
          className="max-w-[60%] sm:max-w-[40%] max-h-[35vh] rounded-xl shadow-2xl ring-1 ring-white/10"
          autoPlay
          playsInline
          onEnded={() => setOverlay(null)}
        />
      ) : (
        <img
          src={overlay.url}
          alt={overlay.name}
          className="max-w-[50%] sm:max-w-[30%] max-h-[30vh] object-contain drop-shadow-2xl"
        />
      ))}

      {/* Host-broadcasted prediction (visible even without trade overlay) */}
      {predictionResult && !tradeOverlay && (
        <div className="pointer-events-auto w-[min(92vw,560px)] rounded-xl border border-border/40 bg-background/30 backdrop-blur-sm shadow-2xl p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-xs">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              <span className="font-semibold">Predicción IA {predictionResult.symbol ? `· ${predictionResult.symbol}` : ""}</span>
              {predictionResult.fromHost && <span className="text-[10px] text-muted-foreground">(host)</span>}
            </div>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setShowPrediction((v) => !v)}>
              {showPrediction ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </Button>
          </div>
          {showPrediction && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold">Tendencia: {predictionResult.trend}</span>
                <span className="text-muted-foreground">Confianza: {predictionResult.confidence}</span>
              </div>
              <p className="text-xs text-foreground/90">{predictionResult.summary}</p>
              {predictionResult.newsAlert && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs">
                  {predictionResult.newsAlert}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Persistent panel of real MT5 positions opened during this stream */}
      {hasStreamPositions && (
        <div className="pointer-events-auto w-[min(92vw,560px)] space-y-2 rounded-xl border border-border/40 bg-background/40 backdrop-blur-sm shadow-2xl p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-primary" /> Mis operaciones del stream
            </span>
            {accountBalance !== null && (
              <span className="text-[10px] text-muted-foreground">Balance: {accountBalance.toFixed(2)} USD</span>
            )}
          </div>
          {streamPositions.map(renderPositionPnL)}
        </div>
      )}

      {tradeOverlay && (
        <div className="pointer-events-auto w-[min(92vw,720px)] rounded-xl border border-border/40 bg-background/30 backdrop-blur-sm shadow-2xl px-3 py-3 sm:px-4">

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs text-black">Símbolo</Label>
                <Input value={tradeOverlay.symbol} readOnly className="h-9 text-sm bg-background/70" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-black">Lote</Label>
                <Input value={viewerLotSize} onChange={(e) => setViewerLotSize(e.target.value)} className="h-9 text-sm bg-background/70" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-red-500">SL</Label>
                <Input value={viewerStopLoss} onChange={(e) => setViewerStopLoss(e.target.value)} className="h-9 text-sm bg-background/70" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-sky-400">TP</Label>
                <Input value={viewerTakeProfit} onChange={(e) => setViewerTakeProfit(e.target.value)} className="h-9 text-sm bg-background/70" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:w-[220px]">
              <Button className="w-full" disabled={!portalId || !partnerUserId || !!sendingOrder} onClick={() => submitTradeIntent("buy")}>
                {sendingOrder === "buy" ? "Enviando..." : "BUY"}
              </Button>
              <Button className="w-full" variant="destructive" disabled={!portalId || !partnerUserId || !!sendingOrder} onClick={() => submitTradeIntent("sell")}>
                {sendingOrder === "sell" ? "Enviando..." : "SELL"}
              </Button>
            </div>
          </div>

          {(viewerPredictionAllowed || predictionResult) && (
            <div className="mt-3 border-t border-border/70 pt-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-foreground">Predicción Tendencia</p>
                  <p className="text-[11px] text-muted-foreground">
                    {viewerPredictionAllowed
                      ? "Analiza el activo y advierte si hay noticia roja relevante."
                      : "Predicción enviada por el host."}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {predictionResult && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowPrediction((v) => !v)} title={showPrediction ? "Ocultar" : "Ver"}>
                      {showPrediction ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  )}
                  {viewerPredictionAllowed && (
                    <Button size="sm" variant="outline" disabled={!portalId || !partnerUserId || predictionLoading} onClick={requestTrendPrediction}>
                      {predictionLoading ? "Analizando..." : "Predicción Tendencia"}
                    </Button>
                  )}
                </div>
              </div>

              {predictionResult && showPrediction && (
                <div className="rounded-lg border border-border bg-background/60 p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-foreground">Tendencia: {predictionResult.trend}</span>
                    <span className="text-muted-foreground">Confianza: {predictionResult.confidence}</span>
                    {predictionResult.fromHost && <span className="text-[10px] text-primary">(enviada por host)</span>}
                  </div>
                  <p className="text-xs text-foreground/90">{predictionResult.summary}</p>
                  {predictionResult.newsAlert && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-foreground">
                      {predictionResult.newsAlert}
                    </div>
                  )}
                  {predictionResult.redFolderEvents.length > 0 && (
                    <div className="space-y-1">
                      {predictionResult.redFolderEvents.slice(0, 3).map((event, index) => (
                        <div key={`${event.title}-${index}`} className="text-[11px] text-muted-foreground">
                          {event.country} · {event.time_label} · {event.title}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export { OverlayManagerHost, OverlayDisplay };
