import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import TournamentAvatar from "./components/TournamentAvatar";
import TournamentAvatar3D from "./components/TournamentAvatar3D";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Award, TrendingUp, Target, Coins, Crown, Share2, Calendar, ShieldCheck, BadgeCheck } from "lucide-react";
import { toast } from "sonner";

export default function TournamentProfile() {
  const { username } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tournament-public-profile?username=${encodeURIComponent(username || "")}`;
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      });
      const j = await r.json();
      if (!j.ok) setError(j.error || "Error");
      else setData(j);
      setLoading(false);
    })();
  }, [username]);

  const share = async () => {
    const url = `https://bullfytech.online/tournament/p/${username}`;
    if (navigator.share) {
      try { await navigator.share({ title: `Perfil de ${data?.user?.full_name}`, url }); } catch { /* noop */ }
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Enlace copiado");
    }
  };

  if (loading) return <div className="text-muted-foreground p-8 text-center">Cargando perfil...</div>;
  if (error) return (
    <div className="p-8 text-center">
      <p className="text-destructive mb-4">{error}</p>
      <Button asChild variant="outline"><Link to="/tournament">Volver al lobby</Link></Button>
    </div>
  );
  if (!data) return null;

  const { user, stats, achievements, recent_tournaments } = data;
  const initials = (user.full_name || user.username || "??").split(" ").map((s: string) => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Hero */}
      <Card className="overflow-hidden">
        <div className="h-32 bg-gradient-to-br from-primary/30 via-primary/10 to-background" />
        <CardContent className="pt-0 -mt-16 relative">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
            {user.avatar_3d_url ? (
              <TournamentAvatar3D
                url={user.avatar_3d_url}
                fallbackConfig={user.avatar_config}
                fallbackUrl={user.avatar_url}
                fallbackSeed={user.username || user.full_name}
                mood="happy"
                animation={(user as any).preferred_pose || "idle"}
                gender={(user as any).avatar_config?.gender || "masculine"}
                fullBody
                shape="portrait"
                size={200}
                interactive
                className="border-4 border-background ring-2 ring-primary/30 shadow-2xl"
              />
            ) : user.avatar_config ? (
              <TournamentAvatar
                config={user.avatar_config}
                fallbackUrl={user.avatar_url}
                fallbackSeed={user.username || user.full_name}
                mood="happy"
                size={128}
                className="border-4 border-background ring-2 ring-primary/30"
              />
            ) : (
              <Avatar className="h-32 w-32 border-4 border-background ring-2 ring-primary/30">
                <AvatarImage src={user.avatar_url || ""} />
                <AvatarFallback className="text-3xl bg-primary text-primary-foreground">{initials}</AvatarFallback>
              </Avatar>
            )}
            <div className="flex-1 pb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{user.full_name || user.username}</h1>
                {user.is_verified_user && <BadgeCheck className="h-5 w-5 text-[#00E5FF]" />}
                {user.is_elite && <Badge className="bg-amber-500 text-amber-950 border-0"><Crown className="h-3 w-3 mr-1" />Élite</Badge>}
                {user.clan && (
                  <Link to={`/tournament/clans/${user.clan.id}`}>
                    <Badge variant="outline" className="flex items-center gap-1">
                      {user.clan.logo_url
                        ? <img src={user.clan.logo_url} className="h-3 w-3 rounded-sm object-cover" alt="" />
                        : null}
                      [{user.clan.tag}] {user.clan.name}
                      {user.clan.is_verified && <ShieldCheck className="h-3 w-3 text-[#00E5FF]" />}
                    </Badge>
                  </Link>
                )}
              </div>

              <p className="text-muted-foreground">@{user.username} {user.country && `· ${user.country}`}</p>
              {user.bio && <p className="text-sm mt-2">{user.bio}</p>}
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Miembro desde {new Date(user.member_since).toLocaleDateString()}
              </p>
            </div>
            <Button onClick={share} variant="outline"><Share2 className="h-4 w-4 mr-2" />Compartir</Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Trophy className="h-5 w-5 text-amber-500" />} label="Victorias" value={stats.wins} />
        <StatCard icon={<Award className="h-5 w-5 text-blue-500" />} label="Podios" value={stats.podiums} />
        <StatCard icon={<Target className="h-5 w-5 text-emerald-500" />} label="Win Rate" value={`${stats.win_rate_pct}%`} />
        <StatCard icon={<TrendingUp className="h-5 w-5 text-purple-500" />} label="Avg P/L" value={`${stats.avg_profit_pct >= 0 ? "+" : ""}${stats.avg_profit_pct}%`} />
        <StatCard icon={<Coins className="h-5 w-5 text-yellow-500" />} label="Bullfy Points" value={user.bullfy_points} />
        <StatCard icon={<Trophy className="h-5 w-5 text-primary" />} label="Torneos" value={stats.total_tournaments} />
        <StatCard icon={<Award className="h-5 w-5 text-pink-500" />} label="Ganancias" value={`$${Number(user.lifetime_winnings_usd || 0).toFixed(0)}`} />
        <StatCard icon={<Crown className="h-5 w-5 text-amber-500" />} label="Ranking BP" value={`#${stats.global_rank}`} />
      </div>

      {/* Achievements */}
      <Card>
        <CardHeader><CardTitle>Logros desbloqueados ({achievements.length})</CardTitle></CardHeader>
        <CardContent>
          {achievements.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aún no ha desbloqueado logros.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {achievements.map((a: any) => (
                <div key={a.code} className="border border-border rounded-lg p-3 text-center bg-muted/30">
                  <div className="text-3xl mb-1">{a.icon || "🏅"}</div>
                  <div className="font-semibold text-sm">{a.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">+{a.reward_points} BP</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent tournaments */}
      <Card>
        <CardHeader><CardTitle>Últimos torneos</CardTitle></CardHeader>
        <CardContent>
          {recent_tournaments.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin participaciones aún.</p>
          ) : (
            <div className="space-y-2">
              {recent_tournaments.map((t: any, i: number) => (
                <div key={i} className="flex items-center justify-between border-b border-border/50 py-2 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">{new Date(t.joined_at).toLocaleDateString()}</div>
                    <div>{t.final_rank ? `Posición #${t.final_rank}` : `Estado: ${t.status}`}</div>
                  </div>
                  <div className="text-right">
                    <div className={Number(t.profit_pct) >= 0 ? "text-emerald-500" : "text-red-500"}>
                      {Number(t.profit_pct) >= 0 ? "+" : ""}{Number(t.profit_pct).toFixed(2)}%
                    </div>
                    {t.prize_won_usd > 0 && <div className="text-xs text-amber-500">${Number(t.prize_won_usd).toFixed(2)}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">{icon}{label}</div>
        <div className="text-xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
