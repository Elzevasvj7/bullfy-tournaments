import type {
  ExternalTournamentAuthSessionDto,
  ExternalTournamentAuthUserDto,
} from "./auth.contracts";

const mockUser: ExternalTournamentAuthUserDto = {
  id: "trader_karlos",
  email: "karlos@bullfy.local",
  phone: "+584121234567",
  full_name: "Karlos Guzman",
  username: "karlosg",
  country: "VE",
  avatar_url: undefined,
  bullfy_points: 538,
  bmoney_balance: 1680,
  wallet_balance_usd: 0,
  is_elite: false,
  kyc_status: "none",
  referral_code: "KG2026",
};

export const mockOtpCode = "123456";

export function createMockSession(
  override?: Partial<ExternalTournamentAuthUserDto>,
): ExternalTournamentAuthSessionDto {
  return {
    token: "mock-tournament-session-token",
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    user: {
      ...mockUser,
      ...override,
    },
  };
}

export function createRegisteredMockSession(input: {
  email: string;
  phone: string;
  fullName: string;
  country: string;
}): ExternalTournamentAuthSessionDto {
  const usernameBase =
    input.fullName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 18) || "trader";

  return createMockSession({
    id: `trader_${Date.now().toString(36)}`,
    email: input.email,
    phone: input.phone,
    full_name: input.fullName,
    username: usernameBase,
    country: input.country,
    bullfy_points: 0,
    bmoney_balance: 2000,
    wallet_balance_usd: 0,
    referral_code: `${usernameBase.slice(0, 2).toUpperCase()}${Math.floor(
      1000 + Math.random() * 9000,
    )}`,
  });
}
