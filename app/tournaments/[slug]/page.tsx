import { notFound } from "next/navigation";
import { getArenaState } from "@/modules/arena";
import { getCurrentSessionUser } from "@/modules/auth/services/session-user";
import { TournamentDetailView } from "@/modules/tournaments/components/tournament-detail-view";
import { getTournamentBySlugAction } from "@/modules/tournaments/services/tournament.actions";

type TournamentPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function TournamentPage({ params }: TournamentPageProps) {
  const { slug } = await params;
  const [tournament, arena, sessionUser] = await Promise.all([
    getTournamentBySlugAction(slug),
    getArenaState(slug),
    getCurrentSessionUser(),
  ]);

  if (!tournament) {
    notFound();
  }

  return (
    <TournamentDetailView
      arena={arena}
      sessionUser={sessionUser}
      tournament={tournament}
    />
  );
}
