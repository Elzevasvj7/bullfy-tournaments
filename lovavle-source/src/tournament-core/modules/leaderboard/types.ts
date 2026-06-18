export type LeaderboardScope = "global" | "tournament" | "clan";

export type RankingEntry = {
  userId: string;
  country: string;
  fullName: string;
  username: string | null;
  publicProfile: boolean;
  avatarUrl: string | null;
  traderId: string;
  traderName: string;
  clanName: string;
  position: number;
  previousPosition: number;
  scorePercent: number;
  pnl: number;
  balance: number;
  trades: number;
  winRate: number;
  total_winnings_usd: number;
  total_points: number;
};

export type Leaderboard = {
  id: string;
  title: string;
  scope: LeaderboardScope;
  updatedAt: string;
  entries: RankingEntry[];
};

export type RankingCacheRow = {
  rank: number;
  user_id: string;
  total_winnings_usd: number;
  total_points: number;
};

export type RankingUserRow = {
  id: string;
  full_name: string | null;
  country: string | null;
  avatar_url: string | null;
  username: string | null;
  public_profile: boolean | null;
};
