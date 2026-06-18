export type ClanRole = "owner" | "officer" | "member";

export type ClanWarStatus = "pending" | "accepted" | "in_progress" | "finished";

export type ClanMember = {
  id: string;
  name: string;
  handle: string;
  role: ClanRole;
  joinedAt: string;
  score: number;
  pnl: number;
  trades: number;
  winRate: number;
  verified: boolean;
};

export type ClanWar = {
  id: string;
  challengerClanId: string;
  defenderClanId: string;
  winnerClanId?: string;
  status: ClanWarStatus;
  stakeUsd: number;
  startedAt: string;
  endedAt?: string;
  minParticipants: number;
  durationMinutes: number;
};

export type Clan = {
  id: string;
  slug: string;
  name: string;
  tag: string;
  description: string;
  inviteCode: string;
  isPublic: boolean;
  isVerified: boolean;
  rating: number;
  rank: number;
  membersCount: number;
  warsWon: number;
  totalWars: number;
  avgMemberScore: number;
  totalScore: number;
  ownerId: string;
  createdAt: string;
  members: ClanMember[];
};

export type ClanDashboard = {
  clans: Clan[];
  wars: ClanWar[];
  currentUserClanId: string | null;
  currentUserId: string;
};

export type CreateClanInput = {
  name: string;
  tag: string;
  description: string;
  isPublic: boolean;
};
