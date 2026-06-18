import { useEffect, useState } from "react";
import {
  getGlobalLeaderboard,
  LeaderboardTable,
  type Leaderboard,
} from "@/tournament-core/modules/leaderboard";

export default function TournamentRankings() {
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLeaderboard() {
      setLoading(true);
      setError(null);

      try {
        const nextLeaderboard = await getGlobalLeaderboard();
        if (!cancelled) {
          setLeaderboard(nextLeaderboard);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "No se pudo cargar el ranking.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadLeaderboard();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <LeaderboardTable
        entries={leaderboard?.entries ?? []}
        loading={loading}
        title={leaderboard?.title ?? "Ranking global"}
      />
      {error ? (
        <p className="border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}
