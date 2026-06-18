import { supabase } from "@/integrations/supabase/client";
import { mapRankingEntry } from "../mappers";
import type { Leaderboard, RankingCacheRow, RankingUserRow } from "../types";

export async function getGlobalLeaderboard(limit = 100): Promise<Leaderboard> {
  const { data: ranks, error } = await supabase
    .from("tournament_rankings_cache")
    .select("rank, user_id, total_winnings_usd, total_points")
    .eq("scope", "global")
    .eq("period", "all_time")
    .order("rank", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  const rows = (ranks || []) as RankingCacheRow[];
  const usersById = await getUsersById(rows.map((row) => row.user_id));

  return {
    id: "global-all-time",
    title: "Ranking global",
    scope: "global",
    updatedAt: new Date().toISOString(),
    entries: rows.map((row) => mapRankingEntry(row, usersById.get(row.user_id))),
  };
}

async function getUsersById(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, RankingUserRow>();
  }

  const { data, error } = await supabase
    .from("tournament_users")
    .select("id, full_name, country, avatar_url, username, public_profile")
    .in("id", userIds);

  if (error) {
    throw error;
  }

  return new Map(
    ((data || []) as RankingUserRow[]).map((user) => [user.id, user]),
  );
}
