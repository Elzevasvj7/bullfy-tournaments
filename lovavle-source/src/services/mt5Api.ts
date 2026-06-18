const MT5_API_BASE = "https://api.bullfytech.online/api";

interface MT5AuthResponse {
  token: string;
  expires_at?: string;
}

interface MT5Account {
  id: string;
  login: number;
  name: string;
  balance: number;
  equity: number;
  margin: number;
  free_margin: number;
  leverage: number;
  currency: string;
  group: string;
  status: string;
}

interface MT5Trade {
  id: string;
  ticket: number;
  symbol: string;
  type: string;
  volume: number;
  open_price: number;
  close_price?: number;
  open_time: string;
  close_time?: string;
  profit: number;
  swap: number;
  commission: number;
  comment?: string;
  state: string;
}

interface MT5Symbol {
  name: string;
  bid: number;
  ask: number;
  spread: number;
  digits: number;
  description: string;
}

interface MT5Stats {
  total_accounts: number;
  total_balance: number;
  total_equity: number;
  total_profit: number;
  total_trades: number;
  active_trades: number;
}

export type { MT5AuthResponse, MT5Account, MT5Trade, MT5Symbol, MT5Stats };

const TOKEN_KEY = "bullfy_token";
const ROLE_KEY = "bullfy_role";

export function getMT5Token(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getMT5Role(): string | null {
  return localStorage.getItem(ROLE_KEY);
}

export function setMT5Auth(token: string, role: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
}

export function clearMT5Token(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
}

export function isMT5Connected(): boolean {
  return !!getMT5Token();
}

async function mt5FetchRaw<T>(path: string, options?: RequestInit): Promise<{ success: boolean; data: T; timestamp?: string }> {
  const token = getMT5Token();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${MT5_API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearMT5Token();
    window.location.href = "/login";
    throw new Error("Sesión expirada. Por favor, vuelve a conectarte.");
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Error ${res.status}: ${body}`);
  }

  const json = await res.json();
  if (json.success === false) {
    throw new Error(json.message || "Error en la API MT5");
  }
  return json as { success: boolean; data: T; timestamp?: string };
}

// ── Auth (solo usuario/contraseña del sistema) ──
export async function mt5Login(username: string, password: string): Promise<MT5AuthResponse> {
  const res = await fetch(`${MT5_API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Error ${res.status}: ${body}`);
  }

  const json = await res.json() as { success: boolean; data: { token: string; role: string; expiresAtUtc: string } };

  if (!json.success) {
    throw new Error("Credenciales inválidas");
  }

  setMT5Auth(json.data.token, json.data.role);
  return { token: json.data.token, expires_at: json.data.expiresAtUtc };
}

export async function mt5Logout(): Promise<void> {
  try {
    await mt5FetchRaw("/auth/logout", { method: "POST" });
  } finally {
    clearMT5Token();
  }
}

// ── Status (response.data → objeto directo) ──
export async function mt5GetStatus(): Promise<MT5Stats> {
  const res = await mt5FetchRaw<Record<string, unknown>>("/mt5/status");
  const d = res.data;
  return {
    total_accounts: (d.totalAccounts as number) ?? 0,
    total_balance: (d.totalBalance as number) ?? 0,
    total_equity: (d.totalEquity as number) ?? 0,
    total_profit: (d.totalProfit as number) ?? 0,
    total_trades: (d.totalTrades as number) ?? 0,
    active_trades: (d.activeTrades as number) ?? 0,
  };
}

// ── Cuentas (response.data.items → array) ──
export async function mt5GetAccounts(): Promise<MT5Account[]> {
  const res = await mt5FetchRaw<{ items: MT5Account[]; totalCount: number }>("/mt5/accounts");
  return res.data.items ?? [];
}

export async function mt5GetAccount(login: string): Promise<MT5Account> {
  const res = await mt5FetchRaw<MT5Account>(`/mt5/accounts/${login}`);
  return res.data;
}

// ── Positions (response.data → array directo) ──
export async function mt5GetPositions(params?: {
  account_id?: string;
  symbol?: string;
  limit?: number;
}): Promise<MT5Trade[]> {
  const query = new URLSearchParams();
  if (params?.account_id) query.set("account_id", params.account_id);
  if (params?.symbol) query.set("symbol", params.symbol);
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  const res = await mt5FetchRaw<MT5Trade[]>(`/mt5/positions${qs ? `?${qs}` : ""}`);
  return Array.isArray(res.data) ? res.data : [];
}

// ── Deals (response.data.items → array) ──
export async function mt5GetDeals(params?: {
  account_id?: string;
  from?: string;
  to?: string;
  symbol?: string;
  limit?: number;
}): Promise<MT5Trade[]> {
  const query = new URLSearchParams();
  if (params?.account_id) query.set("account_id", params.account_id);
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  if (params?.symbol) query.set("symbol", params.symbol);
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  const res = await mt5FetchRaw<{ items: MT5Trade[]; totalCount: number }>(`/mt5/deals${qs ? `?${qs}` : ""}`);
  return res.data.items ?? [];
}

// ── Trades (legacy alias → deals) ──
export async function mt5GetTrades(params?: {
  account_id?: string;
  from?: string;
  to?: string;
  symbol?: string;
  limit?: number;
}): Promise<MT5Trade[]> {
  return mt5GetDeals(params);
}

// ── Groups (response.data → array directo) ──
export async function mt5GetGroups(): Promise<unknown[]> {
  const res = await mt5FetchRaw<unknown[]>("/mt5/groups");
  return Array.isArray(res.data) ? res.data : [];
}

// ── Risk (response.data → objeto directo) ──
export async function mt5GetRisk(): Promise<unknown> {
  const res = await mt5FetchRaw<unknown>("/mt5/risk");
  return res.data;
}

// ── Logs ──
export async function mt5GetLogs(): Promise<unknown[]> {
  const res = await mt5FetchRaw<unknown[]>("/mt5/logs");
  return Array.isArray(res.data) ? res.data : [];
}

// ── Sync ──
export async function mt5Sync(): Promise<unknown> {
  const res = await mt5FetchRaw<unknown>("/mt5/sync", { method: "POST" });
  return res.data;
}

// ── Test Connection ──
export async function mt5TestConnection(): Promise<unknown> {
  const res = await mt5FetchRaw<unknown>("/mt5/test-connection", { method: "POST" });
  return res.data;
}

// ── Market Data ──
export async function mt5GetSymbols(): Promise<MT5Symbol[]> {
  const res = await mt5FetchRaw<MT5Symbol[]>("/mt5/symbols");
  return Array.isArray(res.data) ? res.data : [];
}

// ── Stats (alias → status) ──
export async function mt5GetStats(): Promise<MT5Stats> {
  return mt5GetStatus();
}
