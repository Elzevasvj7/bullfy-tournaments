import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, RefreshCw, Share2, Sparkles, Flame, TrendingUp, Download, Tv, Box, ChevronDown, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { toPng } from "html-to-image";
import TournamentChat from "./TournamentChat";
import TournamentPodium from "./components/TournamentPodium";
import EquitySparkline from "./components/EquitySparkline";
import StoryCardExport from "./components/StoryCardExport";
import TournamentAvatar from "./components/TournamentAvatar";
import TournamentAvatar3D from "./components/TournamentAvatar3D";
import TradeTicker from "./components/TradeTicker";
import AchievementPopups from "./components/AchievementPopups";
import ScoreBreakdown from "./components/ScoreBreakdown";
import { useTournamentAuth } from "@/hooks/useTournamentAuth";
import { toast } from "@/hooks/use-toast";

type Participant = {
  id: string;
  user_id: string;
  current_score: number;
  current_equity: number;
  profit_pct: number;
  winrate: number;
  trades_count: number;
  profit_factor: number;
  sharpe: number;
  max_drawdown_pct: number;
  rank: number;
  user?: { id: string; full_name?: string; country?: string; username?: string; avatar_url?: string | null; avatar_config?: any; avatar_3d_url?: string | null };
};

export default function TournamentLive() {
  const { slug } = useParams();
  const { user: me } = useTournamentAuth();
  const [t, setT] = useState<any>(null);
  const [parts, setParts] = useState<Participant[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const prevLeaderRef = useRef<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const storyRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!slug) return;
    const { data: tour } = await supabase
      .from("tournaments")
      .select("id, name, status, ends_at, slug, scoring_weights")
      .eq("slug", slug)
      .maybeSingle();
    setT(tour);
    if (!tour) return;
    const { data: ps } = await supabase
      .from("tournament_participants")
      .select("id, user_id, current_score, current_equity, profit_pct, winrate, trades_count, profit_factor, sharpe, max_drawdown_pct")
      .eq("tournament_id", tour.id)
      .order("current_score", { ascending: false });
    const ids = (ps || []).map((p) => p.user_id);
    const { data: us } = ids.length
      ? await supabase.from("tournament_users").select("id, full_name, country, username, avatar_url, avatar_config, avatar_3d_url").in("id", ids)
      : { data: [] };
    const map = new Map((us || []).map((u: any) => [u.id, u]));
    const ranked = (ps || []).map((p, i) => ({ rank: i + 1, ...p, user: map.get(p.user_id) })) as Participant[];

    // Confetti on leader change
    const newLeaderId = ranked[0]?.user_id ?? null;
    if (prevLeaderRef.current && newLeaderId && newLeaderId !== prevLeaderRef.current) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.3 }, colors: ["#146EF5", "#83CBFF", "#FFD56B"] });
    }
    prevLeaderRef.current = newLeaderId;
    setParts(ranked);
  };

  useEffect(() => {
    load();
  }, [slug]);

  // Realtime subscription
  useEffect(() => {
    if (!t?.id) return;
    const channel = supabase
      .channel(`tournament_live_${t.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_participants", filter: `tournament_id=eq.${t.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [t?.id]);

  // Periodic safety refresh
  useEffect(() => {
    if (!slug) return;
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, [slug]);

  const myEntry = me ? parts.find((p) => p.user_id === me.id) : null;
  const top3 = parts.slice(0, 3);
  const rest = parts.slice(3);

  const handleExportStory = async () => {
    if (!storyRef.current) return;
    try {
      const dataUrl = await toPng(storyRef.current, { cacheBust: true, pixelRatio: 1, width: 1080, height: 1920 });
      const link = document.createElement("a");
      link.download = `bullfy-tournament-${slug}-rank-${myEntry?.rank ?? "x"}.png`;
      link.href = dataUrl;
      link.click();
      toast({ title: "Imagen lista", description: "Compártela en tu Story de Instagram" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  if (!t) return <div className="text-muted-foreground">Cargando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button variant="ghost" asChild>
          <Link to={`/tournament/t/${slug}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {myEntry && (
            <Button variant="default" size="sm" onClick={() => setShareOpen(true)} className="bg-gradient-to-r from-primary to-bullfy-blue hover:opacity-90">
              <Share2 className="h-4 w-4 mr-1" />
              Compartir mi posición
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link to={`/tournament/t/${slug}/arena`}><Box className="h-4 w-4 mr-1" />Arena 3D</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/tournament/t/${slug}/tv`}><Tv className="h-4 w-4 mr-1" />TV Mode</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refrescar
          </Button>
        </div>
      </div>

      <AchievementPopups
        tournamentId={t.id}
        participants={parts.map((p) => ({
          id: p.id,
          user_id: p.user_id,
          rank: p.rank,
          profit_pct: Number(p.profit_pct),
          trades_count: p.trades_count,
          current_equity: Number(p.current_equity),
          user: { full_name: p.user?.full_name },
        }))}
      />

      <div className="rounded-xl border border-primary/20 bg-card/40 px-3 py-2 backdrop-blur">
        <div className="text-[10px] uppercase tracking-widest text-primary font-bold mb-1 flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> Trade ticker · en vivo
        </div>
        <TradeTicker tournamentId={t.id} participants={parts} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 overflow-hidden border-primary/20">
          <CardHeader className="bg-gradient-to-r from-primary/10 via-bullfy-blue/5 to-transparent">
            <CardTitle className="flex items-center justify-between flex-wrap gap-2">
              <span className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                {t.name} · En vivo
              </span>
              <span className="text-xs sm:text-sm text-muted-foreground font-mono">
                Termina {new Date(t.ends_at).toLocaleString()}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Podio */}
            {top3.length > 0 && <TournamentPodium weights={t.scoring_weights} top={top3.map((p) => ({
              id: p.id,
              rank: p.rank,
              name: p.user?.full_name || "—",
              country: p.user?.country,
              score: Number(p.current_score),
              profit_pct: Number(p.profit_pct),
              winrate: Number(p.winrate),
              profit_factor: Number(p.profit_factor),
              sharpe: Number(p.sharpe),
              max_drawdown_pct: Number(p.max_drawdown_pct),
              trades_count: Number((p as any).trades_count ?? 0),
              avatar_url: p.user?.avatar_url,
              avatar_config: p.user?.avatar_config,
              avatar_3d_url: p.user?.avatar_3d_url,
            }))} />}

            {/* Cómo se calcula CTA */}
            <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <HelpCircle className="h-4 w-4 text-primary" />
                <span>El podio se calcula combinando 5 métricas con pesos definidos. Toca un trader para ver el desglose.</span>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/tournament/t/${slug}/scoring`}>¿Cómo se calcula?</Link>
              </Button>
            </div>


            {/* My card */}
            {myEntry && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-xl bg-gradient-to-r from-primary/15 via-primary/5 to-transparent border border-primary/30 p-3 flex items-center gap-3"
              >
                <div className="text-2xl font-black text-primary min-w-[3rem] text-center">#{myEntry.rank}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">Tu posición · {myEntry.user?.full_name}</div>
                  <div className="text-xs text-muted-foreground">Score {Number(myEntry.current_score).toFixed(2)} · {myEntry.trades_count} trades</div>
                </div>
                <div className={`text-base font-bold font-mono ${myEntry.profit_pct >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {myEntry.profit_pct >= 0 ? "+" : ""}{Number(myEntry.profit_pct).toFixed(2)}%
                </div>
              </motion.div>
            )}

            {/* Rest of leaderboard */}
            <div className="space-y-1.5">
              <div className="grid grid-cols-[40px_1fr_70px_90px_40px] sm:grid-cols-[48px_1fr_80px_110px_80px_60px_60px_40px] gap-2 px-2 text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold pb-1 border-b border-border">
                <div>#</div>
                <div>Trader</div>
                <div className="text-right">Score</div>
                <div className="text-right">P/L %</div>
                <div className="text-right hidden sm:block">Trend</div>
                <div className="text-right hidden sm:block">WR</div>
                <div className="text-right hidden sm:block">Trades</div>
                <div />
              </div>



              <AnimatePresence initial={false}>
                {rest.map((p) => {
                  const positive = Number(p.profit_pct) >= 0;
                  const isMe = me && p.user_id === me.id;
                  const isOpen = expanded === p.id;
                  return (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: "spring", stiffness: 220, damping: 24 }}
                      className={`rounded-lg ${isMe ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/40"}`}
                    >
                      <Collapsible open={isOpen} onOpenChange={(o) => setExpanded(o ? p.id : null)}>
                        <CollapsibleTrigger className="w-full text-left">
                          <div className="grid grid-cols-[40px_1fr_70px_90px_40px] sm:grid-cols-[48px_1fr_80px_110px_80px_60px_60px_40px] gap-2 items-center px-2 py-2 text-xs sm:text-sm">
                            <div className="font-bold text-primary">#{p.rank}</div>
                            <div className="flex items-center gap-2 min-w-0">
                              {p.user?.avatar_3d_url ? (
                                <TournamentAvatar3D
                                  url={p.user.avatar_3d_url}
                                  fallbackConfig={p.user?.avatar_config}
                                  fallbackUrl={p.user?.avatar_url}
                                  fallbackSeed={p.user?.username || p.user?.full_name}
                                  mood={Number(p.profit_pct) >= 5 ? "happy" : Number(p.profit_pct) <= -5 ? "worried" : "idle"}
                                  gender={(p.user?.avatar_config?.gender as any) || "masculine"}
                                  fullBody
                                  shape="portrait"
                                  width={40}
                                  height={64}
                                  className="flex-shrink-0 ring-1 ring-primary/30"
                                />
                              ) : (
                                <TournamentAvatar
                                  config={p.user?.avatar_config}
                                  fallbackUrl={p.user?.avatar_url}
                                  fallbackSeed={p.user?.username || p.user?.full_name}
                                  mood={Number(p.profit_pct) >= 5 ? "happy" : Number(p.profit_pct) <= -5 ? "worried" : "idle"}
                                  size={40}
                                  className="flex-shrink-0"
                                />
                              )}
                              <div className="min-w-0">
                                {p.user?.username ? (
                                  <Link to={`/tournament/p/${p.user.username}`} onClick={(e) => e.stopPropagation()} className="hover:underline truncate block font-medium">
                                    {p.user?.full_name || "—"}
                                  </Link>
                                ) : (
                                  <div className="truncate font-medium">{p.user?.full_name || "—"}</div>
                                )}
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  {p.user?.country}
                                  {p.trades_count >= 10 && <Flame className="w-3 h-3 text-orange-500" />}
                                  {Number(p.profit_pct) >= 5 && <TrendingUp className="w-3 h-3 text-emerald-500" />}
                                </div>
                              </div>
                            </div>
                            <div className="text-right font-semibold font-mono">{Number(p.current_score).toFixed(2)}</div>
                            <div className={`text-right font-mono font-semibold ${positive ? "text-emerald-500" : "text-red-500"}`}>
                              {positive ? "+" : ""}{Number(p.profit_pct).toFixed(2)}%
                            </div>
                            <div className="hidden sm:flex justify-end">
                              <EquitySparkline participantId={p.id} positive={positive} />
                            </div>
                            <div className="text-right hidden sm:block text-muted-foreground">{Number(p.winrate).toFixed(0)}%</div>
                            <div className="text-right text-muted-foreground hidden sm:block">{p.trades_count}</div>

                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-3 pb-3 pt-1 border-t border-border/50">
                            <ScoreBreakdown
                              weights={t.scoring_weights}
                              metrics={{
                                profit_pct: Number(p.profit_pct),
                                winrate: Number(p.winrate),
                                profit_factor: Number(p.profit_factor),
                                sharpe: Number(p.sharpe),
                                max_drawdown_pct: Number(p.max_drawdown_pct),
                              }}
                              totalScore={Number(p.current_score)}
                              tradesCount={Number(p.trades_count ?? 0)}
                              variant="full"
                            />
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {parts.length === 0 && (
                <div className="py-8 text-center text-muted-foreground text-sm">Sin participantes activos.</div>
              )}
            </div>



            <p className="text-[10px] text-muted-foreground mt-3 text-center">
              Sincronización en tiempo real · Datos desde MT5 cada minuto
            </p>
          </CardContent>
        </Card>
        <TournamentChat tournamentId={t.id} />
      </div>

      {/* Hidden story card for export */}
      {myEntry && (
        <div style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }}>
          <StoryCardExport
            ref={storyRef}
            tournamentName={t.name}
            rank={myEntry.rank}
            fullName={myEntry.user?.full_name || "—"}
            country={myEntry.user?.country}
            score={Number(myEntry.current_score)}
            profitPct={Number(myEntry.profit_pct)}
            trades={myEntry.trades_count}
            winrate={Number(myEntry.winrate)}
            slug={t.slug}
            avatarUrl={myEntry.user?.avatar_url}
          />
        </div>
      )}

      {/* Share modal */}
      <AnimatePresence>
        {shareOpen && myEntry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => setShareOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card rounded-2xl p-6 max-w-sm w-full border border-primary/30"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-2">Comparte tu posición</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Descarga tu tarjeta lista para Instagram Stories (1080x1920).
              </p>
              <div className="rounded-lg overflow-hidden border border-border mb-4 aspect-[9/16] bg-gradient-to-br from-bullfy-dark to-bullfy-blue flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="text-4xl font-black">#{myEntry.rank}</div>
                  <div className="text-sm opacity-80">{myEntry.user?.full_name}</div>
                  <div className="text-xs opacity-60 mt-1">{t.name}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShareOpen(false)}>
                  Cerrar
                </Button>
                <Button className="flex-1 bg-gradient-to-r from-primary to-bullfy-blue" onClick={handleExportStory}>
                  <Download className="h-4 w-4 mr-1" />
                  Descargar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
