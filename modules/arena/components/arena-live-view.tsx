"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import type { Chart, KLineData, Options } from "klinecharts";
import {
  Activity,
  AreaChart,
  ChartArea,
  LineChart,
  MessageCircle,
  Radio,
  RadioTower,
  ShieldAlert,
  Swords,
  Target,
  Trophy,
  Tv,
  UserPlus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChatPanel, type ChatRoom } from "@/modules/chat";
import type { ChatAuthor } from "@/modules/chat";
import type { RankingEntry } from "@/modules/leaderboard";
import type { Tournament } from "@/modules/tournaments";
import type { ArenaOpenPosition, ArenaParticipant, ArenaState } from "../types";
import { ScenarioArenaScene } from "./ScenarioArenaScene";

type ArenaMode = "cockpit" | "tv";
type CenterViewMode = "arena" | "market";
type PositionsSyncStatus = "idle" | "syncing" | "synced" | "error";

type ArenaLiveViewProps = {
  tournament: Tournament;
  arena: ArenaState;
  chatRoom: ChatRoom;
  currentChatUser?: ChatAuthor;
  initialMode?: ArenaMode;
};

type MockMarketCandle = KLineData & {
  signal: "long" | "short" | "neutral";
};

type CompetitiveContext = {
  activeParticipants: number;
  ahead?: ArenaParticipant;
  behind?: ArenaParticipant;
  dropBuffer: number;
  eliminatedSeats: number;
  leader?: ArenaParticipant;
  podiumDelta: number;
  podiumLine?: ArenaParticipant;
  pressurePercent: number;
  riskLabel: string;
  riskTone: "safe" | "chasing" | "risk";
  trader: ArenaParticipant;
  upDelta: number;
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactMoneyFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const klineTerminalOptions = {
  timezone: "UTC",
  layout: {
    basicParams: {
      barSpaceLimitMax: 24,
      barSpaceLimitMin: 4,
      paneMinHeight: 48,
      yAxisInside: true,
    },
    panes: [
      { type: "candle" },
      {
        type: "indicator",
        content: ["VOL"],
        options: {
          dragEnabled: false,
          height: 70,
          id: "volume",
          minHeight: 54,
        },
      },
      {
        type: "xAxis",
        options: {
          dragEnabled: false,
          height: 28,
          id: "x-axis",
        },
      },
    ],
  },
  styles: {
    candle: {
      bar: {
        compareRule: "current_open",
        downBorderColor: "#ef4444",
        downColor: "#ef4444",
        downWickColor: "#fb7185",
        noChangeBorderColor: "#94a3b8",
        noChangeColor: "#64748b",
        noChangeWickColor: "#94a3b8",
        upBorderColor: "#a3ff3d",
        upColor: "#a3ff3d",
        upWickColor: "#67e8f9",
      },
      priceMark: {
        show: false,
        high: { color: "#cbd5e1" },
        last: {
          line: { dashedValue: [4, 4], size: 1 },
          text: {
            borderColor: "#00e5ff",
            color: "#020617",
          },
        },
        low: { color: "#cbd5e1" },
      },
      tooltip: {
        showRule: "none",
        rect: {
          borderColor: "rgba(34, 211, 238, 0.28)",
          borderSize: 1,
        },
        title: { color: "#e2e8f0", size: 11 },
        legend: { color: "#94a3b8", size: 11 },
      },
      type: "candle_solid",
    },
    crosshair: {
      horizontal: {
        line: { color: "rgba(34, 211, 238, 0.45)", dashedValue: [4, 4] },
        text: { backgroundColor: "#00e5ff", color: "#020617" },
      },
      vertical: {
        line: { color: "rgba(34, 211, 238, 0.35)", dashedValue: [4, 4] },
        text: { backgroundColor: "#102033", color: "#e2e8f0" },
      },
    },
    grid: {
      horizontal: {
        color: "rgba(148, 163, 184, 0.12)",
        dashedValue: [3, 6],
        show: true,
        size: 1,
        style: "dashed",
      },
      show: true,
      vertical: {
        color: "rgba(34, 211, 238, 0.07)",
        dashedValue: [2, 10],
        show: true,
        size: 1,
        style: "dashed",
      },
    },
    indicator: {
      bars: [
        {
          downColor: "rgba(239, 68, 68, 0.4)",
          noChangeColor: "rgba(148, 163, 184, 0.24)",
          upColor: "rgba(163, 255, 61, 0.42)",
        },
      ],
      tooltip: {
        showRule: "none",
        title: { color: "#94a3b8", size: 10 },
        legend: { color: "#64748b", size: 10 },
      },
    },
    separator: {
      color: "rgba(34, 211, 238, 0.12)",
      size: 1,
    },
    xAxis: {
      axisLine: { color: "rgba(34, 211, 238, 0.16)", show: true },
      tickLine: { show: false },
      tickText: { color: "#64748b", size: 10 },
    },
    yAxis: {
      axisLine: { show: false },
      tickLine: { show: false },
      tickText: { color: "#7dd3fc", marginEnd: 6, size: 10 },
    },
  },
  thousandsSeparator: {
    sign: ",",
  },
  zoomAnchor: "last_bar",
} satisfies Options;

const cockpitParticipantMock: ArenaParticipant = {
  id: "trader_karlos_mock",
  name: "Karlos Guzman",
  clan: "Bullfy Clan",
  avatarUrl: "/avatars/karlos.svg",
  position: 1,
  previousPosition: 1,
  scoreChange: -0.91,
  pnl: -91.32,
  balance: 9908.68,
  trades: 34,
  winRate: 58,
};

const fallbackRivals: ArenaParticipant[] = [
  {
    id: "rival_luna_mock",
    name: "Luna Trader",
    clan: "Apex Desk",
    avatarUrl: "/avatars/luna.svg",
    position: 2,
    previousPosition: 4,
    scoreChange: 1.38,
    pnl: 342.16,
    balance: 10342.16,
    trades: 28,
    winRate: 62,
  },
  {
    id: "rival_mateo_mock",
    name: "Mateo Torres",
    clan: "Quant Norte",
    avatarUrl: "/avatars/mateo.svg",
    position: 3,
    previousPosition: 2,
    scoreChange: 0.64,
    pnl: 274.8,
    balance: 10274.8,
    trades: 31,
    winRate: 57,
  },
  {
    id: "rival_valentina_mock",
    name: "Valentina FX",
    clan: "Bull Vault",
    avatarUrl: "/avatars/valentina.svg",
    position: 4,
    previousPosition: 5,
    scoreChange: -0.22,
    pnl: 226.3,
    balance: 10226.3,
    trades: 22,
    winRate: 54,
  },
  {
    id: "rival_fx_immortal_mock",
    name: "FX Immortal",
    clan: "Zero Spread",
    avatarUrl: "/avatars/immortal.svg",
    position: 5,
    previousPosition: 3,
    scoreChange: -1.1,
    pnl: 198.12,
    balance: 10198.12,
    trades: 37,
    winRate: 49,
  },
];

function useCompetitiveContext(
  arena: ArenaState,
  currentTrader: ArenaParticipant,
): CompetitiveContext {
  return useMemo(() => {
    const participantMap = new Map<string, ArenaParticipant>();

    [...arena.participants, ...fallbackRivals, currentTrader].forEach(
      (participant) => {
        participantMap.set(participant.id, participant);
      },
    );

    const sorted = [...participantMap.values()].sort(
      (first, second) => first.position - second.position,
    );
    const trader =
      sorted.find((participant) => participant.id === currentTrader.id) ??
      currentTrader;
    const currentIndex = sorted.findIndex(
      (participant) => participant.id === trader.id,
    );
    const ahead = currentIndex > 0 ? sorted[currentIndex - 1] : undefined;
    const behind =
      currentIndex >= 0 && currentIndex < sorted.length - 1
        ? sorted[currentIndex + 1]
        : undefined;
    const leader = sorted[0];
    const thirdPlace = sorted.find((participant) => participant.position === 3);
    const fourthPlace = sorted.find((participant) => participant.position === 4);
    const podiumLine = trader.position <= 3 ? fourthPlace : thirdPlace;
    const podiumDelta = podiumLine
      ? Math.abs(podiumLine.pnl - trader.pnl)
      : Math.abs((leader?.pnl ?? trader.pnl + 42) - trader.pnl);
    const upDelta = ahead ? Math.max(0, ahead.pnl - trader.pnl) : 0;
    const dropBuffer = behind ? Math.max(0, trader.pnl - behind.pnl) : 64;
    const pressurePercent = Math.max(
      8,
      Math.min(100, 100 - Math.min(dropBuffer, 160) / 1.6),
    );
    const riskTone: CompetitiveContext["riskTone"] =
      dropBuffer < 24
        ? "risk"
        : trader.position <= 3 || podiumDelta < 55
          ? "chasing"
          : "safe";
    const riskLabel =
      riskTone === "risk"
        ? "En riesgo"
        : riskTone === "chasing"
          ? trader.position <= 3
            ? "Defendiendo podio"
            : "Persiguiendo"
          : "Seguro";

    return {
      activeParticipants: Math.max(arena.participants.length, sorted.length),
      ahead,
      behind,
      dropBuffer,
      eliminatedSeats: Math.max(0, 20 - sorted.length),
      leader,
      podiumDelta,
      podiumLine,
      pressurePercent,
      riskLabel,
      riskTone,
      trader,
      upDelta,
    };
  }, [arena.participants, currentTrader]);
}

export function ArenaLiveView({
  arena,
  chatRoom,
  currentChatUser,
  initialMode = "cockpit",
  tournament,
}: ArenaLiveViewProps) {
  const [liveArena, setLiveArena] = useState(arena);
  const [mode, setMode] = useState<ArenaMode>(initialMode);
  const [centerViewMode, setCenterViewMode] = useState<CenterViewMode>("market");
  const [commsOpen, setCommsOpen] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [positionsSyncStatus, setPositionsSyncStatus] =
    useState<PositionsSyncStatus>("idle");
  const [lastPositionsSyncAt, setLastPositionsSyncAt] = useState<string | null>(
    null,
  );
  const currentTrader =
    liveArena.currentParticipant ??
    liveArena.participants[0] ??
    cockpitParticipantMock;
  const rankingEntries = useRankingEntries(liveArena.participants);
  const competitiveContext = useCompetitiveContext(liveArena, currentTrader);
  const shouldSyncPositions =
    Boolean(liveArena.currentParticipantJoined) &&
    liveArena.mt5Account.login !== "-";
  const displayedPositionsSyncStatus = shouldSyncPositions
    ? positionsSyncStatus
    : "idle";
  const displayedLastPositionsSyncAt = shouldSyncPositions
    ? lastPositionsSyncAt
    : null;

  useEffect(() => {
    if (!shouldSyncPositions) {
      return;
    }

    let cancelled = false;

    async function syncPositions() {
      setPositionsSyncStatus((current) =>
        current === "idle" ? "syncing" : current,
      );

      try {
        const response = await fetch(
          `/api/demo/tournaments/${tournament.slug}/positions`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as {
          arena?: ArenaState;
          error?: string;
        };

        if (!response.ok || !payload.arena) {
          throw new Error(payload.error ?? "No se pudo sincronizar MT5");
        }

        if (!cancelled) {
          setLiveArena(payload.arena);
          setLastPositionsSyncAt(new Date().toISOString());
          setPositionsSyncStatus("synced");
        }
      } catch {
        if (!cancelled) {
          setPositionsSyncStatus("error");
        }
      }
    }

    void syncPositions();
    const intervalId = window.setInterval(syncPositions, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [shouldSyncPositions, tournament.slug]);

  async function postArenaAction(path: string, body?: object) {
    setApiError(null);

    const response = await fetch(path, {
      body: body ? JSON.stringify(body) : undefined,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      method: "POST",
    });
    const payload = (await response.json()) as {
      arena?: ArenaState;
      error?: string;
    };

    if (!response.ok || !payload.arena) {
      throw new Error(payload.error ?? "No se pudo actualizar la arena");
    }

    setLiveArena(payload.arena);
  }

  async function handleEnsureAccount() {
    try {
      await postArenaAction(
        `/api/demo/tournaments/${tournament.slug}/mt5-account`,
      );
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Error MT5");
    }
  }

  async function handleJoinTournament() {
    setIsJoining(true);
    try {
      await postArenaAction(`/api/demo/tournaments/${tournament.slug}/join`);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Error al unirse");
    } finally {
      setIsJoining(false);
    }
  }

  async function handleOpenOrder(input: {
    price?: number;
    side: "buy" | "sell";
    stopLoss?: number;
    symbol: string;
    takeProfit?: number;
    volume: number;
  }) {
    try {
      await postArenaAction(
        `/api/demo/tournaments/${tournament.slug}/orders`,
        input,
      );
    } catch (error) {
      console.log(error, "Error al abrir orden");
      setApiError(
        error instanceof Error ? error.message : "Error al abrir orden",
      );
    }
  }

  async function handleClosePosition(positionId: string) {
    try {
      await postArenaAction(
        `/api/demo/tournaments/${tournament.slug}/positions/${positionId}/close`,
      );
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "Error al cerrar orden",
      );
    }
  }

  if (mode === "tv") {
    return (
      <ArenaTvView
        arena={liveArena}
        chatRoom={chatRoom}
        centerViewMode={centerViewMode}
        currentChatUser={currentChatUser}
        onCenterViewChange={setCenterViewMode}
        onModeChange={setMode}
        rankingEntries={rankingEntries}
        tournament={tournament}
      />
    );
  }

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#030911] text-white">
      <div className="grid h-dvh min-h-0 w-full overflow-hidden p-2">
        <div className="grid min-h-0 w-full gap-2 overflow-hidden xl:grid-cols-[320px_minmax(0,1fr)_420px]">
          <LeftRail
            arena={liveArena}
            competitiveContext={competitiveContext}
            currentTrader={currentTrader}
            isJoining={isJoining}
            onJoinTournament={handleJoinTournament}
            onModeChange={setMode}
          />

          <section
            className={
              centerViewMode === "arena"
                ? "relative grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_minmax(20rem,38dvh)] gap-1.5 overflow-hidden"
                : "relative grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_minmax(20rem,38dvh)] gap-1.5 overflow-hidden"
            }
          >
            {centerViewMode === "arena" ? (
              <div className="relative h-full min-h-0 overflow-hidden">
                <SceneShell
                  arena={liveArena}
                  className="arena-cockpit-scene"
                  compactHeader={false}
                  showLiveBadge={false}
                  tournament={tournament}
                />
                <CockpitCommandBar
                  activeParticipants={competitiveContext.activeParticipants}
                  centerViewMode={centerViewMode}
                  onCenterViewChange={setCenterViewMode}
                  overlay
                  tournament={tournament}
                />
              </div>
            ) : (
              <>
                <CockpitCommandBar
                  activeParticipants={competitiveContext.activeParticipants}
                  centerViewMode={centerViewMode}
                  onCenterViewChange={setCenterViewMode}
                  tournament={tournament}
                />
                <MarketChartView arena={liveArena} />
              </>
            )}

            <CenterIntelDeck
              arena={liveArena}
              currentPosition={competitiveContext.trader.position}
              onOpenComms={() => setCommsOpen(true)}
              rankingEntries={rankingEntries}
            />
          </section>

          <RightCockpitRail
            apiError={apiError}
            arena={liveArena}
            centerViewMode={centerViewMode}
            competitiveContext={competitiveContext}
            lastPositionsSyncAt={displayedLastPositionsSyncAt}
            onClosePosition={handleClosePosition}
            onEnsureAccount={handleEnsureAccount}
            onOpenOrder={handleOpenOrder}
            positionsSyncStatus={displayedPositionsSyncStatus}
          />
        </div>
      </div>
      <TacticalSidebar
        arena={liveArena}
        currentUser={currentChatUser}
        onClose={() => setCommsOpen(false)}
        open={commsOpen}
        room={chatRoom}
      />
    </main>
  );
}

function ArenaTvView({
  arena,
  chatRoom,
  centerViewMode,
  currentChatUser,
  onCenterViewChange,
  onModeChange,
  rankingEntries,
  tournament,
}: {
  arena: ArenaState;
  chatRoom: ChatRoom;
  centerViewMode: CenterViewMode;
  currentChatUser?: ChatAuthor;
  onCenterViewChange: (mode: CenterViewMode) => void;
  onModeChange: (mode: ArenaMode) => void;
  rankingEntries: RankingEntry[];
  tournament: Tournament;
}) {
  return (
    <main className="fixed inset-0 overflow-hidden bg-[#02070c] text-white pb-2">
      <div className="grid h-dvh min-h-0 overflow-hidden xl:grid-cols-[1fr_360px]">
        <section className="scrollbar-app relative min-h-0 overflow-y-auto">
          {centerViewMode === "arena" ? (
            <SceneShell compactHeader tournament={tournament} arena={arena} />
          ) : (
            <BroadcastMarketView arena={arena} tournament={tournament} />
          )}
          <div className="absolute left-4 top-4 z-20 flex flex-wrap items-center gap-2">
            <LiveBadge />
            {arena.currentParticipantJoined ? (
              <ModeButton
                active={false}
                icon={Swords}
                label="Cockpit"
                onClick={() => onModeChange("cockpit")}
              />
            ) : null}
            <ToggleGroup
              aria-label="Cambiar vista de ArenaTV"
              className="rounded-md border border-cyan-300/15 bg-black/45 p-1 backdrop-blur"
              size="sm"
              value={[centerViewMode]}
              variant="outline"
              onValueChange={(value) => {
                const nextValue = value[0];

                if (nextValue === "arena" || nextValue === "market") {
                  onCenterViewChange(nextValue);
                }
              }}
            >
              <ToggleGroupItem value="arena">
                <Swords data-icon="inline-start" />
                3D
              </ToggleGroupItem>
              <ToggleGroupItem value="market">
                <AreaChart data-icon="inline-start" />
                Grafico
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="absolute bottom-4 left-4 right-4 z-20 grid gap-2 md:grid-cols-4">
            <BroadcastMetric
              label="Tiempo"
              value={
                <TournamentCountdownText
                  endsAt={tournament.endsAt}
                  status={tournament.status}
                />
              }
            />
            <BroadcastMetric
              label="Espectadores"
              value={String(arena.spectators)}
            />
            <BroadcastMetric
              label="Trades activos"
              value={String(arena.openPositions.length)}
            />
            <BroadcastMetric
              label="Volumen"
              value={arena.metrics[0]?.value ?? "$0"}
            />
          </div>
          <ArenaTvPictureInPicture
            arena={arena}
            centerViewMode={centerViewMode}
            onCenterViewChange={onCenterViewChange}
          />
        </section>

        <aside className="grid h-dvh min-h-0 grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-2 overflow-auto border-l border-cyan-300/10 bg-[#06111c]/95 p-2">
          <Panel title="Top ranking" icon={Trophy}>
            <div className="grid gap-2">
              {rankingEntries.length === 0 && (
                <p className="text-center text-sm text-slate-500">
                  No hay ranking actual
                </p>
              )}
              {rankingEntries.slice(0, 5).map((entry) => (
                <div
                  key={entry.traderId}
                  className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-2 rounded-md border border-white/10 bg-black/25 px-3 py-2"
                >
                  <p className="font-mono text-lg font-black text-cyan-100">
                    #{entry.position}
                  </p>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">
                      {entry.traderName}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {entry.clanName}
                    </p>
                  </div>
                  <p
                    className={
                      entry.pnl >= 0
                        ? "font-mono text-xs font-black text-lime-300"
                        : "font-mono text-xs font-black text-red-300"
                    }
                  >
                    {entry.pnl >= 0 ? "+" : ""}$
                    {compactMoneyFormatter.format(entry.pnl)}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel fill title="Actividad reciente" icon={Activity}>
            <ActivityFeed arena={arena} fill scrollable />
          </Panel>

          <div>
            <ChatPanel compact currentUser={currentChatUser} room={chatRoom} />
          </div>
        </aside>
      </div>
    </main>
  );
}

function ArenaTvPictureInPicture({
  arena,
  centerViewMode,
  onCenterViewChange,
}: {
  arena: ArenaState;
  centerViewMode: CenterViewMode;
  onCenterViewChange: (mode: CenterViewMode) => void;
}) {
  const marketData = useMemo(() => buildMockMarketData(arena), [arena]);
  const targetMode: CenterViewMode =
    centerViewMode === "arena" ? "market" : "arena";
  const label =
    targetMode === "market" ? "Abrir grafico en vivo" : "Abrir arena 3D";

  return (
    <button
      aria-label={label}
      className="group absolute bottom-32 right-5 z-30 hidden w-[min(25rem,calc(100%-2rem))] overflow-hidden rounded-md border border-cyan-300/25 bg-[#02070c]/88 p-1 text-left shadow-[0_24px_90px_rgba(0,0,0,0.55),0_0_0_1px_rgba(163,255,61,0.12)] backdrop-blur-md transition hover:-translate-y-1 hover:border-lime-300/45 hover:shadow-[0_28px_110px_rgba(0,0,0,0.62),0_0_34px_rgba(34,211,238,0.18)] md:block"
      type="button"
      onClick={() => onCenterViewChange(targetMode)}
    >
      <div className="relative aspect-video overflow-hidden rounded-sm border border-white/10 bg-black">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-3 py-2">
          <span className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-100">
            Picture in picture
          </span>
          <span className="rounded-sm border border-lime-300/25 bg-lime-300/15 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-lime-200">
            {targetMode === "market" ? "Grafico" : "3D"}
          </span>
        </div>

        {targetMode === "market" ? (
          <KlineMarketChart
            data={marketData}
            symbol={arena.tradeTicket.defaultSymbol}
            variant="pip"
          />
        ) : (
          <div className="arena-pip-scene h-full w-full">
            <ScenarioArenaScene showControls={false} />
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 z-30 ring-1 ring-inset ring-white/10 transition group-hover:ring-lime-300/30" />
        <div className="pointer-events-none absolute bottom-2 left-2 right-2 z-30 flex items-center justify-between">
          <span className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-white drop-shadow">
            {label}
          </span>
          <span className="rounded-sm bg-cyan-300 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-950">
            Click
          </span>
        </div>
      </div>
    </button>
  );
}

function BroadcastMarketView({
  arena,
  tournament,
}: {
  arena: ArenaState;
  tournament: Tournament;
}) {
  const marketData = useMemo(() => buildMockMarketData(arena), [arena]);
  const latest = marketData[marketData.length - 1];
  const first = marketData[0];
  const delta = latest && first ? latest.close - first.open : 0;
  const deltaPercent = first ? (delta / first.open) * 100 : 0;
  const isPositive = delta >= 0;
  const volume = marketData.reduce(
    (total, item) => total + (item.volume ?? 0),
    0,
  );

  return (
    <div className="relative h-screen min-h-[42rem] overflow-hidden bg-[#02070c] p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_16%,rgba(0,229,255,0.18),transparent_28%),radial-gradient(circle_at_78%_18%,rgba(163,255,61,0.1),transparent_24%),linear-gradient(180deg,rgba(2,7,12,0.24),rgba(2,7,12,0.96))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(2,7,12,0.88),transparent)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-[linear-gradient(0deg,rgba(2,7,12,0.92),transparent)]" />

      <div className="relative grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 pt-14">
        <div className="grid grid-cols-[1fr_auto] items-end gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100/70">
              ArenaTV market feed
            </p>
            <h1 className="mt-2 truncate text-5xl font-black uppercase leading-none text-white">
              {arena.tradeTicket.defaultSymbol}
            </h1>
            <p className="mt-2 text-sm font-semibold text-slate-400">
              {tournament.name} live chart
            </p>
          </div>

          <div className="grid min-w-[28rem] grid-cols-3 gap-2">
            <BroadcastMetric
              label="Ultimo"
              value={latest ? latest.close.toFixed(5) : "--"}
            />
            <BroadcastMetric
              label="Cambio"
              value={
                <span
                  className={isPositive ? "text-lime-300" : "text-red-300"}
                >
                  {isPositive ? "+" : ""}
                  {deltaPercent.toFixed(2)}%
                </span>
              }
            />
            <BroadcastMetric
              label="Volumen"
              value={compactMoneyFormatter.format(volume)}
            />
          </div>
        </div>

        <div className="min-h-0">
          <KlineMarketChart
            data={marketData}
            symbol={arena.tradeTicket.defaultSymbol}
            variant="broadcast"
          />
        </div>
      </div>
    </div>
  );
}

function CockpitCommandBar({
  activeParticipants,
  centerViewMode,
  onCenterViewChange,
  overlay = false,
  tournament,
}: {
  activeParticipants: number;
  centerViewMode: CenterViewMode;
  onCenterViewChange: (mode: CenterViewMode) => void;
  overlay?: boolean;
  tournament: Tournament;
}) {
  const shellClassName = overlay
    ? "absolute left-2 right-3 top-2 z-30 grid min-h-0 gap-2  px-2 py-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
    : "grid min-h-0 gap-2 rounded-sm border border-cyan-300/10 bg-[#07131d]/45 px-2.5 py-1.5 shadow-[0_16px_60px_rgba(0,0,0,0.18)] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center";

  return (
    <div className={shellClassName}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="max-w-[min(38rem,70vw)] truncate px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] text-white sm:text-2xl">
            {tournament.name}
          </h2>
          <span className="rounded-sm border border-lime-300/20 bg-lime-300/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-lime-100">
            {activeParticipants} participantes
          </span>
          <span className="rounded-sm border border-white/10 bg-black/35 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-300">
            {tournament.status}
          </span>
        </div>
      </div>

      <ToggleGroup
        aria-label="Cambiar vista central"
        className="justify-self-start lg:justify-self-end"
        size="sm"
        value={[centerViewMode]}
        variant="outline"
        onValueChange={(value) => {
          const nextValue = value[0];

          if (nextValue === "arena" || nextValue === "market") {
            onCenterViewChange(nextValue);
          }
        }}
      >
        <ToggleGroupItem value="market">
          <AreaChart data-icon="inline-start" />
          Mercado
        </ToggleGroupItem>
        <ToggleGroupItem value="arena">
          <Swords data-icon="inline-start" />
          Arena
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

function CenterIntelDeck({
  arena,
  currentPosition,
  onOpenComms,
  rankingEntries,
}: {
  arena: ArenaState;
  currentPosition: number;
  onOpenComms: () => void;
  rankingEntries: RankingEntry[];
}) {
  return (
    <section className="relative min-h-0 overflow-hidden rounded-md border border-cyan-300/15 bg-[linear-gradient(180deg,rgba(7,19,29,0.96),rgba(2,7,12,0.98))] shadow-[0_20px_80px_rgba(0,0,0,0.24)]">
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(0,229,255,0.48),rgba(182,255,61,0.42),transparent)]" />
      <Tabs
        className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]"
        defaultValue="ranking"
      >
        <div className="flex items-center justify-between gap-3 border-b border-cyan-300/10 px-3 py-2">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
              Match intel
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Tu ranking #{currentPosition}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TabsList className="bg-black/35" variant="line">
              <TabsTrigger
                className="h-8 px-3 text-[10px] font-black uppercase tracking-[0.12em]"
                value="ranking"
              >
                <Trophy data-icon="inline-start" />
                Ranking
              </TabsTrigger>
              <TabsTrigger
                className="h-8 px-3 text-[10px] font-black uppercase tracking-[0.12em]"
                value="stats"
              >
                <Activity data-icon="inline-start" />
                Stats
              </TabsTrigger>
            </TabsList>
            <button
              className="flex h-8 items-center justify-center gap-2 rounded-md border border-cyan-300/20 bg-black/25 px-3 text-[10px] font-black uppercase tracking-wide text-cyan-100 transition hover:border-lime-300/40 hover:text-lime-100"
              type="button"
              onClick={onOpenComms}
            >
              <Radio className="size-3.5" />
              Comms
            </button>
          </div>
        </div>

        <TabsContent
          className="scrollbar-app min-h-0 overflow-y-auto p-3"
          value="ranking"
        >
          <RankingTacticalPanel entries={rankingEntries} />
        </TabsContent>
        <TabsContent
          className="scrollbar-app min-h-0 overflow-y-auto"
          value="stats"
        >
          <MetricsGrid arena={arena} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function MarketChartView({
  arena,
}: {
  arena: ArenaState;
}) {
  const marketData = useMemo(() => buildMockMarketData(arena), [arena]);

  return (
    <section className="relative min-h-0 overflow-hidden rounded-md border border-cyan-300/5 bg-[#02070c] shadow-[0_24px_90px_rgba(0,0,0,0.38)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,229,255,0.10),transparent_28%),linear-gradient(180deg,rgba(3,9,17,0.12),rgba(3,9,17,0.92))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
      <div className="relative grid h-full min-h-0 p-1.5">
        <div className="relative min-h-0">
          <KlineMarketChart
            data={marketData}
            symbol={arena.tradeTicket.defaultSymbol}
          />
          <ChartDecisionOverlays arena={arena} data={marketData} />
        </div>
      </div>
    </section>
  );
}

function ChartDecisionOverlays({
  arena,
  data,
}: {
  arena: ArenaState;
  data: MockMarketCandle[];
}) {
  const latest = data.at(-1);
  const currentPrice = latest?.close ?? 1;
  const positions = arena.openPositions.slice(0, 4);

  if (positions.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-4 z-30 overflow-hidden rounded-md">
      {positions.map((position, index) => {
        const top = Math.max(
          24,
          Math.min(
            74,
            50 - ((position.entryPrice - currentPrice) / currentPrice) * 9000,
          ),
        );
        const positive = position.pnl >= 0;

        return (
        <div
          className={`absolute left-0 right-0 border-t border-dashed ${
            positive ? "border-lime-300/55" : "border-red-300/50"
          }`}
          key={position.id}
          style={{ top: `${top}%` }}
        >
          <span
            className={`absolute -top-3 rounded-sm border px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] shadow-[0_0_18px_rgba(182,255,61,0.14)] ${
              positive
                ? "border-lime-300/30 bg-lime-300/15 text-lime-100"
                : "border-red-300/30 bg-red-400/15 text-red-100"
            }`}
            style={{ left: `${12 + index * 16}%` }}
          >
            {position.side.toUpperCase()} {position.lots} @{" "}
            {position.entryPrice.toFixed(5)}
          </span>
        </div>
        );
      })}
    </div>
  );
}

function KlineMarketChart({
  data,
  symbol,
  variant = "cockpit",
}: {
  data: MockMarketCandle[];
  symbol: string;
  variant?: "broadcast" | "cockpit" | "pip";
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const [isReady, setIsReady] = useState(false);
  const isBroadcast = variant === "broadcast";
  const isPip = variant === "pip";

  useEffect(() => {
    let isMounted = true;
    let mountedContainer: HTMLDivElement | null = null;
    let resizeObserver: ResizeObserver | null = null;

    async function mountChart() {
      const container = containerRef.current;

      if (!container) {
        return;
      }

      mountedContainer = container;

      const { dispose, init } = await import("klinecharts");

      if (!isMounted) {
        return;
      }

      dispose(container);

      const chart = init(container, klineTerminalOptions);

      if (!chart) {
        return;
      }

      chartRef.current = chart;
      chart.setBarSpace(isPip ? 7 : 12);
      chart.setOffsetRightDistance(isPip ? 8 : 20);
      chart.setDataLoader({
        getBars: ({ callback }) => {
          callback(data, { backward: false, forward: false });
        },
      });
      chart.setSymbol({
        pricePrecision: 5,
        ticker: symbol,
        volumePrecision: 0,
      });
      chart.setPeriod({ span: 5, type: "minute" });
      chart.scrollToRealTime(0);

      resizeObserver = new ResizeObserver(() => chart.resize());
      resizeObserver.observe(container);
      setIsReady(true);
    }

    void mountChart();

    return () => {
      isMounted = false;
      resizeObserver?.disconnect();
      setIsReady(false);

      if (chartRef.current) {
        chartRef.current.resetData();
      }

      const container = mountedContainer;

      if (container) {
        void import("klinecharts").then(({ dispose }) => dispose(container));
      }

      chartRef.current = null;
    };
  }, [data, isPip, symbol]);

  return (
    <div
      className={`relative h-full min-h-0 overflow-hidden border border-cyan-300/10 bg-black/45 ${
        isBroadcast
          ? "rounded-sm shadow-[0_0_0_1px_rgba(163,255,61,0.12),0_30px_120px_rgba(0,0,0,0.48)]"
          : "rounded-sm"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(90deg,rgba(34,211,238,0.07)_1px,transparent_1px),linear-gradient(180deg,rgba(34,211,238,0.05)_1px,transparent_1px)] bg-[size:54px_44px] opacity-24" />
      {!isPip ? (
        <>
          <div
            className={`pointer-events-none absolute left-3 top-3 z-20 flex gap-1 ${
              isBroadcast ? "left-4 top-9" : ""
            }`}
          >
            {["M1", "M5", "M15", "H1"].map((period) => (
              <span
                className={`rounded-sm border px-2 py-1 font-black uppercase tracking-[0.16em] ${
                  period === "M5"
                    ? "border-lime-300/40 bg-lime-300/15 text-lime-200"
                    : "border-white/10 bg-slate-950/70 text-slate-500"
                } ${isBroadcast ? "text-[10px]" : "text-[9px]"}`}
                key={period}
              >
                {period}
              </span>
            ))}
          </div>
          <div
            className={`pointer-events-none absolute right-3 top-3 z-20 grid grid-cols-2 gap-2 ${
              isBroadcast ? "right-4 top-4" : ""
            }`}
          >
            <span className="rounded-sm border border-lime-300/20 bg-lime-300/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-lime-200">
              Bid {data.at(-1)?.close.toFixed(5) ?? "--"}
            </span>
            <span className="rounded-sm border border-red-300/20 bg-red-300/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-red-200">
              Ask{" "}
              {data.at(-1) ? (data.at(-1)!.close + 0.00008).toFixed(5) : "--"}
            </span>
          </div>
        </>
      ) : null}
      {!isReady ? (
        <div className="absolute inset-0 z-30 grid place-items-center bg-[#02070c] text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/70">
          Inicializando terminal
        </div>
      ) : null}
      <div
        ref={containerRef}
        className={`h-full w-full ${
          isPip ? "min-h-0" : isBroadcast ? "min-h-[34rem]" : "min-h-[260px]"
        }`}
      />
    </div>
  );
}

function LeftRail({
  arena,
  competitiveContext,
  currentTrader,
  isJoining,
  onJoinTournament,
  onModeChange,
}: {
  arena: ArenaState;
  competitiveContext: CompetitiveContext;
  currentTrader?: ArenaParticipant;
  isJoining: boolean;
  onJoinTournament: () => Promise<void>;
  onModeChange: (mode: ArenaMode) => void;
}) {
  return (
    <aside className="grid h-full min-h-0 content-start gap-2 overflow-y-auto p-0!">
      <CompetitivePressurePanel context={competitiveContext} />

      {currentTrader ? <TraderProfileCard participant={currentTrader} /> : null}

      <Panel title="Modo desarrollo" icon={Radio}>
        {!arena.currentParticipantJoined ? (
          <Button
            className="mb-3 h-10 w-full justify-center gap-2 font-black uppercase"
            disabled={isJoining}
            onClick={onJoinTournament}
            type="button"
          >
            <UserPlus className="size-4" />
            {isJoining ? "Uniendo..." : "Unirme al torneo"}
          </Button>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <ModeButton
            active
            icon={Swords}
            label="Cockpit"
            onClick={() => onModeChange("cockpit")}
          />
          <ModeButton
            active={false}
            icon={Tv}
            label="ArenaTV"
            onClick={() => onModeChange("tv")}
          />
        </div>
      </Panel>

      <Panel title="Reglas del torneo" icon={ShieldAlert}>
        <div className="grid gap-2 text-xs text-slate-300">
          <RuleLine
            label="Max risk"
            value={`${arena.tradeTicket.maxRiskPercent}%`}
          />
          <RuleLine
            label="Lotes"
            value={`${arena.tradeTicket.minLots}-${arena.tradeTicket.maxLots}`}
          />
          <RuleLine
            label="Simbolos"
            value={arena.tradeTicket.availableSymbols.join(", ")}
          />
        </div>
      </Panel>
    </aside>
  );
}

function CompetitivePressurePanel({
  context,
}: {
  context: CompetitiveContext;
}) {
  return (
    <section className="relative overflow-hidden rounded-md border border-amber-300/20 bg-[linear-gradient(180deg,rgba(18,20,15,0.98),rgba(6,12,18,0.98))] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.28)]">
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(251,191,36,0.8),rgba(182,255,61,0.72),transparent)]" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/75">
            <Target className="size-3.5 text-amber-200" />
            Presion competitiva
          </p>
          <p className="mt-2 text-2xl font-black uppercase leading-none text-white">
            #{context.trader.position}
          </p>
        </div>
        <span
          className={
            context.riskTone === "risk"
              ? "rounded-md border border-red-300/35 bg-red-400/12 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-red-100 cockpit-risk-pulse"
              : "rounded-md border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-100"
          }
        >
          {context.riskLabel}
        </span>
      </div>

      <div className="mt-4 rounded-md border border-white/10 bg-black/25 p-3">
        <p className="text-sm font-black text-white">
          {context.trader.position <= 3
            ? `Defiendes podio por $${compactMoneyFormatter.format(context.podiumDelta)}`
            : `Estas a $${compactMoneyFormatter.format(context.podiumDelta)} del podio`}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className={
              context.riskTone === "risk"
                ? "h-full rounded-full bg-red-400 cockpit-meter-pulse"
                : "h-full rounded-full bg-[linear-gradient(90deg,#00e5ff,#b6ff3d)]"
            }
            style={{ width: `${context.pressurePercent}%` }}
          />
        </div>
        <p className="mt-2 text-[10px] font-semibold text-slate-400">
          Presion de caida: {Math.round(context.pressurePercent)}%
        </p>
      </div>

      <div className="mt-3 grid gap-2">
        <RivalPressureRow
          label="Trader delante"
          participant={context.ahead}
          value={
            context.ahead
              ? `+$${compactMoneyFormatter.format(context.upDelta)}`
              : "Eres lider"
          }
        />
        <RivalPressureRow
          label="Trader detras"
          participant={context.behind}
          tone={context.dropBuffer <= 24 ? "negative" : "neutral"}
          value={
            context.behind
              ? `-$${compactMoneyFormatter.format(context.dropBuffer)}`
              : "Sin amenaza"
          }
        />
      </div>
    </section>
  );
}

function RivalPressureRow({
  label,
  participant,
  tone = "neutral",
  value,
}: {
  label: string;
  participant?: ArenaParticipant;
  tone?: "neutral" | "negative";
  value: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
          {label}
        </p>
        <p className="mt-0.5 truncate text-xs font-black text-white">
          {participant?.name ?? "--"}
        </p>
      </div>
      <p
        className={
          tone === "negative"
            ? "font-mono text-xs font-black text-red-200"
            : "font-mono text-xs font-black text-lime-200"
        }
      >
        {value}
      </p>
    </div>
  );
}

function ArenaContextMiniPanel({
  arena,
  centerViewMode,
  context,
}: {
  arena: ArenaState;
  centerViewMode: CenterViewMode;
  context: CompetitiveContext;
}) {
  const marketData = useMemo(() => buildMockMarketData(arena), [arena]);
  const showingArena = centerViewMode === "market";

  return (
    <section className="relative overflow-hidden rounded-md border border-cyan-300/15 bg-[#07131d]/95 shadow-[0_20px_80px_rgba(0,0,0,0.24)]">
      <div className="relative h-56 overflow-hidden border-b border-cyan-300/10 bg-black">
        {showingArena ? (
          <div className="arena-pip-scene h-full w-full opacity-75">
            <ScenarioArenaScene showControls={false} />
          </div>
        ) : (
          <KlineMarketChart
            data={marketData}
            symbol={arena.tradeTicket.defaultSymbol}
            variant="pip"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_35%_42%,rgba(182,255,61,0.16),transparent_26%),linear-gradient(180deg,rgba(2,7,12,0.12),rgba(2,7,12,0.85))]" />
        <div className="absolute left-3 top-3 rounded-sm border border-lime-300/30 bg-lime-300/12 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-lime-100">
          {showingArena
            ? `Tu cabina #${context.trader.position}`
            : arena.tradeTicket.defaultSymbol}
        </div>
        <div className="absolute bottom-3 right-3 rounded-sm border border-amber-300/30 bg-amber-300/12 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-amber-100">
          {showingArena ? `Lider ${context.leader?.name ?? "--"}` : "Mercado"}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        <MiniMetric label="Activos" value={String(context.activeParticipants)} />
        <MiniMetric label="Eliminados" value={String(context.eliminatedSeats)} />
      </div>
    </section>
  );
}

function RightCockpitRail({
  apiError,
  arena,
  centerViewMode,
  competitiveContext,
  lastPositionsSyncAt,
  onClosePosition,
  onEnsureAccount,
  onOpenOrder,
  positionsSyncStatus,
}: {
  apiError: string | null;
  arena: ArenaState;
  centerViewMode: CenterViewMode;
  competitiveContext: CompetitiveContext;
  lastPositionsSyncAt: string | null;
  onClosePosition: (positionId: string) => Promise<void>;
  onEnsureAccount: () => Promise<void>;
  onOpenOrder: (input: {
    price?: number;
    side: "buy" | "sell";
    stopLoss?: number;
    symbol: string;
    takeProfit?: number;
    volume: number;
  }) => Promise<void>;
  positionsSyncStatus: PositionsSyncStatus;
}) {
  return (
    <aside className="grid grid-rows-[auto_minmax(0,1fr)] h-full min-h-0 content-start gap-2 overflow-y-auto p-0!">
      <TradeCommandDeck
        apiError={apiError}
        arena={arena}
        competitiveContext={competitiveContext}
        lastPositionsSyncAt={lastPositionsSyncAt}
        onClosePosition={onClosePosition}
        onEnsureAccount={onEnsureAccount}
        onOpenOrder={onOpenOrder}
        positions={arena.openPositions}
        positionsSyncStatus={positionsSyncStatus}
      />
      <ArenaContextMiniPanel
        arena={arena}
        centerViewMode={centerViewMode}
        context={competitiveContext}
      />
    </aside>
  );
}

function  TradeCommandDeck({
  apiError,
  arena,
  competitiveContext,
  lastPositionsSyncAt,
  onClosePosition,
  onEnsureAccount,
  onOpenOrder,
  positions,
  positionsSyncStatus,
}: {
  apiError: string | null;
  arena: ArenaState;
  competitiveContext: CompetitiveContext;
  lastPositionsSyncAt: string | null;
  onClosePosition: (positionId: string) => Promise<void>;
  onEnsureAccount: () => Promise<void>;
  onOpenOrder: (input: {
    price?: number;
    side: "buy" | "sell";
    stopLoss?: number;
    symbol: string;
    takeProfit?: number;
    volume: number;
  }) => Promise<void>;
  positions: ArenaOpenPosition[];
  positionsSyncStatus: PositionsSyncStatus;
}) {
  const hasJoined = Boolean(arena.currentParticipantJoined);
  return (
    <section className="relative grid min-h-[34rem] overflow-hidden rounded-md border border-cyan-300/20 bg-[linear-gradient(180deg,rgba(7,19,29,0.98),rgba(2,7,12,0.98))] p-3 shadow-[0_28px_110px_rgba(0,0,0,0.42),0_0_28px_rgba(0,229,255,0.08)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(182,255,61,0.85),rgba(0,229,255,0.7),transparent)]" />
      <div className="pointer-events-none absolute inset-y-5 left-0 w-0.5 bg-lime-300/70 shadow-[0_0_18px_rgba(182,255,61,0.45)]" />
      <Tabs
        className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-0"
        defaultValue="trade"
      >
        <div className="border-b border-white/10 p-2.5">
          <div className="grid grid-cols-[1fr_auto] items-start gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
                <RadioTower className="size-3.5 text-lime-300" />
                MT5 Command Deck
              </p>
              <p className="mt-1 truncate font-mono text-lg font-black uppercase leading-none text-white">
                {arena.mt5Account.login}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-flex rounded border border-lime-300/30 bg-lime-300/10 px-2 py-1 text-[10px] font-black uppercase text-lime-200">
                {arena.mt5Account.status}
              </span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-2">
            <TabsList className="bg-black/35" variant="line">
              <TabsTrigger
                className="h-8 px-3 text-[10px] font-black uppercase tracking-[0.12em]"
                value="trade"
              >
                <Swords data-icon="inline-start" />
                Operar
              </TabsTrigger>
              <TabsTrigger
                className="h-8 px-3 text-[10px] font-black uppercase tracking-[0.12em]"
                value="positions"
              >
                <LineChart data-icon="inline-start" />
                Posiciones
                <span className="ml-1 rounded-sm border border-cyan-300/20 bg-cyan-300/10 px-1.5 py-0.5 font-mono text-[9px] text-cyan-100">
                  {positions.length}
                </span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent className="scrollbar-app min-h-0 overflow-y-auto p-2.5" value="trade">
          <OrderTicket
            apiError={apiError}
            arena={arena}
            competitiveContext={competitiveContext}
            hasJoined={hasJoined}
            onEnsureAccount={onEnsureAccount}
            onOpenOrder={onOpenOrder}
          />
        </TabsContent>
        <TabsContent className="min-h-0 overflow-hidden p-2.5" value="positions">
          <OpenPositions
            lastPositionsSyncAt={lastPositionsSyncAt}
            onClosePosition={onClosePosition}
            positions={positions}
            positionsSyncStatus={positionsSyncStatus}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function SceneShell({
  className,
  compactHeader,
  showLiveBadge = true,
}: {
  arena: ArenaState;
  className?: string;
  compactHeader: boolean;
  showLiveBadge?: boolean;
  tournament: Tournament;
}) {
  return (
    <div
      className={
        compactHeader
          ? "scenario-arena-frame h-screen min-h-[42rem]"
          : `scenario-arena-frame ${className ?? ""}`
      }
    >
      <ScenarioArenaScene />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-36 bg-[linear-gradient(180deg,rgba(2,7,12,0.86),transparent)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-40 bg-[linear-gradient(0deg,rgba(2,7,12,0.9),transparent)]" />
      {showLiveBadge ? (
        <div className="absolute left-5 top-5 z-10 max-w-[min(32rem,calc(100%-2.5rem))]">
          <div className="flex flex-wrap items-center gap-2">
            <LiveBadge />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OrderTicket({
  apiError,
  arena,
  competitiveContext,
  hasJoined,
  onEnsureAccount,
  onOpenOrder,
}: {
  apiError: string | null;
  arena: ArenaState;
  competitiveContext: CompetitiveContext;
  hasJoined: boolean;
  onEnsureAccount: () => Promise<void>;
  onOpenOrder: (input: {
    price?: number;
    side: "buy" | "sell";
    stopLoss?: number;
    symbol: string;
    takeProfit?: number;
    volume: number;
  }) => Promise<void>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [symbol, setSymbol] = useState(arena.tradeTicket.defaultSymbol);
  const [lots, setLots] = useState(String(arena.tradeTicket.defaultLots));
  const [price, setPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const hasAccount = hasJoined && arena.mt5Account.login !== "-";
  const numericLots = Number(lots);
  const validLots = Number.isFinite(numericLots) ? numericLots : 0;
  const usedRiskPercent = arena.openPositions.reduce(
    (total, position) => total + Math.min(0.45, Math.abs(position.pnlPercent)),
    0,
  );
  const riskRemaining = Math.max(
    0,
    arena.tradeTicket.maxRiskPercent - usedRiskPercent,
  );
  const estimatedPipsToPodium = Math.max(
    8,
    Math.ceil(competitiveContext.podiumDelta / Math.max(1, validLots * 38)),
  );
  const canReachPodium =
    competitiveContext.trader.position > 3 &&
    competitiveContext.podiumDelta < 140;
  const orderImpactCopy = canReachPodium
    ? `Esta orden puede subirte al #3 si alcanza +${estimatedPipsToPodium} pips.`
    : competitiveContext.ahead
      ? `Necesitas +${estimatedPipsToPodium} pips aprox. para presionar a ${competitiveContext.ahead.name}.`
      : `Estas liderando; la prioridad es defender $${compactMoneyFormatter.format(competitiveContext.dropBuffer)}.`;

  async function submitOrder() {
    setIsSubmitting(true);
    try {
      await onOpenOrder({
        price: parseOptionalNumber(price),
        side,
        stopLoss: parseOptionalNumber(stopLoss),
        symbol,
        takeProfit: parseOptionalNumber(takeProfit),
        volume: Number(lots),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-0 content-start">
      {!hasAccount ? (
        <Button
          className="mb-3 h-10 w-full justify-center gap-2 font-black uppercase"
          disabled={isSubmitting || !hasJoined}
          onClick={async () => {
            setIsSubmitting(true);
            try {
              await onEnsureAccount();
            } finally {
              setIsSubmitting(false);
            }
          }}
          type="button"
        >
          <RadioTower data-icon="inline-start" />
          {hasJoined ? "Conectar cuenta MT5 demo" : "Unete para operar"}
        </Button>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setSide("buy")}
          className={
            side === "buy"
              ? "relative h-12 overflow-hidden rounded-md border border-lime-200 bg-lime-300 font-black text-black shadow-[0_0_28px_rgba(182,255,61,0.22)] hover:cursor-pointer"
              : "relative h-12 overflow-hidden rounded-md border bg-black/25 font-black text-slate-300 transition hover:border-lime-300/35 hover:text-lime-100 hover:cursor-pointer"
          }
        >
          <span className="absolute left-2 top-1 rounded border border-black/20 px-1.5 py-0.5 text-[9px] uppercase opacity-70">
            LT
          </span>
          BUY
        </button>
        <button
          type="button"
          onClick={() => setSide("sell")}
          className={
            side === "sell"
              ? "relative h-12 overflow-hidden rounded-md border border-red-200 bg-red-400 font-black text-black shadow-[0_0_28px_rgba(255,59,92,0.22)] hover:cursor-pointer"
              : "relative h-12 overflow-hidden rounded-md border bg-black/25 font-black text-slate-300 transition hover:border-red-300/35 hover:text-red-100 hover:cursor-pointer"
          }
        >
          <span className="absolute left-2 top-1 rounded border border-white/10 px-1.5 py-0.5 text-[9px] uppercase opacity-70">
            RT
          </span>
          SELL
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniMetric
          label="Riesgo permitido"
          tone={riskRemaining <= 0.4 ? "negative" : "positive"}
          value={`${percentFormatter.format(riskRemaining)}%`}
        />
        <MiniMetric
          label="Impacto torneo"
          tone={canReachPodium ? "positive" : "neutral"}
          value={canReachPodium ? "Podio posible" : "Control ranking"}
        />
      </div>

      <div className="mt-2 grid gap-2">
        <Field label="Simbolo">
          <select
            value={symbol}
            onChange={(event) => setSymbol(event.target.value)}
            className="h-9 rounded-md border border-white/10 bg-[#030911] px-3 text-sm font-black text-white"
          >
            {arena.tradeTicket.availableSymbols.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Lotes">
            <input
              value={lots}
              onChange={(event) => setLots(event.target.value)}
              className="h-9 rounded-md border border-white/10 bg-[#030911] px-3 font-mono text-sm font-black text-white w-full"
            />
          </Field>
          <Field label="Precio">
            <input
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className="h-9 rounded-md border border-white/10 bg-[#030911] px-3 font-mono text-sm text-white w-full"
              placeholder="Market"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="SL">
            <input
              className="h-9 rounded-md border border-white/10 bg-[#030911] px-3 font-mono text-sm text-white w-full"
              onChange={(event) => setStopLoss(event.target.value)}
              placeholder="Opcional"
              value={stopLoss}
            />
          </Field>
          <Field label="TP">
            <input
              className="h-9 rounded-md border border-white/10 bg-[#030911] px-3 font-mono text-sm text-white w-full"
              onChange={(event) => setTakeProfit(event.target.value)}
              placeholder="Opcional"
              value={takeProfit}
            />
          </Field>
        </div>
      </div>

      <div className="mt-3 rounded-md border border-amber-300/20 bg-amber-300/10 p-3">
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-amber-100">
          <Target className="size-3" />
          Validacion de torneo
        </p>
        <p className="mt-2 text-xs leading-5 text-amber-50/90">
          {orderImpactCopy}
        </p>
        <p className="mt-2 text-[10px] font-semibold text-slate-400">
          Regla activa: lotaje {arena.tradeTicket.minLots}-
          {arena.tradeTicket.maxLots}, riesgo maximo{" "}
          {arena.tradeTicket.maxRiskPercent}%.
        </p>
      </div>

      <Button
        className={
          side === "buy"
            ? "mt-3 h-11 w-full justify-center gap-2 bg-lime-300 font-black uppercase text-slate-950 shadow-[0_0_26px_rgba(182,255,61,0.22)] hover:bg-lime-200"
            : "mt-3 h-11 w-full justify-center gap-2 bg-red-400 font-black uppercase text-slate-950 shadow-[0_0_26px_rgba(255,59,92,0.22)] hover:bg-red-300"
        }
        disabled={isSubmitting || !hasAccount}
        onClick={submitOrder}
        type="button"
      >
        <RadioTower data-icon="inline-start" />
        {isSubmitting ? "Procesando..." : `Confirmar ${side.toUpperCase()}`}
      </Button>
      {!hasJoined ? (
        <p className="mt-3 rounded-md border border-amber-300/20 bg-amber-300/10 p-2 text-xs leading-5 text-amber-100">
          Primero unete al torneo desde el panel izquierdo.
        </p>
      ) : apiError ? (
        <p className="mt-3 rounded-md border border-red-300/25 bg-red-400/10 p-2 text-xs leading-5 text-red-100">
          {apiError}
        </p>
      ) : null}
    </div>
  );
}

function OpenPositions({
  lastPositionsSyncAt,
  onClosePosition,
  positions,
  positionsSyncStatus,
}: {
  lastPositionsSyncAt: string | null;
  onClosePosition: (positionId: string) => Promise<void>;
  positions: ArenaOpenPosition[];
  positionsSyncStatus: PositionsSyncStatus;
}) {
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          Posiciones en combate
        </p>
        <SyncPill
          lastPositionsSyncAt={lastPositionsSyncAt}
          status={positionsSyncStatus}
        />
      </div>
      <div className="scrollbar-app grid min-h-0 content-start gap-2 overflow-y-auto pr-1">
        {positions.length === 0 ? (
          <p className="rounded-md border border-white/10 bg-black/20 px-3 py-8 text-center text-xs text-slate-500">
            No hay operaciones abiertas.
          </p>
        ) : (
          positions.map((position) => (
            <CompactPositionRow
              key={position.id}
              onClosePosition={onClosePosition}
              position={position}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CompactPositionRow({
  onClosePosition,
  position,
}: {
  onClosePosition: (positionId: string) => Promise<void>;
  position: ArenaOpenPosition;
}) {
  const [isClosing, setIsClosing] = useState(false);
  const positive = position.pnl >= 0;

  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-md border border-white/10 bg-black/25 px-2 py-1.5">
      <div className="min-w-0">
        <p className="truncate text-xs font-black text-white">
          {position.symbol}
        </p>
        <p className="text-[10px] uppercase text-slate-500">
          {position.side} / {position.lots}
        </p>
      </div>
      <p
        className={
          positive
            ? "font-mono text-xs font-black text-lime-300"
            : "font-mono text-xs font-black text-red-300"
        }
      >
        {positive ? "+" : ""}${moneyFormatter.format(position.pnl)}
      </p>
      <button
        type="button"
        disabled={isClosing}
        onClick={async () => {
          setIsClosing(true);
          try {
            await onClosePosition(position.id);
          } finally {
            setIsClosing(false);
          }
        }}
        className="rounded border border-red-300/25 bg-red-400/10 px-2 py-1 text-[10px] font-black uppercase text-red-200 transition hover:bg-red-400/15 disabled:opacity-60"
      >
        {isClosing ? "..." : "Cerrar"}
      </button>
    </div>
  );
}

function CommsConsole({
  arena,
  currentUser,
  room,
  onClose,
}: {
  arena: ArenaState;
  currentUser?: ChatAuthor;
  room: ChatRoom;
  onClose: () => void;
}) {
  return (
    <section className="relative grid h-full min-h-[28rem] rounded-md shadow-[0_20px_80px_rgba(0,0,0,0.24)]">
      <Tabs
        className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-0"
        defaultValue="activity"
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
          <TabsList className="bg-black/30" variant="line">
            <TabsTrigger
              className="h-7 px-4 text-[10px] font-black uppercase tracking-[0.12em]"
              value="activity"
            >
              <Activity data-icon="inline-start" />
              Feed
            </TabsTrigger>
            <TabsTrigger
              className="h-7 px-4 text-[10px] font-black uppercase tracking-[0.12em]"
              value="chat"
            >
              <MessageCircle data-icon="inline-start" />
              Chat
            </TabsTrigger>
          </TabsList>
          <div>
            <Button onClick={onClose} variant="ghost">
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <TabsContent className="p-3 h-full" value="activity">
          <ActivityFeed arena={arena} fill scrollable />
        </TabsContent>
        <TabsContent className="h-full p-3" value="chat">
          <ChatPanel
            compact
            className="h-full border-0 bg-transparent shadow-none grid grid-rows-[minmax(0,50px)_minmax(250px,1fr)_minmax(0,50px)] gap-2"
            currentUser={currentUser}
            messagesClassName="pr-1 h-full overflow-y-auto"
            room={room}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function TacticalSidebar({
  arena,
  currentUser,
  onClose,
  open,
  room,
}: {
  arena: ArenaState;
  currentUser?: ChatAuthor;
  onClose: () => void;
  open: boolean;
  room: ChatRoom;
}) {
  if (!open) {
    return null;
  }

  return (
    <aside className="fixed bottom-2 right-2 top-2 z-50 w-[min(420px,calc(100vw-1rem))]">
      <div className="grid h-full min-h-0 grid-rows-[auto] overflow-hidden rounded-md border border-cyan-300/20 bg-[#06111c] shadow-[0_24px_90px_rgba(0,0,0,0.42)]">
        <div className="h-full min-h-0 p-3">
          <CommsConsole arena={arena} currentUser={currentUser} room={room} onClose={onClose} />
        </div>
      </div>
    </aside>
  );
}

function RankingTacticalPanel({ entries }: { entries: RankingEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="rounded-md border border-white/10 bg-black/20 px-3 py-8 text-center text-xs text-slate-500">
        No hay ranking actual.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {entries.slice(0, 8).map((entry) => {
        const podium = entry.position <= 3;
        const rising = entry.position < entry.previousPosition;
        const falling = entry.position > entry.previousPosition;

        return (
          <div
            className={
              podium
                ? "grid grid-cols-[3rem_1fr_auto] items-center gap-3 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2"
                : "grid grid-cols-[3rem_1fr_auto] items-center gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2"
            }
            key={entry.traderId}
          >
            <div className="flex items-center gap-1">
              {podium ? <Trophy className="size-3 text-amber-200" /> : null}
              <span className="font-mono text-lg font-black text-white">
                #{entry.position}
              </span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-white">
                {entry.traderName}
              </p>
              <p className="truncate text-[10px] uppercase tracking-wide text-slate-500">
                {entry.clanName}
              </p>
            </div>
            <div className="text-right">
              <p
                className={
                  entry.pnl >= 0
                    ? "font-mono text-xs font-black text-lime-300"
                    : "font-mono text-xs font-black text-red-300"
                }
              >
                {entry.pnl >= 0 ? "+" : ""}$
                {compactMoneyFormatter.format(entry.pnl)}
              </p>
              <p
                className={
                  rising
                    ? "text-[10px] font-black uppercase text-lime-300"
                    : falling
                      ? "text-[10px] font-black uppercase text-red-300"
                      : "text-[10px] font-black uppercase text-slate-500"
                }
              >
                {rising ? "sube" : falling ? "baja" : "estable"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetricsGrid({ arena }: { arena: ArenaState }) {
  return (
    <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
      <MiniMetric
        label="Balance"
        value={`$${moneyFormatter.format(arena.mt5Account.balance)}`}
      />
      <MiniMetric
        label="Equity"
        value={`$${moneyFormatter.format(arena.mt5Account.equity)}`}
      />
      <MiniMetric
        label="Free margin"
        value={`$${moneyFormatter.format(arena.mt5Account.freeMargin)}`}
      />
      <MiniMetric
        label="Margin level"
        value={`${percentFormatter.format(arena.mt5Account.marginLevelPercent)}%`}
      />
      {arena.metrics.map((metric) => (
        <MiniMetric
          key={metric.label}
          label={metric.label}
          value={metric.value}
        />
      ))}
    </div>
  );
}

function ActivityFeed({
  arena,
  fill = false,
  scrollable = false,
}: {
  arena: ArenaState;
  fill?: boolean;
  scrollable?: boolean;
}) {
  const events = useMemo(() => buildTournamentFeedEvents(arena), [arena]);

  return (
    <div
      className={
        scrollable
          ? fill
            ? "scrollbar-app grid h-full min-h-0 content-start gap-3 overflow-y-auto pr-1"
            : "scrollbar-app grid max-h-64 gap-3 overflow-y-auto pr-1"
          : "grid gap-3"
      }
    >
      {events.length === 0 ? (
        <p className="text-center text-sm text-slate-500">
          No hay actividad reciente
        </p>
      ) : (
        events.map((event) => (
          <div
            key={event.id}
            className="cockpit-feed-in flex gap-3 rounded-md border border-white/10 bg-black/18 p-2"
          >
            <div
              className={
                event.tone === "negative"
                  ? "flex size-8 shrink-0 items-center justify-center rounded-full bg-red-400/12 text-[10px] font-black text-red-100"
                  : event.tone === "gold"
                    ? "flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-300/12 text-[10px] font-black text-amber-100"
                    : "flex size-8 shrink-0 items-center justify-center rounded-full bg-cyan-300/10 text-[10px] font-black text-cyan-100"
              }
            >
              {event.traderName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs leading-5 text-slate-300">
                {event.headline}
              </p>
              <p
                className={
                  event.tone === "negative"
                    ? "text-[10px] text-red-300"
                    : event.pnlPercent >= 0
                    ? "text-[10px] text-lime-300"
                    : "text-[10px] text-red-300"
                }
              >
                {event.pnlPercent === 0
                  ? "hace 1 min"
                  : `${event.pnlPercent > 0 ? "+" : ""}${percentFormatter.format(event.pnlPercent)}%`}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function buildTournamentFeedEvents(arena: ArenaState) {
  const trader = arena.currentParticipant ?? cockpitParticipantMock;
  const leader =
    arena.participants.find((participant) => participant.position === 1) ??
    fallbackRivals[0];
  const liveMocks = [
    {
      asset: "EURUSD",
      headline: `${fallbackRivals[0].name} subio al #2 tras cerrar EURUSD +0.8%.`,
      id: "mock-feed-luna-podium",
      pnlPercent: 0.8,
      tone: "gold",
      traderName: fallbackRivals[0].name,
    },
    {
      asset: "EURUSD",
      headline: `${trader.name} queda a $${compactMoneyFormatter.format(Math.abs((fallbackRivals[1]?.pnl ?? trader.pnl + 42) - trader.pnl))} del podio.`,
      id: "mock-feed-user-podium",
      pnlPercent: trader.scoreChange,
      tone: "positive",
      traderName: trader.name,
    },
    {
      asset: "XAUUSD",
      headline: `${fallbackRivals[3].name} entra en zona de riesgo por drawdown abierto.`,
      id: "mock-feed-risk-zone",
      pnlPercent: -0.42,
      tone: "negative",
      traderName: fallbackRivals[3].name,
    },
    {
      asset: arena.tradeTicket.defaultSymbol,
      headline: `${leader.name} sostiene el liderato con $${compactMoneyFormatter.format(leader.pnl)} de PnL.`,
      id: "mock-feed-leader",
      pnlPercent: leader.scoreChange,
      tone: "positive",
      traderName: leader.name,
    },
  ];

  const liveEvents = arena.activity.slice(0, 4).map((event) => ({
    ...event,
    headline: `${event.traderName} ${event.message} en ${event.asset}.`,
    tone:
      event.pnlPercent < 0
        ? "negative"
        : event.pnlPercent > 0.6
          ? "gold"
          : "positive",
  }));

  return [...liveMocks, ...liveEvents].slice(0, 8);
}

function TraderProfileCard({ participant }: { participant: ArenaParticipant }) {
  const pnlPositive = participant.pnl >= 0;
  const initials = participant.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <section className="relative overflow-hidden rounded-md border border-amber-300/20 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,0.16),transparent_34%),linear-gradient(180deg,rgba(10,19,31,0.98),rgba(3,9,17,0.98))] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.24)]">
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-amber-200/60" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            Mi perfil
          </p>
          <p className="mt-1 truncate text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">
            {participant.clan}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-amber-100">
          <Trophy className="size-3" />
          <span className="font-mono text-lg font-black leading-none">
            #{participant.position}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="relative flex size-16 shrink-0 items-center justify-center rounded-full border border-amber-200/50 bg-amber-200/10 text-lg font-black text-amber-100 shadow-[0_0_32px_rgba(251,191,36,0.22)]">
          <span className="absolute inset-1 rounded-full border border-white/10" />
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">
            {participant.name}
          </p>
          <p
            className={
              participant.scoreChange >= 0
                ? "mt-1 font-mono text-xs font-black text-lime-300"
                : "mt-1 font-mono text-xs font-black text-red-300"
            }
          >
            {participant.scoreChange >= 0 ? "+" : ""}
            {percentFormatter.format(participant.scoreChange)}% score
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniMetric
          label="PnL"
          tone={pnlPositive ? "positive" : "negative"}
          value={`${pnlPositive ? "+" : ""}$${moneyFormatter.format(participant.pnl)}`}
        />
        <MiniMetric label="Trades" value={String(participant.trades)} />
        <MiniMetric
          label="Balance"
          value={`$${moneyFormatter.format(participant.balance)}`}
        />
        <MiniMetric label="Win rate" value={`${participant.winRate}%`} />
      </div>

      <Link
        href="/profile"
        className="mt-4 flex h-9 items-center justify-center rounded-md bg-blue-500 text-xs font-black uppercase tracking-wide text-white transition hover:bg-blue-400"
      >
        Ver mi perfil
      </Link>
    </section>
  );
}

function TournamentCountdownText({
  endsAt,
  status,
}: {
  endsAt: string;
  status: Tournament["status"];
}) {
  const remaining = useCountdown(endsAt, status);

  return `${String(remaining.hours).padStart(2, "0")}:${String(remaining.minutes).padStart(2, "0")}:${String(remaining.seconds).padStart(2, "0")}`;
}

function useCountdown(endsAt: string, status: Tournament["status"]) {
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    const now = Date.now();
    const parsed = new Date(endsAt).getTime();
    const targetTime =
      Number.isFinite(parsed) && parsed > now
        ? parsed
        : status === "live"
          ? now + 2 * 60 * 60 * 1000 + 36 * 60 * 1000 + 45 * 1000
          : parsed;

    const updateRemaining = () =>
      setRemainingMs(Math.max(0, targetTime - Date.now()));
    updateRemaining();
    const intervalId = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(intervalId);
  }, [endsAt, status]);

  const totalSeconds = Math.floor(remainingMs / 1000);

  return {
    totalMs: remainingMs,
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function ModeButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "flex h-9 items-center justify-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 text-xs font-black uppercase text-cyan-100"
          : "flex h-9 items-center justify-center gap-2 rounded-md border border-white/10 bg-black/35 px-3 text-xs font-black uppercase text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-100"
      }
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

function LiveBadge() {
  return (
    <span className="flex items-center gap-2 rounded-sm border border-red-400/40 bg-red-500 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
      <span className="size-1.5 rounded-full bg-white" />
      Live
    </span>
  );
}

function BroadcastMetric({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-md border border-cyan-300/15 bg-black/45 p-3 backdrop-blur">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/70">
        {label}
      </p>
      <p className="mt-1 font-mono text-xl font-black text-white">{value}</p>
    </div>
  );
}

function SyncPill({
  lastPositionsSyncAt,
  status,
}: {
  lastPositionsSyncAt: string | null;
  status: PositionsSyncStatus;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-black/25 px-3 py-2 text-right">
      <p className={getPositionsSyncStatusClassName(status)}>
        {formatPositionsSyncStatus(status)}
      </p>
      <p className="mt-1 font-mono text-[10px] text-slate-500">
        {lastPositionsSyncAt ? formatSyncTime(lastPositionsSyncAt) : "--:--:--"}
      </p>
    </div>
  );
}

function buildMockMarketData(arena: ArenaState): MockMarketCandle[] {
  const openPosition = arena.openPositions[0];
  const base = openPosition?.currentPrice || openPosition?.entryPrice || 1.0862;
  const pnlInfluence = Math.max(
    -0.003,
    Math.min(0.003, (openPosition?.pnl ?? 0) / 100000),
  );
  const now = Date.parse(arena.serverTime) || Date.UTC(2026, 5, 14, 17, 0, 0);
  const startTimestamp = now - 59 * 5 * 60 * 1000;
  let previousClose = base - 0.0014 + pnlInfluence;

  return Array.from({ length: 60 }, (_, index) => {
    const wave = Math.sin(index / 2.8) * 0.00056;
    const pulse = Math.cos(index / 6.2) * 0.00027;
    const tournamentPressure = (arena.participants.length - 2) * 0.000015;
    const tradePressure = (openPosition?.side === "sell" ? -1 : 1) * 0.000035;
    const drift = (index - 28) * 0.000015 + pnlInfluence / 8;
    const open = previousClose;
    const close = Number(
      (
        open +
        wave * 0.24 +
        pulse * 0.4 +
        drift +
        tournamentPressure +
        tradePressure
      ).toFixed(5),
    );
    const wick = Math.abs(Math.sin(index * 1.7)) * 0.00038 + 0.00018;
    const high = Number((Math.max(open, close) + wick).toFixed(5));
    const low = Number((Math.min(open, close) - wick * 0.82).toFixed(5));
    const volume = Math.round(
      180 +
        Math.abs(close - open) * 450000 +
        Math.abs(Math.sin(index / 3)) * 120 +
        arena.openPositions.length * 36,
    );

    previousClose = close;

    return {
      close,
      high,
      low,
      open: Number(open.toFixed(5)),
      signal: close > open ? "long" : close < open ? "short" : "neutral",
      timestamp: startTimestamp + index * 5 * 60 * 1000,
      volume,
    };
  });
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
      {label}
      {children}
    </label>
  );
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatPositionsSyncStatus(status: PositionsSyncStatus) {
  const labels: Record<PositionsSyncStatus, string> = {
    error: "Error",
    idle: "Sin cuenta",
    synced: "Actualizado",
    syncing: "Sincronizando",
  };

  return labels[status];
}

function getPositionsSyncStatusClassName(status: PositionsSyncStatus) {
  const base = "mt-1 text-[10px] font-black uppercase tracking-[0.16em]";

  if (status === "synced") {
    return `${base} text-lime-300`;
  }

  if (status === "error") {
    return `${base} text-amber-300`;
  }

  return `${base} text-slate-400`;
}

function formatSyncTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--:--:--";
  }

  return date.toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function RuleLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md px-3 py-2">
      <span>{label}</span>
      <span className="font-mono font-black text-white">{value}</span>
    </div>
  );
}

function Panel({
  children,
  fill = false,
  icon: Icon,
  title,
}: {
  children: ReactNode;
  fill?: boolean;
  icon: ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <Card
      className={
        fill
          ? "min-h-0 overflow-hidden rounded-md border-cyan-300/10 bg-[#07131d]/80 p-3 shadow-[0_16px_56px_rgba(0,0,0,0.18)]"
          : "overflow-hidden rounded-md border-cyan-300/10 bg-[#07131d]/80 p-3 shadow-[0_16px_56px_rgba(0,0,0,0.18)]"
      }
    >
      <CardContent
        className={
          fill
            ? "grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]"
            : undefined
        }
      >
        <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
          <Icon className="size-3.5 text-cyan-200" />
          {title}
        </p>
        {children}
      </CardContent>
    </Card>
  );
}

function MiniMetric({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "neutral" | "positive" | "negative";
  value: string;
}) {
  const valueColor =
    tone === "positive"
      ? "text-lime-300"
      : tone === "negative"
        ? "text-red-300"
        : "text-white";

  return (
    <div className="rounded-md border border-white/10 bg-black/25 px-3 py-2">
      <p className="text-[9px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-1 truncate font-mono text-sm font-black ${valueColor}`}>
        {value}
      </p>
    </div>
  );
}

function useRankingEntries(participants: ArenaParticipant[]): RankingEntry[] {
  return useMemo(
    () =>
      participants.map((participant) => ({
        traderId: participant.id,
        traderName: participant.name,
        clanName: participant.clan,
        position: participant.position,
        previousPosition: participant.previousPosition,
        scorePercent: participant.scoreChange,
        pnl: participant.pnl,
        balance: participant.balance,
        trades: participant.trades,
        winRate: participant.winRate,
        country: "AR",
        fullName: participant.name,
        username: participant.name.toLowerCase().replace(/\s/g, ""),
        userId: participant.id,
        total_winnings_usd: participant.pnl > 0 ? participant.pnl : 0,
        total_points: Math.max(0, participant.scoreChange),
      })),
    [participants],
  );
}
