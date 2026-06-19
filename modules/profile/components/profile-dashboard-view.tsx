"use client";
import Link from "next/link";
import {
  BadgeCheck,
  Crown,
  Edit3,
  LineChart,
  Medal,
  RadioTower,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  UserRound,
  Wand2,
  Wallet,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/shared/components/app-header";
import type { CurrentSessionUser } from "@/modules/auth/types";
import type { ProfileDashboard } from "../types";
import { Card } from "@/components/ui/card";

type ProfileDashboardViewProps = {
  dashboard: ProfileDashboard;
  sessionUser?: CurrentSessionUser | null;
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactMoneyFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const pointsFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("es-VE", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const tournamentStatusLabel: Record<
  ProfileDashboard["tournaments"][number]["status"],
  string
> = {
  live: "En vivo",
  upcoming: "Proximo",
  finished: "Finalizado",
};

const tournamentResultLabel: Record<
  ProfileDashboard["tournaments"][number]["result"],
  string
> = {
  active: "Compitiendo",
  qualified: "Clasificado",
  podium: "Podio",
  eliminated: "Eliminado",
};

const versusStatusLabel: Record<
  ProfileDashboard["versus"][number]["status"],
  string
> = {
  pending: "Pendiente",
  live: "En vivo",
  finished: "Finalizado",
};

const versusResultLabel: Record<
  ProfileDashboard["versus"][number]["result"],
  string
> = {
  win: "Victoria",
  loss: "Derrota",
  draw: "Empate",
  active: "En curso",
};

const membershipLabel = {
  free: "Free",
  elite: "Elite",
} as const;

const membershipStatusLabel = {
  active: "Activo",
  inactive: "Inactivo",
  pending: "Pendiente",
} as const;

const mt5StatusLabel = {
  connected: "Conectada",
  pending: "Pendiente",
  suspended: "Suspendida",
} as const;

export function ProfileDashboardView({
  dashboard,
  sessionUser = null,
}: ProfileDashboardViewProps) {
  const { trader, wallet, performance, membership, clan } = dashboard;
  const initials = trader.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
  const pnlPositive = performance.pnlAmount >= 0;
  const globalRank = getRankPresentation(performance.globalRank);
  const tournamentRank = getRankPresentation(performance.currentTournamentRank);

  return (
    <main className="tournament-neon min-h-screen overflow-hidden text-white">
      <ProfileBackground />
      <div className="relative z-10">
        <AppHeader active="perfil" user={sessionUser} />

        <section className="mx-auto w-full max-w-7xl px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
            <Card>
              <div className="grid gap-5 md:grid-cols-[auto_1fr_auto] md:items-center">
                <div className="relative flex size-24 items-center justify-center rounded-lg border border-bullfy-neon-blue/30 bg-bullfy-neon-blue/10 text-3xl font-black text-bullfy-neon-blue shadow-neon-blue">
                  {initials}
                  {trader.verified ? (
                    <span className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full border border-bullfy-neon-green/50 bg-[#071102] text-bullfy-neon-green">
                      <BadgeCheck className="size-4" />
                    </span>
                  ) : null}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-white/10 bg-white/5 text-slate-200">
                      @{trader.handle}
                    </Badge>
                    <Badge
                      className={
                        membership.tier === "elite"
                          ? "border-amber-300/35 bg-amber-300/10 text-amber-200"
                          : "border-bullfy-neon-blue/35 bg-bullfy-neon-blue/10 text-bullfy-neon-blue"
                      }
                    >
                      {membershipLabel[membership.tier]}
                    </Badge>
                    {clan?.tag ? (
                      <Badge className="border-bullfy-neon-green/30 bg-bullfy-neon-green/10 text-bullfy-neon-green">
                        {clan.tag}
                      </Badge>
                    ) : null}
                  </div>
                  <h1 className="mt-3 text-3xl font-black uppercase leading-none tracking-normal sm:text-5xl">
                    {trader.name}
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                    {trader.bio}
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1">
                  <Link
                    href="/profile?edit=1"
                    className={cn(
                      buttonVariants({ variant: "neonBlue", size: "lg" }),
                      "h-10 justify-center",
                    )}
                  >
                    <Edit3 className="size-4" />
                    Editar perfil
                  </Link>
                  <Link
                    href="/wallet"
                    className={cn(
                      buttonVariants({ variant: "neonGreen", size: "lg" }),
                      "h-10 justify-center",
                    )}
                  >
                    <Wallet className="size-4" />
                    Retirar
                  </Link>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Mi membresia
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-2xl font-black text-white">
                    <Crown className="size-5 text-amber-300" />
                    {membershipLabel[membership.tier]}
                  </p>
                </div>
                <Badge className="border-bullfy-neon-green/30 bg-bullfy-neon-green/10 text-bullfy-neon-green">
                  {membershipStatusLabel[membership.status]}
                </Badge>
              </div>
              {membership.renewsAt ? (
                <p className="mt-3 text-xs text-slate-500">
                  Renueva {dateFormatter.format(new Date(membership.renewsAt))}
                </p>
              ) : null}
              <div className="mt-4 grid gap-2">
                {membership.benefits.slice(0, 4).map((benefit) => (
                  <div
                    key={benefit}
                    className="flex items-center gap-2 text-sm text-slate-300"
                  >
                    <Zap className="size-3.5 text-bullfy-neon-green" />
                    {benefit}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <TopMetric
              icon={Wallet}
              label="Saldo USD"
              value={`$${compactMoneyFormatter.format(wallet.realBalance)}`}
            />
            <TopMetric
              icon={Medal}
              label="Bullfy Points"
              value={pointsFormatter.format(wallet.bullfyPoints)}
              tone="blue"
            />
            <TopMetric
              icon={Trophy}
              label="Ganancias totales"
              value={`$${compactMoneyFormatter.format(1840)}`}
            />
            <TopMetric
              icon={Crown}
              label="Estado Elite"
              value={membershipStatusLabel[membership.status]}
              tone="gold"
            />
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <Panel
              title="Ranking y estadisticas"
              actionLabel="Ver ranking"
              href="/rankings"
            >
              <div className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
                <div
                  className={cn(
                    "relative overflow-hidden rounded-lg border p-4",
                    globalRank.cardClass,
                  )}
                >
                  <div className="pointer-events-none absolute -right-7 -top-7 size-28 rounded-full bg-white/8 blur-2xl" />
                  <div className="relative z-10">
                    <p
                      className={cn(
                        "text-xs font-black uppercase tracking-[0.16em]",
                        globalRank.labelClass,
                      )}
                    >
                      Ranking global
                    </p>
                    <p className="mt-3 flex items-end gap-2 text-6xl font-black leading-none text-white">
                      #{performance.globalRank || "-"}
                      <span
                        className={cn(
                          "mb-1 rounded-md border px-2 py-1 text-[10px] uppercase tracking-[0.16em]",
                          globalRank.badgeClass,
                        )}
                      >
                        {globalRank.label}
                      </span>
                    </p>
                    <div className="mt-4 grid gap-2">
                      <RankStrip
                        label="Torneo activo"
                        presentation={tournamentRank}
                        value={
                          performance.currentTournamentRank > 0
                            ? `#${performance.currentTournamentRank}`
                            : "Sin rank"
                        }
                      />
                      <RankStrip
                        label="Score"
                        presentation={globalRank}
                        value={`${performance.pnlPercent > 0 ? "+" : ""}${performance.pnlPercent}%`}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <StatTile
                    label="PnL"
                    value={`${pnlPositive ? "+" : "-"}$${moneyFormatter.format(
                      Math.abs(performance.pnlAmount),
                    )}`}
                    detail={`${performance.pnlPercent > 0 ? "+" : ""}${
                      performance.pnlPercent
                    }%`}
                    positive={pnlPositive}
                  />
                  <StatTile
                    label="Win rate"
                    value={`${performance.winRate}%`}
                    detail={`${performance.trades} trades`}
                  />
                  <StatTile
                    label="Profit factor"
                    value={performance.profitFactor.toFixed(2)}
                    detail={`Mejor activo ${performance.bestAsset}`}
                  />
                  <StatTile
                    label="Max drawdown"
                    value={`${performance.maxDrawdownPercent}%`}
                    detail="Control de riesgo"
                    positive={false}
                  />
                  <StatTile
                    label="Torneos"
                    value={String(performance.tournamentsPlayed)}
                    detail={`${performance.tournamentsWon} victorias`}
                  />
                  <StatTile
                    label="Balance demo"
                    value={`$${compactMoneyFormatter.format(wallet.demoBalance)}`}
                    detail="BMoney disponible"
                  />
                </div>
              </div>
            </Panel>

            <AvatarIdentityCard
              traderName={trader.name}
              initials={initials}
              trader={trader}
            />
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <Panel
              title="Mi clan"
              actionLabel={clan?.slug ? "Abrir clan" : "Buscar clan"}
              href={clan?.slug ? `/clans/${clan.slug}` : "/clans"}
            >
              {clan ? (
                <div className="grid gap-4">
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-black/25 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-12 items-center justify-center rounded-lg border border-bullfy-neon-green/30 bg-bullfy-neon-green/10 text-sm font-black text-bullfy-neon-green">
                        {clan.tag}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-lg font-black text-white">
                          {clan.name}
                        </p>
                        <p className="text-sm capitalize text-slate-400">
                          {clan.role}
                        </p>
                      </div>
                    </div>
                    <Shield className="size-5 text-bullfy-neon-green" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <MiniStat
                      label="Rank clan"
                      value={`#${clan.rank ?? "-"}`}
                    />
                    <MiniStat
                      label="Miembros"
                      value={String(clan.membersCount ?? "-")}
                    />
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={Shield}
                  title="Sin clan"
                  description="Unete a un clan para competir en guerras y rankings por equipo."
                />
              )}
            </Panel>

            <Panel
              title="Cuentas MT5 conectadas"
              actionLabel="Conectar"
              href="#"
            >
              <div className="grid gap-3">
                {dashboard.mt5Accounts.map((account) => (
                  <div
                    key={account.id}
                    className="grid gap-3 rounded-lg border border-white/10 bg-black/25 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="border-bullfy-neon-blue/30 bg-bullfy-neon-blue/10 text-bullfy-neon-blue">
                          {account.kind.toUpperCase()}
                        </Badge>
                        <Badge className="border-white/10 bg-white/5 text-slate-300">
                          {mt5StatusLabel[account.status]}
                        </Badge>
                      </div>
                      <p className="mt-3 font-mono text-lg font-black text-white">
                        {account.login}
                      </p>
                      <p className="text-sm text-slate-500">{account.server}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xs text-slate-500">Equity</p>
                      <p className="mt-1 text-xl font-black text-white">
                        ${moneyFormatter.format(account.equity)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {dateFormatter.format(new Date(account.lastSyncAt))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel
              title="Actividad competitiva"
              actionLabel="Ver historial"
              href="/profile/history"
            >
              {dashboard.tournaments.length > 0 ? (
                <div className="grid gap-4">
                  <div className="rounded-lg border border-bullfy-neon-blue/25 bg-bullfy-neon-blue/8 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="border-bullfy-neon-blue/30 bg-bullfy-neon-blue/10 text-bullfy-neon-blue">
                            {
                              tournamentStatusLabel[
                                dashboard.tournaments[0].status
                              ]
                            }
                          </Badge>
                          <Badge className="border-white/10 bg-white/5 text-slate-300">
                            {
                              tournamentResultLabel[
                                dashboard.tournaments[0].result
                              ]
                            }
                          </Badge>
                        </div>
                        <p className="mt-3 truncate text-xl font-black text-white">
                          {dashboard.tournaments[0].tournamentName}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {dashboard.tournaments[0].participants} traders /
                          Prize $
                          {compactMoneyFormatter.format(
                            dashboard.tournaments[0].prizeUsd,
                          )}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                          Rank actual
                        </p>
                        <p className="mt-1 text-3xl font-black text-white">
                          {dashboard.tournaments[0].rank > 0
                            ? `#${dashboard.tournaments[0].rank}`
                            : "-"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Torneos recientes
                    </p>
                    {dashboard.tournaments.slice(1, 4).map((tournament) => (
                      <CompetitionRow
                        key={tournament.id}
                        icon={Trophy}
                        title={tournament.tournamentName}
                        meta={`${tournamentStatusLabel[tournament.status]} / ${
                          tournament.participants
                        } traders`}
                        result={
                          tournament.rank > 0
                            ? `#${tournament.rank}`
                            : "Sin rank"
                        }
                        score={`${tournament.scorePercent > 0 ? "+" : ""}${
                          tournament.scorePercent
                        }%`}
                        positive={tournament.scorePercent >= 0}
                      />
                    ))}
                  </div>

                  <div className="grid gap-3 border-t border-white/10 pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                        Versus recientes
                      </p>
                      <Link
                        href="/versus"
                        className="text-xs font-black text-bullfy-neon-blue transition hover:text-white"
                      >
                        Crear versus
                      </Link>
                    </div>
                    {dashboard.versus.slice(0, 3).map((versus) => (
                      <CompetitionRow
                        key={versus.id}
                        icon={Swords}
                        title={`vs ${versus.opponentName}`}
                        meta={`${versusStatusLabel[versus.status]} / @${
                          versus.opponentHandle
                        }`}
                        result={versusResultLabel[versus.result]}
                        score={`${versus.score}-${versus.opponentScore}`}
                        positive={versus.result !== "loss"}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={Trophy}
                  title="Aun no participas en ningun torneo"
                  description="Ve al lobby para inscribirte y empezar a rankear."
                />
              )}
            </Panel>
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_22rem]">
            <Panel
              title="Trades recientes"
              actionLabel="Ver wallet"
              href="/wallet"
            >
              <div className="grid gap-3 md:grid-cols-3">
                {dashboard.recentTrades.map((trade) => (
                  <div
                    key={trade.id}
                    className="rounded-lg border border-white/10 bg-black/25 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-black text-white">{trade.asset}</p>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                          {trade.side}
                        </p>
                      </div>
                      <LineChart
                        className={cn(
                          "size-4",
                          trade.pnl >= 0
                            ? "text-bullfy-neon-green"
                            : "text-bullfy-neon-red",
                        )}
                      />
                    </div>
                    <p
                      className={cn(
                        "mt-4 text-2xl font-black",
                        trade.pnl >= 0
                          ? "text-bullfy-neon-green"
                          : "text-bullfy-neon-red",
                      )}
                    >
                      {trade.pnl > 0 ? "+" : "-"}$
                      {moneyFormatter.format(Math.abs(trade.pnl))}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {dateFormatter.format(new Date(trade.closedAt))}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Acciones rapidas">
              <div className="grid gap-3">
                <QuickAction
                  href="/tournaments/create"
                  icon={Trophy}
                  label="Crear torneo"
                />
                <QuickAction
                  href="/wallet"
                  icon={Wallet}
                  label="Retirar fondos"
                />
                <QuickAction
                  href="/versus"
                  icon={Swords}
                  label="Crear versus"
                />
                <QuickAction
                  href="/profile?edit=1"
                  icon={UserRound}
                  label="Editar perfil"
                />
              </div>
            </Panel>
          </section>
        </section>
      </div>
    </main>
  );
}

function ProfileBackground() {
  return (
    <div className="absolute inset-0 z-0">
      <video
        autoPlay
        loop
        muted
        playsInline
        poster="/videos/tournament-poster.jpg"
        className="h-full w-full object-cover opacity-32"
      >
        <source src="/videos/tournament-bg.webm" type="video/webm" />
        <source src="/videos/tournament-bg.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,9,18,0.72),rgba(4,9,18,0.92)_32%,rgba(4,9,18,0.98)),radial-gradient(circle_at_16%_12%,rgba(0,229,255,0.18),transparent_28%),radial-gradient(circle_at_82%_16%,rgba(182,255,61,0.10),transparent_26%)]" />
    </div>
  );
}

type RankPresentation = {
  badgeClass: string;
  cardClass: string;
  label: string;
  labelClass: string;
};

function getRankPresentation(rank: number): RankPresentation {
  if (rank === 1) {
    return {
      badgeClass: "border-amber-200/40 bg-amber-200/15 text-amber-100",
      cardClass:
        "border-amber-300/35 bg-[radial-gradient(circle_at_22%_0%,rgba(251,191,36,0.24),transparent_34%),linear-gradient(135deg,rgba(251,191,36,0.16),rgba(7,19,29,0.9))]",
      label: "Lider",
      labelClass: "text-amber-200",
    };
  }

  if (rank === 2) {
    return {
      badgeClass: "border-cyan-100/35 bg-cyan-100/10 text-cyan-100",
      cardClass:
        "border-cyan-200/30 bg-[radial-gradient(circle_at_22%_0%,rgba(125,211,252,0.18),transparent_34%),linear-gradient(135deg,rgba(148,163,184,0.14),rgba(7,19,29,0.9))]",
      label: "Top 2",
      labelClass: "text-cyan-100",
    };
  }

  if (rank === 3) {
    return {
      badgeClass: "border-orange-300/35 bg-orange-300/10 text-orange-100",
      cardClass:
        "border-orange-300/28 bg-[radial-gradient(circle_at_22%_0%,rgba(251,146,60,0.18),transparent_34%),linear-gradient(135deg,rgba(251,146,60,0.12),rgba(7,19,29,0.9))]",
      label: "Podio",
      labelClass: "text-orange-100",
    };
  }

  if (rank > 0 && rank <= 10) {
    return {
      badgeClass:
        "border-bullfy-neon-green/35 bg-bullfy-neon-green/10 text-bullfy-neon-green",
      cardClass:
        "border-bullfy-neon-green/24 bg-[radial-gradient(circle_at_22%_0%,rgba(182,255,61,0.15),transparent_34%),linear-gradient(135deg,rgba(182,255,61,0.08),rgba(7,19,29,0.9))]",
      label: "Top 10",
      labelClass: "text-bullfy-neon-green",
    };
  }

  return {
    badgeClass:
      "border-bullfy-neon-blue/35 bg-bullfy-neon-blue/10 text-bullfy-neon-blue",
    cardClass:
      "border-bullfy-neon-blue/20 bg-[radial-gradient(circle_at_22%_0%,rgba(0,229,255,0.15),transparent_34%),linear-gradient(135deg,rgba(0,229,255,0.08),rgba(7,19,29,0.9))]",
    label: "Ranqueando",
    labelClass: "text-bullfy-neon-blue",
  };
}

function RankStrip({
  label,
  presentation,
  value,
}: {
  label: string;
  presentation: RankPresentation;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/25 px-3 py-2">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <span
        className={cn("font-mono text-sm font-black", presentation.labelClass)}
      >
        {value}
      </span>
    </div>
  );
}

function AvatarIdentityCard({
  initials,
  traderName,
  trader,
}: {
  initials: string;
  traderName: string;
  trader: ProfileDashboard["trader"];
}) {
  const hasAvatar = Boolean(trader.avatar3dUrl);

  return (
    <section className="relative overflow-hidden rounded-lg border border-bullfy-neon-blue/20 bg-[radial-gradient(circle_at_50%_0%,rgba(0,229,255,0.18),transparent_38%),linear-gradient(180deg,rgba(7,19,29,0.96),rgba(3,9,17,0.98))] p-5 shadow-glass-blue backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-bullfy-neon-blue/60" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-bullfy-neon-blue">
            <Sparkles className="size-4" />
            Avatar digital
          </p>
          <h2 className="mt-3 text-2xl font-black uppercase leading-none text-white">
            Identidad de arena
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Preparado para integrar avatar 3D, poses y aparicion en podio,
            ArenaTV y perfil publico.
          </p>
        </div>
        <Badge
          className={
            hasAvatar
              ? "border-bullfy-neon-green/30 bg-bullfy-neon-green/10 text-bullfy-neon-green"
              : "border-amber-300/30 bg-amber-300/10 text-amber-100"
          }
        >
          {hasAvatar ? "Activo" : "Pendiente"}
        </Badge>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[10rem_1fr] sm:items-center">
        <div className="relative mx-auto flex aspect-[3/4] w-36 items-center justify-center overflow-hidden rounded-lg border border-bullfy-neon-blue/30 bg-black/35 shadow-[0_0_46px_rgba(0,229,255,0.14)]">
          <div className="absolute inset-x-4 top-5 h-16 rounded-full bg-bullfy-neon-blue/18 blur-2xl" />
          <div className="absolute bottom-0 h-24 w-24 rounded-t-full border border-bullfy-neon-blue/25 bg-bullfy-neon-blue/10" />
          <div className="relative z-10 flex size-20 items-center justify-center rounded-full border border-amber-200/45 bg-amber-200/10 text-2xl font-black text-amber-100">
            {initials}
          </div>
        </div>

        <div className="grid gap-3">
          <MiniStat
            label="Estado"
            value={hasAvatar ? "Avatar creado" : "Avatar no creado"}
          />
          <MiniStat
            label="Uso"
            value={hasAvatar ? "ArenaTV, podio, perfil" : "Listo para crear"}
          />
          <MiniStat label="Trader" value={traderName} />
          <Link
            href="/profile/avatar"
            className={cn(
              buttonVariants({ variant: "neonBlue", size: "lg" }),
              "mt-1 h-10 justify-center",
            )}
          >
            <Wand2 className="size-4" />
            {hasAvatar ? "Editar avatar" : "Crear avatar"}
          </Link>
        </div>
      </div>
    </section>
  );
}

function TopMetric({
  icon: Icon,
  label,
  tone = "white",
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone?: "white" | "blue" | "gold";
  value: string;
}) {
  const iconClass = {
    white: "text-slate-300",
    blue: "text-bullfy-neon-blue",
    gold: "text-amber-300",
  }[tone];

  return (
    <Card>
      <div className="flex items-center gap-2 text-sm font-black text-slate-200">
        <Icon className={cn("size-4", iconClass)} />
        {label}
      </div>
      <p className="mt-3 text-2xl font-black text-slate-100">{value}</p>
    </Card>
  );
}

function Panel({
  actionLabel,
  children,
  href,
  title,
}: {
  actionLabel?: string;
  children: React.ReactNode;
  href?: string;
  title: string;
}) {
  return (
    <Card>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-xl font-black text-slate-100">{title}</h2>
        {href && actionLabel ? (
          <Link
            href={href}
            className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs font-black text-slate-200 transition hover:border-bullfy-neon-blue/40 hover:text-bullfy-neon-blue"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

function StatTile({
  detail,
  label,
  positive,
  value,
}: {
  detail: string;
  label: string;
  positive?: boolean;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-2xl font-black text-white",
          positive === true && "text-bullfy-neon-green",
          positive === false && "text-bullfy-neon-red",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/25 px-4 py-3 text-sm font-black text-slate-200 transition hover:border-bullfy-neon-blue/40 hover:text-bullfy-neon-blue"
    >
      <span className="flex items-center gap-2">
        <Icon className="size-4" />
        {label}
      </span>
      <RadioTower className="size-3.5 text-slate-500" />
    </Link>
  );
}

function CompetitionRow({
  icon: Icon,
  meta,
  positive,
  result,
  score,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  meta: string;
  positive: boolean;
  result: string;
  score: string;
  title: string;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-white/10 bg-black/25 p-3 transition hover:border-bullfy-neon-blue/35 sm:grid-cols-[1fr_auto_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-black text-white">{title}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{meta}</p>
        </div>
      </div>
      <Badge className="w-fit border-white/10 bg-white/5 text-slate-300">
        {result}
      </Badge>
      <p
        className={cn(
          "font-mono text-sm font-black sm:text-right",
          positive ? "text-bullfy-neon-green" : "text-bullfy-neon-red",
        )}
      >
        {score}
      </p>
    </div>
  );
}

function EmptyState({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-6 text-center">
      <Icon className="mx-auto size-6 text-slate-500" />
      <p className="mt-3 font-black text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}
