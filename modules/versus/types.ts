export type VersusStatus =
  | "pending"
  | "accepted"
  | "live"
  | "finished"
  | "rejected"
  | "expired"
  | "cancelled";

export type VersusTrader = {
  id: string;
  name: string;
  username: string;
  clanTag?: string;
  verified: boolean;
  score: number;
  winRate: number;
};

export type VersusChallenge = {
  id: string;
  status: VersusStatus;
  challenger: VersusTrader;
  opponent?: VersusTrader;
  opponentEmail?: string;
  opponentUsernameHint?: string;
  winnerId?: string;
  inviteToken?: string;
  tournamentSlug?: string;
  stakeUsd: number;
  durationMinutes: number;
  message: string;
  createdAt: string;
  acceptedAt?: string;
  startsAt?: string;
  endsAt?: string;
  challengerScore: number;
  opponentScore: number;
};

export type VersusDashboard = {
  currentUserId: string;
  challenges: VersusChallenge[];
  suggestedOpponents: VersusTrader[];
};

export type CreateVersusInput = {
  opponentUsername?: string;
  opponentEmail?: string;
  stakeUsd: number;
  durationMinutes: number;
  message: string;
};
