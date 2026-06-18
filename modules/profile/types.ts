import type { WalletBalance } from "@/modules/wallet";

export type TraderProfile = {
  id: string;
  name: string;
  handle: string;
  clan: string;
  avatarUrl: string;
  country: string;
  joinedAt: string;
  bio: string;
  verified: boolean;
};

export type ProfileWallet = Pick<
  WalletBalance,
  "realBalance" | "demoBalance" | "bullfyPoints"
>;

export type ProfilePerformance = {
  globalRank: number;
  currentTournamentRank: number;
  pnlPercent: number;
  pnlAmount: number;
  winRate: number;
  trades: number;
  profitFactor: number;
  maxDrawdownPercent: number;
  tournamentsPlayed: number;
  tournamentsWon: number;
  bestAsset: string;
};

export type ProfileMembership = {
  tier: "free" | "elite";
  status: "active" | "inactive" | "pending";
  renewsAt?: string;
  benefits: string[];
};

export type ProfileClan = {
  id?: string;
  slug?: string;
  name?: string;
  tag?: string;
  role?: "owner" | "captain" | "member";
  rank?: number;
  membersCount?: number;
};

export type ProfileMt5Account = {
  id: string;
  login: string;
  server: string;
  kind: "demo" | "funded";
  status: "connected" | "pending" | "suspended";
  equity: number;
  lastSyncAt: string;
};

export type ProfileTournamentSnapshot = {
  id: string;
  slug?: string;
  tournamentName: string;
  status: "live" | "upcoming" | "finished";
  rank: number;
  participants: number;
  scorePercent: number;
  prizeUsd: number;
  startedAt: string;
  endedAt?: string;
  result: "active" | "qualified" | "podium" | "eliminated";
};

export type ProfileVersusSnapshot = {
  id: string;
  opponentName: string;
  opponentHandle: string;
  status: "pending" | "live" | "finished";
  result: "win" | "loss" | "draw" | "active";
  stakeUsd: number;
  pnlPercent: number;
  score: number;
  opponentScore: number;
  playedAt: string;
};

export type ProfileClanWarSnapshot = {
  id: string;
  opponentClan: string;
  opponentTag: string;
  status: "scheduled" | "live" | "finished";
  result: "win" | "loss" | "draw" | "active";
  rankImpact: number;
  clanScore: number;
  opponentScore: number;
  playedAt: string;
};

export type ProfileTrade = {
  id: string;
  asset: string;
  side: "buy" | "sell";
  pnl: number;
  pnlPercent: number;
  closedAt: string;
};

export type ProfileDashboard = {
  trader: TraderProfile;
  wallet: ProfileWallet;
  performance: ProfilePerformance;
  membership: ProfileMembership;
  clan: ProfileClan | null;
  mt5Accounts: ProfileMt5Account[];
  tournaments: ProfileTournamentSnapshot[];
  versus: ProfileVersusSnapshot[];
  clanWars: ProfileClanWarSnapshot[];
  recentTrades: ProfileTrade[];
};
