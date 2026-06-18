import type { RankingCacheRow, RankingEntry, RankingUserRow } from "./types";

const CLAN_NAMES = [
  "Bullfy Clan",
  "Alpha Clan",
  "Moon Clan",
  "Legend Clan",
  "Gold Clan",
];

export function mapRankingEntry(
  row: RankingCacheRow,
  user?: RankingUserRow,
): RankingEntry {
  const totalPoints = Number(row.total_points ?? 0);
  const winnings = Number(row.total_winnings_usd ?? 0);
  const position = Number(row.rank ?? 0);
  const scorePercent = getScorePercent(totalPoints, winnings, position);
  const pnl = winnings > 0 ? winnings : scorePercent * 13.7;

  return {
    userId: row.user_id,
    country: user?.country || "",
    fullName: user?.full_name || "Trader sin nombre",
    username: user?.username || null,
    publicProfile: Boolean(user?.public_profile),
    avatarUrl: user?.avatar_url || null,
    traderId: `TR-${row.user_id.slice(0, 6).toUpperCase()}`,
    traderName: user?.full_name || user?.username || "Trader sin nombre",
    clanName: CLAN_NAMES[(position - 1) % CLAN_NAMES.length] || "Bullfy Clan",
    position,
    previousPosition: Math.max(1, position + getPositionDelta(position)),
    scorePercent,
    pnl,
    balance: 10_000 + pnl,
    trades: 18 + ((position * 7 + totalPoints) % 43),
    winRate: clamp(42 + ((totalPoints + position * 3) % 27), 0, 100),
    total_winnings_usd: winnings,
    total_points: totalPoints,
  };
}

function getScorePercent(totalPoints: number, winnings: number, position: number) {
  if (winnings !== 0) {
    return Number((winnings / 100).toFixed(2));
  }

  if (totalPoints === 0) {
    return Number((Math.max(1, 12 - position) * -0.17).toFixed(2));
  }

  return Number(((totalPoints / 1000) - position * 0.08).toFixed(2));
}

function getPositionDelta(position: number) {
  if (position <= 3) return 0;
  if (position % 4 === 0) return 2;
  if (position % 5 === 0) return -1;
  return 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
