// Shared helpers for tournament auth + bridge edge functions
export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
export const ok = (b: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ ok: true, ...b }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
export const err = (m: string, extra: Record<string, unknown> = {}, status = 200) =>
  new Response(JSON.stringify({ ok: false, error: m, ...extra }), { status, headers: { ...cors, "Content-Type": "application/json" } });

export function randomToken(bytes = 32): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a).map((x) => x.toString(16).padStart(2, "0")).join("");
}

export async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const PBKDF2_ITER = 100_000;
export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITER, hash: "SHA-256" }, key, 256,
  );
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2$${PBKDF2_ITER}$${saltHex}$${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, iterStr, saltHex, hashHex] = stored.split("$");
    if (scheme !== "pbkdf2") return false;
    const iterations = parseInt(iterStr, 10);
    const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256,
    );
    const computed = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return computed === hashHex;
  } catch { return false; }
}

// Validate Bearer token against tournament_user_sessions and return user row
export async function requireTournamentUser(req: Request, supa: any): Promise<{ user: any | null; error?: string }> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return { user: null, error: "Sin token" };
  const { data: session } = await supa.from("tournament_user_sessions")
    .select("user_id, expires_at").eq("token", token).maybeSingle();
  if (!session) return { user: null, error: "Sesión inválida" };
  if (new Date(session.expires_at) < new Date()) return { user: null, error: "Sesión expirada" };
  const { data: user } = await supa.from("tournament_users").select("*").eq("id", session.user_id).maybeSingle();
  if (!user || user.banned_at) return { user: null, error: "Usuario no válido" };
  return { user };
}

// MT5 Bridge direct call (server-side, no admin proxy). Includes hard timeout to avoid hanging UI.
export async function bridgeCall(method: string, path: string, body?: unknown, timeoutMs = 25000): Promise<{ ok: boolean; status: number; data: any }> {
  const BRIDGE_URL = Deno.env.get("MT5_BRIDGE_URL");
  const BRIDGE_KEY = Deno.env.get("MT5_BRIDGE_API_KEY");
  if (!BRIDGE_URL || !BRIDGE_KEY) return { ok: false, status: 500, data: { error: "MT5 bridge no configurado" } };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${BRIDGE_URL.replace(/\/+$/, "")}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${BRIDGE_KEY}` },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    let data: any = {};
    try { data = await r.json(); } catch { /* ignore */ }
    return { ok: r.ok, status: r.status, data };
  } catch (e) {
    const msg = (e as Error)?.name === "AbortError"
      ? `Bridge MT5 no responde (timeout ${timeoutMs}ms en ${path})`
      : `Bridge MT5 inaccesible: ${(e as Error)?.message || "unknown"}`;
    return { ok: false, status: 504, data: { error: msg } };
  } finally {
    clearTimeout(timer);
  }
}

export function gen6(): string {
  const a = new Uint8Array(6); crypto.getRandomValues(a);
  return Array.from(a).map((x) => (x % 10).toString()).join("");
}

export function genRedemptionCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const a = new Uint8Array(12); crypto.getRandomValues(a);
  return Array.from(a).map((x) => chars[x % chars.length]).join("").replace(/(.{4})/g, "$1-").slice(0, 14);
}

// HMAC-SHA256 → hex. Auxiliar para verificar firmas de webhooks.
async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Verifica el header Stripe-Signature (HMAC-SHA256, tolerancia 5 min en el timestamp).
// Formato del header: "t=<unix>,v1=<hex>". Documentado en stripe.com/docs/webhooks/signatures
export async function verifyStripeSignature(
  body: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header || !secret) return false;
  const pairs: Record<string, string> = {};
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    pairs[part.slice(0, eq)] = part.slice(eq + 1);
  }
  const timestamp = pairs["t"];
  const sig = pairs["v1"];
  if (!timestamp || !sig) return false;
  // Tolerancia 5 min para protegerse de replay
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const computed = await hmacHex(secret, `${timestamp}.${body}`);
  return computed === sig;
}

// Guard para Edge Functions que solo deben ser llamadas desde cron jobs o
// herramientas internas con privilegios elevados.
//
// Acepta TRES formas (cualquiera basta):
//   1) Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
//        Útil para llamadas server-to-server desde infra de Supabase.
//   2) Authorization: Bearer <TOURNAMENT_CRON_SECRET>
//        Útil si quien llama puede setear el header completo libremente.
//   3) X-Cron-Secret: <TOURNAMENT_CRON_SECRET>
//        Útil para pg_cron: la `Authorization` queda libre para llevar el
//        anon JWT que el API gateway de Supabase exige (todas las funciones
//        con verify_jwt=true rechazan antes de llegar al código si no hay
//        JWT válido en Authorization). El secret va en este header
//        custom y nuestra función lo valida después del gateway.
//
// Devolver false → el caller debe rechazar con 403. Esto cierra endpoints
// que de otra forma serían públicos y permitirían DoS, recálculos forzados,
// o disparar liquidaciones a voluntad.
export function requireServiceRole(req: Request): boolean {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const customSecret = req.headers.get("x-cron-secret") || "";

  const cronSecret = Deno.env.get("TOURNAMENT_CRON_SECRET");
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (bearer && cronSecret && bearer === cronSecret) return true;
  if (bearer && svcKey && bearer === svcKey) return true;
  if (customSecret && cronSecret && customSecret === cronSecret) return true;
  return false;
}
