import { motion } from "framer-motion";
import { Crown, Medal, Sparkles } from "lucide-react";
import TournamentAvatar from "./TournamentAvatar";
import TournamentAvatar3D from "./TournamentAvatar3D";
import ScoreBreakdown from "./ScoreBreakdown";
import { computeBreakdown, topDriver, formatContribution } from "@/lib/tournamentScore";

interface PodiumEntry {
  id: string;
  rank: number;
  name: string;
  country?: string;
  score: number;
  profit_pct: number;
  winrate?: number;
  profit_factor?: number;
  sharpe?: number;
  max_drawdown_pct?: number;
  trades_count?: number;
  avatar_url?: string | null;
  avatar_config?: any;
  avatar_3d_url?: string | null;
}

const heights = { 1: 180, 2: 140, 3: 110 } as const;
const colors = {
  1: "from-yellow-400 via-yellow-300 to-amber-500",
  2: "from-slate-300 via-slate-200 to-slate-400",
  3: "from-orange-400 via-orange-300 to-orange-500",
} as const;
const order = [2, 1, 3] as const;

export default function TournamentPodium({ top, weights }: { top: PodiumEntry[]; weights?: any }) {
  const byRank = new Map(top.map((p) => [p.rank, p]));
  return (
    <div className="relative flex items-end justify-center gap-3 sm:gap-6 py-6">
      {order.map((rank) => {
        const p = byRank.get(rank);
        if (!p) return <div key={rank} className="w-24 sm:w-32" />;
        const h = heights[rank as 1 | 2 | 3];
        const grad = colors[rank as 1 | 2 | 3];
        return (
          <motion.div
            key={p.id}
            layout
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 120, damping: 18, delay: rank * 0.08 }}
            className="flex flex-col items-center"
          >
            {/* Avatar + crown */}
            <div className="relative mb-2">
              {rank === 1 && (
                <motion.div
                  animate={{ y: [0, -4, 0], rotate: [-3, 3, -3] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                  className="absolute -top-7 left-1/2 -translate-x-1/2 z-10"
                >
                  <Crown className="w-7 h-7 text-yellow-300 fill-yellow-400 drop-shadow-[0_0_8px_rgba(252,211,77,0.8)]" />
                </motion.div>
              )}
              {rank !== 1 && (
                <Medal className={`absolute -top-3 -right-2 w-5 h-5 z-10 ${rank === 2 ? "text-slate-300" : "text-orange-400"}`} />
              )}
              {p.avatar_3d_url ? (
                <motion.div
                  animate={rank === 1 ? { boxShadow: ["0 0 0 0 rgba(252,211,77,0.5)", "0 0 0 18px rgba(252,211,77,0)"] } : {}}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className={`rounded-2xl bg-gradient-to-br ${grad} p-[3px]`}
                >
                  <div className="rounded-2xl bg-background overflow-hidden">
                    <TournamentAvatar3D
                      url={p.avatar_3d_url}
                      fallbackConfig={p.avatar_config}
                      fallbackUrl={p.avatar_url}
                      fallbackSeed={p.name}
                      mood={rank === 1 ? "celebrate" : rank === 2 ? "happy" : "idle"}
                      animation={rank === 1 ? "victory" : rank === 2 ? "thinking" : "idle"}
                      gender={(p.avatar_config?.gender as "masculine" | "feminine") || "masculine"}
                      shape="portrait"
                      fullBody
                      width={rank === 1 ? 140 : 110}
                      height={rank === 1 ? 220 : 176}
                    />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  animate={rank === 1 ? { boxShadow: ["0 0 0 0 rgba(252,211,77,0.5)", "0 0 0 18px rgba(252,211,77,0)"] } : {}}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className={`rounded-full bg-gradient-to-br ${grad} p-[3px]`}
                >
                  <div className="rounded-full bg-background overflow-hidden">
                    <TournamentAvatar
                      config={p.avatar_config}
                      fallbackUrl={p.avatar_url}
                      fallbackSeed={p.name}
                      mood={rank === 1 ? "celebrate" : rank === 2 ? "happy" : "idle"}
                      size={rank === 1 ? 80 : 64}
                    />
                  </div>
                </motion.div>
              )}
            </div>

            {/* Name + score driver */}
            <div className="text-center mb-2 max-w-[140px] sm:max-w-[180px]">
              <div className="text-xs sm:text-sm font-bold truncate">{p.name}</div>
              <div className={`text-xs font-mono ${p.profit_pct >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {p.profit_pct >= 0 ? "+" : ""}
                {p.profit_pct.toFixed(2)}%
              </div>
              {weights && (p.trades_count ?? 0) === 0 ? (
                <div className="mt-1 inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 font-semibold">
                  Sin trades cerrados
                </div>
              ) : (
                <>
                  {weights && (() => {
                    const driver = topDriver(computeBreakdown(weights, {
                      profit_pct: p.profit_pct,
                      winrate: p.winrate,
                      profit_factor: p.profit_factor,
                      sharpe: p.sharpe,
                      max_drawdown_pct: p.max_drawdown_pct,
                    }));
                    if (!driver) return null;
                    return (
                      <div className="mt-1 inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary font-semibold">
                        <Sparkles className="h-2.5 w-2.5" />
                        Lidera: {driver.shortLabel} {formatContribution(driver.contribution)}
                      </div>
                    );
                  })()}
                  {weights && (
                    <div className="mt-1.5">
                      <ScoreBreakdown
                        weights={weights}
                        metrics={{
                          profit_pct: p.profit_pct,
                          winrate: p.winrate,
                          profit_factor: p.profit_factor,
                          sharpe: p.sharpe,
                          max_drawdown_pct: p.max_drawdown_pct,
                        }}
                        totalScore={p.score}
                        variant="podium"
                      />
                    </div>
                  )}
                </>
              )}
            </div>



            {/* Pillar */}
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: h }}
              transition={{ type: "spring", stiffness: 80, damping: 16, delay: 0.2 + rank * 0.08 }}
              className={`w-20 sm:w-28 rounded-t-xl bg-gradient-to-b ${grad} shadow-lg flex items-start justify-center pt-3 relative overflow-hidden`}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />
              <span className="text-3xl sm:text-4xl font-black text-background drop-shadow">#{rank}</span>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}
