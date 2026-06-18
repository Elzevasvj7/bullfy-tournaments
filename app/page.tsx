import { getCurrentSessionUser } from "@/modules/auth/services/session-user";
import { TournamentsOverview } from "@/modules/tournaments";
import { getTournamentsAction } from "@/modules/tournaments/services/tournament.actions";

export default async function Home() {
  const [tournaments, sessionUser] = await Promise.all([
    getTournamentsAction(),
    getCurrentSessionUser(),
  ]);

  return <TournamentsOverview sessionUser={sessionUser} tournaments={tournaments} />;
}
