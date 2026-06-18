import { getCurrentSessionUser } from "@/modules/auth/services/session-user";
import { getProfileDashboard, ProfileDashboardView } from "@/modules/profile";

export default async function ProfilePage() {
  const [dashboard, sessionUser] = await Promise.all([
    getProfileDashboard(),
    getCurrentSessionUser(),
  ]);

  return <ProfileDashboardView dashboard={dashboard} sessionUser={sessionUser} />;
}
