import { Outlet } from "react-router-dom";
import {
  TournamentAuthProvider,
  useTournamentAuth,
} from "@/hooks/useTournamentAuth";
import { TournamentHeader } from "@/tournament-core/components";
import TournamentAvatarOverlay from "./components/TournamentAvatarOverlay";
import TournamentNotificationBell from "./components/TournamentNotificationBell";

function Shell() {
  const { user, wallet, logout } = useTournamentAuth();

  return (
    <div className="tournament-neon">
      <video
        className="pointer-events-none fixed inset-0 z-0 h-screen w-screen object-cover"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster="/videos/tournament-poster.jpg"
        aria-hidden
      >
        <source src="/videos/tournament-bg.webm" type="video/webm" />
        <source src="/videos/tournament-bg.mp4" type="video/mp4" />
      </video>
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-[#060B1F]/35"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-[#060B1F]/10 via-[#060B1F]/25 to-[#060B1F]/60"
        aria-hidden
      />

      <TournamentHeader
        user={user}
        wallet={wallet}
        onLogout={logout}
        notificationSlot={<TournamentNotificationBell />}
      />
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="relative z-10 mt-12 border-t border-white/5 py-6 text-center text-[10px] uppercase tracking-[0.3em] text-slate-500">
        {new Date().getFullYear()} Bullfy Tournament - powered by Bullfy
      </footer>
      <TournamentAvatarOverlay />
    </div>
  );
}

export default function TournamentLayout() {
  return (
    <TournamentAuthProvider>
      <Shell />
    </TournamentAuthProvider>
  );
}
