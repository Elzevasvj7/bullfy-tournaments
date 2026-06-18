import { getCurrentSessionUser } from "@/modules/auth/services/session-user";
import { getVersusDashboard, VersusOverview } from "@/modules/versus";

export default async function VersusPage() {
  const [dashboard, sessionUser] = await Promise.all([
    getVersusDashboard(),
    getCurrentSessionUser(),
  ]);

  return <VersusOverview dashboard={dashboard} sessionUser={sessionUser} />;
}
