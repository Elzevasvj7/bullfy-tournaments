import type { Leaderboard, LeaderboardScope } from "../types";
import type { ExternalLeaderboardDto } from "./leaderboard.contracts";

const scopeMap: Record<ExternalLeaderboardDto["scope"], LeaderboardScope> = {
  GLOBAL: "global",
  TOURNAMENT: "tournament",
  CLAN: "clan",
};

export function mapLeaderboard(dto: ExternalLeaderboardDto): Leaderboard {
  return {
    id: dto.leaderboard_id,
    title: dto.title,
    scope: scopeMap[dto.scope],
    updatedAt: dto.updated_at,
    entries: dto.entries.map((entry) => ({
      userId: entry.trader_id,
      country: "",
      fullName: entry.trader_name,
      username: entry.trader_name.toLowerCase().replace(/\s+/g, "-"),
      traderId: entry.trader_id,
      traderName: entry.trader_name,
      clanName: entry.clan_name,
      position: entry.rank,
      previousPosition: entry.previous_rank,
      scorePercent: entry.score_pct,
      pnl: entry.pnl_amount,
      balance: entry.balance_amount,
      trades: entry.trades_count,
      winRate: entry.win_rate_pct,
      total_winnings_usd: Math.max(entry.pnl_amount, 0),
      total_points: Math.max(Math.round(entry.score_pct * 100), 0),
    })),
  };
}
