"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Crown,
  Medal,
  Shield,
  Swords,
  Trophy,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/shared/components/app-header";
import type { CurrentSessionUser } from "@/modules/auth/types";
import type {
  ProfileClanWarSnapshot,
  ProfileDashboard,
  ProfileTournamentSnapshot,
  ProfileVersusSnapshot,
} from "../types";

type ProfileHistoryViewProps = {
  dashboard: ProfileDashboard;
  sessionUser?: CurrentSessionUser | null;
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("es-VE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const tournamentStatusLabel: Record<ProfileTournamentSnapshot["status"], string> =
  {
    live: "En vivo",
    upcoming: "Proximo",
    finished: "Finalizado",
  };

const tournamentResultLabel: Record<ProfileTournamentSnapshot["result"], string> =
  {
    active: "Compitiendo",
    qualified: "Clasificado",
    podium: "Podio",
    eliminated: "Eliminado",
  };

const versusStatusLabel: Record<ProfileVersusSnapshot["status"], string> = {
  pending: "Pendiente",
  live: "En vivo",
  finished: "Finalizado",
};

const versusResultLabel: Record<ProfileVersusSnapshot["result"], string> = {
  win: "Victoria",
  loss: "Derrota",
  draw: "Empate",
  active: "En curso",
};

const clanWarStatusLabel: Record<ProfileClanWarSnapshot["status"], string> = {
  scheduled: "Programada",
  live: "En vivo",
  finished: "Finalizada",
};

const clanWarResultLabel: Record<ProfileClanWarSnapshot["result"], string> = {
  win: "Victoria",
  loss: "Derrota",
  draw: "Empate",
  active: "En curso",
};

export function ProfileHistoryView({
  dashboard,
  sessionUser = null,
}: ProfileHistoryViewProps) {
  const finishedTournaments = dashboard.tournaments.filter(
    (tournament) => tournament.status === "finished",
  ).length;
  const versusWins = dashboard.versus.filter(
    (versus) => versus.result === "win",
  ).length;
  const clanWins = dashboard.clanWars.filter((war) => war.result === "win").length;

  return (
    <main className="tournament-neon min-h-screen overflow-hidden text-white">
      <HistoryBackground />
      <div className="relative z-10">
        <AppHeader active="perfil" user={sessionUser} />

        <section className="mx-auto w-full max-w-7xl px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-[1fr_22rem] lg:items-stretch">
            <section className="rounded-none border border-white/10 bg-bullfy-panel/82 p-5 shadow-glass-blue backdrop-blur-xl">
              <Link
                href="/profile"
                className="inline-flex items-center gap-2 text-sm font-black text-slate-400 transition hover:text-bullfy-neon-blue"
              >
                <ArrowLeft className="size-4" />
                Volver al perfil
              </Link>
              <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <Badge className="border-bullfy-neon-blue/35 bg-bullfy-neon-blue/10 text-bullfy-neon-blue">
                    @{dashboard.trader.handle}
                  </Badge>
                  <h1 className="mt-3 max-w-3xl text-4xl font-black uppercase leading-none tracking-normal sm:text-6xl">
                    Historial competitivo
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
                    Torneos, versus y guerras de clan vistos como una bitacora
                    privada del perfil.
                  </p>
                </div>
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
            </section>

            <section className="rounded-none border border-white/10 bg-bullfy-panel/82 p-5 shadow-glass-blue backdrop-blur-xl">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Resumen del perfil
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <SummaryTile label="Torneos" value={String(finishedTournaments)} />
                <SummaryTile label="Versus ganados" value={String(versusWins)} />
                <SummaryTile label="Clan wars" value={String(dashboard.clanWars.length)} />
                <SummaryTile label="Victorias clan" value={String(clanWins)} />
              </div>
            </section>
          </div>

          <section className="mt-5 rounded-none border border-white/10 bg-bullfy-panel/82 p-4 shadow-glass-blue backdrop-blur-xl sm:p-5">
            <Tabs defaultValue="tournaments" className="gap-5">
              <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-none border border-white/10 bg-black/25 p-1">
                <HistoryTab value="tournaments" icon={Trophy} label="Torneos" />
                <HistoryTab value="versus" icon={Swords} label="Versus" />
                <HistoryTab value="clan-wars" icon={Shield} label="Clan wars" />
              </TabsList>

              <TabsContent value="tournaments" className="mt-5">
                <div className="grid gap-3">
                  {dashboard.tournaments.map((tournament) => (
                    <TournamentHistoryCard
                      key={tournament.id}
                      tournament={tournament}
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="versus" className="mt-5">
                <div className="grid gap-3">
                  {dashboard.versus.map((versus) => (
                    <VersusHistoryCard key={versus.id} versus={versus} />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="clan-wars" className="mt-5">
                <div className="grid gap-3">
                  {dashboard.clanWars.map((war) => (
                    <ClanWarHistoryCard key={war.id} war={war} />
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </section>
        </section>
      </div>
    </main>
  );
}

function HistoryBackground() {
  return (
    <div className="absolute inset-0 z-0">
      <video
        autoPlay
        loop
        muted
        playsInline
        poster="/videos/tournament-poster.jpg"
        className="h-full w-full object-cover opacity-24"
      >
        <source src="/videos/tournament-bg.webm" type="video/webm" />
        <source src="/videos/tournament-bg.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,9,18,0.72),rgba(4,9,18,0.94)_34%,rgba(4,9,18,0.99))]" />
    </div>
  );
}

function HistoryTab({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <TabsTrigger
      value={value}
      className="h-10 flex-none rounded-none px-4 text-sm font-black text-slate-400 data-active:border-bullfy-neon-blue/40 data-active:bg-bullfy-neon-blue/10 data-active:text-bullfy-neon-blue"
    >
      <Icon className="size-4" />
      {label}
    </TabsTrigger>
  );
}

function TournamentHistoryCard({
  tournament,
}: {
  tournament: ProfileTournamentSnapshot;
}) {
  const positive = tournament.scorePercent >= 0;

  return (
    <article className="grid gap-4 rounded-none border border-white/10 bg-black/25 p-4 transition hover:border-bullfy-neon-blue/35 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-white/10 bg-white/5 text-slate-300">
            {tournamentStatusLabel[tournament.status]}
          </Badge>
          <Badge
            className={cn(
              "border-white/10 bg-white/5",
              tournament.result === "podium" && "border-amber-300/35 bg-amber-300/10 text-amber-200",
              tournament.result === "eliminated" && "border-bullfy-neon-red/35 bg-bullfy-neon-red/10 text-bullfy-neon-red",
            )}
          >
            {tournamentResultLabel[tournament.result]}
          </Badge>
        </div>
        <p className="mt-3 truncate text-lg font-black text-white">
          {tournament.tournamentName}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {dateFormatter.format(new Date(tournament.startedAt))} /{" "}
          {tournament.participants} traders
        </p>
      </div>
      <MetricPill icon={Medal} label="Rank" value={tournament.rank > 0 ? `#${tournament.rank}` : "-"} />
      <MetricPill icon={Crown} label="Prize pool" value={`$${compactFormatter.format(tournament.prizeUsd)}`} />
      <div
        className={cn(
          "rounded-none border px-4 py-3 text-right font-mono text-lg font-black",
          positive
            ? "border-bullfy-neon-green/30 bg-bullfy-neon-green/10 text-bullfy-neon-green"
            : "border-bullfy-neon-red/30 bg-bullfy-neon-red/10 text-bullfy-neon-red",
        )}
      >
        {tournament.scorePercent > 0 ? "+" : ""}
        {tournament.scorePercent}%
      </div>
    </article>
  );
}

function VersusHistoryCard({ versus }: { versus: ProfileVersusSnapshot }) {
  const positive = versus.result === "win" || versus.result === "draw";

  return (
    <article className="grid gap-4 rounded-none border border-white/10 bg-black/25 p-4 transition hover:border-bullfy-neon-green/35 md:grid-cols-[1fr_auto_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-white/10 bg-white/5 text-slate-300">
            {versusStatusLabel[versus.status]}
          </Badge>
          <Badge
            className={cn(
              "border-white/10 bg-white/5",
              versus.result === "win" && "border-bullfy-neon-green/35 bg-bullfy-neon-green/10 text-bullfy-neon-green",
              versus.result === "loss" && "border-bullfy-neon-red/35 bg-bullfy-neon-red/10 text-bullfy-neon-red",
            )}
          >
            {versusResultLabel[versus.result]}
          </Badge>
        </div>
        <p className="mt-3 truncate text-lg font-black text-white">
          vs {versus.opponentName}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          @{versus.opponentHandle} / {dateFormatter.format(new Date(versus.playedAt))}
        </p>
      </div>
      <MetricPill
        icon={Wallet}
        label="Stake"
        value={`$${moneyFormatter.format(versus.stakeUsd)}`}
      />
      <div className="rounded-none border border-white/10 bg-black/30 px-4 py-3 text-right">
        <p className="font-mono text-lg font-black text-white">
          {versus.score} - {versus.opponentScore}
        </p>
        <p
          className={cn(
            "mt-1 text-xs font-black",
            positive ? "text-bullfy-neon-green" : "text-bullfy-neon-red",
          )}
        >
          {versus.pnlPercent > 0 ? "+" : ""}
          {versus.pnlPercent}% PnL
        </p>
      </div>
    </article>
  );
}

function ClanWarHistoryCard({ war }: { war: ProfileClanWarSnapshot }) {
  const positive = war.result === "win" || war.result === "draw";

  return (
    <article className="grid gap-4 rounded-none border border-white/10 bg-black/25 p-4 transition hover:border-amber-300/35 md:grid-cols-[1fr_auto_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-white/10 bg-white/5 text-slate-300">
            {clanWarStatusLabel[war.status]}
          </Badge>
          <Badge
            className={cn(
              "border-white/10 bg-white/5",
              war.result === "win" && "border-bullfy-neon-green/35 bg-bullfy-neon-green/10 text-bullfy-neon-green",
              war.result === "loss" && "border-bullfy-neon-red/35 bg-bullfy-neon-red/10 text-bullfy-neon-red",
            )}
          >
            {clanWarResultLabel[war.result]}
          </Badge>
        </div>
        <p className="mt-3 truncate text-lg font-black text-white">
          vs {war.opponentClan}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {war.opponentTag} / {dateFormatter.format(new Date(war.playedAt))}
        </p>
      </div>
      <MetricPill
        icon={Shield}
        label="Impacto"
        value={`${war.rankImpact > 0 ? "+" : ""}${war.rankImpact} rank`}
      />
      <div className="rounded-none border border-white/10 bg-black/30 px-4 py-3 text-right">
        <p className="font-mono text-lg font-black text-white">
          {war.clanScore} - {war.opponentScore}
        </p>
        <p
          className={cn(
            "mt-1 text-xs font-black",
            positive ? "text-bullfy-neon-green" : "text-bullfy-neon-red",
          )}
        >
          {clanWarResultLabel[war.result]}
        </p>
      </div>
    </article>
  );
}

function MetricPill({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-none border border-white/10 bg-black/30 px-4 py-3">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        <Icon className="size-3.5" />
        {label}
      </p>
      <p className="mt-1 whitespace-nowrap text-lg font-black text-white">{value}</p>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-none border border-white/10 bg-black/25 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  );
}
