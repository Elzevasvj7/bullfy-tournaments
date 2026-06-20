import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentSessionUser } from "@/modules/auth/services/session-user";
import { AvatarStudio } from "@/modules/profile/components/avatar-studio";
import { getAvatarProfile } from "@/modules/profile/services/avatar.server";
import { AppHeader } from "@/shared/components/app-header";

export default async function ProfileAvatarPage() {
  const sessionUser = await getCurrentSessionUser();
  const avatarProfile = sessionUser
    ? await getAvatarProfile(sessionUser.id)
    : {
        avatarConfig: {},
        avatarProvider: null,
        avatarUrl: null,
        avaturnAvatarId: null,
        avaturnUserId: null,
        preferredPose: "idle",
        updatedAt: null,
      };
  const initials =
    sessionUser?.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "BU";

  return (
    <main className="tournament-neon min-h-screen overflow-hidden text-white">
      <AvatarBackground />
      <div className="relative z-10">
        <AppHeader active="perfil" user={sessionUser} />

        <section className="mx-auto w-full max-w-7xl px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 text-sm font-black text-slate-400 transition hover:text-bullfy-neon-blue"
          >
            <ArrowLeft className="size-4" />
            Volver al perfil
          </Link>

          <div className="mt-5">
            <AvatarStudio
              initialProfile={avatarProfile}
              initials={initials}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function AvatarBackground() {
  return (
    <div className="absolute inset-0 z-0">
      <video
        autoPlay
        loop
        muted
        playsInline
        poster="/videos/tournament-poster.jpg"
        className="h-full w-full object-cover opacity-24"
      >
        <source src="/videos/tournament-bg.webm" type="video/webm" />
        <source src="/videos/tournament-bg.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,9,18,0.74),rgba(4,9,18,0.94)_36%,rgba(4,9,18,0.99))]" />
    </div>
  );
}
