export type ExternalProfileDashboardDto = {
  trader: {
    trader_id: string;
    display_name: string;
    handle: string;
    clan_name: string;
    avatar_url: string;
    country_code: string;
    joined_at: string;
    bio: string;
    verified: boolean;
  };
  wallet: {
    real_balance: number;
    demo_balance: number;
    bullfy_points: number;
  };
  performance: {
    global_rank: number;
    current_tournament_rank: number;
    pnl_pct: number;
    pnl_amount: number;
    win_rate_pct: number;
    trades_count: number;
    profit_factor: number;
    max_drawdown_pct: number;
    tournaments_played: number;
    tournaments_won: number;
    best_asset: string;
  };
  membership: {
    tier: "FREE" | "ELITE";
    status: "ACTIVE" | "INACTIVE" | "PENDING";
    renews_at?: string | null;
    benefits: string[];
  };
  clan: {
    clan_id?: string | null;
    slug?: string | null;
    name?: string | null;
    tag?: string | null;
    role?: "OWNER" | "CAPTAIN" | "MEMBER" | null;
    rank?: number | null;
    members_count?: number | null;
  } | null;
  mt5_accounts: Array<{
    account_id: string;
    login: string;
    server: string;
    kind: "DEMO" | "FUNDED";
    status: "CONNECTED" | "PENDING" | "SUSPENDED";
    equity: number;
    last_sync_at: string;
  }>;
  tournaments: Array<{
    tournament_id: string;
    slug?: string | null;
    tournament_name: string;
    status: "LIVE" | "UPCOMING" | "FINISHED";
    rank: number;
    participants: number;
    score_pct: number;
    prize_usd: number;
    started_at: string;
    ended_at?: string | null;
    result: "ACTIVE" | "QUALIFIED" | "PODIUM" | "ELIMINATED";
  }>;
  versus: Array<{
    versus_id: string;
    opponent_name: string;
    opponent_handle: string;
    status: "PENDING" | "LIVE" | "FINISHED";
    result: "WIN" | "LOSS" | "DRAW" | "ACTIVE";
    stake_usd: number;
    pnl_pct: number;
    score: number;
    opponent_score: number;
    played_at: string;
  }>;
  clan_wars: Array<{
    war_id: string;
    opponent_clan: string;
    opponent_tag: string;
    status: "SCHEDULED" | "LIVE" | "FINISHED";
    result: "WIN" | "LOSS" | "DRAW" | "ACTIVE";
    rank_impact: number;
    clan_score: number;
    opponent_score: number;
    played_at: string;
  }>;
  recent_trades: Array<{
    trade_id: string;
    asset_symbol: string;
    side: "BUY" | "SELL";
    pnl_amount: number;
    pnl_pct: number;
    closed_at: string;
  }>;
};
