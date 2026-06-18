import { getCurrentSessionUser } from "@/modules/auth/services/session-user";
import { CreateTournamentForm } from "@/modules/tournaments";
import { AppHeader } from "@/shared/components/app-header";

export default async function CreateTournamentPage() {
  const sessionUser = await getCurrentSessionUser();

  return (
    <div className="min-h-screen">
      <AppHeader active="torneos" user={sessionUser} />
      <CreateTournamentForm />
    </div>
  );
}
