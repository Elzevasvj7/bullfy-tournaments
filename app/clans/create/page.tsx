import { getCurrentSessionUser } from "@/modules/auth/services/session-user";
import { ClanCreateView } from "@/modules/clans";

export default async function CreateClanPage() {
  const sessionUser = await getCurrentSessionUser();

  return <ClanCreateView sessionUser={sessionUser} />;
}
