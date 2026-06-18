import { getCurrentSessionUser } from "@/modules/auth/services/session-user";
import { ClansOverview, getClanDashboard } from "@/modules/clans";

export default async function ClansPage() {
  const [dashboard, sessionUser] = await Promise.all([
    getClanDashboard(),
    getCurrentSessionUser(),
  ]);

  return <ClansOverview dashboard={dashboard} sessionUser={sessionUser} />;
}
