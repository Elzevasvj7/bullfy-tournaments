import { notFound } from "next/navigation";
import { getCurrentSessionUser } from "@/modules/auth/services/session-user";
import {
  ClanDetailView,
  getClanBySlug,
  getClanDashboard,
} from "@/modules/clans";

type ClanDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ClanDetailPage({ params }: ClanDetailPageProps) {
  const { slug } = await params;
  const [clan, dashboard, sessionUser] = await Promise.all([
    getClanBySlug(slug),
    getClanDashboard(),
    getCurrentSessionUser(),
  ]);

  if (!clan) {
    notFound();
  }

  return (
    <ClanDetailView
      clan={clan}
      dashboard={dashboard}
      sessionUser={sessionUser}
    />
  );
}
