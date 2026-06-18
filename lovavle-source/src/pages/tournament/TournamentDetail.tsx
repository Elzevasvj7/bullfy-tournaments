import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTournamentAuth } from "@/hooks/useTournamentAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trophy, Users, Calendar, DollarSign, Clock, Activity } from "lucide-react";
import { TournamentHighlights } from "./components/TournamentHighlights";

export default function TournamentDetail() {
  const { slug } = useParams();
  const { user, token, refresh } = useTournamentAuth();
  const nav = useNavigate();
  const [t, setT] = useState<any>(null);
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);

  const load = async () => {
    if (!slug) return;
    setLoading(true);
    const { data } = await supabase.functions.invoke("tournament-leaderboard", {
      method: "GET" as any,
    } as any);
    // fallback: query directly
    const { data: tour } = await supabase.from("tournaments").select("*").eq("slug", slug).maybeSingle();
    setT(tour);
    if (tour) {
      const { data: ps } = await supabase.from("tournament_participants")
        .select("id, user_id, current_score, current_equity, profit_pct, trades_count, status, final_rank, prize_won_usd, points_won")
        .eq("tournament_id", tour.id).order("current_score", { ascending: false });
      const ids = (ps || []).map((p) => p.user_id);
      const { data: us } = ids.length
        ? await supabase.from("tournament_users").select("id, full_name, country").in("id", ids)
        : { data: [] };
      const map = new Map((us || []).map((u: any) => [u.id, u]));
      setParts((ps || []).map((p, i) => ({ rank: i + 1, ...p, user: map.get(p.user_id) })));
      if (user) {
        const mine = (ps || []).find((p) => p.user_id === user.id);
        setMyParticipantId(mine?.id || null);
      }
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [slug]);

  const handleJoin = async () => {
    if (!user) { nav(`/tournament/login`); return; }
    if (!t) return;
    setJoining(true);
    try {
      const { data, error } = await supabase.functions.invoke("tournament-join", {
        body: { tournament_id: t.id },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (error || !data?.ok) { toast.error(data?.error || error?.message || "No se pudo inscribir"); return; }
      toast.success("¡Inscripción exitosa! Crea tu cuenta MT5 desde tu panel.");
      await refresh();
      await load();
      if (data?.participant?.id) nav(`/tournament/account/${data.participant.id}`);
    } finally { setJoining(false); }
  };


  if (loading) return <div className="text-muted-foreground">Cargando...</div>;
  if (!t) return <div>Torneo no encontrado.</div>;

  const isJoined = !!parts.find((p) => p.user_id === user?.id);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border overflow-hidden">
        {t.banner_url && <div className="h-48 bg-cover bg-center" style={{ backgroundImage: `url(${t.banner_url})` }} />}
        <div className="p-6 bg-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold">{t.name}</h1>
              <div className="flex gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className="capitalize">{t.league === "bmoney" ? "BMoney" : "Élite"}</Badge>
                <Badge variant="outline" className="capitalize">{t.modality}</Badge>
                <Badge variant={t.status === "running" ? "default" : "outline"} className="capitalize">{t.status}</Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild><Link to={`/tournament/t/${t.slug}/live`}><Activity className="h-4 w-4 mr-1" />En vivo</Link></Button>
              {!isJoined && ["scheduled", "running"].includes(t.status) && (() => {
                const isBM = (t.league || "elite") === "bmoney";
                const fee = isBM ? Number(t.entry_fee_bmoney || 0) : Number(t.entry_fee_usd || 0);
                const feeLabel = fee > 0 ? (isBM ? `${fee} BM$` : `$${fee}`) : "gratis";
                return (
                  <Button onClick={handleJoin} disabled={joining}>
                    {joining ? "Inscribiendo..." : `Inscribirme (${feeLabel})`}
                  </Button>
                );
              })()}
              {isJoined && myParticipantId && (
                <Button asChild variant="default"><Link to={`/tournament/account/${myParticipantId}`}>Mi cuenta MT5</Link></Button>
              )}
              {isJoined && <Badge className="self-center">Inscrito</Badge>}
            </div>
          </div>
          {t.description && <p className="text-muted-foreground mt-3">{t.description}</p>}

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
            <Stat icon={<Calendar className="h-4 w-4" />} label="Inicia" value={new Date(t.starts_at).toLocaleString()} />
            <Stat icon={<Clock className="h-4 w-4" />} label="Termina" value={new Date(t.ends_at).toLocaleString()} />
            <Stat icon={<Users className="h-4 w-4" />} label="Participantes" value={`${t.participants_count}/${t.max_participants}`} />
            <Stat icon={<DollarSign className="h-4 w-4" />} label="Saldo demo" value={`$${t.starting_balance_usd}`} />
            <Stat icon={<Trophy className="h-4 w-4 text-primary" />} label="Premio USD" value={`$${t.prize_pool_usd || (t.entry_fee_usd * t.participants_count)}`} />
            <Stat icon={<Trophy className="h-4 w-4 text-amber-400" />} label="Bullfy Points" value={`${t.bullfy_points_pool}`} />
            <Stat icon={<DollarSign className="h-4 w-4" />} label="Inscripción" value={t.entry_fee_usd > 0 ? `$${t.entry_fee_usd}` : "Gratis"} />
            <Stat icon={<Activity className="h-4 w-4" />} label="Comisión casa" value={`${t.house_fee_pct}%`} />
          </div>
        </div>
      </div>

      {["finished", "settled"].includes(t.status) && (
        <TournamentHighlights tournamentId={t.id} tournamentName={t.name} />
      )}

      <Card>
        <CardHeader><CardTitle>Leaderboard</CardTitle></CardHeader>
        <CardContent>
          {parts.length === 0 ? <p className="text-muted-foreground text-sm">Aún no hay participantes.</p> : (
            <div className="divide-y divide-border">
              {parts.slice(0, 50).map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-center font-bold text-primary">#{p.rank}</span>
                    <div>
                      <div className="font-medium">{p.user?.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{p.trades_count} trades · {p.user?.country || ""}</div>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-semibold">{Number(p.current_score).toFixed(2)}</div>
                    <div className={`text-xs ${Number(p.profit_pct) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {Number(p.profit_pct) >= 0 ? "+" : ""}{Number(p.profit_pct).toFixed(2)}%
                    </div>
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

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-3 py-2">
      {icon}
      <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium">{value}</div></div>
    </div>
  );
}
