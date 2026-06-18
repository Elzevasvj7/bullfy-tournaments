"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  CircleDollarSign,
  Flame,
  Gauge,
  Shield,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArenaParticipant, ArenaState } from "@/modules/arena";
import type { CurrentSessionUser } from "@/modules/auth/types";
import { AppHeader } from "@/shared/components/app-header";
import type { Tournament } from "../types";
import { TournamentCardActions } from "./tournament-card-actions";

type TournamentDetailViewProps = {
  arena: ArenaState | null;
  sessionUser?: CurrentSessionUser | null;
  tournament: Tournament;
};

type RosterFighter = {
  id: string;
  alias: string;
  clan: string;
  image: string;
  position: number;
  pnl: number;
  winRate: number;
  trades: number;
  status: "confirmed" | "pending" | "captain";
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("es-VE", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

const fighterImages = [
  "/assets/poses/crossed_arms.jpg",
  "/assets/poses/victory.jpg",
  "/assets/poses/salute.jpg",
  "/assets/poses/cheer.jpg",
  "/assets/poses/idle.jpg",
  "/assets/poses/thinking.jpg",
  "/assets/poses/yelling.jpg",
  "/assets/poses/weight_shift.jpg",
  "/assets/poses/weight_shift.jpg",
];

const mockFighters = [
  ["NOVA PIP", "Bullfy Clan"],
  ["KAIRO FX", "Alpha Desk"],
  ["LUNA XAU", "Moon Clan"],
  ["VOLTAGE", "Legend Clan"],
  ["RISK ZERO", "Apex Room"],
  ["MARGIN", "North Desk"],
  ["MARGIN", "West Desk"],
] as const;

export function TournamentDetailView({
  arena,
  sessionUser = null,
  tournament,
}: TournamentDetailViewProps) {
  const [activeFighterId, setActiveFighterId] = useState<string | null>(null);
  const fighters = useMemo(
    () => buildRoster(tournament, arena?.participants ?? []),
    [arena?.participants, tournament],
  );
  const activeFighter =
    fighters.find((fighter) => fighter.id === activeFighterId) ?? fighters[0];
  const prizeLabel =
    tournament.prizeCurrency === "USD"
      ? `$${moneyFormatter.format(tournament.prizePool)} USD`
      : `${moneyFormatter.format(tournament.prizePool)} BP`;
  const entryLabel =
    tournament.entryFee === 0
      ? "Gratis"
      : `${moneyFormatter.format(tournament.entryFee)} ${tournament.entryCurrency}`;

  return (
    <main className="tournament-neon relative min-h-screen overflow-hidden text-white">
      <TournamentDetailBackground />
      <AppHeader active="torneos" user={sessionUser} />

      <section className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 border border-white/10 bg-black/30 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-100"
        >
          <ChevronLeft className="size-4" />
          Volver al lobby
        </Link>

        <section className="grid gap-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
          <div className="relative overflow-hidden border border-white/10 bg-[#071022]/82 p-7 shadow-[0_26px_80px_rgba(0,0,0,0.45)] sm:p-9">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(255,46,196,0.22),transparent_28%),radial-gradient(circle_at_80%_8%,rgba(0,229,255,0.18),transparent_34%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(112deg,rgba(255,255,255,0.07)_0_1px,transparent_1px_26px)] opacity-20" />
            <div className="t-scanlines opacity-25" />

            <div className="relative z-10">
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <span className="bg-[#FF2EC4] px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#070b18]">
                  {tournament.entryCurrency === "USD" ? "Elite VIP" : "BMoney"}
                </span>
                <span className="border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100">
                  {tournament.status}
                </span>
              </div>

              <h1 className="t-display max-w-4xl text-5xl font-black uppercase leading-[0.88] text-white sm:text-6xl lg:text-7xl">
                {tournament.name}
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-6 text-slate-300">
                {tournament.description}
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                <DetailMetric
                  icon={Trophy}
                  label="Prize pool"
                  value={prizeLabel}
                />
                <DetailMetric
                  icon={Users}
                  label="Participantes"
                  value={`${tournament.participantsCount}/${tournament.rules.maxParticipants}`}
                />
                <DetailMetric
                  icon={CircleDollarSign}
                  label="Entrada"
                  value={entryLabel}
                />
              </div>
            </div>
          </div>

          <aside className="relative overflow-hidden border border-white/10 bg-black/50 p-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_0%,rgba(0,229,255,0.18),transparent_38%)]" />
            <div className="relative z-10 flex h-full flex-col justify-between gap-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">
                  Combat briefing
                </p>
                <div className="mt-4 grid gap-2">
                  <BriefingLine
                    icon={CalendarDays}
                    label="Inicio"
                    value={dateFormatter.format(new Date(tournament.startsAt))}
                  />
                  <BriefingLine
                    icon={Flame}
                    label="Fin"
                    value={dateFormatter.format(new Date(tournament.endsAt))}
                  />
                  <BriefingLine
                    icon={Gauge}
                    label="Mercado"
                    value={tournament.rules.market}
                  />
                  <BriefingLine
                    icon={Shield}
                    label="Balance inicial"
                    value={`$${moneyFormatter.format(tournament.rules.minBalance)}`}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <TournamentCardActions
                  arenaHref={`/tournaments/${tournament.slug}/arena`}
                  secondaryHref={`/tournaments/${tournament.slug}/tv`}
                  secondaryLabel="Ver ArenaTV"
                  sessionUser={sessionUser}
                  tournament={tournament}
                />
              </div>
            </div>
          </aside>
        </section>

        <section className="relative z-10">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4 px-1">
            <div>
              <h2 className="t-display flex items-center gap-3 text-3xl font-black uppercase sm:text-4xl">
                <Swords className="size-7 text-[#FF2EC4]" />
                <span className="text-[#00E5FF]">Participantes</span>
              </h2>
            </div>
            <div className="border border-white/10 bg-black/30 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              {fighters.length} contendientes
            </div>
          </div>

          {activeFighter ? (
            <ParticipantSelectArena
              activeFighter={activeFighter}
              activeFighterId={activeFighterId}
              fighters={fighters}
              onActiveChange={setActiveFighterId}
            />
          ) : null}
        </section>
      </section>
    </main>
  );
}

function DetailMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-white/10 bg-black/35 px-4 py-3">
      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        <Icon className="size-3.5 text-[#00E5FF]" />
        {label}
      </p>
      <p className="t-mono mt-2 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function BriefingLine({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border border-white/10 bg-black/25 px-3 py-2.5">
      <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        <Icon className="size-3.5 text-[#FF2EC4]" />
        {label}
      </span>
      <span className="t-mono text-right text-xs font-black text-white">
        {value}
      </span>
    </div>
  );
}

function ParticipantSelectArena({
  activeFighter,
  activeFighterId,
  fighters,
  onActiveChange,
}: {
  activeFighter: RosterFighter;
  activeFighterId: string | null;
  fighters: RosterFighter[];
  onActiveChange: (fighterId: string | null) => void;
}) {
  return (
    <div
      className="relative overflow-hidden"
      onMouseLeave={() => onActiveChange(null)}
    >
      <div className="relative min-h-[36rem] overflow-hidden px-0 pb-5 pt-6 sm:min-h-[38rem] lg:min-h-[40rem]">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[27rem] w-[min(34rem,88vw)] -translate-x-1/2 opacity-90 sm:h-[30rem] lg:h-[32rem]">
          <Image
            alt={activeFighter.alias}
            className="object-cover object-top grayscale drop-shadow-[0_30px_80px_rgba(0,0,0,0.65)] transition duration-500"
            fill
            priority
            sizes="(min-width: 1024px) 34rem, 88vw"
            src={activeFighter.image}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_54%,rgba(5,8,19,0.86)_100%)]" />

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,transparent_0%,transparent_42%,rgba(5,8,19,0.72)_78%)]" />
          <div className="relative pb-5 z-10 mx-auto flex max-w-4xl flex-col items-center pt-[20rem] text-center sm:pt-[20rem] lg:pt-[26rem]">
            <h3 className="t-display mt-3 text-xl font-black uppercase leading-[0.86] text-white drop-shadow-[0_8px_0_rgba(0,0,0,0.72)] sm:text-2xl lg:text-3xl">
              {activeFighter.alias}
            </h3>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.22em] text-cyan-100">
              {activeFighter.clan}
            </p>
          </div>
        </div>
        <div className="sm:mx-auto sm:max-w-5xl pt-[25rem] sm:pt-[30rem] lg:pt-[32rem]">
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-6">
            {fighters.map((fighter) => (
              <ParticipantTile
                active={activeFighter.id === fighter.id}
                dimmed={
                  activeFighterId !== null && activeFighterId !== fighter.id
                }
                fighter={fighter}
                key={fighter.id}
                onActive={() => onActiveChange(fighter.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ParticipantTile({
  active,
  dimmed,
  fighter,
  onActive,
}: {
  active: boolean;
  dimmed: boolean;
  fighter: RosterFighter;
  onActive: () => void;
}) {
  return (
    <button
      className={cn(
        "group/tile cursor-pointer relative h-20 overflow-hidden border bg-[#091022] text-left transition duration-200 sm:h-28",
        active
          ? "z-10 border-[#FF2EC4] shadow-[0_0_28px_rgba(255,46,196,0.34)]"
          : "border-white/10 hover:border-cyan-300/45",
        dimmed && "opacity-45 saturate-50",
      )}
      onFocus={onActive}
      onMouseEnter={onActive}
      type="button"
    >
      <Image
        alt={fighter.alias}
        className={cn(
          "object-cover object-center grayscale transition duration-300 group-hover/tile:scale-105 group-hover/tile:grayscale-0",
          active && "grayscale-0",
        )}
        fill
        sizes="(min-width: 640px) 16vw, 33vw"
        src={fighter.image}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_42%,rgba(0,0,0,0.9)_100%)]" />
    </button>
  );
}

function TournamentDetailBackground() {
  return (
    <>
      <video
        aria-hidden
        autoPlay
        className="pointer-events-none fixed inset-0 z-0 h-screen w-screen object-cover"
        loop
        muted
        playsInline
        poster="/videos/tournament-poster.jpg"
        preload="auto"
      >
        <source src="/videos/tournament-bg.webm" type="video/webm" />
        <source src="/videos/tournament-bg.mp4" type="video/mp4" />
      </video>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[#050716]/60"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_18%_8%,rgba(255,46,196,0.18),transparent_30%),radial-gradient(circle_at_86%_12%,rgba(0,229,255,0.18),transparent_30%),linear-gradient(180deg,rgba(6,11,31,0.04),rgba(6,11,31,0.7))]"
      />
    </>
  );
}

function buildRoster(
  tournament: Tournament,
  participants: ArenaParticipant[],
): RosterFighter[] {
  const realFighters = participants.map((participant, index) => ({
    alias: participant.name,
    clan: participant.clan,
    id: participant.id,
    image: fighterImages[index % fighterImages.length],
    pnl: participant.scoreChange,
    position: participant.position,
    status: index === 0 ? ("captain" as const) : ("confirmed" as const),
    trades: participant.trades,
    winRate: participant.winRate,
  }));

  const targetCount = Math.min(Math.max(tournament.participantsCount, 10), 10);

  if (realFighters.length >= targetCount) {
    return realFighters.slice(0, targetCount);
  }

  const generated = Array.from(
    { length: targetCount - realFighters.length },
    (_, index) => {
      const rosterIndex = realFighters.length + index;
      const [alias, clan] = mockFighters[rosterIndex % mockFighters.length];

      return {
        alias,
        clan,
        id: `${tournament.slug}-mock-${rosterIndex}`,
        image: fighterImages[rosterIndex % fighterImages.length],
        pnl: Number(
          ((rosterIndex % 2 === 0 ? 1 : -1) * (0.4 + index * 0.23)).toFixed(1),
        ),
        position: rosterIndex + 1,
        status: "pending" as const,
        trades: 12 + rosterIndex * 3,
        winRate: 47 + ((rosterIndex * 7) % 24),
      };
    },
  );

  return [...realFighters, ...generated];
}
