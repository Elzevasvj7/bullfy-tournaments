import "server-only";

import type {
  Mt5BridgeClient,
  Mt5CreateAccountInput,
  Mt5Deal,
  Mt5OpenOrderInput,
  Mt5Position,
} from "./types";

type BridgeAccountResponse = {
  login: number | string;
  name: string;
  group: string;
  leverage: number;
  email: string;
};

type BridgeAccountSnapshotResponse = {
  login: number | string;
  balance: number;
  equity: number;
  margin: number;
  margin_free: number;
  profit: number;
};

type BridgeOrderResponse = {
  deal: number | string;
  order?: number | string;
  position?: number | string;
  login: number | string;
  symbol: string;
  action: number;
  volume: number;
  price: number;
};

type BridgeDealResponse = {
  deal_id: number | string;
  order_id?: number | string;
  position_id?: number | string;
  login: number | string;
  symbol: string;
  action: number;
  volume: number;
  price: number;
  profit: number;
  time: number;
};

type BridgePositionResponse = {
  position_id?: number | string;
  position?: number | string;
  ticket?: number | string;
  login: number | string;
  symbol: string;
  action?: number;
  type?: number;
  volume: number;
  price?: number;
  price_current?: number;
  price_open?: number;
  current_price?: number;
  profit?: number;
};

const DEFAULT_TIMEOUT_MS = 15000;

export function createMt5BridgeClient(): Mt5BridgeClient {
  if (process.env.MT5_BRIDGE_USE_MOCK === "true") {
    return createMockMt5BridgeClient();
  }

  const baseUrl = process.env.MT5_BRIDGE_BASE_URL;
  const token = process.env.MT5_BRIDGE_TOKEN;

  if (!baseUrl || !token) {
    return createMockMt5BridgeClient();
  }

  return createHttpMt5BridgeClient({
    baseUrl,
    timeoutMs: Number(process.env.MT5_BRIDGE_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
    token,
  });
}

function createHttpMt5BridgeClient({
  baseUrl,
  timeoutMs,
  token,
}: {
  baseUrl: string;
  timeoutMs: number;
  token: string;
}): Mt5BridgeClient {
  async function request<Json>(
    path: string,
    init: RequestInit = {},
  ): Promise<Json> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(new URL(path, baseUrl), {
        ...init,
        headers: {
          "x-tenant-id": "tenant-demo",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(init.headers ?? {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.log(errorBody, "Error Body")
        throw new Error(
          errorBody
            ? `MT5 bridge ${response.status} ${response.statusText}: ${errorBody}`
            : `MT5 bridge ${response.status} ${response.statusText}`,
        );
      }

      if (response.status === 204) {
        return undefined as Json;
      }

      return (await response.json()) as Json;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async createAccount(input: Mt5CreateAccountInput) {
      const body = await request<BridgeAccountResponse>("/users", {
        body: JSON.stringify(input),
        method: "POST",
      });

      return {
        email: body.email,
        group: body.group,
        leverage: body.leverage,
        login: String(body.login),
        name: body.name,
        raw: body,
      };
    },
    async getAccount(login: string) {
      const body = await request<BridgeAccountSnapshotResponse>(
        `/accounts/${login}`,
      );

      return {
        balance: Number(body.balance),
        equity: Number(body.equity),
        freeMargin: Number(body.margin_free),
        login: String(body.login),
        margin: Number(body.margin),
        marginLevelPercent:
          Number(body.margin) > 0
            ? (Number(body.equity) / Number(body.margin)) * 100
            : 0,
        profit: Number(body.profit),
        server: "Bullfy-Bridge",
        status: "connected",
      };
    },
    async listDeals(login: string) {
      const body = await request<BridgeDealResponse[]>(`/users/${login}/deals`);

      return body.map(mapDeal);
    },
    async listPositions(login: string) {
      const body = await request<BridgePositionResponse[]>(
        `/users/${login}/positions`,
      );

      return body.map(mapPosition);
    },
    async openOrder(input: Mt5OpenOrderInput) {
      const body = await request<BridgeOrderResponse>(
        `/users/${input.login}/orders`,
        {
          body: JSON.stringify({
            comment: input.comment ?? "",
            sl: input.stopLoss ?? 0,
            symbol: input.symbol,
            tp: input.takeProfit ?? 0,
            type: input.side === "buy" ? 0 : 1,
            volume: input.volume,
          }),
          method: "POST",
        },
      );

      return {
        dealId: String(body.deal),
        login: String(body.login),
        orderId: body.order ? String(body.order) : undefined,
        positionId: body.position ? String(body.position) : undefined,
        price: Number(body.price),
        raw: body,
        side: body.action === 0 ? "buy" : "sell",
        symbol: body.symbol,
        volume: Number(body.volume),
      };
    },
    async closePosition(login: string, ticket: string) {
      try {
        await request(`/users/${login}/positions/${ticket}/close`, {
          body: "{}",
          method: "POST",
        });
      } catch (postError) {
        try {
          await request(`/users/${login}/positions/${ticket}/close`, {
            method: "DELETE",
          });
        } catch {
          throw postError;
        }
      }
    },
  };
}

function createMockMt5BridgeClient(): Mt5BridgeClient {
  return {
    async createAccount(input) {
      const login = "121734";

      return {
        email: input.email,
        group: input.group,
        leverage: input.leverage,
        login,
        name: input.name,
        raw: { login, mock: true },
      };
    },
    async getAccount(login) {
      return {
        balance: 10000,
        equity: 10000,
        freeMargin: 10000,
        login,
        margin: 0,
        marginLevelPercent: 0,
        profit: 0,
        server: "Bullfy-Bridge Mock",
        status: "connected",
      };
    },
    async listDeals() {
      return [];
    },
    async listPositions() {
      return [];
    },
    async openOrder(input) {
      const price = input.price && input.price > 0 ? input.price : 1.16;
      const dealId = String(Date.now());

      return {
        dealId,
        login: input.login,
        orderId: dealId,
        positionId: dealId,
        price,
        raw: { deal: dealId, mock: true },
        side: input.side,
        symbol: input.symbol,
        volume: input.volume,
      };
    },
    async closePosition() {
      return undefined;
    },
  };
}

function mapDeal(deal: BridgeDealResponse): Mt5Deal {
  return {
    dealId: String(deal.deal_id),
    login: String(deal.login),
    orderId: deal.order_id ? String(deal.order_id) : undefined,
    positionId: deal.position_id ? String(deal.position_id) : undefined,
    price: Number(deal.price),
    profit: Number(deal.profit),
    raw: deal,
    side: deal.action === 0 ? "buy" : "sell",
    symbol: deal.symbol,
    time: new Date(Number(deal.time) * 1000).toISOString(),
    volume: Number(deal.volume),
  };
}

function mapPosition(position: BridgePositionResponse): Mt5Position {
  const rawSide = position.action ?? position.type ?? 0;
  const entryPrice = Number(position.price_open ?? position.price ?? 0);
  const currentPrice = Number(
    position.price_current ?? position.current_price ?? position.price ?? entryPrice,
  );

  return {
    currentPrice: Number.isFinite(currentPrice) ? currentPrice : undefined,
    login: String(position.login),
    positionId: String(
      position.position_id ?? position.position ?? position.ticket ?? "",
    ),
    price: entryPrice,
    profit: Number(position.profit ?? 0),
    raw: position,
    side: rawSide === 1 ? "sell" : "buy",
    symbol: position.symbol,
    volume: Number(position.volume),
  };
}
