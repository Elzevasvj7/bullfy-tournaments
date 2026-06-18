import type { CurrentSessionUser } from "@/modules/auth/types";
import { AppHeader } from "@/shared/components/app-header";

export function ClanShell({
  children,
  sessionUser = null,
}: {
  children: React.ReactNode;
  sessionUser?: CurrentSessionUser | null;
}) {
  return (
    <main className="tournament-neon relative min-h-screen overflow-hidden text-white">
      <video
        aria-hidden
        autoPlay
        className="fixed inset-0 z-0 h-screen w-screen object-cover pointer-events-none"
        loop
        muted
        playsInline
        poster="/videos/tournament-poster.jpg"
        preload="auto"
      >
        <source src="/videos/tournament-bg.webm" type="video/webm" />
        <source src="/videos/tournament-bg.mp4" type="video/mp4" />
      </video>
      <div className="fixed inset-0 z-0 bg-[#060B1F]/50 pointer-events-none" aria-hidden />
      <div
        className="fixed inset-0 z-0 bg-gradient-to-b from-[#060B1F]/10 via-[#060B1F]/35 to-[#060B1F]/80 pointer-events-none"
        aria-hidden
      />
      <AppHeader active="clanes" user={sessionUser} />
      <section className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </section>
    </main>
  );
}
