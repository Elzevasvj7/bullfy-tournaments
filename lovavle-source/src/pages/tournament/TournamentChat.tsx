import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, Crown, MessageCircle, ShieldCheck, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { useTournamentAuth } from "@/hooks/useTournamentAuth";

type ChatMsg = {
  id: string;
  message: string;
  created_at: string;
  user: { id: string; username?: string; full_name?: string; avatar_url?: string; is_elite?: boolean; is_verified_user?: boolean; clan_tag?: string | null; clan_verified?: boolean };
};


export default function TournamentChat({ tournamentId }: { tournamentId: string }) {
  const { user, token } = useTournamentAuth();
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tournament-chat?action=list&tournament_id=${tournamentId}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` } });
    const j = await r.json();
    if (j.ok) setMsgs(j.messages || []);
  };

  useEffect(() => {
    load();
    // Realtime subscription
    const ch = supabase
      .channel(`tournament_chat_${tournamentId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "tournament_chat_messages",
        filter: `tournament_id=eq.${tournamentId}`,
      }, async (payload: any) => {
        // Fetch user info for the new message
        const { data: u } = await supabase
          .from("tournament_users")
          .select("id, username, full_name, avatar_url, is_elite, is_verified_user, clan_id, tournament_clans(tag, is_verified)")
          .eq("id", payload.new.user_id)
          .maybeSingle();
        const uany: any = u || {};
        setMsgs((prev) => [...prev, {
          id: payload.new.id,
          message: payload.new.message,
          created_at: payload.new.created_at,
          user: {
            id: payload.new.user_id,
            username: uany.username,
            full_name: uany.full_name,
            avatar_url: uany.avatar_url,
            is_elite: uany.is_elite,
            is_verified_user: uany.is_verified_user,
            clan_tag: uany.tournament_clans?.tag || null,
            clan_verified: uany.tournament_clans?.is_verified || false,
          },
        }]);

      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tournamentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const send = async () => {
    if (!text.trim() || sending) return;
    if (!user || !token) { toast.error("Inicia sesión para chatear"); return; }
    setSending(true);
    const body = JSON.stringify({ tournament_id: tournamentId, message: text.trim() });
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tournament-chat?action=send`;
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body,
    });
    const j = await r.json();
    if (!j.ok) toast.error(j.error || "Error");
    else setText("");
    setSending(false);
  };

  return (
    <Card className="flex flex-col h-[500px]">
      <CardHeader className="py-3 border-b border-border">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="h-4 w-4" /> Chat del torneo
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-3 space-y-2">
        {msgs.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">Sé el primero en escribir 🔥</p>
        )}
        {msgs.map((m) => {
          const initials = (m.user?.full_name || m.user?.username || "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
          return (
            <div key={m.id} className="flex gap-2 text-sm">
              <Link to={`/tournament/p/${m.user?.username || ""}`}>
                <Avatar className="h-7 w-7">
                  <AvatarImage src={m.user?.avatar_url || ""} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-xs">
                  <Link to={`/tournament/p/${m.user?.username || ""}`} className="font-semibold hover:underline truncate">
                    {m.user?.full_name || m.user?.username || "Anónimo"}
                  </Link>
                  {m.user?.is_verified_user && <BadgeCheck className="h-3 w-3 text-[#00E5FF]" />}
                  {m.user?.is_elite && <Crown className="h-3 w-3 text-amber-500" />}
                  {m.user?.clan_tag && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 flex items-center gap-0.5">
                      [{m.user.clan_tag}]
                      {m.user?.clan_verified && <ShieldCheck className="h-2.5 w-2.5 text-[#00E5FF]" />}
                    </Badge>
                  )}
                  <span className="text-muted-foreground">· {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>

                <p className="text-sm break-words">{m.message}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </CardContent>
      <div className="p-3 border-t border-border flex gap-2">
        {user ? (
          <>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Escribe un mensaje..."
              maxLength={280}
              disabled={sending}
            />
            <Button size="icon" onClick={send} disabled={sending || !text.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button asChild className="w-full" variant="outline">
            <Link to="/tournament/login">Inicia sesión para chatear</Link>
          </Button>
        )}
      </div>
    </Card>
  );
}
