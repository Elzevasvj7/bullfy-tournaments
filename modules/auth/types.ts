export type AuthVerificationChannel = "email" | "sms";

export type TournamentAuthUser = {
  id: string;
  email: string;
  phone: string;
  fullName: string;
  username: string;
  country?: string;
  avatarUrl?: string;
  bullfyPoints: number;
  bmoneyBalance: number;
  walletBalanceUsd: number;
  isElite: boolean;
  kycStatus: "none" | "pending" | "approved" | "rejected";
  referralCode: string;
};

export type TournamentAuthSession = {
  token: string;
  expiresAt: string;
  user: TournamentAuthUser;
};

export type CurrentSessionUser = {
  id: string;
  email: string;
  name: string;
  handle: string;
  clan?: string;
  avatarUrl?: string;
  avatar3dUrl?: string | null;
  avatarConfig?: Record<string, unknown> | null;
  avatarProvider?: string | null;
  avaturnUserId?: string | null;
  avaturnAvatarId?: string | null;
  preferredPose?: string | null;
  country?: string;
  membershipTier: "free" | "elite";
  membershipStatus: "active" | "inactive" | "pending";
  bullfyPoints: number;
  bmoneyBalance: number;
  walletBalanceUsd: number;
  referralCode: string;
  stats: {
    globalRank: number;
    currentTournamentRank: number;
    pnlAmount: number;
    pnlPercent: number;
    trades: number;
    winRate: number;
    tournamentsPlayed: number;
    tournamentsWon: number;
  };
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RequestRegistrationOtpInput = {
  email: string;
  phone: string;
  channel: AuthVerificationChannel;
};

export type VerifyRegistrationOtpInput = {
  email: string;
  phone: string;
  channel: AuthVerificationChannel;
  code: string;
};

export type RegisterInput = {
  email: string;
  phone: string;
  fullName: string;
  password: string;
  country: string;
  referredByCode?: string;
  emailCode: string;
  smsCode: string;
};
