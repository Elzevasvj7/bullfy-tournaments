export type ExternalLeaderboardDto = {
  leaderboard_id: string;
  title: string;
  scope: "GLOBAL" | "TOURNAMENT" | "CLAN";
  updated_at: string;
  entries: Array<{
    trader_id: string;
    trader_name: string;
    clan_name: string;
    rank: number;
    previous_rank: number;
    score_pct: number;
    pnl_amount: number;
    balance_amount: number;
    trades_count: number;
    win_rate_pct: number;
  }>;
};
