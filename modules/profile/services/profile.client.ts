import { queryRows } from "@/lib/db/postgres";
import { getCurrentSessionUser } from "@/modules/auth/services/session-user";
import type { ProfileDashboard } from "../types";
import { mapProfileDashboard } from "./profile.mapper";
import { profileDashboardMockDto } from "./profile.mock";
import type { ExternalProfileDashboardDto } from "./profile.contracts";

type DemoProfileTournamentRow = {
  tournament_id: string;
  slug: string;
  tournament_name: string;
  status: string;
  rank: number;
  participants: string;
  score_pct: string;
  prize_usd: string;
  started_at: Date;
  ended_at: Date | null;
};

type DemoProfileMt5Row = {
  account_id: string;
  login: string | null;
  server: string;
  status: string;
  equity: string;
  last_sync_at: Date;
};

type DemoProfileTradeRow = {
  trade_id: string;
  asset_symbol: string;
  side: string;
  pnl_amount: string;
  pnl_pct: string;
  closed_at: Date;
};

export async function getProfileDashboard(): Promise<ProfileDashboard> {
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    return mapProfileDashboard(profileDashboardMockDto);
  }

  try {
    const [tournaments, mt5Accounts, recentTrades] = await Promise.all([
      getDemoProfileTournaments(sessionUser.id),
      getDemoProfileMt5Accounts(sessionUser.id),
      getDemoProfileTrades(sessionUser.id),
    ]);

    return mapProfileDashboard({
      clan: sessionUser.clan
        ? {
            clan_id: "clan_bullfy",
            members_count: 18,
            name: sessionUser.clan,
            rank: 4,
            role: "MEMBER",
            slug: slugify(sessionUser.clan),
            tag: createClanTag(sessionUser.clan),
          }
        : null,
      clan_wars: profileDashboardMockDto.clan_wars,
      membership: {
        benefits:
          sessionUser.membershipTier === "elite"
            ? [
                "Torneos Elite",
                "Retiros USDT",
                "MT5 fondeado",
                "Clanes verificados",
              ]
            : ["Lobby BMoney", "ArenaTV", "Ranking publico", "Clanes demo"],
        renews_at:
          sessionUser.membershipTier === "elite"
            ? "2026-07-10T14:00:00.000Z"
            : null,
        status: sessionUser.membershipStatus.toUpperCase() as "ACTIVE",
        tier: sessionUser.membershipTier.toUpperCase() as "FREE" | "ELITE",
      },
      mt5_accounts: mt5Accounts.length > 0 ? mt5Accounts : [],
      performance: {
        best_asset: "EURUSD",
        current_tournament_rank: sessionUser.stats.currentTournamentRank,
        global_rank: sessionUser.stats.globalRank || 1,
        max_drawdown_pct: 4.7,
        pnl_amount: sessionUser.stats.pnlAmount,
        pnl_pct: sessionUser.stats.pnlPercent,
        profit_factor: sessionUser.stats.pnlAmount >= 0 ? 1.82 : 0.91,
        tournaments_played: sessionUser.stats.tournamentsPlayed,
        tournaments_won: sessionUser.stats.tournamentsWon,
        trades_count: sessionUser.stats.trades,
        win_rate_pct: sessionUser.stats.winRate,
      },
      recent_trades:
        recentTrades.length > 0
          ? recentTrades
          : profileDashboardMockDto.recent_trades.slice(0, 1),
      tournaments,
      trader: {
        avatar_3d_url: sessionUser.avatar3dUrl ?? null,
        avatar_config: sessionUser.avatarConfig ?? null,
        avatar_provider: sessionUser.avatarProvider ?? null,
        avatar_url: sessionUser.avatarUrl ?? "/avatars/karlos.svg",
        avaturn_avatar_id: sessionUser.avaturnAvatarId ?? null,
        avaturn_user_id: sessionUser.avaturnUserId ?? null,
        bio: `Trader Bullfy conectado como @${sessionUser.handle}. Perfil demo alimentado desde la sesion y Postgres local.`,
        clan_name: sessionUser.clan ?? "Sin clan",
        country_code: sessionUser.country ?? "VE",
        display_name: sessionUser.name,
        handle: sessionUser.handle,
        joined_at: new Date().toISOString(),
        preferred_pose: sessionUser.preferredPose ?? "idle",
        trader_id: sessionUser.id,
        verified: sessionUser.membershipTier === "elite",
      },
      versus: profileDashboardMockDto.versus,
      wallet: {
        bullfy_points: sessionUser.bullfyPoints,
        demo_balance: sessionUser.bmoneyBalance,
        real_balance: sessionUser.walletBalanceUsd,
      },
    });
  } catch {
    return mapProfileDashboard(profileDashboardMockDto);
  }
}

async function getDemoProfileTournaments(traderId: string) {
  const rows = await queryRows<DemoProfileTournamentRow>(
    `
      select
        t.id as tournament_id,
        t.slug,
        t.name as tournament_name,
        t.status,
        p.rank,
        (
          select count(*)::text
          from demo_tournament_participants total
          where total.tournament_id = t.id
        ) as participants,
        p.score_pct,
        t.prize_pool::text as prize_usd,
        t.starts_at as started_at,
        t.ends_at as ended_at
      from demo_tournament_participants p
      join demo_tournaments t on t.id = p.tournament_id
      where p.trader_id = $1
      order by p.created_at desc
      limit 8
    `,
    [traderId],
  );

  return rows.map((row) => ({
    ended_at: row.ended_at?.toISOString() ?? null,
    participants: Number(row.participants),
    prize_usd: Number(row.prize_usd),
    rank: row.rank,
    result: mapTournamentResult(row.status, row.rank),
    score_pct: Number(row.score_pct),
    slug: row.slug,
    started_at: row.started_at.toISOString(),
    status: mapTournamentStatus(row.status),
    tournament_id: row.tournament_id,
    tournament_name: row.tournament_name,
  })) satisfies ExternalProfileDashboardDto["tournaments"];
}

async function getDemoProfileMt5Accounts(traderId: string) {
  const rows = await queryRows<DemoProfileMt5Row>(
    `
      select
        a.id as account_id,
        a.login,
        a.server,
        a.status,
        a.equity::text,
        a.updated_at as last_sync_at
      from demo_mt5_accounts a
      join demo_tournament_participants p on p.id = a.participant_id
      where p.trader_id = $1
      order by a.updated_at desc
      limit 4
    `,
    [traderId],
  );

  return rows.map((row) => ({
    account_id: row.account_id,
    equity: Number(row.equity),
    kind: "DEMO",
    last_sync_at: row.last_sync_at.toISOString(),
    login: row.login ?? "-",
    server: row.server,
    status: row.status === "connected" ? "CONNECTED" : "PENDING",
  })) satisfies ExternalProfileDashboardDto["mt5_accounts"];
}

async function getDemoProfileTrades(traderId: string) {
  const rows = await queryRows<DemoProfileTradeRow>(
    `
      select
        pos.id as trade_id,
        pos.symbol as asset_symbol,
        pos.side,
        pos.pnl::text as pnl_amount,
        pos.pnl_pct::text as pnl_pct,
        coalesce(pos.closed_at, pos.opened_at) as closed_at
      from demo_trade_positions pos
      join demo_tournament_participants p on p.id = pos.participant_id
      where p.trader_id = $1
      order by coalesce(pos.closed_at, pos.opened_at) desc
      limit 6
    `,
    [traderId],
  );

  return rows.map((row) => ({
    asset_symbol: row.asset_symbol,
    closed_at: row.closed_at.toISOString(),
    pnl_amount: Number(row.pnl_amount),
    pnl_pct: Number(row.pnl_pct),
    side: row.side === "sell" ? "SELL" : "BUY",
    trade_id: row.trade_id,
  })) satisfies ExternalProfileDashboardDto["recent_trades"];
}

function mapTournamentStatus(
  status: string,
): ExternalProfileDashboardDto["tournaments"][number]["status"] {
  if (status === "live") {
    return "LIVE";
  }

  if (status === "finished") {
    return "FINISHED";
  }

  return "UPCOMING";
}

function mapTournamentResult(
  status: string,
  rank: number,
): ExternalProfileDashboardDto["tournaments"][number]["result"] {
  if (status === "live") {
    return "ACTIVE";
  }

  if (rank > 0 && rank <= 3) {
    return "PODIUM";
  }

  return rank > 0 ? "QUALIFIED" : "ELIMINATED";
}

function createClanTag(clan: string) {
  return clan
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
