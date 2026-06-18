import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCheck, ShieldCheck, Trophy, Swords, Coins, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useTournamentAuth } from "@/hooks/useTournamentAuth";

interface TNotif {
  id: string; type: string; title: string; message: string;
  link?: string | null; reference_id?: string | null; reference_type?: string | null;
  read: boolean; created_at: string;
}

const typeIcon: Record<string, typeof Bell> = {
  clan_war_challenge: Swords, clan_war_response: Swords, clan_war_result: Trophy,
  versus_invite: Swords, versus_response: Swords, versus_result: Trophy,
  verification_result: ShieldCheck, bp_award: Coins, clan_event: Sparkles,
};

const formatTime = (iso: string) => {
  const d = new Date(iso); const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000); if (m < 1) return "Ahora";
  if (m < 60) return `${m}m`; const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`; return `${Math.floor(h / 24)}d`;
};

export default function TournamentNotificationBell() {
  const { user, token } = useTournamentAuth();
  const [items, setItems] = useState<TNotif[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.read).length;

  const fetchList = useCallback(async () => {
    if (!user || !token) return;
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tournament-notifications?action=list`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (j.ok) setItems(j.notifications || []);
    } catch { /* noop */ }
  }, [user, token]);

  useEffect(() => {
    fetchList();
    const i = setInterval(fetchList, 25_000);
    const onFocus = () => fetchList();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(i); window.removeEventListener("focus", onFocus); };
  }, [fetchList]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const markRead = async (id: string) => {
    if (!token) return;
    setItems((p) => p.map((n) => n.id === id ? { ...n, read: true } : n));
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tournament-notifications?action=mark_read`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  };
  const markAll = async () => {
    if (!token) return;
    setItems((p) => p.map((n) => ({ ...n, read: true })));
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tournament-notifications?action=mark_all_read`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
  };

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-[#B6FF3D] text-[#060B1F] font-black text-[10px] flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-[#00E5FF]/20 bg-[#0a1129]/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 className="text-sm font-bold text-white">Notificaciones</h3>
            {unread > 0 && (
              <Button variant="ghost" size="sm" className="text-xs gap-1 h-7 text-gray-400 hover:text-white" onClick={markAll}>
                <CheckCheck className="w-3 h-3" /> Marcar todas
              </Button>
            )}
          </div>
          <ScrollArea className="max-h-80">
            {items.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">Sin notificaciones</div>
            ) : (
              <div className="divide-y divide-white/5">
                {items.map((n) => {
                  const Icon = typeIcon[n.type] || Bell;
                  const body = (
                    <div className={cn("flex gap-3 px-4 py-3 cursor-pointer hover:bg-white/5", !n.read && "bg-[#00E5FF]/5")}
                      onClick={() => !n.read && markRead(n.id)}>
                      <div className="mt-0.5 text-[#00E5FF] shrink-0"><Icon className="w-4 h-4" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn("text-xs font-medium truncate", n.read ? "text-gray-400" : "text-white")}>{n.title}</p>
                          <span className="text-[10px] text-gray-500 shrink-0">{formatTime(n.created_at)}</span>
                        </div>
                        <p className="text-[11px] text-gray-400 line-clamp-2 mt-0.5">{n.message}</p>
                      </div>
                      {!n.read && <div className="mt-1.5 w-2 h-2 rounded-full bg-[#B6FF3D] shrink-0" />}
                    </div>
                  );
                  return n.link ? <Link key={n.id} to={n.link} onClick={() => setOpen(false)}>{body}</Link> : <div key={n.id}>{body}</div>;
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
