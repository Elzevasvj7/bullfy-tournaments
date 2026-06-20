"use client";

import { useEffect, useState, type CSSProperties, type ComponentType } from "react";
import { motion } from "motion/react";
import {
  Calendar,
  CircleDollarSign,
  Crown,
  Shield,
  Timer,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CurrentSessionUser } from "@/modules/auth/types";
import type { Tournament } from "../types";
import { TournamentCardActions } from "./tournament-card-actions";

type TournamentCardListProps = {
  sessionUser?: CurrentSessionUser | null;
  tournaments: Tournament[];
};

type TournamentCardProps = {
  active?: boolean;
  dimmed?: boolean;
  onActiveChange?: (active: boolean) => void;
  sessionUser?: CurrentSessionUser | null;
  tournament: Tournament;
};

type TournamentKind = "free" | "paid" | "elite";

const typeLabel: Record<TournamentKind, string> = {
  elite: "Elite",
  free: "BMoney",
  paid: "Paid",
};

const statusLabel: Record<Tournament["status"], string> = {
  draft: "Borrador",
  upcoming: "Proximo",
  live: "En vivo",
  finished: "Finalizado",
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("es-VE", {
  day: "2-digit",
  month: "short",
});

export function TournamentCardList({
  sessionUser = null,
  tournaments,
}: TournamentCardListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <div
      className="grid grid-cols-1 gap-7 md:grid-cols-2 xl:grid-cols-3"
      onMouseLeave={() => setActiveId(null)}
    >
      {tournaments.map((tournament) => (
        <TournamentCard
          active={activeId === tournament.id}
          dimmed={activeId !== null && activeId !== tournament.id}
          key={tournament.id}
          onActiveChange={(active) => setActiveId(active ? tournament.id : null)}
          sessionUser={sessionUser}
          tournament={tournament}
        />
      ))}
    </div>
  );
}

export function TournamentCard({
  active = false,
  dimmed = false,
  onActiveChange,
  sessionUser = null,
  tournament,
}: TournamentCardProps) {
  const [now, setNow] = useState<number | null>(null);
  const kind = getTournamentType(tournament);
  const accent = accentForType(kind);
  const league = getTournamentLeague(tournament);
  const target =
    tournament.status === "live" ? tournament.endsAt : tournament.startsAt;
  const countdownLabel =
    tournament.status === "live" ? "Finaliza" : "Arranque";
  const capacity = Math.min(
    100,
    Math.round(
      (tournament.participantsCount / tournament.rules.maxParticipants) * 100,
    ),
  );
  const pointsPool =
    tournament.prizeCurrency === "BULLFY"
      ? tournament.prizePool
      : Math.max(tournament.prizePool * 10, 0);

  useEffect(() => {
    const initialTick = window.setTimeout(() => setNow(Date.now()), 0);
    const id = window.setInterval(() => setNow(Date.now()), 1000);

    return () => {
      window.clearInterval(id);
      window.clearTimeout(initialTick);
    };
  }, []);

  const style = {
    "--card-accent": accent.color,
    "--card-accent-rgb": accent.rgb,
  } as CSSProperties;

  return (
    <motion.article
      animate={{
        opacity: dimmed ? 0.48 : 1,
        scale: active ? 1.018 : 1,
        y: active ? -6 : 0,
      }}
      className={cn(
        "group/card relative isolate min-h-[31rem] transition-[filter] duration-300 cursor-pointer",
        dimmed && "saturate-50",
      )}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          onActiveChange?.(false);
        }
      }}
      onFocus={() => onActiveChange?.(true)}
      onMouseEnter={() => onActiveChange?.(true)}
      style={style}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
   

      <div className="relative flex h-full min-h-[31rem] flex-col overflow-hidden bg-[#070b18] p-px">
   

        <div
          className={cn(
            "absolute -left-1/2 top-0 h-full w-1/2 skew-x-[-18deg] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.16),transparent)] opacity-0 transition duration-700 group-hover/card:left-full group-hover/card:opacity-100",
            active && "opacity-100",
          )}
        />

        <div className="relative z-10 flex h-full flex-1 flex-col px-7 py-5 sm:px-8">
          <div className="flex items-start justify-between gap-3">
            <TierRibbon
              accent={accent.color}
              icon={kind === "elite" ? Crown : kind === "paid" ? Zap : Shield}
              label={kind === "elite" ? "Elite VIP" : `${typeLabel[kind]} tier`}
            />
            <StatusPill active={active} status={tournament.status} />
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.26em] text-white/40">
              {tournament.sponsor}
            </p>
            <h3 className="t-display mt-2 text-[1.85rem] font-black uppercase leading-[0.93] text-white sm:text-[2.18rem] truncate">
              {tournament.name}
            </h3>
            <div className="mt-3 h-px bg-[linear-gradient(90deg,rgb(var(--card-accent-rgb)/0.8),rgba(255,255,255,0.16),transparent)]" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <CombatStat
              icon={Users}
              label="Slots"
              value={`${tournament.participantsCount}/${tournament.rules.maxParticipants}`}
            />
            <CombatStat
              icon={Calendar}
              label="Fecha"
              value={dateFormatter.format(new Date(tournament.startsAt))}
            />
            <CombatStat
              icon={CircleDollarSign}
              label="Entrada"
              value={
                tournament.entryFeeUsd > 0
                  ? `${moneyFormatter.format(tournament.entryFeeUsd)} ${
                      league === "bmoney" ? "BM$" : tournament.entryCurrency
                    }`
                  : "Gratis"
              }
            />
          </div>

          <PrizePoolPanel
            active={active}
            capacity={capacity}
            countdownLabel={countdownLabel}
            currency={tournament.prizeCurrency}
            pointsPool={pointsPool}
            prizePool={tournament.prizePool}
            target={now ? formatCountdown(target, now) : "--:--:--"}
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="bg-white/8 border border-white/10 px-4 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              {tournament.rules.market}
            </span>
            {tournament.rules.allowedAssets.slice(0, 3).map((asset) => (
              <span
                className="border border-white/10 bg-black/25 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500"
                key={asset}
              >
                {asset}
              </span>
            ))}
          </div>

          <div className="pt-4">
            <TournamentCardActions
              sessionUser={sessionUser}
              tournament={tournament}
            />
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function TierRibbon({
  accent,
  icon: Icon,
  label,
}: {
  accent: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div
      className="inline-flex h-8 items-center gap-2 bg-white px-4 text-[10px] font-black uppercase tracking-[0.22em] text-[#050815] shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition duration-300 group-hover/card:translate-x-1"
      style={{ background: accent }}
    >
      <Icon className="size-3.5" />
      {label}
    </div>
  );
}

function StatusPill({
  active,
  status,
}: {
  active: boolean;
  status: Tournament["status"];
}) {
  return (
    <div
      className={cn(
        "border border-white/10 bg-black/45 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-300 transition duration-300",
        status === "live" && "text-[#B6FF3D]",
        active && "border-[rgb(var(--card-accent-rgb)/0.42)] text-white",
      )}
    >
      {statusLabel[status]}
    </div>
  );
}

function CombatStat({
  icon: Icon,
  label,
  tone = "neutral",
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  tone?: "hot" | "neutral";
  value: string;
}) {
  return (
    <div className="group/stat relative overflow-hidden border border-white/10 bg-black/25 px-2.5 py-2.5 transition duration-300 group-hover/card:border-[rgb(var(--card-accent-rgb)/0.28)] group-hover/card:bg-black/35">
      <div className="absolute inset-x-0 top-0 h-px scale-x-0 bg-[rgb(var(--card-accent-rgb)/0.75)] transition duration-300 group-hover/card:scale-x-100" />
      <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.17em] text-slate-500">
        <Icon
          className={cn(
            "size-3",
            tone === "hot" ? "text-[#B6FF3D]" : "text-[var(--card-accent)]",
          )}
        />
        {label}
      </p>
      <p className="t-mono mt-1.5 truncate text-xs font-black uppercase text-white sm:text-sm">
        {value}
      </p>
    </div>
  );
}

function PrizePoolPanel({
  active,
  capacity,
  countdownLabel,
  currency,
  pointsPool,
  prizePool,
  target,
}: {
  active: boolean;
  capacity: number;
  countdownLabel: string;
  currency: Tournament["prizeCurrency"];
  pointsPool: number;
  prizePool: number;
  target: string;
}) {
  return (
    <div
      className={cn(
        "relative mt-4 overflow-hidden border border-white/10 bg-[#050813] px-4 py-3 transition duration-300",
        active && "border-[rgb(var(--card-accent-rgb)/0.45)]",
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-[var(--card-accent)] opacity-70" />
      <Trophy className="absolute -right-2 top-2 size-16 text-white/[0.035]" />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--card-accent)]">
            Prize Pool Total
          </p>
          <p className="t-display mt-1 text-3xl font-black uppercase leading-none text-white">
            {moneyFormatter.format(pointsPool)}
            <span className="ml-2 text-base text-slate-500">BP</span>
          </p>
          {currency === "USD" && prizePool > 0 ? (
            <p className="t-mono mt-1 text-xs font-bold text-slate-400">
              + ${moneyFormatter.format(prizePool)} USD
            </p>
          ) : null}
        </div>

        <div className="min-w-24 border-l border-white/10 pl-3 text-right">
          <p className="flex items-center justify-end gap-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
            <Timer className="size-3 text-[var(--card-accent)]" />
            {countdownLabel}
          </p>
          <p className="t-mono mt-2 text-sm font-black text-white">{target}</p>
        </div>
      </div>

      <div className="relative z-10 mt-3">
        <div className="mb-1 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
          <span>Ocupacion</span>
          <span>{capacity}%</span>
        </div>
        <div className="h-2 overflow-hidden bg-white/10">
          <div
            className="h-full bg-[linear-gradient(90deg,var(--card-accent),#B6FF3D)] transition-[width] duration-500"
            style={{ width: `${capacity}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function accentForType(type: TournamentKind) {
  if (type === "elite") {
    return { color: "#FF2EC4", rgb: "255 46 196" };
  }

  if (type === "paid") {
    return { color: "#00E5FF", rgb: "0 229 255" };
  }

  return { color: "#B6FF3D", rgb: "182 255 61" };
}

function getTournamentLeague(tournament: Tournament) {
  return tournament.entryCurrency === "BULLFY" ? "bmoney" : "elite";
}

function getTournamentType(tournament: Tournament): TournamentKind {
  if (getTournamentLeague(tournament) === "elite") {
    return "elite";
  }

  return tournament.entryFeeUsd > 0 ? "paid" : "free";
}

function formatCountdown(target: string, now: number) {
  const diff = new Date(target).getTime() - now;

  if (diff <= 0) {
    return "00:00:00";
  }

  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
