export type ExternalTournamentStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "RUNNING"
  | "COMPLETED";

export type ExternalTournamentDto = {
  id?: string;
  tournament_id?: string;
  slug: string;
  name?: string;
  title?: string;
  description?: string | null;
  summary?: string | null;
  type?: "free" | "paid" | "elite";
  modality?: "pro" | "standard";
  status: string;
  starts_at?: string;
  start_time?: string;
  ends_at?: string;
  end_time?: string;
  participants_count?: number;
  entry_fee_usd?: number;
  entry_fee_bmoney?: number;
  entry_fee?: {
    amount: number;
    currency: "USD" | "BULLFY";
  };
  league?: "bmoney" | "elite";
  max_participants: number;
  banner_url?: string | null;
  prize_pool_usd?: number;
  bullfy_points_pool?: number;
  prize_pool?: {
    amount: number;
    currency: "USD" | "BULLFY";
  };
  sponsor_name?: string;
  rules?: {
    market: string;
    account_mode: "demo" | "real";
    min_balance: number;
    allowed_assets: string[];
  };
  prizes?: Array<{
    place: number;
    label: string;
    amount: number;
    currency: "USD" | "BULLFY";
  }>;
};

 

export type ExternalCreateTournamentRequestDto = {
  name: string;
  description: string;
  modality: "standard";
  starts_at: string;
  ends_at: string;
  registration_closes_at: string;
  timezone: string;
  max_participants: number;
  starting_balance_usd: number;
  league: "bmoney" | "elite";
  house_fee_pct: number;
  entry_fee_bmoney?: number;
  entry_fee_usd?: number;
  allows_funded_mt5?: boolean;
  min_funded_equity_usd?: number;
};

export type ExternalCreateTournamentResponseDto = {
  tournament: ExternalTournamentDto;
};
