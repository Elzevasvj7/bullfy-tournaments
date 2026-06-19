import "server-only";

import { queryOne } from "@/lib/db/postgres";
import { getDemoSession } from "@/modules/demo/demo-session";
import type { ChatAuthor } from "@/modules/chat";
import type { CurrentSessionUser } from "../types";

type DemoTraderSessionRow = {
  id: string;
  name: string;
  handle: string;
  email: string;
  clan: string | null;
  country: string | null;
  membership: string;
  avatar_url: string | null;
  avatar_3d_url: string | null;
  avatar_config: Record<string, unknown> | null;
  avatar_provider: string | null;
  avaturn_user_id: string | null;
  avaturn_avatar_id: string | null;
  preferred_pose: string | null;
  created_at: Date;
  best_rank: number | null;
  current_rank: number | null;
  pnl_amount: string;
  trades: string;
  wins: string;
  tournaments_played: string;
  tournaments_won: string;
  wallet_balance_usd: string;
  wallet_bullfy_points: string;
  wallet_demo_balance: string;
};

export async function getCurrentSessionUser(): Promise<CurrentSessionUser | null> {
  const session = await getDemoSession();

  if (!session) {
    return null;
  }

  try {
    const row = await queryOne<DemoTraderSessionRow>(
      `
        select
          tr.id,
          tr.name,
          tr.handle,
          tr.email,
          tr.clan,
          tr.country,
          tr.membership,
          tr.avatar_url,
          tr.avatar_3d_url,
          tr.avatar_config,
          tr.avatar_provider,
          tr.avaturn_user_id,
          tr.avaturn_avatar_id,
          tr.preferred_pose,
          tr.created_at,
          min(nullif(p.rank, 0))::int as best_rank,
          min(nullif(p.rank, 0)) filter (where t.status = 'live')::int as current_rank,
          coalesce(sum(p.pnl), 0)::text as pnl_amount,
          coalesce(sum(p.trades_count), 0)::text as trades,
          coalesce(sum(round((p.win_rate_pct / 100) * p.trades_count)), 0)::text as wins,
          count(distinct p.tournament_id)::text as tournaments_played,
          count(distinct p.tournament_id) filter (where p.rank = 1 and t.status = 'finished')::text as tournaments_won,
          coalesce(wa.balance_usd, 0)::text as wallet_balance_usd,
          coalesce(wa.demo_balance, 1680)::text as wallet_demo_balance,
          coalesce(wa.bullfy_points, 538)::text as wallet_bullfy_points
        from demo_traders tr
        left join demo_tournament_participants p on p.trader_id = tr.id
        left join demo_tournaments t on t.id = p.tournament_id
        left join wallet_accounts wa on wa.trader_id = tr.id
        where tr.id = $1
        group by tr.id, wa.balance_usd, wa.demo_balance, wa.bullfy_points
        limit 1
      `,
      [session.traderId],
    );

    if (!row) {
      return {
        avatarUrl: "/avatars/karlos.svg",
        bmoneyBalance: 0,
        bullfyPoints: 0,
        email: session.email,
        handle: session.login,
        id: session.traderId,
        membershipStatus: "active",
        membershipTier: "free",
        name: session.name,
        referralCode: createReferralCode(session.login),
        stats: emptyStats(),
        walletBalanceUsd: 0,
      };
    }

    return mapDemoTraderSessionRow(row);
  } catch {
    return {
      avatarUrl: "/avatars/karlos.svg",
      bmoneyBalance: 0,
      bullfyPoints: 0,
      email: session.email,
      handle: session.login,
      id: session.traderId,
      membershipStatus: "active",
      membershipTier: "free",
      name: session.name,
      referralCode: createReferralCode(session.login),
      stats: emptyStats(),
      walletBalanceUsd: 0,
    };
  }
}

export async function getCurrentChatAuthor(): Promise<ChatAuthor | undefined> {
  const user = await getCurrentSessionUser();

  if (!user) {
    return undefined;
  }

  return {
    avatarUrl: user.avatarUrl,
    clan: user.clan,
    handle: user.handle,
    id: user.id,
    name: user.name,
    role: "trader",
  };
}

function mapDemoTraderSessionRow(row: DemoTraderSessionRow): CurrentSessionUser {
  const pnlAmount = Number(row.pnl_amount);
  const trades = Number(row.trades);
  const wins = Number(row.wins);
  const winRate = trades > 0 ? Math.round((wins / trades) * 100) : 0;
  const membershipTier = row.membership === "elite" ? "elite" : "free";

  return {
    avatar3dUrl: row.avatar_3d_url,
    avatarConfig: row.avatar_config,
    avatarProvider: row.avatar_provider,
    avatarUrl: row.avatar_url ?? "/avatars/karlos.svg",
    avaturnAvatarId: row.avaturn_avatar_id,
    avaturnUserId: row.avaturn_user_id,
    bmoneyBalance: Number(row.wallet_demo_balance),
    bullfyPoints: Number(row.wallet_bullfy_points),
    clan: row.clan ?? undefined,
    country: row.country ?? undefined,
    email: row.email,
    handle: row.handle,
    id: row.id,
    membershipStatus: "active",
    membershipTier,
    name: row.name,
    preferredPose: row.preferred_pose ?? "idle",
    referralCode: createReferralCode(row.handle),
    stats: {
      currentTournamentRank: row.current_rank ?? row.best_rank ?? 0,
      globalRank: row.best_rank ?? 0,
      pnlAmount,
      pnlPercent: Number(((pnlAmount / 10000) * 100).toFixed(2)),
      trades,
      tournamentsPlayed: Number(row.tournaments_played),
      tournamentsWon: Number(row.tournaments_won),
      winRate,
    },
    walletBalanceUsd: Number(row.wallet_balance_usd),
  };
}

function emptyStats(): CurrentSessionUser["stats"] {
  return {
    currentTournamentRank: 0,
    globalRank: 0,
    pnlAmount: 0,
    pnlPercent: 0,
    trades: 0,
    tournamentsPlayed: 0,
    tournamentsWon: 0,
    winRate: 0,
  };
}

function createReferralCode(handle: string) {
  const prefix = handle.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase();

  return `${prefix || "BFY"}2026`;
}
