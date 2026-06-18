"use client";

import type {
  LoginInput,
  RegisterInput,
  RequestRegistrationOtpInput,
  TournamentAuthSession,
  VerifyRegistrationOtpInput,
} from "../types";
import {
  mapLoginRequest,
  mapRegisterRequest,
  mapRequestRegistrationOtpRequest,
  mapTournamentAuthSession,
  mapVerifyRegistrationOtpRequest,
} from "./auth.mapper";
import {
  createMockSession,
  createRegisteredMockSession,
  mockOtpCode,
} from "./auth.mock";

export const tournamentSessionStorageKey = "tournament_session_token";

export async function loginTournamentUser(
  input: LoginInput,
): Promise<TournamentAuthSession> {
  const payload = mapLoginRequest(input);

  await simulateLatency();

  if (!payload.email || !payload.password) {
    throw new Error("Email y contraseña requeridos.");
  }

  return mapTournamentAuthSession(createMockSession({ email: payload.email }));
}

export async function requestRegistrationOtp(
  input: RequestRegistrationOtpInput,
): Promise<{ sent: true; via: "email" | "sms" | "email_fallback" }> {
  const payload = mapRequestRegistrationOtpRequest(input);

  await simulateLatency();

  if (payload.channel === "email" && !payload.email) {
    throw new Error("Email requerido.");
  }

  if (payload.channel === "sms" && !payload.phone) {
    throw new Error("Telefono requerido.");
  }

  return {
    sent: true,
    via: payload.channel === "sms" ? "email_fallback" : "email",
  };
}

export async function verifyRegistrationOtp(
  input: VerifyRegistrationOtpInput,
): Promise<{ verified: true }> {
  const payload = mapVerifyRegistrationOtpRequest(input);

  await simulateLatency();

  if (payload.code !== mockOtpCode) {
    throw new Error("Codigo incorrecto. Usa 123456 mientras no hay backend.");
  }

  return { verified: true };
}

export async function registerTournamentUser(
  input: RegisterInput,
): Promise<TournamentAuthSession> {
  const payload = mapRegisterRequest(input);

  await simulateLatency();

  if (!payload.email || !payload.phone || !payload.full_name) {
    throw new Error("Completa tus datos principales.");
  }

  if (input.password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }

  if (input.emailCode !== mockOtpCode || input.smsCode !== mockOtpCode) {
    throw new Error("Verifica ambos codigos antes de crear la cuenta.");
  }

  return mapTournamentAuthSession(
    createRegisteredMockSession({
      email: payload.email,
      phone: payload.phone,
      fullName: payload.full_name,
      country: payload.country ?? "",
    }),
  );
}

export function persistTournamentSession(session: TournamentAuthSession) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(tournamentSessionStorageKey, session.token);
}

async function simulateLatency() {
  await new Promise((resolve) => setTimeout(resolve, 350));
}
