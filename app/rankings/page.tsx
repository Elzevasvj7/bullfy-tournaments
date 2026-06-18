import { getCurrentSessionUser } from "@/modules/auth/services/session-user";
import {
  getGlobalLeaderboard,
  LeaderboardOverview,
} from "@/modules/leaderboard";

export default async function RankingsPage() {
  const [leaderboard, sessionUser] = await Promise.all([
    getGlobalLeaderboard(),
    getCurrentSessionUser(),
  ]);

  return (
    <LeaderboardOverview leaderboard={leaderboard} sessionUser={sessionUser} />
  );
}
