// Polls Bridge MT5 Bullfy for every active stream account and upserts into
// `bridge_account_snapshot`. Designed to be invoked every ~1s by pg_cron.
// Skips accounts updated < 800ms ago to avoid duplicate work on overlapping ticks.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ok = (body: Record<string, unknown>) =>
  new Response(JSON.stringify({ ok: true, ...body }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
const fail = (error: string, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ ok: false, error, ...extra }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ── Bridge helpers (mirror the trading-room-client logic, kept inline so this
//    function has zero cross-file deps and can run on its own cron tick) ──────
type BridgePosition = Record<string, unknown> & { state?: unknown; status?: unknown; reason?: unknown };
type BridgeAccountInfo = { balance?: unknown; equity?: unknown; margin?: unknown; margin_free?: unknown; marginFree?: unknown };

const BRIDGE_URL = (Deno.env.get("MT5_BRIDGE_URL") ?? "").replace(/\/+$/, "");
const BRIDGE_KEY = Deno.env.get("MT5_BRIDGE_API_KEY") ?? "";

async function bridgeFetch<T>(method: string, path: string): Promise<T> {
  const res = await fetch(BRIDGE_URL + path, {
    method,
    headers: { Authorization: `Bearer ${BRIDGE_KEY}`, "Content-Type": "application/json" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Bridge ${res.status}: ${text.slice(0, 200)}`);
  return text ? (JSON.parse(text) as T) : ({} as T);
}

function firstDefined<T>(...values: T[]): T | undefined {
  return values.find((v) => v !== undefined && v !== null && v !== "") as T | undefined;
}
function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) { const n = Number(v); return Number.isFinite(n) ? n : null; }
  return null;
}
function bridgeTimestamp(value: unknown): string | null {
  if (typeof value === "string") {
    const t = value.trim(); if (!t) return null;
    const n = Number(t);
    if (Number.isFinite(n)) return new Date(n > 1e12 ? n : n * 1000).toISOString();
    return t;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value > 1e12 ? value : value * 1000).toISOString();
  }
  return null;
}
function normalizeVolume(v: unknown): number | null {
  const raw = toNum(v); if (raw === null) return null;
  return Number.isInteger(raw) && Math.abs(raw) >= 100 ? raw / 10000 : raw;
}
function mapType(action: unknown): string {
  const n = typeof action === "string" ? action.trim().toUpperCase() : action;
  if (n === "BUY" || n === "POSITION_TYPE_BUY") return "POSITION_TYPE_BUY";
  if (n === "SELL" || n === "POSITION_TYPE_SELL") return "POSITION_TYPE_SELL";
  if (n === "ORDER_TYPE_BUY" || n === "MARKET_BUY") return "POSITION_TYPE_BUY";
  if (n === "ORDER_TYPE_SELL" || n === "MARKET_SELL") return "POSITION_TYPE_SELL";
  const a = typeof n === "string" ? Number(n) : n;
  if (a === 0) return "POSITION_TYPE_BUY";
  if (a === 1) return "POSITION_TYPE_SELL";
  return typeof action === "string" ? action : "—";
}
function extractType(p: BridgePosition): unknown {
  const explicit = firstDefined(p.action, p.Action, p.type, p.Type, p.order_type, p.side, p.cmd, p.Cmd);
  if (explicit !== undefined) return explicit;
  for (const [key, value] of Object.entries(p)) {
    if (!/(action|type|side|cmd)/i.test(key)) continue;
    const mapped = mapType(value);
    if (mapped === "POSITION_TYPE_BUY" || mapped === "POSITION_TYPE_SELL") return value;
  }
  return undefined;
}
function extract(value: unknown, depth = 0): BridgePosition[] {
  if (Array.isArray(value)) return value as BridgePosition[];
  if (!value || typeof value !== "object" || depth > 3) return [];
  const r = value as Record<string, unknown>;
  for (const k of ["positions", "data", "items", "result", "results", "open_positions", "openPositions"]) {
    const nested = extract(r[k], depth + 1);
    if (nested.length) return nested;
  }
  const arr = Object.values(r).find(Array.isArray);
  return Array.isArray(arr) ? (arr as BridgePosition[]) : [];
}
function isOpen(p: BridgePosition): boolean {
  const s = String(firstDefined(p.state, p.status, p.reason) ?? "").toLowerCase();
  if (!s) return true;
  return !/(closed|close|cancel|filled|history|deleted|expired|rejected)/.test(s);
}
function mapPositions(raws: BridgePosition[]) {
  return raws
    .map((p: any) => {
      const id = firstDefined(p.position, p.position_id, p.ticket, p.order, p.id, p.Position, p.PositionID, p.PositionId, p.Ticket, p.Order);
      return {
        id: String(id ?? ""),
        symbol: String(firstDefined(p.symbol, p.Symbol) ?? "—"),
        type: mapType(extractType(p)),
        volume: normalizeVolume(firstDefined(p.volume, p.volume_current, p.volume_initial, p.Volume, p.VolumeCurrent, p.VolumeInitial)),
        open_price: toNum(firstDefined(p.price_open, p.PriceOpen, p.price, p.Price)),
        current_price: toNum(firstDefined(p.price_current, p.PriceCurrent, p.price_open, p.PriceOpen, p.price, p.Price)),
        profit: toNum(firstDefined(p.profit, p.Profit)),
        opened_at: bridgeTimestamp(firstDefined(p.time_create, p.TimeCreate)),
        updated_at: bridgeTimestamp(firstDefined(p.time_update, p.TimeUpdate)),
        comment: firstDefined(p.comment, p.Comment) ?? null,
      };
    })
    .filter((p) => p.id.length > 0);
}

async function fetchPositions(login: string) {
  const direct = extract(await bridgeFetch<unknown>("GET", `/users/${login}/positions`));
  if (direct.length) return direct;
  try {
    const orders = extract(await bridgeFetch<unknown>("GET", `/users/${login}/orders`));
    return orders.filter(isOpen);
  } catch (_) { return []; }
}

async function sha(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface AccountRow {
  id: string; bridge_login: string | null; partner_user_id: string; portal_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!BRIDGE_URL || !BRIDGE_KEY) return fail("Bridge no configurado");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const t0 = Date.now();
  const { data: accounts, error } = await supabase
    .from("trading_room_accounts")
    .select("id, bridge_login, partner_user_id, portal_id, updated_at")
    .eq("provider", "bridge")
    .eq("is_active_for_stream", true)
    .not("bridge_login", "is", null)
    .returns<AccountRow[]>();

  if (error) return fail(error.message);
  if (!accounts?.length) return ok({ polled: 0, ms: Date.now() - t0 });

  // Skip accounts updated <800ms ago (overlap protection)
  const { data: recent } = await supabase
    .from("bridge_account_snapshot")
    .select("account_id, updated_at")
    .in("account_id", accounts.map((a) => a.id));
  const recentMap = new Map<string, number>();
  (recent ?? []).forEach((r: any) => recentMap.set(r.account_id, new Date(r.updated_at).getTime()));

  const due = accounts.filter((a) => (Date.now() - (recentMap.get(a.id) ?? 0)) >= 800);

  // Fetch in parallel (capped at 8 concurrent to stay polite to the Bridge)
  const CONCURRENCY = 8;
  let polled = 0, changed = 0, errors = 0;

  for (let i = 0; i < due.length; i += CONCURRENCY) {
    const batch = due.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (acc) => {
      const login = acc.bridge_login as string;
      try {
        const [info, posRaw] = await Promise.all([
          bridgeFetch<BridgeAccountInfo>("GET", `/accounts/${login}`).catch(() => ({} as BridgeAccountInfo)),
          fetchPositions(login),
        ]);
        const positions = mapPositions(posRaw);
        const balance = toNum(info.balance);
        const equity = toNum((info as any).equity);
        const margin = toNum(info.margin);
        const free_margin = toNum(firstDefined(info.margin_free, info.marginFree));

        const payload = JSON.stringify({ balance, equity, margin, free_margin, positions });
        const hash = await sha(payload);

        const prev = (recent ?? []).find((r: any) => r.account_id === acc.id) as any;
        if (prev?.payload_hash === hash) {
          // Touch updated_at so we know it was polled recently (without firing a realtime change).
          await supabase.from("bridge_account_snapshot")
            .update({ updated_at: new Date().toISOString(), fetch_error: null })
            .eq("account_id", acc.id);
          polled++;
          return;
        }

        const { error: upErr } = await supabase
          .from("bridge_account_snapshot")
          .upsert({
            account_id: acc.id,
            bridge_login: login,
            partner_user_id: acc.partner_user_id,
            portal_id: acc.portal_id,
            balance, equity, margin, free_margin,
            open_positions: positions,
            payload_hash: hash,
            fetch_error: null,
            updated_at: new Date().toISOString(),
          }, { onConflict: "account_id" });
        if (upErr) { errors++; return; }
        polled++; changed++;
      } catch (e) {
        errors++;
        await supabase.from("bridge_account_snapshot")
          .upsert({
            account_id: acc.id,
            bridge_login: login,
            partner_user_id: acc.partner_user_id,
            portal_id: acc.portal_id,
            fetch_error: (e as Error).message.slice(0, 250),
            updated_at: new Date().toISOString(),
          }, { onConflict: "account_id" });
      }
    }));
  }

  return ok({ active: accounts.length, polled, changed, errors, ms: Date.now() - t0 });
});
