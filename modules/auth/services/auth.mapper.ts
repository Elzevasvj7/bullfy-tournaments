import type {
  LoginInput,
  RegisterInput,
  RequestRegistrationOtpInput,
  TournamentAuthSession,
  TournamentAuthUser,
  VerifyRegistrationOtpInput,
} from "../types";
import type {
  ExternalTournamentAuthSessionDto,
  ExternalTournamentAuthUserDto,
} from "./auth.contracts";

export function mapTournamentAuthUser(
  dto: ExternalTournamentAuthUserDto,
): TournamentAuthUser {
  return {
    id: dto.id,
    email: dto.email,
    phone: dto.phone,
    fullName: dto.full_name,
    username: dto.username,
    country: dto.country ?? undefined,
    avatarUrl: dto.avatar_url ?? undefined,
    bullfyPoints: dto.bullfy_points,
    bmoneyBalance: dto.bmoney_balance,
    walletBalanceUsd: dto.wallet_balance_usd,
    isElite: dto.is_elite,
    kycStatus: dto.kyc_status,
    referralCode: dto.referral_code,
  };
}

export function mapTournamentAuthSession(
  dto: ExternalTournamentAuthSessionDto,
): TournamentAuthSession {
  return {
    token: dto.token,
    expiresAt: dto.expires_at,
    user: mapTournamentAuthUser(dto.user),
  };
}

export function mapLoginRequest(input: LoginInput) {
  return {
    email: input.email.trim().toLowerCase(),
    password: input.password,
  };
}

export function mapRequestRegistrationOtpRequest(
  input: RequestRegistrationOtpInput,
) {
  return {
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    channel: input.channel,
    purpose:
      input.channel === "email" ? "registration_email" : "registration_sms",
    fallback_to_email: input.channel === "sms",
  };
}

export function mapVerifyRegistrationOtpRequest(
  input: VerifyRegistrationOtpInput,
) {
  return {
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    code: input.code.trim(),
    purpose:
      input.channel === "email" ? "registration_email" : "registration_sms",
  };
}

export function mapRegisterRequest(input: RegisterInput) {
  return {
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    full_name: input.fullName.trim(),
    password: input.password,
    country: input.country.trim() || null,
    referred_by_code: input.referredByCode?.trim().toUpperCase() || null,
  };
}
