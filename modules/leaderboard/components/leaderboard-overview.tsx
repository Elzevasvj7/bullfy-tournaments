import Link from "next/link";
import { Trophy } from "lucide-react";
import type { CurrentSessionUser } from "@/modules/auth/types";
import { AppHeader } from "@/shared/components/app-header";
import type { Leaderboard } from "../types";
import { LeaderboardTable } from "./leaderboard-table";
import { Card, CardContent } from "@/components/ui/card";
import { IoMdPodium } from "react-icons/io";

type LeaderboardOverviewProps = {
  leaderboard: Leaderboard;
  sessionUser?: CurrentSessionUser | null;
};

const updatedFormatter = new Intl.DateTimeFormat("es-VE", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function LeaderboardOverview({
  leaderboard,
  sessionUser = null,
}: LeaderboardOverviewProps) {
  const leader = leaderboard.entries[0];
  const totalPnl = leaderboard.entries.reduce((total, entry) => total + entry.pnl, 0);
  const totalTrades = leaderboard.entries.reduce(
    (total, entry) => total + entry.trades,
    0,
  );
  const averageWinRate =
    leaderboard.entries.length > 0
      ? leaderboard.entries.reduce((total, entry) => total + entry.winRate, 0) /
        leaderboard.entries.length
      : 0;

  return (
    <main className="tournament-neon relative min-h-screen overflow-hidden text-white">
      <RankingBackground />
      <AppHeader active="rankings" user={sessionUser} />

      <section className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="relative overflow-hidden rounded-[2.5rem] border border-white/5 bg-[#0a1129]/30 p-8 shadow-2xl backdrop-blur-sm md:p-10">
          <div className="t-scanlines z-10" />
          <div className="relative z-20 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-[#B6FF3D]/30 bg-[#B6FF3D]/10 px-5 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#B6FF3D]">
                <IoMdPodium className="size-4"   />
                Ranking global
              </div>

              <h1 className="t-display text-4xl font-black leading-[0.95] tracking-tighter md:text-6xl">
                TRADERS <span className="t-shimmer">EN ASCENSO.</span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-400">
                {leaderboard.title}. Tabla actualizada con score, PnL, balance,
                operaciones, win rate y cambio de posicion.
              </p>
              <p className="t-mono mt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500">
                Actualizado {updatedFormatter.format(new Date(leaderboard.updatedAt))}
              </p>
            </div>

            {leader ? (
              <div className="rounded-3xl border border-[#B6FF3D]/30 bg-[#B6FF3D]/10 p-5 shadow-[0_0_35px_rgba(182,255,61,0.12)]">
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#B6FF3D]">
                  <Trophy className="size-4" />
                  Lider actual
                </p>
                <p className="t-display mt-3 text-3xl font-black text-white">
                  {leader.traderName}
                </p>
                <p className="mt-1 text-sm text-gray-400">{leader.clanName}</p>
              </div>
            ) : null}
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <RankingStat label="Traders" value={String(leaderboard.entries.length)} tone="cyan" />
          <RankingStat
            label="PnL total"
            value={`${totalPnl >= 0 ? "+" : "-"}$${Math.abs(totalPnl).toLocaleString("en-US", {
              maximumFractionDigits: 2,
            })}`}
            tone="lime"
          />
          <RankingStat
            label="Trades / WR"
            value={`${totalTrades} / ${averageWinRate.toFixed(1)}%`}
            tone="magenta"
          />
        </section>

        <div className="flex items-center justify-between px-2">
          <div>
            <Link
              href="/"
              className="text-[11px] font-black uppercase tracking-[0.2em] text-[#00E5FF] transition hover:text-white"
            >
              Volver a torneos
            </Link>
          </div>
        </div>
        <Card>
          <CardContent>
           <LeaderboardTable entries={leaderboard.entries} title="Tabla general" className="bg-transparent" />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function RankingBackground() {
  return (
    <>
      <video
        aria-hidden
        autoPlay
        className="fixed inset-0 z-0 h-screen w-screen object-cover pointer-events-none"
        loop
        muted
        playsInline
        poster="/videos/tournament-poster.jpg"
        preload="auto"
      >
        <source src="/videos/tournament-bg.webm" type="video/webm" />
        <source src="/videos/tournament-bg.mp4" type="video/mp4" />
      </video>
      <div className="fixed inset-0 z-0 bg-[#060B1F]/45 pointer-events-none" aria-hidden />
      <div
        className="fixed inset-0 z-0 bg-gradient-to-b from-[#060B1F]/10 via-[#060B1F]/35 to-[#060B1F]/75 pointer-events-none"
        aria-hidden
      />
    </>
  );
}

function RankingStat({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "cyan" | "lime" | "magenta";
  value: string;
}) {
  const color = {
    cyan: "#00E5FF",
    lime: "#B6FF3D",
    magenta: "#FF2EC4",
  }[tone];

  return (
    <div className="rounded-3xl border border-white/5 bg-[#0a1129]/75 p-5 backdrop-blur-sm">
      <p
        className="text-[10px] font-black uppercase tracking-[0.2em]"
        style={{ color }}
      >
        {label}
      </p>
      <p className="t-display mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );
}
