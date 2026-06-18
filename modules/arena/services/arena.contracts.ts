export type ExternalArenaParticipantDto = {
  trader_id: string;
  display_name: string;
  clan_name: string;
  avatar_url: string;
  rank: number;
  previous_rank: number;
  score_pct: number;
  pnl_amount: number;
  balance_amount: number;
  trades_count: number;
  win_rate_pct: number;
};

export type ExternalArenaEventDto = {
  event_id: string;
  trader_name: string;
  description: string;
  asset_symbol: string;
  pnl_pct: number;
  created_at: string;
};

export type ExternalArenaDto = {
  tournament_slug: string;
  spectators_count: number;
  server_time: string;
  leaderboard: ExternalArenaParticipantDto[];
  metrics: Array<{
    label: string;
    value: string;
    trend: "UP" | "DOWN" | "FLAT";
  }>;
  recent_activity: ExternalArenaEventDto[];
  mt5_account: {
    login: string;
    server: string;
    status: "CONNECTED" | "SYNCING" | "DISCONNECTED";
    balance: number;
    equity: number;
    margin: number;
    free_margin: number;
    margin_level_pct: number;
  };
  open_positions: Array<{
    position_id: string;
    symbol: string;
    side: "BUY" | "SELL";
    lots: number;
    entry_price: number;
    current_price: number;
    stop_loss?: number | null;
    take_profit?: number | null;
    pnl_amount: number;
    pnl_pct: number;
    opened_at: string;
  }>;
  trade_ticket: {
    default_symbol: string;
    available_symbols: string[];
    min_lots: number;
    max_lots: number;
    default_lots: number;
    max_risk_pct: number;
  };
};
