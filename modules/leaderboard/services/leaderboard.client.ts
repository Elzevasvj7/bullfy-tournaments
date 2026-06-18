import type { Leaderboard } from "../types";
import { mapLeaderboard } from "./leaderboard.mapper";
import { leaderboardMockDtos } from "./leaderboard.mock";

export async function getGlobalLeaderboard(): Promise<Leaderboard> {
  return mapLeaderboard(leaderboardMockDtos[0]);
}

export async function getTournamentLeaderboard(
  tournamentSlug: string,
): Promise<Leaderboard | null> {
  const leaderboard = leaderboardMockDtos.find(
    (item) => item.leaderboard_id === `${tournamentSlug}_live`,
  );

  return leaderboard ? mapLeaderboard(leaderboard) : null;
}
