export type ExternalTournamentAuthUserDto = {
  id: string;
  email: string;
  phone: string;
  full_name: string;
  username: string;
  country?: string | null;
  avatar_url?: string | null;
  bullfy_points: number;
  bmoney_balance: number;
  wallet_balance_usd: number;
  is_elite: boolean;
  kyc_status: "none" | "pending" | "approved" | "rejected";
  referral_code: string;
};

export type ExternalTournamentAuthSessionDto = {
  token: string;
  expires_at: string;
  user: ExternalTournamentAuthUserDto;
};

export type ExternalAuthResponseDto = {
  ok: boolean;
  error?: string;
  token?: string;
  user?: ExternalTournamentAuthUserDto;
  session?: ExternalTournamentAuthSessionDto;
};

export type ExternalOtpResponseDto = {
  ok: boolean;
  error?: string;
  sent?: boolean;
  verified?: boolean;
  via?: "email" | "sms" | "email_fallback";
};
