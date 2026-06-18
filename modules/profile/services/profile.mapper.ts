import type {
  ProfileClanWarSnapshot,
  ProfileDashboard,
  ProfileTournamentSnapshot,
  ProfileVersusSnapshot,
} from "../types";
import type { ExternalProfileDashboardDto } from "./profile.contracts";

const tournamentStatusMap: Record<
  ExternalProfileDashboardDto["tournaments"][number]["status"],
  ProfileTournamentSnapshot["status"]
> = {
  LIVE: "live",
  UPCOMING: "upcoming",
  FINISHED: "finished",
};

const tournamentResultMap: Record<
  ExternalProfileDashboardDto["tournaments"][number]["result"],
  ProfileTournamentSnapshot["result"]
> = {
  ACTIVE: "active",
  QUALIFIED: "qualified",
  PODIUM: "podium",
  ELIMINATED: "eliminated",
};

const versusStatusMap: Record<
  ExternalProfileDashboardDto["versus"][number]["status"],
  ProfileVersusSnapshot["status"]
> = {
  PENDING: "pending",
  LIVE: "live",
  FINISHED: "finished",
};

const versusResultMap: Record<
  ExternalProfileDashboardDto["versus"][number]["result"],
  ProfileVersusSnapshot["result"]
> = {
  WIN: "win",
  LOSS: "loss",
  DRAW: "draw",
  ACTIVE: "active",
};

const clanWarStatusMap: Record<
  ExternalProfileDashboardDto["clan_wars"][number]["status"],
  ProfileClanWarSnapshot["status"]
> = {
  SCHEDULED: "scheduled",
  LIVE: "live",
  FINISHED: "finished",
};

const clanWarResultMap: Record<
  ExternalProfileDashboardDto["clan_wars"][number]["result"],
  ProfileClanWarSnapshot["result"]
> = {
  WIN: "win",
  LOSS: "loss",
  DRAW: "draw",
  ACTIVE: "active",
};

const membershipTierMap = {
  FREE: "free",
  ELITE: "elite",
} as const;

const membershipStatusMap = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  PENDING: "pending",
} as const;

const clanRoleMap = {
  OWNER: "owner",
  CAPTAIN: "captain",
  MEMBER: "member",
} as const;

const mt5KindMap = {
  DEMO: "demo",
  FUNDED: "funded",
} as const;

const mt5StatusMap = {
  CONNECTED: "connected",
  PENDING: "pending",
  SUSPENDED: "suspended",
} as const;

export function mapProfileDashboard(
  dto: ExternalProfileDashboardDto,
): ProfileDashboard {
  return {
    trader: {
      id: dto.trader.trader_id,
      name: dto.trader.display_name,
      handle: dto.trader.handle,
      clan: dto.trader.clan_name,
      avatarUrl: dto.trader.avatar_url,
      country: dto.trader.country_code,
      joinedAt: dto.trader.joined_at,
      bio: dto.trader.bio,
      verified: dto.trader.verified,
    },
    wallet: {
      realBalance: dto.wallet.real_balance,
      demoBalance: dto.wallet.demo_balance,
      bullfyPoints: dto.wallet.bullfy_points,
    },
    performance: {
      globalRank: dto.performance.global_rank,
      currentTournamentRank: dto.performance.current_tournament_rank,
      pnlPercent: dto.performance.pnl_pct,
      pnlAmount: dto.performance.pnl_amount,
      winRate: dto.performance.win_rate_pct,
      trades: dto.performance.trades_count,
      profitFactor: dto.performance.profit_factor,
      maxDrawdownPercent: dto.performance.max_drawdown_pct,
      tournamentsPlayed: dto.performance.tournaments_played,
      tournamentsWon: dto.performance.tournaments_won,
      bestAsset: dto.performance.best_asset,
    },
    membership: {
      tier: membershipTierMap[dto.membership.tier],
      status: membershipStatusMap[dto.membership.status],
      renewsAt: dto.membership.renews_at ?? undefined,
      benefits: dto.membership.benefits,
    },
    clan: dto.clan
      ? {
          id: dto.clan.clan_id ?? undefined,
          slug: dto.clan.slug ?? undefined,
          name: dto.clan.name ?? undefined,
          tag: dto.clan.tag ?? undefined,
          role: dto.clan.role ? clanRoleMap[dto.clan.role] : undefined,
          rank: dto.clan.rank ?? undefined,
          membersCount: dto.clan.members_count ?? undefined,
        }
      : null,
    mt5Accounts: dto.mt5_accounts.map((account) => ({
      id: account.account_id,
      login: account.login,
      server: account.server,
      kind: mt5KindMap[account.kind],
      status: mt5StatusMap[account.status],
      equity: account.equity,
      lastSyncAt: account.last_sync_at,
    })),
    tournaments: dto.tournaments.map((tournament) => ({
      id: tournament.tournament_id,
      slug: tournament.slug ?? undefined,
      tournamentName: tournament.tournament_name,
      status: tournamentStatusMap[tournament.status],
      rank: tournament.rank,
      participants: tournament.participants,
      scorePercent: tournament.score_pct,
      prizeUsd: tournament.prize_usd,
      startedAt: tournament.started_at,
      endedAt: tournament.ended_at ?? undefined,
      result: tournamentResultMap[tournament.result],
    })),
    versus: dto.versus.map((versus) => ({
      id: versus.versus_id,
      opponentName: versus.opponent_name,
      opponentHandle: versus.opponent_handle,
      status: versusStatusMap[versus.status],
      result: versusResultMap[versus.result],
      stakeUsd: versus.stake_usd,
      pnlPercent: versus.pnl_pct,
      score: versus.score,
      opponentScore: versus.opponent_score,
      playedAt: versus.played_at,
    })),
    clanWars: dto.clan_wars.map((war) => ({
      id: war.war_id,
      opponentClan: war.opponent_clan,
      opponentTag: war.opponent_tag,
      status: clanWarStatusMap[war.status],
      result: clanWarResultMap[war.result],
      rankImpact: war.rank_impact,
      clanScore: war.clan_score,
      opponentScore: war.opponent_score,
      playedAt: war.played_at,
    })),
    recentTrades: dto.recent_trades.map((trade) => ({
      id: trade.trade_id,
      asset: trade.asset_symbol,
      side: trade.side === "BUY" ? "buy" : "sell",
      pnl: trade.pnl_amount,
      pnlPercent: trade.pnl_pct,
      closedAt: trade.closed_at,
    })),
  };
}
