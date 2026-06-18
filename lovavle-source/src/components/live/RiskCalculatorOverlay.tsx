import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { Calculator, X, Minus, Plus, GripVertical, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMT5Connection } from "@/hooks/useMT5Connection";
import { mt5GetAccounts } from "@/services/mt5Api";
import {
  calculateRisk,
  RISK_PRESETS,
  RR_PRESETS,
  type SymbolSpec,
  type RiskResult,
} from "@/lib/riskCalculations";

interface RiskCalculatorOverlayProps {
  isHost?: boolean;
  portalId?: string | null;
  partnerUserId?: string | null;
}

interface BrokerSymbolRow {
  symbol: string;
  description: string | null;
  category: string | null;
  digits: number | null;
  tick_size: number | null;
  tick_value: number | null;
  contract_size: number | null;
}

type RiskCalcMessage = {
  type?: string;
  enabled?: boolean;
  symbol?: string;
  mode?: "self" | "mirror";
  /** Snapshot del state del host (broadcast periódico cuando mode=mirror). */
  state?: MirrorState;
};

interface MirrorState {
  symbol: string;
  side: "buy" | "sell";
  riskPercent: number;
  rrRatio: number;
  entryPrice: number;
  stopLossPips: number;
  lotSize: number;
  takeProfitPips: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  riskUsd: number;
  balance: number;
}

type Corner = "tl" | "tr" | "bl" | "br";

const STORAGE = {
  corner: "bullfy-risk-calc-corner",
  opacity: "bullfy-risk-calc-opacity",
  closed: "bullfy-risk-calc-viewer-closed",
  collapsed: "bullfy-risk-calc-collapsed",
  manualBalance: "bullfy-risk-calc-manual-balance",
};

const PANEL_W = 560;
const PANEL_H_EXPANDED = 380;
const PANEL_H_COLLAPSED = 56;
const MARGIN = 12;

const readBool = (k: string, def = false) => {
  try { return localStorage.getItem(k) === "1" ? true : localStorage.getItem(k) === "0" ? false : def; } catch { return def; }
};
const writeBool = (k: string, v: boolean) => { try { localStorage.setItem(k, v ? "1" : "0"); } catch {} };

/**
 * Risk Calculator Overlay — draggable, transparent panel rendered on top of the live stage.
 *
 * Sync model:
 * - Host toggles enabled (+ default symbol) → broadcasted via LiveKit DataChannel.
 * - Each viewer can also toggle locally (close the panel) without affecting others.
 * - Position / opacity / collapsed / chosen symbol / inputs are LOCAL per viewer.
 *
 * Data sources:
 * - Symbols: public.broker_symbols (admin-managed via MetaAPI sync).
 * - Balance: MT5 account balance (when connected) → first account; else manual input.
 */
const RiskCalculatorOverlay = ({ isHost = false, portalId = null, partnerUserId = null }: RiskCalculatorOverlayProps) => {
  const room = useRoomContext();

  // ── Sync state (host-driven) ──
  const [enabled, setEnabled] = useState(false);
  const [calcMode, setCalcMode] = useState<"self" | "mirror">("self");
  const [hostSymbol, setHostSymbol] = useState<string | null>(null);
  const [mirrorState, setMirrorState] = useState<MirrorState | null>(null);

  // ── Local viewer state ──
  const [viewerClosed, setViewerClosed] = useState(() => readBool(STORAGE.closed, false));
  const [collapsed, setCollapsed] = useState(() => readBool(STORAGE.collapsed, false));
  const [corner, setCorner] = useState<Corner>(() => {
    try { return (localStorage.getItem(STORAGE.corner) as Corner) || "br"; } catch { return "br"; }
  });
  const [opacity, setOpacity] = useState<number>(() => {
    try { return Number(localStorage.getItem(STORAGE.opacity)) || 0.95; } catch { return 0.95; }
  });
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ dx: 0, dy: 0 });

  // ── Symbols catalog ──
  const [symbols, setSymbols] = useState<BrokerSymbolRow[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>("");

  // ── MT5 balance ──
  const { connected: mt5Connected } = useMT5Connection();
  const [mt5Balance, setMt5Balance] = useState<number | null>(null);
  const [manualBalance, setManualBalance] = useState<number>(() => {
    try { return Number(localStorage.getItem(STORAGE.manualBalance)) || 10000; } catch { return 10000; }
  });

  // ── Calc inputs ──
  const [riskPercent, setRiskPercent] = useState(1);
  const [rrRatio, setRrRatio] = useState(2);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [stopLossPips, setStopLossPips] = useState<string>("30");
  const [lotSize, setLotSize] = useState<string>("");
  const [entryPrice, setEntryPrice] = useState<string>("");
  const [mode, setMode] = useState<"sl" | "lot">("sl");

  // Persist locals
  useEffect(() => writeBool(STORAGE.closed, viewerClosed), [viewerClosed]);
  useEffect(() => writeBool(STORAGE.collapsed, collapsed), [collapsed]);
  useEffect(() => { try { localStorage.setItem(STORAGE.corner, corner); } catch {} }, [corner]);
  useEffect(() => { try { localStorage.setItem(STORAGE.opacity, String(opacity)); } catch {} }, [opacity]);
  useEffect(() => { try { localStorage.setItem(STORAGE.manualBalance, String(manualBalance)); } catch {} }, [manualBalance]);

  const isPortalUser = !!(portalId && partnerUserId);
  const [portalBalance, setPortalBalance] = useState<number | null>(null);
  const [portalHasMt5, setPortalHasMt5] = useState(false);

  // ── Load symbols + balance ──
  // Portal users → trading-room-client edge function (service role bypasses RLS + brings MetaAPI balance)
  // Internal users → Supabase + admin MT5 API
  useEffect(() => {
    let alive = true;
    (async () => {
      if (isPortalUser) {
        const { data, error } = await supabase.functions.invoke("trading-room-client", {
          body: { action: "get_risk_calc_data", portal_id: portalId, partner_user_id: partnerUserId },
        });
        if (!alive) return;
        if (error || !data?.ok) {
          console.warn("[RiskCalc] portal data load error:", error?.message || data?.error);
          return;
        }
        setSymbols((data.symbols || []) as BrokerSymbolRow[]);
        setPortalBalance(typeof data.balance === "number" ? data.balance : null);
        setPortalHasMt5(!!data.has_mt5);
      } else {
        const { data, error } = await supabase
          .from("broker_symbols")
          .select("symbol, description, category, digits, tick_size, tick_value, contract_size")
          .eq("enabled", true)
          .order("symbol", { ascending: true });
        if (!alive) return;
        if (error) {
          console.warn("[RiskCalc] broker_symbols load error:", error.message);
          return;
        }
        setSymbols((data || []) as BrokerSymbolRow[]);
      }
    })();
    return () => { alive = false; };
  }, [isPortalUser, portalId, partnerUserId]);

  // ── MT5 balance fetch (internal users only) ──
  useEffect(() => {
    let alive = true;
    if (isPortalUser) return;
    if (!mt5Connected) { setMt5Balance(null); return; }
    (async () => {
      try {
        const accs = await mt5GetAccounts();
        if (!alive) return;
        if (accs && accs.length > 0) setMt5Balance(accs[0].balance);
      } catch (e: any) {
        console.warn("[RiskCalc] MT5 balance fetch failed:", e?.message);
      }
    })();
    return () => { alive = false; };
  }, [mt5Connected]);

  // ── DataChannel listener (sync from host) ──
  useEffect(() => {
    const applyRiskCalcMsg = (msg: RiskCalcMessage) => {
      try {
        if (msg?.type === "risk-calc-set") {
          setEnabled(!!msg.enabled);
          if (msg.mode === "mirror" || msg.mode === "self") setCalcMode(msg.mode);
          if (typeof msg.symbol === "string") {
            setHostSymbol(msg.symbol);
            setSelectedSymbol((prev) => (prev ? prev : msg.symbol!));
          }
          if (msg.enabled) setViewerClosed(false);
        }
        if (msg?.type === "risk-calc-state" && msg.state) {
          setMirrorState(msg.state);
        }
      } catch { return; }
    };
    const onData = (payload: Uint8Array) => {
      try { applyRiskCalcMsg(JSON.parse(new TextDecoder().decode(payload)) as RiskCalcMessage); } catch { return; }
    };
    const onLocal = (e: Event) => applyRiskCalcMsg((e as CustomEvent<RiskCalcMessage>).detail);
    if (room) room.on(RoomEvent.DataReceived, onData);
    window.addEventListener("bullfy-risk-calc-set", onLocal);
    return () => {
      if (room) room.off(RoomEvent.DataReceived, onData);
      window.removeEventListener("bullfy-risk-calc-set", onLocal);
    };
  }, [room]);

  // Default selected symbol: first available
  useEffect(() => {
    if (!selectedSymbol && symbols.length > 0) {
      setSelectedSymbol(symbols[0].symbol);
    }
  }, [symbols, selectedSymbol]);

  // ── Host actions ──
  const broadcast = useCallback(async (payload: Record<string, unknown>) => {
    try {
      const data = new TextEncoder().encode(JSON.stringify(payload));
      await room.localParticipant?.publishData(data, { reliable: true });
    } catch (e: any) {
      console.warn("[RiskCalc] broadcast failed:", e?.message);
    }
  }, [room]);

  // Host activation now happens from the CTA panel via RiskCalculatorHostToggle.
  // Symbol changes still propagate from inside the panel.

  const hostChangeSymbol = useCallback(async (sym: string) => {
    setSelectedSymbol(sym);
    if (enabled && isHost) {
      await broadcast({ type: "risk-calc-set", enabled: true, mode: calcMode, symbol: sym });
    }
  }, [enabled, isHost, broadcast, calcMode]);

  // ── Quote polling (entry price desde Bridge) ──
  // Solo cuando el usuario es portal user y tiene MT5 conectado. Cada 3s.
  // Si el backend devuelve `supported: false`, dejamos de pollear y permitimos input manual.
  const [autoEntry, setAutoEntry] = useState<number | null>(null);
  const [quoteSupported, setQuoteSupported] = useState(true);
  useEffect(() => {
    if (!isPortalUser || !portalHasMt5 || !selectedSymbol || !enabled) return;
    if (!quoteSupported) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const { data } = await supabase.functions.invoke("trading-room-client", {
          body: { action: "get_quote", portal_id: portalId, partner_user_id: partnerUserId, symbol: selectedSymbol },
        });
        if (!alive) return;
        if (data?.ok) {
          if (data.supported === false) { setQuoteSupported(false); return; }
          if (typeof data.price === "number") setAutoEntry(data.price);
        }
      } catch (_e) { /* ignore */ }
      if (alive) timer = setTimeout(tick, 3000);
    };
    tick();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [isPortalUser, portalHasMt5, selectedSymbol, enabled, portalId, partnerUserId, quoteSupported]);

  // Si llega autoEntry y el usuario no ha tocado manualmente, sincronizar entryPrice
  const userTouchedEntryRef = useRef(false);
  useEffect(() => {
    if (autoEntry != null && !userTouchedEntryRef.current) {
      setEntryPrice(String(autoEntry));
    }
  }, [autoEntry]);
  // Reset touched flag al cambiar símbolo
  useEffect(() => { userTouchedEntryRef.current = false; }, [selectedSymbol]);


  // ── Position helpers ──
  const panelHeight = collapsed ? PANEL_H_COLLAPSED : PANEL_H_EXPANDED;
  const computeCornerPos = useCallback((c: Corner) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    switch (c) {
      case "tl": return { x: MARGIN, y: 80 };
      case "tr": return { x: w - PANEL_W - MARGIN, y: 80 };
      case "bl": return { x: MARGIN, y: h - panelHeight - MARGIN };
      case "br": return { x: w - PANEL_W - MARGIN, y: h - panelHeight - MARGIN };
    }
  }, [panelHeight]);

  const onPointerDown = (e: React.PointerEvent) => {
    const cur = dragPos ?? computeCornerPos(corner);
    dragOffset.current = { dx: e.clientX - cur.x, dy: e.clientY - cur.y };
    setDragPos(cur);
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const x = Math.max(0, Math.min(window.innerWidth - PANEL_W, e.clientX - dragOffset.current.dx));
    const y = Math.max(0, Math.min(window.innerHeight - panelHeight, e.clientY - dragOffset.current.dy));
    setDragPos({ x, y });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    if (!dragPos) return;
    const cx = dragPos.x + PANEL_W / 2;
    const cy = dragPos.y + panelHeight / 2;
    const isLeft = cx < window.innerWidth / 2;
    const isTop = cy < window.innerHeight / 2;
    const next: Corner = isTop ? (isLeft ? "tl" : "tr") : (isLeft ? "bl" : "br");
    setCorner(next);
    setDragPos(null);
    try { (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); } catch { return; }
  };

  // ── Build symbol spec ──
  const spec: SymbolSpec | null = useMemo(() => {
    const s = symbols.find((x) => x.symbol === selectedSymbol);
    if (!s || !s.tick_size || !s.tick_value || !s.digits) return null;
    return {
      symbol: s.symbol,
      digits: s.digits,
      tickSize: Number(s.tick_size),
      tickValue: Number(s.tick_value),
      contractSize: Number(s.contract_size || 100000),
    };
  }, [symbols, selectedSymbol]);

  const liveBalance: number | null = isPortalUser
    ? (portalHasMt5 ? portalBalance : null)
    : (mt5Connected && mt5Balance != null ? mt5Balance : null);
  const balance = liveBalance != null ? liveBalance : manualBalance;

  const result: RiskResult | null = useMemo(() => {
    if (!spec) return null;
    return calculateRisk({
      balance,
      riskPercent,
      rrRatio,
      entryPrice: Number(entryPrice) || 0,
      side,
      spec,
      lotSize: mode === "lot" ? Number(lotSize) : undefined,
      stopLossPips: mode === "sl" ? Number(stopLossPips) : undefined,
    });
  }, [spec, balance, riskPercent, rrRatio, entryPrice, side, mode, lotSize, stopLossPips]);

  // Host: cuando mode=mirror, broadcast estado cada 1.5s para que viewers lo vean en read-only.
  useEffect(() => {
    if (!isHost || !enabled || calcMode !== "mirror" || !result || !spec) return;
    const send = () => {
      void broadcast({
        type: "risk-calc-state",
        state: {
          symbol: spec.symbol, side, riskPercent, rrRatio,
          entryPrice: Number(entryPrice) || 0,
          stopLossPips: result.stopLossPips,
          lotSize: result.lotSize,
          takeProfitPips: result.takeProfitPips,
          stopLossPrice: result.stopLossPrice,
          takeProfitPrice: result.takeProfitPrice,
          riskUsd: result.riskUsd,
          balance,
        } as MirrorState,
      });
    };
    send();
    const t = setInterval(send, 1500);
    return () => clearInterval(t);
  }, [isHost, enabled, calcMode, result, spec, side, riskPercent, rrRatio, entryPrice, balance, broadcast]);

  // ── Visibility gate ──
  // Panel sólo se renderiza cuando el host lo activa (broadcast-driven).
  const visible = enabled && !viewerClosed;
  if (!visible) return null;

  // Viewer en mode=mirror → renderiza la vista del host en read-only.
  const isMirrorViewer = !isHost && calcMode === "mirror";
  // Viewer en mode=self sin Bridge conectado → bloqueado con CTA.
  const needsBridge = !isHost && calcMode === "self" && isPortalUser && !portalHasMt5;

  const pos = dragPos ?? computeCornerPos(corner);
  const symbolList = symbols.length > 0 ? symbols : [];

  return (
    <div
      className="fixed z-40 select-none"
      style={{
        left: pos.x,
        top: pos.y,
        width: PANEL_W,
        opacity,
        transition: dragging ? "none" : "left 200ms ease, top 200ms ease",
        touchAction: "none",
      }}
    >
      <div className="rounded-xl border border-white/15 bg-[#031633]/90 backdrop-blur-md shadow-2xl text-white overflow-hidden">
        {/* Header (drag handle) */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={`flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-[#062B63] to-[#0a3a8a] border-b border-white/10 ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        >
          <GripVertical className="w-3.5 h-3.5 text-white/50" />
          <Calculator className="w-4 h-4 text-[#3B82F6]" />
          <span className="text-xs font-semibold flex-1 truncate">Calculadora de Riesgo</span>
          {(isHost || isMirrorViewer) && (
            <Badge className={`text-[10px] h-5 px-1.5 ${
              isMirrorViewer ? "bg-[#146EF5]" : enabled ? "bg-emerald-600" : "bg-white/10"
            }`}>
              {isMirrorViewer ? "VISTA DEL HOST" : enabled ? "EN VIVO" : "OFF"}
            </Badge>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="p-1 rounded hover:bg-white/10"
            title={collapsed ? "Expandir" : "Minimizar"}
          >
            {collapsed ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setViewerClosed(true)}
            className="p-1 rounded hover:bg-white/10"
            title="Cerrar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {!collapsed && needsBridge && (
          <div className="p-6 text-center space-y-3">
            <Calculator className="w-10 h-10 mx-auto text-white/30" />
            <p className="text-base font-semibold text-white">Conecta tu cuenta MT5 de Bullfy</p>
            <p className="text-xs text-white/60">
              Para usar la calculadora con tu balance y precios reales, conecta tu cuenta desde Bullfy Trading Room.
            </p>
            <Button
              size="sm"
              className="bg-[#146EF5] hover:bg-[#146EF5]/90"
              onClick={() => window.open("/partner", "_blank")}
            >
              Ir a Bullfy Trading Room
            </Button>
          </div>
        )}

        {!collapsed && isMirrorViewer && !needsBridge && (
          <div className="p-3 space-y-2 text-white">
            {!mirrorState ? (
              <p className="text-xs text-white/60 text-center py-6">Esperando datos del host…</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <ResultCell label="Activo" value={mirrorState.symbol} />
                  <ResultCell label="Lado" value={mirrorState.side.toUpperCase()} highlight />
                  <ResultCell label="Entrada" value={mirrorState.entryPrice ? mirrorState.entryPrice.toString() : "—"} />
                  <ResultCell label="Riesgo" value={`$${mirrorState.riskUsd.toFixed(2)}`} />
                  <ResultCell label="Lotaje" value={String(mirrorState.lotSize)} highlight />
                  <ResultCell label="R:R" value={`1:${mirrorState.rrRatio}`} />
                  <ResultCell label="SL pips" value={String(mirrorState.stopLossPips)} small />
                  <ResultCell label="TP pips" value={String(mirrorState.takeProfitPips)} small />
                  <ResultCell label="Balance" value={`$${mirrorState.balance.toLocaleString()}`} small />
                  <ResultCell label="SL Precio" value={mirrorState.stopLossPrice ? mirrorState.stopLossPrice.toString() : "—"} small />
                  <ResultCell label="TP Precio" value={mirrorState.takeProfitPrice ? mirrorState.takeProfitPrice.toString() : "—"} small />
                </div>
                <p className="text-[10px] text-white/40 text-center">Vista en vivo del host — solo lectura</p>
              </>
            )}
          </div>
        )}

        {!collapsed && !isMirrorViewer && !needsBridge && (
          <div className="p-3 space-y-2.5 max-h-[calc(100vh-160px)] overflow-y-auto">
            <div className="grid grid-cols-2 gap-2">
              {/* Symbol */}
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-white/60">Activo</Label>
                <Select value={selectedSymbol} onValueChange={isHost ? hostChangeSymbol : setSelectedSymbol}>
                  <SelectTrigger className="h-8 bg-white/5 border-white/15 text-white text-xs">
                    <SelectValue placeholder="Selecciona activo" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {symbolList.length === 0 && (
                      <div className="text-xs text-muted-foreground p-2">Sin símbolos cargados</div>
                    )}
                    {symbolList.map((s) => (
                      <SelectItem key={s.symbol} value={s.symbol} className="text-xs">
                        {s.symbol}{s.description ? ` — ${s.description}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            {/* Balance */}
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-white/60 flex items-center gap-1">
                <Wallet className="w-3 h-3" /> Balance (USD)
                {liveBalance != null && (
                  <Badge className="ml-auto bg-emerald-600/80 text-[9px] h-4 px-1">MT5</Badge>
                )}
              </Label>
              {liveBalance != null ? (
                <div className="h-8 px-3 rounded-md bg-emerald-600/10 border border-emerald-500/30 text-sm font-mono flex items-center">
                  ${liveBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
              ) : (
                <Input
                  type="number"
                  value={manualBalance}
                  onChange={(e) => setManualBalance(Number(e.target.value))}
                  className="h-8 bg-white/5 border-white/15 text-white text-xs"
                  min={1}
                />
              )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">

            {/* Risk % presets + free input */}
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-white/60">Riesgo (%)</Label>
              <div className="flex flex-wrap gap-1">
                {RISK_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setRiskPercent(p)}
                    className={`px-2 py-0.5 rounded text-[11px] border ${
                      riskPercent === p
                        ? "bg-[#146EF5] border-[#146EF5] text-white"
                        : "bg-white/5 border-white/15 text-white/80 hover:bg-white/10"
                    }`}
                  >
                    {p}%
                  </button>
                ))}
                <Input
                  type="number"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(Number(e.target.value))}
                  className="h-6 w-14 bg-white/5 border-white/15 text-white text-[11px] px-1.5"
                  step={0.1}
                  min={0.1}
                />
              </div>
            </div>

            {/* R:R presets + free input */}
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-white/60">Ratio R:R</Label>
              <div className="flex flex-wrap gap-1">
                {RR_PRESETS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRrRatio(r)}
                    className={`px-2 py-0.5 rounded text-[11px] border ${
                      rrRatio === r
                        ? "bg-[#146EF5] border-[#146EF5] text-white"
                        : "bg-white/5 border-white/15 text-white/80 hover:bg-white/10"
                    }`}
                  >
                    1:{r}
                  </button>
                ))}
                <Input
                  type="number"
                  value={rrRatio}
                  onChange={(e) => setRrRatio(Number(e.target.value))}
                  className="h-6 w-14 bg-white/5 border-white/15 text-white text-[11px] px-1.5"
                  step={0.1}
                  min={0.1}
                />
              </div>
            </div>
            </div>

            {/* Side + entry */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-white/60">Lado</Label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setSide("buy")}
                    className={`flex-1 h-7 rounded text-[11px] border ${
                      side === "buy" ? "bg-emerald-600 border-emerald-600" : "bg-white/5 border-white/15 hover:bg-white/10"
                    }`}
                  >BUY</button>
                  <button
                    type="button"
                    onClick={() => setSide("sell")}
                    className={`flex-1 h-7 rounded text-[11px] border ${
                      side === "sell" ? "bg-red-600 border-red-600" : "bg-white/5 border-white/15 hover:bg-white/10"
                    }`}
                  >SELL</button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-white/60">Entrada</Label>
                <Input
                  type="number"
                  value={entryPrice}
                  onChange={(e) => { userTouchedEntryRef.current = true; setEntryPrice(e.target.value); }}
                  className="h-7 bg-white/5 border-white/15 text-white text-[11px]"
                  step={spec ? spec.tickSize : 0.0001}
                  placeholder="precio"
                />
              </div>
            </div>

            {/* Mode toggle + dynamic input pareados horizontal */}
            <div className="grid grid-cols-2 gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-white/60">Modo</Label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setMode("sl")}
                    className={`flex-1 h-7 rounded text-[11px] border ${mode === "sl" ? "bg-[#146EF5] border-[#146EF5]" : "bg-white/5 border-white/15"}`}
                  >SL → Lot</button>
                  <button
                    type="button"
                    onClick={() => setMode("lot")}
                    className={`flex-1 h-7 rounded text-[11px] border ${mode === "lot" ? "bg-[#146EF5] border-[#146EF5]" : "bg-white/5 border-white/15"}`}
                  >Lot → SL</button>
                </div>
              </div>
              {mode === "sl" ? (
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-white/60">Stop Loss (pips)</Label>
                  <Input
                    type="number"
                    value={stopLossPips}
                    onChange={(e) => setStopLossPips(e.target.value)}
                    className="h-7 bg-white/5 border-white/15 text-white text-[11px]"
                    min={1}
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-white/60">Lotaje</Label>
                  <Input
                    type="number"
                    value={lotSize}
                    onChange={(e) => setLotSize(e.target.value)}
                    className="h-7 bg-white/5 border-white/15 text-white text-[11px]"
                    step={0.01}
                    min={0.01}
                  />
                </div>
              )}
            </div>

            {/* Results — 3 columnas más horizontal */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <ResultCell label="Riesgo" value={result ? `$${result.riskUsd.toFixed(2)}` : "—"} />
              <ResultCell label="Lotaje" value={result ? result.lotSize.toString() : "—"} highlight />
              <ResultCell label="SL" value={result ? `${result.stopLossPips} pips` : "—"} />
              <ResultCell label="TP" value={result ? `${result.takeProfitPips} pips` : "—"} />
              <ResultCell label="SL Precio" value={result && result.stopLossPrice > 0 ? result.stopLossPrice.toString() : "—"} small />
              <ResultCell label="TP Precio" value={result && result.takeProfitPrice > 0 ? result.takeProfitPrice.toString() : "—"} small />
            </div>

            {!spec && selectedSymbol && (
              <p className="text-[10px] text-amber-300/90">
                Falta info del símbolo (digits / tickSize / tickValue). Sincroniza desde MetaAPI.
              </p>
            )}

            {/* Opacity slider */}
            <div className="space-y-1 pt-1 border-t border-white/10">
              <Label className="text-[10px] uppercase text-white/60">Transparencia</Label>
              <Slider
                value={[Math.round(opacity * 100)]}
                onValueChange={(v) => setOpacity((v[0] || 50) / 100)}
                min={30}
                max={100}
                step={5}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ResultCell = ({ label, value, highlight, small }: { label: string; value: string; highlight?: boolean; small?: boolean }) => (
  <div className={`rounded-md px-2 py-1.5 border ${highlight ? "bg-[#146EF5]/15 border-[#146EF5]/40" : "bg-white/5 border-white/10"}`}>
    <div className="text-[9px] uppercase text-white/50">{label}</div>
    <div className={`font-mono font-semibold ${small ? "text-[11px]" : "text-sm"} text-white`}>{value}</div>
  </div>
);

export default RiskCalculatorOverlay;
