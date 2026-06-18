export type ArenaParticipant = {
  id: string;
  name: string;
  clan: string;
  avatarUrl: string;
  position: number;
  previousPosition: number;
  scoreChange: number;
  pnl: number;
  balance: number;
  trades: number;
  winRate: number;
};

export type ArenaMetric = {
  label: string;
  value: string;
  trend: "up" | "down" | "flat";
};

export type ArenaActivityEvent = {
  id: string;
  traderName: string;
  message: string;
  asset: string;
  pnlPercent: number;
  occurredAt: string;
};

export type ArenaMt5Account = {
  login: string;
  server: string;
  status: "connected" | "syncing" | "disconnected";
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevelPercent: number;
};

export type ArenaOpenPosition = {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  lots: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  pnl: number;
  pnlPercent: number;
  openedAt: string;
};

export type ArenaTradeTicket = {
  defaultSymbol: string;
  availableSymbols: string[];
  minLots: number;
  maxLots: number;
  defaultLots: number;
  maxRiskPercent: number;
};

export type ArenaState = {
  tournamentSlug: string;
  spectators: number;
  serverTime: string;
  currentParticipant?: ArenaParticipant;
  currentParticipantJoined?: boolean;
  participants: ArenaParticipant[];
  metrics: ArenaMetric[];
  activity: ArenaActivityEvent[];
  mt5Account: ArenaMt5Account;
  openPositions: ArenaOpenPosition[];
  tradeTicket: ArenaTradeTicket;
};
