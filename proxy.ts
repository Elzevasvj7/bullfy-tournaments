import { jwtVerify } from "jose";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  DEMO_SESSION_AUDIENCE,
  DEMO_SESSION_COOKIE,
  DEMO_SESSION_ISSUER,
} from "@/modules/demo/demo-session.config";

const PRIVATE_PAGE_PREFIXES = [
  "/chat",
  "/clans/create",
  "/profile",
  "/tournaments/create",
  "/wallet",
];

const PROTECTED_DEMO_API_SEGMENTS = [
  "/join",
  "/mt5-account",
  "/orders",
  "/positions/",
];

function getSessionSecretKey() {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    return null;
  }

  return new TextEncoder().encode(secret);
}

async function hasValidDemoSession(request: NextRequest) {
  const token = request.cookies.get(DEMO_SESSION_COOKIE)?.value;
  const secretKey = getSessionSecretKey();

  if (!token || !secretKey) {
    return false;
  }

  try {
    await jwtVerify(token, secretKey, {
      audience: DEMO_SESSION_AUDIENCE,
      issuer: DEMO_SESSION_ISSUER,
    });

    return true;
  } catch {
    return false;
  }
}

function isPrivatePage(pathname: string) {
  if (PRIVATE_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }

  return pathname.startsWith("/tournaments/") && !pathname.endsWith("/tv");
}

function isProtectedDemoApi(pathname: string) {
  if (!pathname.startsWith("/api/demo/tournaments/")) {
    return false;
  }

  return PROTECTED_DEMO_API_SEGMENTS.some((segment) =>
    pathname.includes(segment),
  );
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  const currentPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  loginUrl.searchParams.set("next", currentPath);

  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = await hasValidDemoSession(request);

  if (pathname === "/login" && isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isProtectedDemoApi(pathname) && !isAuthenticated) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  if (isPrivatePage(pathname) && !isAuthenticated) {
    return redirectToLogin(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/chat/:path*",
    "/clans/create/:path*",
    "/profile/:path*",
    "/tournaments/:path*",
    "/wallet/:path*",
    "/api/demo/tournaments/:path*",
  ],
};
