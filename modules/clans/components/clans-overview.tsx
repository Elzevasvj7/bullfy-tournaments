"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Crown,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CurrentSessionUser } from "@/modules/auth/types";
import type { Clan, ClanDashboard, ClanWar } from "../types";
import { ClanShell } from "./clan-shell";
import { Card } from "@/components/ui/card";
import { PiCastleTurretBold } from "react-icons/pi";


type ClansOverviewProps = {
  dashboard: ClanDashboard;
  sessionUser?: CurrentSessionUser | null;
};

export function ClansOverview({
  dashboard,
  sessionUser = null,
}: ClansOverviewProps) {
  const [query, setQuery] = useState("");
  const myClan = dashboard.clans.find(
    (clan) => clan.id === dashboard.currentUserClanId,
  );
  const filteredClans = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return dashboard.clans;
    }

    return dashboard.clans.filter((clan) =>
      [clan.name, clan.tag, clan.description]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [dashboard.clans, query]);

  return (
    <ClanShell sessionUser={sessionUser}>
      <header className="relative overflow-hidden rounded-[2.5rem] border border-white/5 bg-[#0a1129]/35 p-8 shadow-2xl backdrop-blur-sm md:p-10">
        <div className="t-scanlines z-10" />
        <div className="relative z-20 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-[#00E5FF]/30 bg-[#00E5FF]/10 px-5 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#00E5FF]">
              <PiCastleTurretBold  className="size-4" />
              Clan sector
            </div>
            <h1 className="t-display text-4xl font-black leading-[0.95] tracking-tighter md:text-6xl">
              CLANES <span className="t-shimmer">Y GUERRAS.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-400">
              Ranking de clanes, guerras activas, busqueda publica y panel de Mi
              clan para gestionar miembros, historial y retos.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {myClan ? (
              <Link
                href={`/clans/${myClan.slug}`}
                className={cn(
                  buttonVariants({ variant: "neonBlueSolid", size: "lg" }),
                  "h-11 justify-center",
                )}
              >
                <Crown className="size-4" />
                Mi clan
              </Link>
            ) : null}
            <Link
              href="/clans/create"
              className={cn(
                buttonVariants({ variant: "neonGreenSolid", size: "lg" }),
                "h-11 justify-center",
              )}
            >
              <Plus className="size-4" />
              Crear clan
            </Link>
          </div>
        </div>
      </header>

      {myClan ? (
        <section className="rounded-3xl border border-[#B6FF3D]/25 bg-[#B6FF3D]/10 p-5 backdrop-blur-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#B6FF3D]">
                Tu estado actual
              </p>
              <h2 className="t-display mt-2 text-2xl font-black">
                [{myClan.tag}] {myClan.name}
              </h2>
              <p className="mt-1 text-sm text-gray-400">{myClan.description}</p>
            </div>
            <Link
              href={`/clans/${myClan.slug}`}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-center text-xs font-black uppercase tracking-[0.2em] text-white transition hover:bg-white hover:text-[#060B1F]"
            >
              Abrir panel
            </Link>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-dashed border-white/10 bg-[#0a1129]/55 p-5 text-center text-sm text-gray-400">
          Aun no perteneces a un clan. Crea uno o busca un clan publico para
          unirte con codigo.
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="t-display text-3xl font-black">
                RANKING <span className="text-[#00E5FF]">DE CLANES</span>
              </h2>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Rating, guerras y rendimiento medio
              </p>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar clan o tag"
                className="h-11 border-white/10 bg-black/25 pl-9 text-white"
              />
            </div>
          </div>

          <Card className="bg-[#0a1129]/60 border-[#00E5FF]/20">
            <div className="divide-y divide-white/5">
              {filteredClans.map((clan) => (
                <ClanRankingRow key={clan.id} clan={clan} />
              ))}
            </div>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card className="bg-[#0a1129]/60 border-[#00E5FF]/20">
            <h2 className="t-display flex items-center gap-2 text-lg font-black">
              <Swords className="size-5 text-[#B6FF3D]" />
              Clan Wars publicas
            </h2>
            <div className="mt-4 space-y-3">
              {dashboard.wars.map((war) => (
                <WarCard key={war.id} clans={dashboard.clans} war={war} />
              ))}
            </div>
          </Card>
        </aside>
      </section>
    </ClanShell>
  );
}

function ClanRankingRow({ clan }: { clan: Clan }) {
  const accent = clan.rank === 1 ? "#B6FF3D" : clan.rank === 2 ? "#00E5FF" : "#FF2EC4";

  return (
    <Link
      href={`/clans/${clan.slug}`}
      className="grid gap-4 px-5 py-4 transition hover:bg-white/[0.035] md:grid-cols-[auto_1fr_auto]"
    >
      <div
        className="t-mono flex h-12 w-14 items-center justify-center rounded-xl border text-base font-black"
        style={{
          background: `${accent}1a`,
          borderColor: `${accent}33`,
          color: accent,
        }}
      >
        #{clan.rank}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="t-display truncate text-xl font-black text-white">
            {clan.name}
          </h3>
          <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black text-gray-300">
            [{clan.tag}]
          </span>
          {clan.isVerified ? <ShieldCheck className="size-4 text-[#00E5FF]" /> : null}
        </div>
        <p className="mt-1 line-clamp-1 text-xs text-gray-400">{clan.description}</p>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500">
          <span className="flex items-center gap-1">
            <Users className="size-3" />
            {clan.membersCount} miembros
          </span>
          <span className="flex items-center gap-1">
            <Trophy className="size-3" />
            {clan.warsWon}/{clan.totalWars} guerras
          </span>
        </div>
      </div>
      <div className="text-left md:text-right">
        <p className="t-display text-3xl font-black text-[#B6FF3D]">
          {clan.rating}
        </p>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
          Rating
        </p>
        <p className="t-mono mt-1 text-xs text-gray-400">
          score medio {clan.avgMemberScore.toFixed(1)}%
        </p>
      </div>
    </Link>
  );
}

function WarCard({ clans, war }: { clans: Clan[]; war: ClanWar }) {
  const challenger = clans.find((clan) => clan.id === war.challengerClanId);
  const defender = clans.find((clan) => clan.id === war.defenderClanId);
  const statusColor = {
    accepted: "text-[#00E5FF]",
    finished: "text-gray-400",
    in_progress: "text-[#B6FF3D]",
    pending: "text-amber-300",
  }[war.status];

  return (
    <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${statusColor}`}>
          {war.status.replace("_", " ")}
        </p>
        <p className="t-mono text-sm font-black text-[#B6FF3D]">
          ${war.stakeUsd}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
        <ClanMini clan={challenger} winner={war.winnerClanId === challenger?.id} />
        <Swords className="size-4 text-gray-500" />
        <ClanMini clan={defender} winner={war.winnerClanId === defender?.id} alignRight />
      </div>
      <p className="mt-3 text-[11px] text-gray-500">
        Min. {war.minParticipants} jugadores por clan · {war.durationMinutes / 60}h
      </p>
    </div>
  );
}

function ClanMini({
  alignRight,
  clan,
  winner,
}: {
  alignRight?: boolean;
  clan?: Clan;
  winner: boolean;
}) {
  return (
    <Link
      href={clan ? `/clans/${clan.slug}` : "#"}
      className={alignRight ? "text-right" : ""}
    >
      <p className="truncate font-bold text-white">
        {winner ? "CROWN " : ""}
        [{clan?.tag ?? "---"}]
      </p>
      <p className="truncate text-[11px] text-gray-500">{clan?.name ?? "Clan"}</p>
    </Link>
  );
}
