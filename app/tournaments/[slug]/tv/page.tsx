import { notFound } from "next/navigation";
import { ArenaLiveView, getArenaState } from "@/modules/arena";
import { getCurrentChatAuthor } from "@/modules/auth/services/session-user";
import { getChatRoom } from "@/modules/chat";
import { getTournamentBySlugAction } from "@/modules/tournaments/services/tournament.actions";

type TournamentTvPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function TournamentTvPage({ params }: TournamentTvPageProps) {
  const { slug } = await params;
  const [tournament, arena, chatRoom, currentChatUser] = await Promise.all([
    getTournamentBySlugAction(slug),
    getArenaState(slug),
    getChatRoom(slug),
    getCurrentChatAuthor(),
  ]);

  if (!tournament || !arena || !chatRoom) {
    notFound();
  }

  return (
    <ArenaLiveView
      arena={arena}
      chatRoom={chatRoom}
      currentChatUser={currentChatUser}
      initialMode="tv"
      tournament={tournament}
    />
  );
}
