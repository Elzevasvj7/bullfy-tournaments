export type Mt5AccountSnapshot = {
  login: string;
  server: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevelPercent: number;
  profit: number;
  status: "connected" | "syncing" | "disconnected";
};

export type Mt5CreateAccountInput = {
  name: string;
  group: string;
  leverage: number;
  password: string;
  email: string;
};

export type Mt5CreateAccountResult = {
  login: string;
  name: string;
  group: string;
  leverage: number;
  email: string;
  raw: unknown;
};

export type Mt5OpenOrderInput = {
  login: string;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
};

export type Mt5OpenOrderResult = {
  dealId: string;
  orderId?: string;
  positionId?: string;
  login: string;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  price: number;
  raw: unknown;
};

export type Mt5Deal = {
  dealId: string;
  orderId?: string;
  positionId?: string;
  login: string;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  price: number;
  profit: number;
  time: string;
  raw: unknown;
};

export type Mt5Position = {
  currentPrice?: number;
  positionId: string;
  login: string;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  price: number;
  profit: number;
  raw: unknown;
};

export type Mt5BridgeClient = {
  createAccount(input: Mt5CreateAccountInput): Promise<Mt5CreateAccountResult>;
  getAccount(login: string): Promise<Mt5AccountSnapshot>;
  listDeals(login: string): Promise<Mt5Deal[]>;
  listPositions(login: string): Promise<Mt5Position[]>;
  openOrder(input: Mt5OpenOrderInput): Promise<Mt5OpenOrderResult>;
  closePosition(login: string, ticket: string): Promise<void>;
};
