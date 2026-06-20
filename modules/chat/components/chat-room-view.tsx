import Link from "next/link";
import { AppHeader } from "@/shared/components/app-header";
import type { CurrentSessionUser } from "@/modules/auth/types";
import { ChatPanel } from "./chat-panel";
import type { ChatAuthor, ChatRoom } from "../types";

type ChatRoomViewProps = {
  currentUser?: ChatAuthor;
  room: ChatRoom;
  sessionUser?: CurrentSessionUser | null;
};

export function ChatRoomView({
  currentUser,
  room,
  sessionUser = null,
}: ChatRoomViewProps) {
  return (
    <main className="min-h-screen bg-[#050b12] text-white">
      <AppHeader active="chat" user={sessionUser} />
      <section className="mx-auto grid w-full max-w-7xl gap-5 px-5 py-5 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-5">
          <section className="rounded-none border border-white/10 bg-[#0d1620] p-5">
            <Link
              href="/"
              className="text-sm font-medium text-cyan-200 hover:text-cyan-100"
            >
              Volver a torneos
            </Link>
            <h1 className="mt-5 text-3xl font-semibold tracking-normal">
              Social
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Chat global, actividad de torneo y mensajes del sistema.
            </p>
          </section>

          <section className="rounded-none border border-white/10 bg-[#0d1620] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Estado
            </p>
            <div className="mt-4 space-y-3">
              <StatRow label="Sala" value={room.scope} />
              <StatRow label="Online" value={String(room.onlineCount)} />
              <StatRow label="Slow mode" value={`${room.slowModeSeconds}s`} />
            </div>
          </section>
        </aside>

        <div className="min-w-0">
          <ChatPanel currentUser={currentUser} room={room} />
        </div>
      </section>
    </main>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-white/10 bg-black/20 px-3 py-2">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-semibold capitalize text-white">
        {value}
      </span>
    </div>
  );
}
