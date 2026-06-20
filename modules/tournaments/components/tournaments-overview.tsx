"use client";

import { useMemo, useState } from "react";
import { History } from "lucide-react";
import { AppHeader } from "@/shared/components/app-header";
import type { CurrentSessionUser } from "@/modules/auth/types";
import type { Tournament } from "../types";
import { TournamentCardList } from "./tournament-card";

type TournamentsOverviewProps = {
  sessionUser?: CurrentSessionUser | null;
  tournaments: Tournament[];
};

type LeagueFilter = "bmoney" | "elite";

const moneyFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export function TournamentsOverview({
  sessionUser = null,
  tournaments,
}: TournamentsOverviewProps) {
  const [leagueFilter, setLeagueFilter] = useState<LeagueFilter>("bmoney");
  const filteredTournaments = useMemo(
    () =>
      tournaments.filter(
        (tournament) => getTournamentLeague(tournament) === leagueFilter,
      ),
    [leagueFilter, tournaments],
  );

  return (
    <main className="tournament-neon relative min-h-screen overflow-hidden text-white">
      <TournamentBackground />
      <AppHeader active="torneos" user={sessionUser} />

      <section className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-8 sm:px-6 lg:px-8">
        <LobbyHero tournaments={tournaments} />

        <section className="relative z-10">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4 px-2">
            <div>
              <h2 className="t-display text-3xl font-black md:text-4xl">
                TORNEOS <span className="text-[#00E5FF]">OPEN</span>
              </h2>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Sector de alto rendimiento
              </p>
            </div>

            <div className="polygon-shape relative flex w-full gap-2 px-2 py-2 [--polygon-bg:rgba(10,17,41,0.72)] [--polygon-border:rgba(255,255,255,0.08)] sm:w-auto">
              <button
                type="button"
                onClick={() => setLeagueFilter("bmoney")}
                className={`polygon-shape relative block cursor-pointer px-4 py-3 text-sm font-black uppercase tracking-widest transition-all [--polygon-border:transparent] [--polygon-hover-bg:rgba(255,255,255,0.08)] sm:px-10 sm:py-4 sm:text-[22px] ${
                  leagueFilter === "bmoney"
                    ? "text-[#060B1F] [--polygon-bg:#b6ff3d]"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <span className="relative">Lobby BMoney</span>
              </button>
              <button
                type="button"
                onClick={() => setLeagueFilter("elite")}
                className={`polygon-shape block cursor-pointer px-4 py-3 text-sm font-black uppercase tracking-widest transition-all [--polygon-border:transparent] [--polygon-hover-bg:rgba(255,255,255,0.08)] sm:px-10 sm:py-4 sm:text-[22px] ${
                  leagueFilter === "elite"
                    ? "text-[#060B1F] [--polygon-bg:#FF2EC4]"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Lobby Elite
              </button>
            </div>
          </div>

          <p className="mb-6 px-2 text-xs text-gray-400">
            {leagueFilter === "bmoney"
              ? "Dinero ficticio. Sin riesgo. Premios en BM$ y Bullfy Points (x1)."
              : "Dinero real USD. Requiere KYC. Premios en USD retirables + Bullfy Points (x5)."}
          </p>

          {filteredTournaments.length === 0 ? (
            <div className="border border-dashed border-white/10 py-16 text-center text-gray-500">
              Aun no hay torneos {leagueFilter === "bmoney" ? "BMoney" : "Elite"}.
              Vuelve pronto.
            </div>
          ) : (
            <TournamentCardList
              sessionUser={sessionUser}
              tournaments={filteredTournaments}
            />
          )}
        </section>

          {/* <section className="relative z-10">
            <div className="mb-8 flex items-end justify-between px-2">
              <div>
                <h2 className="t-display flex items-center gap-3 text-3xl font-black md:text-4xl">
                  <History className="h-7 w-7 text-[#B6FF3D]" />
                  MI <span className="text-[#B6FF3D]">HISTORIAL</span>
                </h2>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Torneos finalizados en los que participaste
                </p>
              </div>
            </div>
            <div className="border border-dashed border-white/10 py-12 text-center text-sm text-gray-500">
              El historial se activara cuando conectemos participaciones reales.
            </div>
          </section> */}
      </section>
    </main>
  );
}

function TournamentBackground() {
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
      <div
        className="fixed inset-0 z-0 bg-[#060B1F]/35 pointer-events-none"
        aria-hidden
      />
      <div
        className="fixed inset-0 z-0 bg-gradient-to-b from-[#060B1F]/10 via-[#060B1F]/25 to-[#060B1F]/60 pointer-events-none"
        aria-hidden
      />
    </>
  );
}

function LobbyHero({ tournaments }: { tournaments: Tournament[] }) {
  const traders = tournaments.reduce(
    (total, tournament) => total + tournament.participantsCount,
    0,
  );
  const prizePool = tournaments.reduce(
    (total, tournament) =>
      total +
      (tournament.prizeCurrency === "USD" ? tournament.prizePool : 0),
    0,
  );

  return (
    <header className="relative z-10 overflow-hidden border border-white/8 bg-[#0a1129]/38 p-8 text-center shadow-[0_28px_90px_rgba(0,0,0,0.42)] backdrop-blur-sm md:p-16">
      <div className="t-scanlines z-10" />

      <div className="relative z-20">
        <div className="mb-8 inline-flex items-center gap-3 border border-[#FF2EC4]/30 bg-[#FF2EC4]/10 px-5 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#FF2EC4]">
          <span className="h-1.5 w-1.5 animate-pulse bg-[#FF2EC4] shadow-[0_0_8px_#FF2EC4]" />
          Live Season Active
        </div>

        <h1 className="t-display mb-6 text-5xl font-black leading-[0.95] tracking-tighter md:text-7xl lg:text-8xl">
          <span className="t-glitch" data-text="COMPITE. GANA.">
            COMPITE. GANA.
          </span>
          <br />
          <span className="t-shimmer">DOMINA.</span>
        </h1>

        <p className="t-display mb-6 text-base font-black uppercase tracking-[0.18em] text-[#00E5FF] md:text-xl">
          Donde el trading es un octagono de lucha
        </p>

        <p className="mx-auto mb-10 max-w-2xl text-base font-light leading-relaxed text-gray-400 md:text-lg">
          Domina los mercados en tiempo real. Gana premios masivos en{" "}
          <span className="font-bold text-white">USDT</span> y{" "}
          <span className="font-bold text-[#B6FF3D]">Bullfy Points</span>{" "}
          operando en las condiciones mas extremas.
        </p>

        <div className="mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-4 sm:gap-6">
          <HeroStat n={`${traders || 10}K+`} l="Traders activos" color="#00E5FF" />
          <HeroStat
            n={`$${moneyFormatter.format(prizePool || 250000)}`}
            l="En premios"
            color="#B6FF3D"
          />
          <HeroStat n="24/7" l="Mercados abiertos" color="#FF2EC4" />
        </div>
      </div>
    </header>
  );
}

function HeroStat({
  color,
  l,
  n,
}: {
  color: string;
  l: string;
  n: string;
}) {
  return (
    <div>
      <div
        className="t-display t-mono text-2xl font-black md:text-4xl"
        style={{ color, textShadow: `0 0 18px ${color}40` }}
      >
        {n}
      </div>
      <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-500">
        {l}
      </div>
    </div>
  );
}

function getTournamentLeague(tournament: Tournament): LeagueFilter {
  return tournament.entryCurrency === "BULLFY" ? "bmoney" : "elite";
}
