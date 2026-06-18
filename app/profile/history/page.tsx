import { getCurrentSessionUser } from "@/modules/auth/services/session-user";
import { getProfileDashboard, ProfileHistoryView } from "@/modules/profile";

export default async function ProfileHistoryPage() {
  const [dashboard, sessionUser] = await Promise.all([
    getProfileDashboard(),
    getCurrentSessionUser(),
  ]);

  return <ProfileHistoryView dashboard={dashboard} sessionUser={sessionUser} />;
}
