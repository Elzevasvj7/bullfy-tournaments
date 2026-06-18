import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTournamentAuth } from "@/hooks/useTournamentAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldCheck, Users, Trophy, Plus, Swords } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function TournamentClans() {
  const { user, token, refresh } = useTournamentAuth();
  const [clans, setClans] = useState<any[]>([]);
  const [wars, setWars] = useState<any[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("tournament_clan_rankings_cache")
      .select("rank, clan_id, avg_member_score, wars_won, rating, members_count")
      .order("rank").limit(100);
    const ids = (data || []).map((r) => r.clan_id);
    const { data: cs } = ids.length
      ? await supabase.from("tournament_clans").select("id, name, tag, logo_url, is_verified").in("id", ids)
      : { data: [] as any[] };
    const map = new Map((cs || []).map((c: any) => [c.id, c]));
    setClans((data || []).map((r) => ({ ...r, clan: map.get(r.clan_id) })));

    // Public Clan Wars (active + recent)
    const { data: ws } = await supabase.from("tournament_clan_wars")
      .select("id, status, stake_usd, created_at, accepted_at, settled_at, challenger_clan_id, defender_clan_id, winner_clan_id")
      .in("status", ["pending", "accepted", "in_progress", "settled", "finished"])
      .order("created_at", { ascending: false }).limit(20);
    const wIds = Array.from(new Set([
      ...(ws || []).map((w: any) => w.challenger_clan_id),
      ...(ws || []).map((w: any) => w.defender_clan_id),
    ].filter(Boolean)));
    const { data: wc } = wIds.length
      ? await supabase.from("tournament_clans").select("id, name, tag, logo_url, is_verified").in("id", wIds)
      : { data: [] as any[] };
    const wmap = new Map((wc || []).map((c: any) => [c.id, c]));
    setWars((ws || []).map((w: any) => ({
      ...w,
      challenger: wmap.get(w.challenger_clan_id),
      defender: wmap.get(w.defender_clan_id),
    })));
  };

  useEffect(() => { load(); }, []);

  const join = async () => {
    if (!token) { toast({ title: "Inicia sesión", variant: "destructive" }); return; }
    setBusy(true);
    const { data } = await supabase.functions.invoke("tournament-clan-join", {
      headers: { Authorization: `Bearer ${token}` }, body: { invite_code: code },
    });
    setBusy(false);
    if (!data?.ok) { toast({ title: data?.error || "Error", variant: "destructive" }); return; }
    toast({ title: `Te uniste a ${data.clan_name}` });
    refresh(); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black t-display flex items-center gap-2"><Shield className="text-[#00E5FF]" /> Clanes</h1>
        {user && !user.clan_id && (
          <Link to="/tournament/clans/create">
            <Button className="bg-[#B6FF3D] text-black hover:brightness-110"><Plus className="h-4 w-4 mr-1" /> Crear clan</Button>
          </Link>
        )}
        {user?.clan_id && (
          <Link to={`/tournament/clans/${user.clan_id}`}>
            <Button variant="outline" className="border-[#00E5FF] text-[#00E5FF]">Mi clan</Button>
          </Link>
        )}
      </div>

      {user && !user.clan_id && (
        <Card className="bg-[#0a1129]/60 border-[#00E5FF]/20">
          <CardHeader><CardTitle className="text-sm">Unirme con código</CardTitle></CardHeader>
          <CardContent className="flex gap-2">
            <Input placeholder="BULL-XXXXXXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono uppercase" />
            <Button onClick={join} disabled={busy || !code}>Unirme</Button>
          </CardContent>
        </Card>
      )}

      <Card className="bg-[#0a1129]/60 border-[#00E5FF]/20">
        <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-[#B6FF3D]" /> Ranking de clanes</CardTitle></CardHeader>
        <CardContent>
          {clans.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay clanes en el ranking.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {clans.map((r) => (
                <Link key={r.clan_id} to={`/tournament/clans/${r.clan_id}`} className="flex items-center justify-between py-3 hover:bg-white/5 px-2 rounded">
                  <div className="flex items-center gap-3">
                    <span className="font-black text-[#00E5FF] w-8">#{r.rank}</span>
                    {r.clan?.logo_url
                      ? <img src={r.clan.logo_url} alt="" className="w-8 h-8 rounded object-cover" />
                      : <div className="w-8 h-8 rounded bg-[#00E5FF]/20 flex items-center justify-center text-[10px] font-bold">{r.clan?.tag}</div>}
                    <div>
                      <div className="font-bold flex items-center gap-1">
                        {r.clan?.name}
                        {r.clan?.is_verified && <ShieldCheck className="h-4 w-4 text-[#00E5FF]" />}
                        <Badge variant="outline" className="text-[10px] ml-1">[{r.clan?.tag}]</Badge>
                      </div>
                      <div className="text-[11px] text-gray-400 flex items-center gap-2">
                        <Users className="h-3 w-3" />{r.members_count} · 🏆 {r.wars_won}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-[#B6FF3D]">{r.rating}</div>
                    <div className="text-[10px] text-gray-400">RATING</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-[#0a1129]/60 border-[#00E5FF]/20">
        <CardHeader><CardTitle className="flex items-center gap-2"><Swords className="h-5 w-5 text-[#B6FF3D]" /> Clan Wars públicas</CardTitle></CardHeader>
        <CardContent>
          {wars.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay clan wars registradas.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {wars.map((w) => {
                const statusColor =
                  w.status === "pending" ? "text-amber-400" :
                  w.status === "settled" || w.status === "finished" ? "text-gray-400" :
                  "text-[#B6FF3D]";
                return (
                  <div key={w.id} className="flex items-center justify-between py-3 px-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center gap-1">
                        <Link to={`/tournament/clans/${w.challenger_clan_id}`} className="font-bold text-sm hover:underline truncate">
                          [{w.challenger?.tag}] {w.challenger?.name}
                        </Link>
                        {w.challenger?.is_verified && <ShieldCheck className="h-3 w-3 text-[#00E5FF]" />}
                        {w.winner_clan_id === w.challenger_clan_id && <span title="Ganador">👑</span>}
                      </div>
                      <Swords className="h-3 w-3 text-gray-400" />
                      <div className="flex items-center gap-1">
                        <Link to={`/tournament/clans/${w.defender_clan_id}`} className="font-bold text-sm hover:underline truncate">
                          [{w.defender?.tag}] {w.defender?.name}
                        </Link>
                        {w.defender?.is_verified && <ShieldCheck className="h-3 w-3 text-[#00E5FF]" />}
                        {w.winner_clan_id === w.defender_clan_id && <span title="Ganador">👑</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-[#B6FF3D]">${Number(w.stake_usd).toFixed(0)}</div>
                      <div className={`text-[10px] uppercase ${statusColor}`}>{w.status}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>

  );
}
