import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTournamentAuth } from "@/hooks/useTournamentAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Wallet, Medal, Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TournamentDashboard() {
  const { user, wallet, loading } = useTournamentAuth();
  const [participations, setParticipations] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("tournament_participants")
        .select("id, status, current_score, current_equity, prize_won_usd, points_won, joined_at, mt5_login, tournaments(name, slug, status, type, modality)")
        .eq("user_id", user.id).order("joined_at", { ascending: false }).limit(20);
      setParticipations(data || []);
    })();
  }, [user]);

  if (loading) return <div className="text-muted-foreground">Cargando...</div>;
  if (!user) return <Navigate to="/tournament/login" replace />;

  return (
    <div className="space-y-6">
      <div className="flex justify-end pr-[180px]">
        <Button asChild variant="outline" size="sm">
          <Link to="/tournament/avatar"><Sparkles className="h-4 w-4 mr-2" />Personalizar avatar</Link>
        </Button>
      </div>
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wallet className="h-4 w-4" />Saldo USD</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">${wallet?.balance_usd ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Medal className="h-4 w-4 text-primary" />Bullfy Points</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{user.bullfy_points}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4" />Ganancias totales</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">${user.lifetime_winnings_usd}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Crown className="h-4 w-4 text-amber-400" />Estado Élite</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{user.is_elite ? "Activo" : "—"}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Mis torneos</CardTitle>
          <Button asChild variant="outline"><Link to="/tournament">Explorar lobby</Link></Button>
        </CardHeader>
        <CardContent>
          {participations.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aún no participas en ningún torneo. Ve al lobby para inscribirte.</p>
          ) : (
            <div className="space-y-2">
              {participations.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-md border border-border gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.tournaments?.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{p.tournaments?.type} · {p.tournaments?.modality} · {p.status}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-sm hidden sm:block">
                      <div>Score: <span className="font-semibold">{Number(p.current_score).toFixed(2)}</span></div>
                      <div className="text-xs text-muted-foreground">Equity ${Number(p.current_equity).toFixed(2)}</div>
                    </div>
                    <Button asChild size="sm" variant={p.mt5_login ? "outline" : "default"}>
                      <Link to={`/tournament/account/${p.id}`}>
                        {p.mt5_login ? "Cuenta MT5" : "Crear MT5"}
                      </Link>
                    </Button>
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
