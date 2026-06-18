import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import {
  DEMO_SESSION_AUDIENCE,
  DEMO_SESSION_COOKIE,
  DEMO_SESSION_DURATION_SECONDS,
  DEMO_SESSION_ISSUER,
} from "./demo-session.config";

export const DEFAULT_DEMO_TRADER_ID = "trader_nando";

export type DemoSessionPayload = {
  traderId: string;
  login: string;
  name: string;
  email: string;
};

function getSessionSecretKey() {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and be at least 32 chars.");
  }

  return new TextEncoder().encode(secret);
}

async function signDemoSession(payload: DemoSessionPayload) {
  const expiresAt = new Date(
    Date.now() + DEMO_SESSION_DURATION_SECONDS * 1000,
  );

  const token = await new SignJWT({
    traderId: payload.traderId,
    login: payload.login,
    name: payload.name,
    email: payload.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(DEMO_SESSION_ISSUER)
    .setAudience(DEMO_SESSION_AUDIENCE)
    .setExpirationTime(expiresAt)
    .sign(getSessionSecretKey());

  return { token, expiresAt };
}

async function verifyDemoSession(token: string | undefined) {
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getSessionSecretKey(), {
      audience: DEMO_SESSION_AUDIENCE,
      issuer: DEMO_SESSION_ISSUER,
    });

    if (
      typeof payload.traderId !== "string" ||
      typeof payload.login !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.email !== "string"
    ) {
      return null;
    }

    return {
      traderId: payload.traderId,
      login: payload.login,
      name: payload.name,
      email: payload.email,
    } satisfies DemoSessionPayload;
  } catch {
    return null;
  }
}

export async function getDemoSession() {
  const cookieStore = await cookies();

  return verifyDemoSession(cookieStore.get(DEMO_SESSION_COOKIE)?.value);
}

export async function setDemoSession(payload: DemoSessionPayload) {
  const cookieStore = await cookies();
  const { token, expiresAt } = await signDemoSession(payload);

  cookieStore.set(DEMO_SESSION_COOKIE, token, {
    expires: expiresAt,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function getCurrentDemoTraderId() {
  const session = await getDemoSession();

  return session?.traderId ?? DEFAULT_DEMO_TRADER_ID;
}

export async function setCurrentDemoTraderId(traderId: string) {
  await setDemoSession({
    email: "demo@bullfy.local",
    login: traderId,
    name: "Demo Trader",
    traderId,
  });
}

export async function clearDemoSession() {
  const cookieStore = await cookies();

  cookieStore.delete(DEMO_SESSION_COOKIE);
}

export async function clearCurrentDemoTraderId() {
  await clearDemoSession();
}
