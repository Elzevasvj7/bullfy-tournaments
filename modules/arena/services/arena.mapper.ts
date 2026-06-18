import type { ArenaState } from "../types";
import type { ExternalArenaDto } from "./arena.contracts";

const trendMap = {
  UP: "up",
  DOWN: "down",
  FLAT: "flat",
} as const;

const mt5StatusMap = {
  CONNECTED: "connected",
  SYNCING: "syncing",
  DISCONNECTED: "disconnected",
} as const;

export function mapArenaState(dto: ExternalArenaDto): ArenaState {
  return {
    tournamentSlug: dto.tournament_slug,
    spectators: dto.spectators_count,
    serverTime: dto.server_time,
    participants: dto.leaderboard.map((participant) => ({
      id: participant.trader_id,
      name: participant.display_name,
      clan: participant.clan_name,
      avatarUrl: participant.avatar_url,
      position: participant.rank,
      previousPosition: participant.previous_rank,
      scoreChange: participant.score_pct,
      pnl: participant.pnl_amount,
      balance: participant.balance_amount,
      trades: participant.trades_count,
      winRate: participant.win_rate_pct,
    })),
    metrics: dto.metrics.map((metric) => ({
      label: metric.label,
      value: metric.value,
      trend: trendMap[metric.trend],
    })),
    activity: dto.recent_activity.map((event) => ({
      id: event.event_id,
      traderName: event.trader_name,
      message: event.description,
      asset: event.asset_symbol,
      pnlPercent: event.pnl_pct,
      occurredAt: event.created_at,
    })),
    mt5Account: {
      login: dto.mt5_account.login,
      server: dto.mt5_account.server,
      status: mt5StatusMap[dto.mt5_account.status],
      balance: dto.mt5_account.balance,
      equity: dto.mt5_account.equity,
      margin: dto.mt5_account.margin,
      freeMargin: dto.mt5_account.free_margin,
      marginLevelPercent: dto.mt5_account.margin_level_pct,
    },
    openPositions: dto.open_positions.map((position) => ({
      id: position.position_id,
      symbol: position.symbol,
      side: position.side === "BUY" ? "buy" : "sell",
      lots: position.lots,
      entryPrice: position.entry_price,
      currentPrice: position.current_price,
      stopLoss: position.stop_loss ?? undefined,
      takeProfit: position.take_profit ?? undefined,
      pnl: position.pnl_amount,
      pnlPercent: position.pnl_pct,
      openedAt: position.opened_at,
    })),
    tradeTicket: {
      defaultSymbol: dto.trade_ticket.default_symbol,
      availableSymbols: dto.trade_ticket.available_symbols,
      minLots: dto.trade_ticket.min_lots,
      maxLots: dto.trade_ticket.max_lots,
      defaultLots: dto.trade_ticket.default_lots,
      maxRiskPercent: dto.trade_ticket.max_risk_pct,
    },
  };
}
