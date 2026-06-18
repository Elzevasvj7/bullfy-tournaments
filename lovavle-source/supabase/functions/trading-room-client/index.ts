import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.24.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const METAAPI_PROVISIONING_BASE = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";
const METAAPI_CLIENT_BASE = "https://mt-client-api-v1.new-york.agiliumtrade.ai";
const METAAPI_API_TOKEN = Deno.env.get("METAAPI_API_TOKEN") ?? "";
const ALLOWED_BROKER_SERVER = "Bullfy-Trade";
const ALWAYS_ON_TEST_EMAIL = "ebarrantes+10@bullfy.com";

const baseSchema = z.object({
  portal_id: z.string().uuid(),
  partner_user_id: z.string().uuid(),
});

const requestSchema = z.discriminatedUnion("action", [
  baseSchema.extend({ action: z.literal("get_state") }),
  baseSchema.extend({ action: z.literal("close_all_positions") }),
  baseSchema.extend({
    action: z.literal("search_symbols"),
    query: z.string().trim().max(30).optional().default(""),
  }),
  baseSchema.extend({
    action: z.literal("toggle_favorite_symbol"),
    symbol: z.string().trim().min(1).max(40),
    display_name: z.string().trim().max(80).optional().nullable(),
    enabled: z.boolean(),
  }),
  baseSchema.extend({ action: z.literal("set_plan"), plan_id: z.string().uuid() }),
  baseSchema.extend({
    action: z.literal("save_account"),
    provider: z.enum(["metaapi", "bridge"]).optional().default("metaapi"),
    mt_login: z.string().trim().min(1).max(64),
    mt_password: z.string().trim().min(1).max(120),
    broker_server: z.string().min(1).max(64).default(ALLOWED_BROKER_SERVER),
    selected_session_key: z.enum(["stream_only", "ny", "london", "hk"]),
  }),
  baseSchema.extend({
    action: z.literal("create_intent"),
    side: z.enum(["buy", "sell"]),
    symbol: z.string().trim().min(1).max(20),
    lot_size: z.number().positive().max(100),
    stop_loss: z.number().nullable().optional(),
    take_profit: z.number().nullable().optional(),
    source: z.enum(["dashboard", "stream_overlay"]),
    room_id: z.string().uuid().optional().nullable(),
  }),
  baseSchema.extend({
    action: z.literal("get_stream_positions"),
    room_id: z.string().uuid().optional().nullable(),
    include_all: z.boolean().optional(),
  }),
  baseSchema.extend({
    action: z.literal("get_host_room_positions"),
    room_id: z.string().uuid(),
  }),
  baseSchema.extend({
    action: z.literal("close_position"),
    position_id: z.string().trim().min(1).max(64),
    room_id: z.string().uuid().optional().nullable(),
  }),
  baseSchema.extend({ action: z.literal("request_analysis") }),
  baseSchema.extend({ action: z.literal("get_risk_calc_data") }),
  baseSchema.extend({
    action: z.literal("get_quote"),
    symbol: z.string().trim().min(1).max(40),
  }),
  baseSchema.extend({
    action: z.literal("set_active_account"),
    provider: z.enum(["metaapi", "bridge"]),
  }),
  baseSchema.extend({ action: z.literal("get_account_status") }),
]);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type SupabaseClient = ReturnType<typeof createClient>;

interface MetaApiProvisioningAccount {
  id?: string;
  _id?: string;
  login?: string | number;
  name?: string;
  server?: string;
  state?: string;
  connectionStatus?: string;
  reliability?: string;
  region?: string;
  version?: number;
  tags?: string[];
}

interface MetaApiTradeResponse {
  numericCode?: number;
  stringCode?: string;
  message?: string;
  orderId?: string | number;
  positionId?: string | number;
  closeByPositionId?: string | number;
}

interface MetaApiAccountInformation {
  balance?: number | string;
  equity?: number | string;
  margin?: number | string;
  freeMargin?: number | string;
  currency?: string;
}

interface MetaApiPosition {
  id?: string | number;
  symbol?: string;
  type?: string;
  volume?: number | string;
  openPrice?: number | string;
  currentPrice?: number | string;
  profit?: number | string;
  time?: string;
  updateTime?: string;
  comment?: string;
}

interface TradingRoomFavoriteSymbol {
  id: string;
  symbol: string;
  display_name: string | null;
}

interface TradingRoomBrokerSymbol {
  symbol: string;
  display_name: string;
}

type SubscriptionAccessRow = {
  access_status?: string | null;
} | null;

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  if (err && typeof err === "object") {
    const maybeError = err as { message?: unknown; error?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [maybeError.message, maybeError.error, maybeError.details, maybeError.hint, maybeError.code]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0);

    if (parts.length > 0) return parts.join(" · ");
  }
  return "Error interno";
}

function ensureMetaApiConfigured() {
  if (!METAAPI_API_TOKEN) {
    throw new Error("MetaApi aún no está configurado en el backend");
  }
}

const METAAPI_TIMEOUT_MS = 12000;

async function metaApiFetch<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  ensureMetaApiConfigured();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), METAAPI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "auth-token": METAAPI_API_TOKEN,
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if ((err as Error).name === "AbortError") {
      throw new Error(`MetaApi timeout (${METAAPI_TIMEOUT_MS}ms) en ${path}`);
    }
    throw err;
  }
  clearTimeout(timeoutId);

  const raw = await response.text();
  let parsed: Record<string, unknown> | null = null;

  if (raw) {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const message =
      (typeof parsed?.message === "string" && parsed.message) ||
      (typeof parsed?.error === "string" && parsed.error) ||
      raw ||
      `MetaApi error ${response.status}`;
    throw new Error(message);
  }

  return parsed as T;
}

function mapMetaApiConnectionStatus(account?: MetaApiProvisioningAccount | null) {
  if (!account) return "not_connected";

  const state = (account.state || "").toUpperCase();
  const connection = (account.connectionStatus || "").toUpperCase();

  if (connection === "CONNECTED") return "connected";
  if (state === "DEPLOYING") return "pending";
  if (state === "DEPLOYED" && connection !== "CONNECTED") return "pending";
  if (state === "UNDEPLOYED") return "pending";
  if (state === "DELETING") return "paused";

  const normalizedConnection = connection.toLowerCase();
  if (["not_connected", "pending", "connected", "paused", "error"].includes(normalizedConnection)) {
    return normalizedConnection;
  }

  return "error";
}

function getMetaApiAccountId(account?: MetaApiProvisioningAccount | null) {
  return account?.id || account?._id || null;
}

function normalizeTradeFailure(reason: unknown) {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  return "No se pudo ejecutar la orden en MetaApi";
}

function buildTradePayload(payload: z.infer<typeof requestSchema> & { action: "create_intent" }) {
  return {
    actionType: payload.side === "buy" ? "ORDER_TYPE_BUY" : "ORDER_TYPE_SELL",
    symbol: payload.symbol,
    volume: payload.lot_size,
    stopLoss: payload.stop_loss ?? undefined,
    takeProfit: payload.take_profit ?? undefined,
  };
}

async function fetchMetaApiAccount(accountId: string) {
  return await metaApiFetch<MetaApiProvisioningAccount>(
    METAAPI_PROVISIONING_BASE,
    `/users/current/accounts/${accountId}`,
    { method: "GET" },
  );
}

async function fetchMetaApiAccountInformation(accountId: string) {
  return await metaApiFetch<MetaApiAccountInformation>(
    METAAPI_CLIENT_BASE,
    `/users/current/accounts/${accountId}/account-information`,
    { method: "GET" },
  );
}

async function fetchMetaApiSymbols(accountId: string) {
  return await metaApiFetch<string[]>(
    METAAPI_CLIENT_BASE,
    `/users/current/accounts/${accountId}/symbols`,
    { method: "GET" },
  );
}

async function fetchMetaApiPositions(accountId: string) {
  return await metaApiFetch<MetaApiPosition[]>(
    METAAPI_CLIENT_BASE,
    `/users/current/accounts/${accountId}/positions`,
    { method: "GET" },
  );
}

// ============================================================================
// MT5 Bridge Bullfy provider — alternative to MetaAPI
// ============================================================================
const BRIDGE_URL = (Deno.env.get("MT5_BRIDGE_URL") ?? "").replace(/\/+$/, "");
const BRIDGE_API_KEY = Deno.env.get("MT5_BRIDGE_API_KEY") ?? "";
const BRIDGE_TIMEOUT_MS = 15000;

function ensureBridgeConfigured() {
  if (!BRIDGE_URL || !BRIDGE_API_KEY) {
    throw new Error("Bridge MT5 Bullfy no está configurado en el backend");
  }
}

async function bridgeFetch<T>(method: string, path: string, body?: Record<string, unknown>): Promise<T> {
  ensureBridgeConfigured();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BRIDGE_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BRIDGE_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${BRIDGE_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: method !== "GET" && method !== "DELETE" && body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if ((err as Error).name === "AbortError") {
      throw new Error(`Bridge MT5 timeout (${BRIDGE_TIMEOUT_MS}ms) en ${path}`);
    }
    throw err;
  }
  clearTimeout(timeoutId);
  const raw = await res.text();
  let parsed: unknown = null;
  if (raw) { try { parsed = JSON.parse(raw); } catch { parsed = raw; } }
  if (!res.ok) {
    const msg =
      (parsed && typeof parsed === "object" && "detail" in parsed && typeof (parsed as { detail: unknown }).detail === "string"
        ? String((parsed as { detail: string }).detail)
        : null) ||
      (parsed && typeof parsed === "object" && "message" in parsed && typeof (parsed as { message: unknown }).message === "string"
        ? String((parsed as { message: string }).message)
        : null) ||
      (typeof parsed === "string" ? parsed : null) ||
      `Bridge MT5 error ${res.status}`;
    throw new Error(msg);
  }
  return parsed as T;
}

interface BridgeAccountInfo {
  balance?: number; equity?: number; margin?: number; margin_free?: number;
  currency?: string; profit?: number; [k: string]: unknown;
}
interface BridgeUserInfo { login?: number | string; name?: string; group?: string; enabled?: boolean; [k: string]: unknown }
interface BridgePosition {
  ticket?: number | string; order?: number | string; position?: number | string; position_id?: number | string; id?: number | string;
  Ticket?: number | string; Order?: number | string; Position?: number | string; PositionID?: number | string; PositionId?: number | string;
  symbol?: string; Symbol?: string; action?: number | string; Action?: number | string; type?: number | string; Type?: number | string; order_type?: number | string; side?: number | string; cmd?: number | string; Cmd?: number | string;
  volume?: number | string; volume_current?: number | string; volume_initial?: number | string; Volume?: number | string; VolumeCurrent?: number | string; VolumeInitial?: number | string;
  price?: number | string; price_open?: number | string; price_current?: number | string; price_sl?: number | string; price_tp?: number | string;
  Price?: number | string;
  PriceOpen?: number | string; PriceCurrent?: number | string; PriceSL?: number | string; PriceTP?: number | string;
  profit?: number | string; Profit?: number | string;
  time_create?: string | number; time_update?: string | number; TimeCreate?: string | number; TimeUpdate?: string | number;
  comment?: string; Comment?: string; state?: string; status?: string; reason?: string;
  sl?: number; tp?: number;
  [k: string]: unknown;
}

async function fetchBridgeUser(login: string) {
  return await bridgeFetch<BridgeUserInfo>("GET", `/users/${login}`);
}

// Validates the user's MT5 main password against the broker via the Bridge.
// Returns:
//   { ok: true }                              → password is valid
//   { ok: false, reason: "invalid" }          → broker rejected credentials
//   { ok: false, reason: "unsupported" }      → endpoint not exposed by Bridge (cannot verify)
//   { ok: false, reason: "error", message }   → transport / unexpected error
async function verifyBridgePassword(login: string, password: string): Promise<
  { ok: true } | { ok: false; reason: "invalid" | "unsupported" | "error"; message?: string }
> {
  ensureBridgeConfigured();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BRIDGE_TIMEOUT_MS);
  let res: Response;
  try {
    const loginNum = Number(login);
    const loginPath = Number.isFinite(loginNum) ? loginNum : login;
    res = await fetch(`${BRIDGE_URL}/users/${loginPath}/password/check`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${BRIDGE_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      // Per Bridge OpenAPI: CheckPasswordRequest = { password: string, investor?: boolean }
      // investor=false validates the master (trading) password.
      body: JSON.stringify({ password, investor: false }),
    });
  } catch (err) {
    clearTimeout(timeoutId);
    return { ok: false, reason: "error", message: (err as Error).message };
  }
  clearTimeout(timeoutId);
  const raw = await res.text().catch(() => "");
  if (res.ok) {
    // Some implementations return { valid: true|false } with HTTP 200 instead of 4xx
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object" && "valid" in parsed && (parsed as { valid: unknown }).valid === false) {
        return { ok: false, reason: "invalid" };
      }
    } catch { /* ignore */ }
    return { ok: true };
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, reason: "invalid" };
  }
  if (res.status === 404 || res.status === 405 || res.status === 501) {
    return { ok: false, reason: "unsupported" };
  }
  return { ok: false, reason: "error", message: `Bridge HTTP ${res.status}: ${raw.slice(0, 200)}` };
}
async function fetchBridgeAccount(login: string) {
  return await bridgeFetch<BridgeAccountInfo>("GET", `/accounts/${login}`);
}
async function fetchBridgePositions(login: string): Promise<BridgePosition[]> {
  const res = await bridgeFetch<unknown>("GET", `/users/${login}/positions`);
  const extracted = extractBridgePositions(res);
  if (extracted.length > 0) return extracted;
  // Bridge builds after May 2026 can expose the live trade rows through `/orders`
  // while `/positions` returns an empty array. Use it as a safe display fallback.
  try {
    const orders = extractBridgePositions(await bridgeFetch<unknown>("GET", `/users/${login}/orders`));
    return orders.filter(isBridgeOpenOrderLike);
  } catch (_) { /* positions endpoint remains authoritative when orders are unavailable */ }
  return [];
}

function extractBridgePositions(value: unknown, depth = 0): BridgePosition[] {
  if (Array.isArray(value)) return value as BridgePosition[];
  if (!value || typeof value !== "object" || depth > 3) return [];
  const record = value as Record<string, unknown>;
  const containers = ["positions", "data", "items", "result", "results", "open_positions", "openPositions"];
  for (const key of containers) {
    const nested = extractBridgePositions(record[key], depth + 1);
    if (nested.length > 0) return nested;
  }
  const objectValues = Object.entries(record)
    .filter(([, item]) => item && typeof item === "object" && !Array.isArray(item))
    .map(([key, item]) => ({ ticket: key, ...(item as Record<string, unknown>) }) as BridgePosition);
  if (objectValues.some((item) => firstDefined(item.position, item.position_id, item.ticket, item.order, item.id, item.Position, item.PositionID, item.PositionId, item.Ticket, item.Order) && firstDefined(item.symbol, item.Symbol))) {
    return objectValues;
  }
  const firstArray = Object.values(record).find(Array.isArray);
  if (Array.isArray(firstArray)) return firstArray as BridgePosition[];
  return [];
}

function mapBridgePositionType(action: number | string | undefined): string {
  // MT5: 0=BUY, 1=SELL for positions
  const normalized = typeof action === "string" ? action.trim().toUpperCase() : action;
  if (normalized === "BUY" || normalized === "POSITION_TYPE_BUY") return "POSITION_TYPE_BUY";
  if (normalized === "SELL" || normalized === "POSITION_TYPE_SELL") return "POSITION_TYPE_SELL";
  if (normalized === "ORDER_TYPE_BUY" || normalized === "MARKET_BUY") return "POSITION_TYPE_BUY";
  if (normalized === "ORDER_TYPE_SELL" || normalized === "MARKET_SELL") return "POSITION_TYPE_SELL";
  const a = typeof normalized === "string" ? Number(normalized) : normalized;
  if (a === 0) return "POSITION_TYPE_BUY";
  if (a === 1) return "POSITION_TYPE_SELL";
  return typeof action === "string" ? action : "—";
}

function extractBridgePositionType(p: BridgePosition): number | string | undefined {
  const explicit = firstDefined(p.action, p.Action, p.type, p.Type, p.order_type, p.side, p.cmd, p.Cmd);
  if (explicit !== undefined) return explicit;
  for (const [key, value] of Object.entries(p)) {
    const normalizedKey = key.toLowerCase();
    if (!/(action|type|side|cmd)/.test(normalizedKey)) continue;
    const mapped = mapBridgePositionType(value as number | string | undefined);
    if (mapped === "POSITION_TYPE_BUY" || mapped === "POSITION_TYPE_SELL") return value as number | string;
  }
  return undefined;
}

function firstDefined<T>(...values: T[]): T | undefined {
  return values.find((value) => value !== undefined && value !== null && value !== "") as T | undefined;
}

function isBridgeOpenOrderLike(p: BridgePosition): boolean {
  const state = String(firstDefined(p.state, p.status, p.reason) ?? "").toLowerCase();
  if (!state) return true;
  return !/(closed|close|cancel|filled|history|deleted|expired|rejected)/.test(state);
}

function bridgeTimestamp(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) return new Date((numeric > 1_000_000_000_000 ? numeric : numeric * 1000)).toISOString();
    return trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date((value > 1_000_000_000_000 ? value : value * 1000)).toISOString();
  }
  return null;
}

function normalizeBridgeVolume(value: unknown): number | null {
  const raw = toNullableNumber(value);
  if (raw === null) return null;
  // MT5 Manager often returns volume in 1/10000 lot units (0.10 lot => 1000).
  return Number.isInteger(raw) && Math.abs(raw) >= 100 ? raw / 10000 : raw;
}

function mapBridgeOpenPositions(positions: BridgePosition[]) {
  return positions
    .map((p) => {
      const id = firstDefined(p.position, p.position_id, p.ticket, p.order, p.id, p.Position, p.PositionID, p.PositionId, p.Ticket, p.Order);
      return {
        id: String(id ?? ""),
        symbol: String(firstDefined(p.symbol, p.Symbol) ?? "—"),
        type: mapBridgePositionType(extractBridgePositionType(p)),
        volume: normalizeBridgeVolume(firstDefined(p.volume, p.volume_current, p.volume_initial, p.Volume, p.VolumeCurrent, p.VolumeInitial)),
        open_price: toNullableNumber(firstDefined(p.price_open, p.PriceOpen, p.price, p.Price)),
        current_price: toNullableNumber(firstDefined(p.price_current, p.PriceCurrent, p.price_open, p.PriceOpen, p.price, p.Price)),
        profit: toNullableNumber(firstDefined(p.profit, p.Profit)),
        opened_at: bridgeTimestamp(firstDefined(p.time_create, p.TimeCreate)),
        updated_at: bridgeTimestamp(firstDefined(p.time_update, p.TimeUpdate)),
        comment: firstDefined(p.comment, p.Comment) ?? null,
      };
    })
    .filter((p) => p.id.length > 0);
}

async function bridgeCreateOrder(login: string, params: { side: "buy" | "sell"; symbol: string; volume: number; sl?: number | null; tp?: number | null }) {
  return await bridgeFetch<unknown>("POST", `/users/${login}/orders`, {
    symbol: params.symbol,
    type: params.side === "buy" ? 0 : 1, // market BUY/SELL
    volume: params.volume,
    sl: params.sl ?? undefined,
    tp: params.tp ?? undefined,
    comment: "Bullfy Trading Room",
  });
}

async function bridgeClosePosition(login: string, ticket: string | number) {
  return await bridgeFetch<unknown>("POST", `/users/${login}/positions/${ticket}/close`, {
    volume: null,
    comment: "Closed via Bullfy",
  });
}

async function bridgeCloseAll(login: string) {
  return await bridgeFetch<unknown>("POST", `/users/${login}/positions/close-all`, {});
}
function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function mapBrokerSymbols(symbols: string[]) {
  return symbols
    .map((symbol) => normalizeSymbol(symbol))
    .filter((symbol, index, list) => symbol.length > 0 && list.indexOf(symbol) === index)
    .sort((a, b) => a.localeCompare(b))
    .map((symbol) => ({ symbol, display_name: symbol }));
}

function filterBrokerSymbols(symbols: TradingRoomBrokerSymbol[], query: string) {
  const normalizedQuery = normalizeSymbol(query || "");
  const filtered = normalizedQuery
    ? symbols.filter((item) => item.symbol.includes(normalizedQuery) || item.display_name.includes(normalizedQuery))
    : symbols;

  return filtered.slice(0, 50);
}

function mapOpenPositions(positions: MetaApiPosition[] | null | undefined) {
  return (positions ?? [])
    .map((position) => ({
      id: String(position.id ?? ""),
      symbol: position.symbol ?? "—",
      type: position.type ?? "—",
      volume: toNullableNumber(position.volume),
      open_price: toNullableNumber(position.openPrice),
      current_price: toNullableNumber(position.currentPrice),
      profit: toNullableNumber(position.profit),
      opened_at: position.time ?? null,
      updated_at: position.updateTime ?? null,
      comment: position.comment ?? null,
    }))
    .filter((position) => position.id.length > 0);
}

async function createMetaApiAccount(params: {
  mt_login: string;
  mt_password: string;
  broker_server: string;
  selected_session_key: "stream_only" | "ny" | "london" | "hk";
}) {
  return await metaApiFetch<MetaApiProvisioningAccount>(
    METAAPI_PROVISIONING_BASE,
    "/users/current/accounts",
    {
      method: "POST",
      body: JSON.stringify({
        login: params.mt_login,
        password: params.mt_password,
        server: params.broker_server,
        platform: "mt5",
        name: `Bullfy ${params.mt_login}`,
        keywords: ["Bullfy", params.selected_session_key],
        magic: 20260423,
      }),
    },
  );
}

async function updateMetaApiAccount(
  accountId: string,
  params: {
    mt_login: string;
    mt_password: string;
    broker_server: string;
    selected_session_key: "stream_only" | "ny" | "london" | "hk";
  },
) {
  return await metaApiFetch<MetaApiProvisioningAccount>(
    METAAPI_PROVISIONING_BASE,
    `/users/current/accounts/${accountId}`,
    {
      method: "PUT",
      body: JSON.stringify({
        login: params.mt_login,
        password: params.mt_password,
        server: params.broker_server,
        name: `Bullfy ${params.mt_login}`,
        keywords: ["Bullfy", params.selected_session_key],
      }),
    },
  );
}

async function deployMetaApiAccount(accountId: string) {
  await fetch(`${METAAPI_PROVISIONING_BASE}/users/current/accounts/${accountId}/deploy`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "auth-token": METAAPI_API_TOKEN,
    },
  });
}

async function executeMetaApiTrade(accountId: string, trade: Record<string, unknown>) {
  return await metaApiFetch<MetaApiTradeResponse>(
    METAAPI_CLIENT_BASE,
    `/users/current/accounts/${accountId}/trade`,
    { method: "POST", body: JSON.stringify(trade) },
  );
}

async function resolvePortalContext(supabase: SupabaseClient, portalId: string, partnerUserId: string) {
  const { data: portal, error: portalError } = await supabase
    .from("partner_portals")
    .select("id, ib_id")
    .eq("id", portalId)
    .maybeSingle();

  if (portalError || !portal?.ib_id) {
    throw new Error("Portal inválido para Bullfy Trading Room");
  }

  const { data: partnerUser, error: userError } = await supabase
    .from("partner_users")
    .select("id, portal_id, email, is_host")
    .eq("id", partnerUserId)
    .eq("portal_id", portalId)
    .maybeSingle();

  if (userError || !partnerUser) {
    throw new Error("Cliente del portal no válido");
  }

  const partnerEmail = (partnerUser.email || "").trim().toLowerCase();
  const isHost = (partnerUser as { is_host?: boolean }).is_host === true;

  return {
    ibId: portal.ib_id,
    // Hosts (admins del portal) operan gratis: tratamos como test user permanente.
    isAlwaysOnTestUser: isHost || partnerEmail === ALWAYS_ON_TEST_EMAIL,
  };
}

async function getAccessState(
  supabase: SupabaseClient,
  ibId: string,
  subscription: SubscriptionAccessRow,
  partnerUserId: string,
  portalId: string,
  isAlwaysOnTestUser: boolean,
) {
  const { data: override } = await supabase
    .from("trading_room_ib_overrides")
    .select("enabled")
    .eq("ib_id", ibId)
    .maybeSingle();

  const { data: testOverrides } = await supabase
    .from("trading_room_test_plan_overrides")
    .select("plan_id")
    .eq("partner_user_id", partnerUserId)
    .eq("portal_id", portalId)
    .eq("enabled", true);

  const overrideEnabled = override?.enabled === true;
  const activeTestPlanIds = (testOverrides ?? []).map((row: { plan_id: string }) => row.plan_id);
  const hasTestOverrides = activeTestPlanIds.length > 0;
  const subscriptionActive = ["active", "trial_override"].includes(subscription?.access_status || "");
  const effectiveAccess = overrideEnabled || hasTestOverrides || isAlwaysOnTestUser
    ? "trial_override"
    : subscriptionActive
      ? subscription?.access_status
      : "inactive";

  return {
    override_enabled: overrideEnabled || hasTestOverrides || isAlwaysOnTestUser,
    effective_access: effectiveAccess,
    can_trade: overrideEnabled || hasTestOverrides || isAlwaysOnTestUser || subscriptionActive,
    is_test_user: isAlwaysOnTestUser,
    active_test_plan_ids: activeTestPlanIds,
  };
}

// Returns the row marked as `is_active_for_stream = true` for the user (or null).
// Used by all actions that need "the" account currently in use for the stream.
async function pickActiveAccount(
  supabase: SupabaseClient,
  portalId: string,
  partnerUserId: string,
  columns: string,
) {
  const { data, error } = await supabase
    .from("trading_room_accounts")
    .select(columns)
    .eq("portal_id", portalId)
    .eq("partner_user_id", partnerUserId)
    .eq("is_active_for_stream", true)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

// Live-syncs a single account row (mutates DB if status/snapshot changed) and
// returns the enriched object with balance/equity/etc.
async function liveSyncAccount(
  supabase: SupabaseClient,
  account: any,
): Promise<{ account: any; openPositions: ReturnType<typeof mapOpenPositions> }> {
  let openPositions: ReturnType<typeof mapOpenPositions> = [];
  if (!account) return { account: null, openPositions };

  if (account.provider === "metaapi" && account.metaapi_account_id) {
    try {
      const liveMetaApiAccount = await fetchMetaApiAccount(account.metaapi_account_id);
      let connectionStatus = mapMetaApiConnectionStatus(liveMetaApiAccount);
      let accountInformation: MetaApiAccountInformation | null = null;
      try {
        accountInformation = await fetchMetaApiAccountInformation(account.metaapi_account_id);
        if (toNullableNumber(accountInformation.balance) !== null || toNullableNumber(accountInformation.equity) !== null) {
          connectionStatus = "connected";
        }
      } catch (_) { /* ignore */ }
      try { openPositions = mapOpenPositions(await fetchMetaApiPositions(account.metaapi_account_id)); } catch (_) { openPositions = []; }
      const snapshotTimestamp = accountInformation ? new Date().toISOString() : account.last_snapshot_at;
      if (connectionStatus !== account.connection_status || snapshotTimestamp !== account.last_snapshot_at) {
        await supabase.from("trading_room_accounts")
          .update({ connection_status: connectionStatus, last_snapshot_at: snapshotTimestamp })
          .eq("id", account.id);
      }
      account = {
        ...account,
        connection_status: connectionStatus,
        last_snapshot_at: snapshotTimestamp,
        balance: toNullableNumber(accountInformation?.balance),
        equity: toNullableNumber(accountInformation?.equity),
        margin: toNullableNumber(accountInformation?.margin),
        free_margin: toNullableNumber(accountInformation?.freeMargin),
        currency: accountInformation?.currency ?? null,
      };
    } catch (_) { /* keep persisted */ }
  } else if (account.provider === "bridge" && account.bridge_login) {
    try {
      let info: BridgeAccountInfo | null = null;
      try { info = await fetchBridgeAccount(account.bridge_login); } catch (_) { /* keep nulls */ }
      try { openPositions = mapBridgeOpenPositions(await fetchBridgePositions(account.bridge_login)); } catch (_) { openPositions = []; }
      const hasMetrics = info && (toNullableNumber(info.balance) !== null || toNullableNumber(info.equity) !== null);
      const connectionStatus = hasMetrics ? "connected" : (account.connection_status || "pending");
      const snapshotTimestamp = info ? new Date().toISOString() : account.last_snapshot_at;
      if (connectionStatus !== account.connection_status || snapshotTimestamp !== account.last_snapshot_at) {
        await supabase.from("trading_room_accounts")
          .update({ connection_status: connectionStatus, last_snapshot_at: snapshotTimestamp })
          .eq("id", account.id);
      }
      account = {
        ...account,
        connection_status: connectionStatus,
        last_snapshot_at: snapshotTimestamp,
        balance: toNullableNumber(info?.balance),
        equity: toNullableNumber(info?.equity),
        margin: toNullableNumber(info?.margin),
        free_margin: toNullableNumber(info?.margin_free),
        currency: (info?.currency as string) ?? null,
      };
    } catch (_) { /* keep persisted */ }
  }
  return { account, openPositions };
}

async function buildState(supabase: SupabaseClient, portalId: string, partnerUserId: string, ibId: string, isAlwaysOnTestUser: boolean) {
  const ACCOUNT_COLUMNS = "id, mt_login, metaapi_account_id, bridge_login, broker_server, provider, account_label, selected_session_key, connection_status, refreshes_per_day, ai_analysis_frequency, last_snapshot_at, last_analysis_at, is_active_for_stream";
  const [plansRes, subRes, accountsRes, ordersRes, analysisRes, favoritesRes] = await Promise.all([
    supabase
      .from("trading_room_plan_catalog")
      .select("id, plan_code, display_name, session_label, target_price_monthly, metaapi_cost_monthly, active_hours_per_month, notes")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("trading_room_subscriptions")
      .select("id, plan_id, price_monthly, access_status, billing_status, current_period_end")
      .eq("portal_id", portalId)
      .eq("partner_user_id", partnerUserId)
      .order("access_status", { ascending: true })
      .order("current_period_end", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("trading_room_accounts")
      .select(ACCOUNT_COLUMNS)
      .eq("portal_id", portalId)
      .eq("partner_user_id", partnerUserId),
    supabase
      .from("trading_room_order_intents")
      .select("id, side, lot_size, stop_loss, take_profit, symbol, execution_status, failure_reason, requested_at, executed_at")
      .eq("portal_id", portalId)
      .eq("partner_user_id", partnerUserId)
      .order("requested_at", { ascending: false })
      .limit(8),
    supabase
      .from("trading_room_analysis_runs")
      .select("id, status, summary, created_at")
      .eq("partner_user_id", partnerUserId)
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("trading_room_favorite_symbols")
      .select("id, symbol, display_name")
      .eq("portal_id", portalId)
      .eq("partner_user_id", partnerUserId)
      .order("symbol"),
  ]);

  const allAccounts = (accountsRes.data ?? []) as any[];
  const metaapiRow = allAccounts.find((a) => a.provider === "metaapi") ?? null;
  const bridgeRow = allAccounts.find((a) => a.provider === "bridge") ?? null;
  let activeRow = allAccounts.find((a) => a.is_active_for_stream === true) ?? null;

  // Live-sync only the active row (saves API calls). Persisted state shown for the other.
  let openPositions: ReturnType<typeof mapOpenPositions> = [];
  if (activeRow) {
    const synced = await liveSyncAccount(supabase, activeRow);
    activeRow = synced.account;
    openPositions = synced.openPositions;
    // Reflect synced fields into the per-provider rows we expose
    if (activeRow?.provider === "metaapi") Object.assign(metaapiRow ?? {}, activeRow);
    else if (activeRow?.provider === "bridge") Object.assign(bridgeRow ?? {}, activeRow);
  }

  const access = await getAccessState(supabase, ibId, subRes.data, partnerUserId, portalId, isAlwaysOnTestUser);

  return {
    plans: plansRes.data ?? [],
    subscription: subRes.data ?? null,
    account: activeRow,
    accounts: { metaapi: metaapiRow, bridge: bridgeRow },
    open_positions: openPositions,
    favorite_symbols: favoritesRes.data ?? [],
    recent_orders: ordersRes.data ?? [],
    recent_analyses: analysisRes.data ?? [],
    access,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonResponse({ ok: false, error: "Solicitud inválida", details: parsed.error.flatten() });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const payload = parsed.data;
    const { ibId, isAlwaysOnTestUser } = await resolvePortalContext(supabase, payload.portal_id, payload.partner_user_id);

    if (payload.action === "get_state") {
      const state = await buildState(supabase, payload.portal_id, payload.partner_user_id, ibId, isAlwaysOnTestUser);
      return jsonResponse({ ok: true, state });
    }

    if (payload.action === "search_symbols") {
      const account = await pickActiveAccount(
        supabase,
        payload.portal_id,
        payload.partner_user_id,
        "metaapi_account_id, bridge_login, provider",
      ) as { metaapi_account_id: string | null; bridge_login: string | null; provider: string } | null;
      const provider = account?.provider ?? "metaapi";
      const hasConnection = provider === "bridge" ? !!account?.bridge_login : !!account?.metaapi_account_id;
      if (!hasConnection) {
        throw new Error("Primero debes conectar una cuenta MT5 para buscar activos del broker");
      }

      // Bridge has no symbols-catalog endpoint → fall back to broker_symbols table
      let symbolList: TradingRoomBrokerSymbol[];
      if (provider === "bridge") {
        const { data: bs } = await supabase
          .from("broker_symbols")
          .select("symbol")
          .eq("enabled", true)
          .order("symbol", { ascending: true });
        symbolList = (bs ?? []).map((row: { symbol: string }) => ({ symbol: row.symbol, display_name: row.symbol }));
      } else {
        symbolList = mapBrokerSymbols(await fetchMetaApiSymbols(account!.metaapi_account_id as string));
      }
      return jsonResponse({ ok: true, symbols: filterBrokerSymbols(symbolList, payload.query ?? "") });
    }

    if (payload.action === "get_risk_calc_data") {
      const account = await pickActiveAccount(
        supabase,
        payload.portal_id,
        payload.partner_user_id,
        "metaapi_account_id, bridge_login, provider, connection_status",
      ) as { metaapi_account_id: string | null; bridge_login: string | null; provider: string; connection_status: string } | null;

      let balance: number | null = null;
      let currency: string | null = null;
      const provider = account?.provider ?? "metaapi";
      const hasConnection = provider === "bridge" ? !!account?.bridge_login : !!account?.metaapi_account_id;

      if (provider === "bridge" && account?.bridge_login) {
        try {
          const info = await fetchBridgeAccount(account.bridge_login);
          balance = toNullableNumber(info?.balance);
          currency = (info?.currency as string) ?? null;
        } catch (_e) { /* keep nulls */ }
      } else if (account?.metaapi_account_id) {
        try {
          const info = await fetchMetaApiAccountInformation(account.metaapi_account_id);
          balance = toNullableNumber(info?.balance);
          currency = info?.currency ?? null;
        } catch (_e) { /* keep nulls if MetaAPI sync fails */ }
      }

      const { data: symbols } = await supabase
        .from("broker_symbols")
        .select("symbol, description, category, digits, tick_size, tick_value, contract_size")
        .eq("enabled", true)
        .order("symbol", { ascending: true });

      return jsonResponse({
        ok: true,
        balance,
        currency,
        has_mt5: hasConnection,
        symbols: symbols ?? [],
      });
    }

    if (payload.action === "get_quote") {
      // Devuelve el precio de mercado actual de un símbolo para el usuario.
      // Estrategia: 1) si hay posición abierta para ese símbolo en el snapshot
      // realtime → usar current_price (sin coste). 2) intentar varios endpoints
      // candidatos del Bridge MT5 (los nombres exactos varían por versión).
      // 3) si todo falla → { ok: true, price: null, supported: false }.
      const account = await pickActiveAccount(
        supabase,
        payload.portal_id,
        payload.partner_user_id,
        "metaapi_account_id, bridge_login, provider",
      ) as { metaapi_account_id: string | null; bridge_login: string | null; provider: string } | null;

      if (!account || (account.provider === "bridge" && !account.bridge_login)) {
        return jsonResponse({ ok: true, price: null, supported: false, reason: "no_account" });
      }

      const sym = payload.symbol.trim();

      // 1) Snapshot realtime (gratis)
      try {
        const { data: snap } = await supabase
          .from("bridge_account_snapshot")
          .select("positions")
          .eq("partner_user_id", payload.partner_user_id)
          .maybeSingle();
        const positions = (snap?.positions ?? []) as Array<{ symbol?: string; current_price?: number | null }>;
        const match = positions.find((p) => (p.symbol ?? "").toUpperCase() === sym.toUpperCase() && p.current_price);
        if (match?.current_price) {
          return jsonResponse({ ok: true, price: Number(match.current_price), source: "snapshot", supported: true });
        }
      } catch (_e) { /* continue */ }

      // 2) Endpoints candidatos del Bridge
      if (account.provider === "bridge" && account.bridge_login) {
        const login = account.bridge_login;
        const candidates = [
          `/users/${login}/quote?symbol=${encodeURIComponent(sym)}`,
          `/users/${login}/symbols/${encodeURIComponent(sym)}/tick`,
          `/users/${login}/symbols/${encodeURIComponent(sym)}/quote`,
          `/symbols/${encodeURIComponent(sym)}/tick`,
          `/quotes/${encodeURIComponent(sym)}?login=${login}`,
        ];
        for (const path of candidates) {
          try {
            const res = await bridgeFetch<Record<string, unknown>>("GET", path);
            const r = res as Record<string, unknown>;
            const bid = toNullableNumber(r.bid ?? r.Bid);
            const ask = toNullableNumber(r.ask ?? r.Ask);
            const last = toNullableNumber(r.last ?? r.Last ?? r.price ?? r.Price);
            const mid = bid != null && ask != null ? (bid + ask) / 2 : (last ?? bid ?? ask);
            if (mid != null) {
              return jsonResponse({ ok: true, price: mid, bid, ask, source: "bridge", supported: true });
            }
          } catch (_e) { /* try next */ }
        }
      }

      return jsonResponse({ ok: true, price: null, supported: false, reason: "no_quote_endpoint" });
    }

    if (payload.action === "toggle_favorite_symbol") {
      const normalizedSymbol = normalizeSymbol(payload.symbol);
      const account = await pickActiveAccount(
        supabase,
        payload.portal_id,
        payload.partner_user_id,
        "id, metaapi_account_id, bridge_login, provider",
      ) as { id: string; metaapi_account_id: string | null; bridge_login: string | null; provider: string } | null;
      const provider = account?.provider ?? "metaapi";
      const hasConnection = provider === "bridge" ? !!account?.bridge_login : !!account?.metaapi_account_id;
      if (!hasConnection) {
        throw new Error("Primero debes conectar una cuenta MT5 antes de guardar favoritos");
      }

      let brokerSymbol: TradingRoomBrokerSymbol | undefined;
      if (provider === "bridge") {
        const { data: row } = await supabase
          .from("broker_symbols")
          .select("symbol")
          .eq("enabled", true)
          .eq("symbol", normalizedSymbol)
          .maybeSingle();
        if (row) brokerSymbol = { symbol: row.symbol, display_name: row.symbol };
      } else {
        const brokerSymbols = mapBrokerSymbols(await fetchMetaApiSymbols(account!.metaapi_account_id as string));
        brokerSymbol = brokerSymbols.find((item) => item.symbol === normalizedSymbol);
      }
      if (!brokerSymbol) {
        throw new Error("El activo seleccionado no existe en la cuenta conectada");
      }

      if (payload.enabled) {
        const { error } = await supabase.from("trading_room_favorite_symbols").upsert(
          {
            partner_user_id: payload.partner_user_id,
            portal_id: payload.portal_id,
            account_id: account!.id,
            symbol: brokerSymbol.symbol,
            display_name: payload.display_name?.trim() || brokerSymbol.display_name,
          },
          { onConflict: "partner_user_id,portal_id,symbol" },
        );

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("trading_room_favorite_symbols")
          .delete()
          .eq("portal_id", payload.portal_id)
          .eq("partner_user_id", payload.partner_user_id)
          .eq("symbol", brokerSymbol.symbol);

        if (error) throw error;
      }

      const state = await buildState(supabase, payload.portal_id, payload.partner_user_id, ibId, isAlwaysOnTestUser);
      return jsonResponse({ ok: true, state });
    }

    if (payload.action === "set_plan") {
      const { data: plan, error: planError } = await supabase
        .from("trading_room_plan_catalog")
        .select("id, target_price_monthly")
        .eq("id", payload.plan_id)
        .maybeSingle();

      if (planError || !plan) {
        throw new Error("Plan no válido");
      }

      if (isAlwaysOnTestUser) {
        const { error } = await supabase.from("trading_room_test_plan_overrides").upsert(
          {
            partner_user_id: payload.partner_user_id,
            portal_id: payload.portal_id,
            plan_id: payload.plan_id,
            always_active: true,
            enabled: true,
            notes: `QA override for ${ALWAYS_ON_TEST_EMAIL}`,
          },
          { onConflict: "partner_user_id,plan_id" },
        );

        if (error) throw error;
      } else {
        const { error } = await supabase.from("trading_room_subscriptions").upsert(
          {
            partner_user_id: payload.partner_user_id,
            portal_id: payload.portal_id,
            ib_id: ibId,
            plan_id: payload.plan_id,
            price_monthly: plan.target_price_monthly,
            access_status: "inactive",
            billing_status: "pending_setup",
          },
          { onConflict: "partner_user_id" },
        );

        if (error) throw error;
      }

      const state = await buildState(supabase, payload.portal_id, payload.partner_user_id, ibId, isAlwaysOnTestUser);
      return jsonResponse({ ok: true, state });
    }

    if (payload.action === "save_account") {
      const access = await getAccessState(
        supabase,
        ibId,
        (
          await supabase
            .from("trading_room_subscriptions")
            .select("access_status")
            .eq("portal_id", payload.portal_id)
            .eq("partner_user_id", payload.partner_user_id)
            .maybeSingle()
        ).data,
        payload.partner_user_id,
        payload.portal_id,
        isAlwaysOnTestUser,
      );

      // Helper: returns true if the user has NO active row yet (auto-activate first one).
      const hasActiveAccount = async (): Promise<boolean> => {
        const { data } = await supabase
          .from("trading_room_accounts")
          .select("id")
          .eq("portal_id", payload.portal_id)
          .eq("partner_user_id", payload.partner_user_id)
          .eq("is_active_for_stream", true)
          .maybeSingle();
        return !!data;
      };

      // ---------- Bridge MT5 Bullfy provider ----------
      // Validates the account exists in the Bullfy MT5 server (via superadmin Bridge).
      // The user-provided MT5 password is collected for UX but discarded — the Bridge
      // operates with its own admin credentials and we do not store user passwords.
      if (payload.provider === "bridge") {
        let bridgeUser: BridgeUserInfo;
        try {
          bridgeUser = await fetchBridgeUser(payload.mt_login);
        } catch (e) {
          return jsonResponse({ ok: false, error: `No se pudo validar la cuenta en Bullfy-Trade: ${getErrorMessage(e)}` });
        }

        // Validate the user's MT5 password against the broker — the Bridge runs on superadmin,
        // so without this step ANY existing login would be reported as "connected".
        const pwdCheck = await verifyBridgePassword(payload.mt_login, payload.mt_password);
        if (!pwdCheck.ok && pwdCheck.reason === "invalid") {
          return jsonResponse({ ok: false, error: "Contraseña MT5 inválida. Verifica la Master password de la cuenta." });
        }
        if (!pwdCheck.ok && pwdCheck.reason === "error") {
          return jsonResponse({ ok: false, error: `No se pudo verificar la contraseña en Bullfy-Trade: ${pwdCheck.message ?? "error desconocido"}` });
        }
        // pwdCheck.reason === "unsupported" → log and continue (older bridge builds without /password/check)
        if (!pwdCheck.ok) {
          console.warn(`[trading-room-client] Bridge /password/check no disponible para login ${payload.mt_login} — continuando sin verificación de contraseña.`);
        }

        let connectionStatus: string = bridgeUser?.enabled === false ? "paused" : "connected";
        try {
          const info = await fetchBridgeAccount(payload.mt_login);
          if (toNullableNumber(info.balance) !== null || toNullableNumber(info.equity) !== null) {
            connectionStatus = bridgeUser?.enabled === false ? "paused" : "connected";
          }
        } catch (_e) { /* keep status from user lookup */ }

        const shouldAutoActivate = !(await hasActiveAccount());
        const upsertPayload: Record<string, unknown> = {
          partner_user_id: payload.partner_user_id,
          portal_id: payload.portal_id,
          ib_id: ibId,
          mt_login: payload.mt_login,
          bridge_login: payload.mt_login,
          broker_server: payload.broker_server,
          provider: "bridge",
          account_label: bridgeUser?.name ? String(bridgeUser.name) : `Bullfy ${payload.mt_login}`,
          selected_session_key: payload.selected_session_key,
          deployment_mode: payload.selected_session_key === "stream_only" ? "stream_only" : "session_window",
          connection_status: access.can_trade ? connectionStatus : "not_connected",
          notes: bridgeUser?.group ? `Bridge group: ${bridgeUser.group}` : null,
        };
        if (shouldAutoActivate) upsertPayload.is_active_for_stream = true;

        const { error } = await supabase.from("trading_room_accounts").upsert(
          upsertPayload,
          { onConflict: "partner_user_id,provider" },
        );

        if (error) throw error;
        const state = await buildState(supabase, payload.portal_id, payload.partner_user_id, ibId, isAlwaysOnTestUser);
        return jsonResponse({ ok: true, state, bridge: { login: payload.mt_login, enabled: bridgeUser?.enabled !== false } });
      }
      // ---------- end Bridge branch ----------

      const { data: existingAccount, error: existingAccountError } = await supabase
        .from("trading_room_accounts")
        .select("metaapi_account_id")
        .eq("portal_id", payload.portal_id)
        .eq("partner_user_id", payload.partner_user_id)
        .eq("provider", "metaapi")
        .maybeSingle();

      if (existingAccountError) throw existingAccountError;

      const accountInput = {
        mt_login: payload.mt_login,
        mt_password: payload.mt_password,
        broker_server: payload.broker_server,
        selected_session_key: payload.selected_session_key,
      };

      const provisionedAccount = existingAccount?.metaapi_account_id
        ? await updateMetaApiAccount(existingAccount.metaapi_account_id, accountInput)
        : await createMetaApiAccount(accountInput);

      const metaApiAccountId = getMetaApiAccountId(provisionedAccount);
      if (!metaApiAccountId) {
        throw new Error("No se pudo crear la conexión interna de la cuenta MT5");
      }

      await deployMetaApiAccount(metaApiAccountId);
      const metaApiAccount = await fetchMetaApiAccount(metaApiAccountId);
      let connectionStatus = mapMetaApiConnectionStatus(metaApiAccount);

      try {
        const accountInformation = await fetchMetaApiAccountInformation(metaApiAccountId);
        if (
          toNullableNumber(accountInformation.balance) !== null ||
          toNullableNumber(accountInformation.equity) !== null
        ) {
          connectionStatus = "connected";
        }
      } catch (_accountInfoError) {
        // Ignore early account-info failures right after deploy; buildState will retry on refresh.
      }

      const shouldAutoActivateMA = !(await hasActiveAccount());
      const metaUpsertPayload: Record<string, unknown> = {
        partner_user_id: payload.partner_user_id,
        portal_id: payload.portal_id,
        ib_id: ibId,
        mt_login: payload.mt_login,
        metaapi_account_id: metaApiAccountId,
        broker_server: payload.broker_server,
        provider: "metaapi",
        account_label: metaApiAccount.name || `Bullfy ${payload.mt_login}`,
        selected_session_key: payload.selected_session_key,
        deployment_mode: payload.selected_session_key === "stream_only" ? "stream_only" : "session_window",
        connection_status: access.can_trade ? connectionStatus : "not_connected",
        notes: metaApiAccount.region ? `MetaApi region: ${metaApiAccount.region}` : null,
      };
      if (shouldAutoActivateMA) metaUpsertPayload.is_active_for_stream = true;

      const { error } = await supabase.from("trading_room_accounts").upsert(
        metaUpsertPayload,
        { onConflict: "partner_user_id,provider" },
      );

      if (error) throw error;
      const state = await buildState(supabase, payload.portal_id, payload.partner_user_id, ibId, isAlwaysOnTestUser);
      return jsonResponse({ ok: true, state, metaapi: { account_state: metaApiAccount.state, connection_status: metaApiAccount.connectionStatus } });
    }

    if (payload.action === "set_active_account") {
      const { data: target, error: targetError } = await supabase
        .from("trading_room_accounts")
        .select("id")
        .eq("portal_id", payload.portal_id)
        .eq("partner_user_id", payload.partner_user_id)
        .eq("provider", payload.provider)
        .maybeSingle();
      if (targetError) throw targetError;
      if (!target) {
        return jsonResponse({ ok: false, error: "Esa cuenta aún no está conectada" });
      }
      // Step 1: deactivate current active row (if different) — must run BEFORE activating
      // the target to satisfy the partial unique index `one active per user`.
      const { error: deactErr } = await supabase
        .from("trading_room_accounts")
        .update({ is_active_for_stream: false })
        .eq("partner_user_id", payload.partner_user_id)
        .neq("id", target.id);
      if (deactErr) throw deactErr;
      const { error: actErr } = await supabase
        .from("trading_room_accounts")
        .update({ is_active_for_stream: true })
        .eq("id", target.id);
      if (actErr) throw actErr;
      const state = await buildState(supabase, payload.portal_id, payload.partner_user_id, ibId, isAlwaysOnTestUser);
      return jsonResponse({ ok: true, state });
    }

    if (payload.action === "create_intent") {
      console.log("[create_intent] start", { user: payload.partner_user_id, symbol: payload.symbol, room: payload.room_id });

      const state = await buildState(supabase, payload.portal_id, payload.partner_user_id, ibId, isAlwaysOnTestUser);
      if (!state.access.can_trade) {
        return jsonResponse({ ok: false, error: "Tu acceso de trading aún no está activo" });
      }

      const accountId = state.account?.id;
      const provider = state.account?.provider ?? "metaapi";
      const metaApiAccountId = state.account?.metaapi_account_id;
      const bridgeLogin = state.account?.bridge_login;
      if (!accountId || (provider === "metaapi" && !metaApiAccountId) || (provider === "bridge" && !bridgeLogin)) {
        return jsonResponse({ ok: false, error: "Primero debes conectar una cuenta MT5 válida" });
      }

      const { data: insertedIntent, error: insertError } = await supabase
        .from("trading_room_order_intents")
        .insert({
          account_id: accountId,
          partner_user_id: payload.partner_user_id,
          portal_id: payload.portal_id,
          side: payload.side,
          lot_size: payload.lot_size,
          stop_loss: payload.stop_loss ?? null,
          take_profit: payload.take_profit ?? null,
          symbol: payload.symbol,
          source: payload.source,
          execution_status: "queued",
          room_id: payload.room_id ?? null,
        })
        .select("id")
        .single();

      if (insertError || !insertedIntent) {
        console.error("[create_intent] insert failed", insertError);
        return jsonResponse({ ok: false, error: getErrorMessage(insertError) });
      }

      const intentId = insertedIntent.id;
      console.log("[create_intent] intent inserted", intentId);

      const markFailed = async (reason: string) => {
        console.error("[create_intent] FAILED", intentId, reason);
        try {
          await supabase
            .from("trading_room_order_intents")
            .update({
              execution_status: "failed",
              executed_at: new Date().toISOString(),
              failure_reason: reason.slice(0, 500),
            })
            .eq("id", intentId);
        } catch (e) {
          console.error("[create_intent] markFailed update error", e);
        }
      };

      // ---------- Bridge MT5 Bullfy execution ----------
      if (provider === "bridge") {
        try {
          let result: { order?: number | string; deal?: number | string; position?: number | string; retcode?: number; comment?: string } & Record<string, unknown>;
          try {
            result = await bridgeCreateOrder(bridgeLogin as string, {
              side: payload.side,
              symbol: payload.symbol,
              volume: payload.lot_size,
              sl: payload.stop_loss ?? null,
              tp: payload.take_profit ?? null,
            }) as typeof result;
          } catch (e) {
            await markFailed(`bridge_trade: ${normalizeTradeFailure(e)}`);
            return jsonResponse({ ok: false, error: normalizeTradeFailure(e) });
          }

          let positionId = result?.position != null ? String(result.position) : null;
          // Bridge create order typically returns { order, deal, retcode } without `position`.
          // The position ticket (used by /positions) may differ from order/deal id, so we
          // resolve it by querying open positions and matching the most recent one by symbol.
          if (!positionId) {
            try {
              const positions = await fetchBridgePositions(bridgeLogin as string);
              const matches = positions
                .filter((p) => (p.symbol ?? "").toUpperCase() === payload.symbol.toUpperCase())
                .sort((a, b) => {
                  const ta = typeof a.time_create === "string" ? Date.parse(a.time_create) : Number(a.time_create ?? 0) * 1000;
                  const tb = typeof b.time_create === "string" ? Date.parse(b.time_create) : Number(b.time_create ?? 0) * 1000;
                  return tb - ta;
                });
              const matchedPositionId = firstDefined(
                matches[0]?.position,
                matches[0]?.position_id,
                matches[0]?.ticket,
                matches[0]?.Position,
                matches[0]?.PositionID,
                matches[0]?.PositionId,
                matches[0]?.Ticket,
              );
              if (matchedPositionId != null) positionId = String(matchedPositionId);
            } catch (e) { console.error("[create_intent bridge] resolve position warn", e); }
          }
          if (!positionId) {
            positionId = result?.deal != null ? String(result.deal)
              : result?.order != null ? String(result.order)
              : null;
          }

          await supabase
            .from("trading_room_order_intents")
            .update({
              execution_status: "executed",
              executed_at: new Date().toISOString(),
              failure_reason: typeof result?.comment === "string" ? result.comment : null,
              metaapi_position_id: positionId, // reuse field for unified position tracking
            })
            .eq("id", intentId);

          try {
            await supabase
              .from("trading_room_accounts")
              .update({ connection_status: "connected", last_snapshot_at: new Date().toISOString() })
              .eq("id", accountId);
          } catch (e) { console.error("[create_intent bridge] acct upd warn", e); }

          try {
            await supabase.from("trading_room_snapshots").insert({
              account_id: accountId,
              snapshot_type: "order_execution",
              snapshot_data: {
                provider: "bridge",
                side: payload.side, symbol: payload.symbol, lot_size: payload.lot_size,
                stop_loss: payload.stop_loss ?? null, take_profit: payload.take_profit ?? null,
                bridge_login: bridgeLogin, trade_result: result,
              },
            });
          } catch (e) { console.error("[create_intent bridge] snapshot warn", e); }

          return jsonResponse({ ok: true, trade_result: result, position_id: positionId });
        } catch (unexpectedError) {
          await markFailed(`bridge_unexpected: ${normalizeTradeFailure(unexpectedError)}`);
          return jsonResponse({ ok: false, error: normalizeTradeFailure(unexpectedError) });
        }
      }
      // ---------- end Bridge branch ----------

      try {
        let liveAccount: MetaApiProvisioningAccount;
        try {
          liveAccount = await fetchMetaApiAccount(metaApiAccountId as string);
        } catch (e) {
          await markFailed(`fetchAccount: ${normalizeTradeFailure(e)}`);
          return jsonResponse({ ok: false, error: normalizeTradeFailure(e) });
        }

        if ((liveAccount.connectionStatus || "").toUpperCase() !== "CONNECTED") {
          try {
            await deployMetaApiAccount(metaApiAccountId as string);
          } catch (e) {
            console.error("[create_intent] deploy warn", e);
          }
        }

        let tradeResult: MetaApiTradeResponse;
        try {
          tradeResult = await executeMetaApiTrade(metaApiAccountId as string, buildTradePayload(payload));
        } catch (e) {
          await markFailed(`trade: ${normalizeTradeFailure(e)}`);
          return jsonResponse({ ok: false, error: normalizeTradeFailure(e) });
        }

        const positionId =
          tradeResult.positionId !== undefined && tradeResult.positionId !== null
            ? String(tradeResult.positionId)
            : tradeResult.orderId !== undefined && tradeResult.orderId !== null
              ? String(tradeResult.orderId)
              : null;

        console.log("[create_intent] trade ok", { intentId, positionId, code: tradeResult.numericCode });

        const { error: updateError } = await supabase
          .from("trading_room_order_intents")
          .update({
            execution_status: "executed",
            executed_at: new Date().toISOString(),
            failure_reason: tradeResult.message ?? null,
            metaapi_position_id: positionId,
          })
          .eq("id", intentId);

        if (updateError) {
          console.error("[create_intent] update executed FAILED", updateError);
        }

        // Best-effort side-effects (non-blocking on failure)
        try {
          await supabase
            .from("trading_room_accounts")
            .update({ connection_status: mapMetaApiConnectionStatus(liveAccount), last_snapshot_at: new Date().toISOString() })
            .eq("id", accountId);
        } catch (e) { console.error("[create_intent] account update warn", e); }

        try {
          await supabase.from("trading_room_snapshots").insert({
            account_id: accountId,
            snapshot_type: "order_execution",
            snapshot_data: {
              side: payload.side,
              symbol: payload.symbol,
              lot_size: payload.lot_size,
              stop_loss: payload.stop_loss ?? null,
              take_profit: payload.take_profit ?? null,
              metaapi_account_id: metaApiAccountId,
              trade_result: tradeResult,
            },
          });
        } catch (e) { console.error("[create_intent] snapshot warn", e); }

        return jsonResponse({ ok: true, trade_result: tradeResult, position_id: positionId });
      } catch (unexpectedError) {
        await markFailed(`unexpected: ${normalizeTradeFailure(unexpectedError)}`);
        return jsonResponse({ ok: false, error: normalizeTradeFailure(unexpectedError) });
      }
    }

    if (payload.action === "close_all_positions") {
      const state = await buildState(supabase, payload.portal_id, payload.partner_user_id, ibId, isAlwaysOnTestUser);
      if (!state.access.can_trade) {
        throw new Error("Tu acceso de trading aún no está activo");
      }

      const accountId = state.account?.id;
      const provider = state.account?.provider ?? "metaapi";
      const metaApiAccountId = state.account?.metaapi_account_id;
      const bridgeLogin = state.account?.bridge_login;
      if (!accountId || (provider === "metaapi" && !metaApiAccountId) || (provider === "bridge" && !bridgeLogin)) {
        throw new Error("Primero debes conectar una cuenta MT5 válida");
      }

      // ---------- Bridge close-all ----------
      if (provider === "bridge") {
        const livePositions = mapBridgeOpenPositions(await fetchBridgePositions(bridgeLogin as string));
        if (livePositions.length === 0) {
          return jsonResponse({ ok: true, closed_count: 0, state });
        }
        let summary: unknown;
        try { summary = await bridgeCloseAll(bridgeLogin as string); } catch (e) {
          throw new Error(normalizeTradeFailure(e));
        }
        await supabase.from("trading_room_snapshots").insert({
          account_id: accountId,
          snapshot_type: "positions_close_all",
          snapshot_data: { provider: "bridge", attempted: livePositions.length, summary, positions: livePositions },
        });
        await supabase
          .from("trading_room_accounts")
          .update({ last_snapshot_at: new Date().toISOString(), connection_status: "connected" })
          .eq("id", accountId);
        const nextState = await buildState(supabase, payload.portal_id, payload.partner_user_id, ibId, isAlwaysOnTestUser);
        return jsonResponse({ ok: true, closed_count: livePositions.length, state: nextState });
      }
      // ---------- end Bridge ----------

      const livePositions = mapOpenPositions(await fetchMetaApiPositions(metaApiAccountId));
      if (livePositions.length === 0) {
        return jsonResponse({ ok: true, closed_count: 0, state });
      }

      const results = await Promise.allSettled(
        livePositions.map((position) =>
          executeMetaApiTrade(metaApiAccountId, {
            actionType: "POSITION_CLOSE_ID",
            positionId: position.id,
          }),
        ),
      );

      const failedCount = results.filter((result) => result.status === "rejected").length;

      await supabase.from("trading_room_snapshots").insert({
        account_id: accountId,
        snapshot_type: "positions_close_all",
        snapshot_data: {
          attempted: livePositions.length,
          failed: failedCount,
          positions: livePositions,
        },
      });

      if (failedCount > 0) {
        throw new Error(`No se pudieron cerrar ${failedCount} de ${livePositions.length} operaciones abiertas`);
      }

      await supabase
        .from("trading_room_accounts")
        .update({ last_snapshot_at: new Date().toISOString(), connection_status: "connected" })
        .eq("id", accountId);

      const nextState = await buildState(supabase, payload.portal_id, payload.partner_user_id, ibId, isAlwaysOnTestUser);
      return jsonResponse({ ok: true, closed_count: livePositions.length, state: nextState });
    }

    if (payload.action === "get_stream_positions") {
      const account = await pickActiveAccount(
        supabase,
        payload.portal_id,
        payload.partner_user_id,
        "id, metaapi_account_id, bridge_login, provider",
      ) as { id: string; metaapi_account_id: string | null; bridge_login: string | null; provider: string } | null;

      const provider = account?.provider ?? "metaapi";
      const hasConn = provider === "bridge" ? !!account?.bridge_login : !!account?.metaapi_account_id;
      if (!hasConn) return jsonResponse({ ok: true, positions: [], balance: null });

      const returnAll = payload.include_all === true || !payload.room_id;
      let allowedIds: Set<string> | null = null;
      if (!returnAll) {
        const { data: streamIntents } = await supabase
          .from("trading_room_order_intents")
          .select("metaapi_position_id")
          .eq("portal_id", payload.portal_id)
          .eq("partner_user_id", payload.partner_user_id)
          .eq("room_id", payload.room_id)
          .eq("execution_status", "executed")
          .not("metaapi_position_id", "is", null);
        allowedIds = new Set(
          (streamIntents ?? [])
            .map((row: { metaapi_position_id: string | null }) => row.metaapi_position_id)
            .filter((id): id is string => !!id),
        );
        if (allowedIds.size === 0) {
          let bal: number | null = null;
          try {
            if (provider === "bridge") bal = toNullableNumber((await fetchBridgeAccount(account!.bridge_login as string)).balance);
            else bal = toNullableNumber((await fetchMetaApiAccountInformation(account!.metaapi_account_id as string)).balance);
          } catch (_) { /* noop */ }
          return jsonResponse({ ok: true, positions: [], balance: bal });
        }
      }

      let livePositions: ReturnType<typeof mapOpenPositions> = [];
      let balance: number | null = null;
      try {
        if (provider === "bridge") livePositions = mapBridgeOpenPositions(await fetchBridgePositions(account!.bridge_login as string));
        else livePositions = mapOpenPositions(await fetchMetaApiPositions(account!.metaapi_account_id as string));
      } catch (_) { /* noop */ }
      try {
        if (provider === "bridge") balance = toNullableNumber((await fetchBridgeAccount(account!.bridge_login as string)).balance);
        else balance = toNullableNumber((await fetchMetaApiAccountInformation(account!.metaapi_account_id as string)).balance);
      } catch (_) { /* noop */ }

      const filtered = allowedIds ? livePositions.filter((p) => allowedIds!.has(p.id)) : livePositions;
      return jsonResponse({ ok: true, positions: filtered, balance });
    }

    if (payload.action === "get_host_room_positions") {
      const account = await pickActiveAccount(
        supabase,
        payload.portal_id,
        payload.partner_user_id,
        "id, metaapi_account_id, bridge_login, provider",
      ) as { id: string; metaapi_account_id: string | null; bridge_login: string | null; provider: string } | null;

      const provider = account?.provider ?? "metaapi";
      const hasConn = provider === "bridge" ? !!account?.bridge_login : !!account?.metaapi_account_id;
      if (!hasConn) return jsonResponse({ ok: true, positions: [], balance: null });

      let livePositions: ReturnType<typeof mapOpenPositions> = [];
      let balance: number | null = null;
      try {
        if (provider === "bridge") livePositions = mapBridgeOpenPositions(await fetchBridgePositions(account!.bridge_login as string));
        else livePositions = mapOpenPositions(await fetchMetaApiPositions(account!.metaapi_account_id as string));
      } catch (_) { /* noop */ }
      try {
        if (provider === "bridge") balance = toNullableNumber((await fetchBridgeAccount(account!.bridge_login as string)).balance);
        else balance = toNullableNumber((await fetchMetaApiAccountInformation(account!.metaapi_account_id as string)).balance);
      } catch (_) { /* noop */ }

      return jsonResponse({ ok: true, positions: livePositions, balance, host_view: true });
    }

    if (payload.action === "get_account_status") {
      const account = await pickActiveAccount(
        supabase,
        payload.portal_id,
        payload.partner_user_id,
        "id, metaapi_account_id, bridge_login, provider, connection_status, account_label, mt_login, broker_server",
      ) as { id: string; metaapi_account_id: string | null; bridge_login: string | null; provider: string; connection_status: string; account_label: string | null; mt_login: string | null; broker_server: string | null } | null;

      if (!account) {
        return jsonResponse({ ok: true, connected: false, status: "disconnected", balance: null, equity: null, currency: null, positions: [], account: null });
      }

      const provider = account.provider ?? "metaapi";
      const hasConn = provider === "bridge" ? !!account.bridge_login : !!account.metaapi_account_id;
      if (!hasConn) {
        return jsonResponse({ ok: true, connected: false, status: account.connection_status || "disconnected", balance: null, equity: null, currency: null, positions: [], account });
      }

      let balance: number | null = null;
      let equity: number | null = null;
      let currency: string | null = null;
      let livePositions: ReturnType<typeof mapOpenPositions> = [];
      let live = false;

      try {
        if (provider === "bridge") {
          const info = await fetchBridgeAccount(account.bridge_login as string);
          balance = toNullableNumber(info?.balance);
          equity = toNullableNumber(info?.equity);
          currency = (info?.currency as string) ?? null;
          live = balance !== null || equity !== null;
        } else {
          const info = await fetchMetaApiAccountInformation(account.metaapi_account_id as string);
          balance = toNullableNumber(info?.balance);
          equity = toNullableNumber(info?.equity);
          currency = info?.currency ?? null;
          live = balance !== null || equity !== null;
        }
      } catch (_) { /* keep nulls */ }

      try {
        if (provider === "bridge") livePositions = mapBridgeOpenPositions(await fetchBridgePositions(account.bridge_login as string));
        else livePositions = mapOpenPositions(await fetchMetaApiPositions(account.metaapi_account_id as string));
      } catch (_) { /* noop */ }

      return jsonResponse({
        ok: true,
        connected: true,
        status: live ? "connected" : (account.connection_status || "unknown"),
        balance,
        equity,
        currency,
        positions: livePositions,
        account: {
          mt_login: account.mt_login,
          broker_server: account.broker_server,
          account_label: account.account_label,
          provider,
        },
      });
    }

    if (payload.action === "close_position") {
      const account = await pickActiveAccount(
        supabase,
        payload.portal_id,
        payload.partner_user_id,
        "id, metaapi_account_id, bridge_login, provider",
      ) as { id: string; metaapi_account_id: string | null; bridge_login: string | null; provider: string } | null;

      const provider = account?.provider ?? "metaapi";
      const hasConn = provider === "bridge" ? !!account?.bridge_login : !!account?.metaapi_account_id;
      if (!hasConn) return jsonResponse({ ok: false, error: "Cuenta MT5 no encontrada" });

      let tradeResult: unknown;
      if (provider === "bridge") {
        tradeResult = await bridgeClosePosition(account!.bridge_login as string, payload.position_id);
      } else {
        tradeResult = await executeMetaApiTrade(account!.metaapi_account_id as string, {
          actionType: "POSITION_CLOSE_ID",
          positionId: payload.position_id,
        });
      }

      await supabase.from("trading_room_snapshots").insert({
        account_id: account!.id,
        snapshot_type: "position_close",
        snapshot_data: {
          provider,
          position_id: payload.position_id,
          room_id: payload.room_id ?? null,
          trade_result: tradeResult,
        },
      });

      return jsonResponse({ ok: true, trade_result: tradeResult });
    }

    if (payload.action === "request_analysis") {
      const state = await buildState(supabase, payload.portal_id, payload.partner_user_id, ibId, isAlwaysOnTestUser);
      if (!state.account?.id) {
        throw new Error("Primero debes guardar la cuenta MT5 Bullfy");
      }

      const snapshotIds = (
        await supabase
          .from("trading_room_snapshots")
          .select("id")
          .eq("account_id", state.account.id)
          .order("created_at", { ascending: false })
          .limit(10)
      ).data?.map((row: { id: string }) => row.id) ?? [];

      const { error: insertError } = await supabase.from("trading_room_analysis_runs").insert({
        account_id: state.account.id,
        partner_user_id: payload.partner_user_id,
        status: "pending",
        input_snapshot_ids: snapshotIds,
      });

      if (insertError) throw insertError;

      await supabase
        .from("trading_room_accounts")
        .update({ last_analysis_at: new Date().toISOString() })
        .eq("id", state.account.id);

      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, error: "Acción no soportada" });
  } catch (err) {
    console.error("[trading-room-client]", err);
    return jsonResponse({ ok: false, error: getErrorMessage(err) });
  }
});