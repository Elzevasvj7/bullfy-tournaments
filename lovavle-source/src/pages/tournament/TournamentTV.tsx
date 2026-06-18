import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import TournamentAvatar from "./components/TournamentAvatar";
import TournamentAvatar3D from "./components/TournamentAvatar3D";
import TradeTicker from "./components/TradeTicker";

function AvatarPortrait({
  user,
  mood,
  width,
  height,
  ring = "ring-2 ring-primary/40",
}: {
  user: any;
  mood: "idle" | "happy" | "worried" | "celebrate" | "ko";
  width: number;
  height: number;
  ring?: string;
}) {
  if (user?.avatar_3d_url) {
    return (
      <TournamentAvatar3D
        url={user.avatar_3d_url}
        fallbackConfig={user?.avatar_config}
        fallbackUrl={user?.avatar_url}
        fallbackSeed={user?.username || user?.full_name}
        mood={mood}
        gender={(user?.avatar_config?.gender as any) || "masculine"}
        fullBody
        shape="portrait"
        width={width}
        height={height}
        className={`${ring} shadow-2xl shadow-primary/20`}
      />
    );
  }
  return (
    <div style={{ width, height }} className={`rounded-2xl overflow-hidden ${ring} shadow-2xl shadow-primary/20 bg-gradient-to-b from-primary/15 to-black flex items-center justify-center`}>
      <TournamentAvatar
        config={user?.avatar_config}
        fallbackUrl={user?.avatar_url}
        fallbackSeed={user?.username || user?.full_name}
        mood={mood}
        size={Math.min(width, height) - 20}
      />
    </div>
  );
}

type P = {
  id: string;
  user_id: string;
  current_score: number;
  current_equity: number;
  profit_pct: number;
  trades_count: number;
  winrate: number;
  rank: number;
  user?: any;
};

/**
 * TV Mode — cinematic, fullscreen, auto-rotating leaderboard ideal for
 * projecting the tournament on a big screen at an event.
 * Read-only. No engine interaction.
 */
export default function TournamentTV() {
  const { slug } = useParams();
  const [t, setT] = useState<any>(null);
  const [parts, setParts] = useState<P[]>([]);
  const [scene, setScene] = useState<"podium" | "leaderboard" | "spotlight">("podium");
  const [spotlightIdx, setSpotlightIdx] = useState(0);

  const load = async () => {
    if (!slug) return;
    const { data: tour } = await supabase.from("tournaments").select("id, name, status, ends_at, slug").eq("slug", slug).maybeSingle();
    setT(tour);
    if (!tour) return;
    const { data: ps } = await supabase
      .from("tournament_participants")
      .select("id, user_id, current_score, current_equity, profit_pct, winrate, trades_count")
      .eq("tournament_id", tour.id)
      .order("current_score", { ascending: false });
    const ids = (ps || []).map((p) => p.user_id);
    const { data: us } = ids.length
      ? await supabase.from("tournament_users").select("id, full_name, country, username, avatar_url, avatar_config, avatar_3d_url").in("id", ids)
      : { data: [] };
    const map = new Map((us || []).map((u: any) => [u.id, u]));
    setParts((ps || []).map((p, i) => ({ rank: i + 1, ...p, user: map.get(p.user_id) })) as P[]);
  };

  useEffect(() => { load(); }, [slug]);

  useEffect(() => {
    if (!t?.id) return;
    const ch = supabase
      .channel(`tv_${t.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_participants", filter: `tournament_id=eq.${t.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [t?.id]);

  // Scene rotation
  useEffect(() => {
    const scenes: Array<"podium" | "leaderboard" | "spotlight"> = ["podium", "leaderboard", "spotlight"];
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % scenes.length;
      setScene(scenes[i]);
      if (scenes[i] === "spotlight") {
        setSpotlightIdx((idx) => (idx + 1) % Math.max(parts.length, 1));
      }
    }, 9000);
    return () => clearInterval(id);
  }, [parts.length]);

  if (!t) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Cargando…</div>;

  const top3 = parts.slice(0, 3);
  const top10 = parts.slice(0, 10);
  const spot = parts[spotlightIdx];

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#0a1c3d_0%,_#000_60%)] text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/10 bg-black/40 backdrop-blur">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-primary animate-pulse" />
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-primary/80">Bullfy Tournament · TV</div>
            <div className="text-2xl font-black">{t.name}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Termina</div>
          <div className="font-mono text-lg">{new Date(t.ends_at).toLocaleString()}</div>
        </div>
      </div>

      {/* Ticker */}
      <div className="px-8 py-2 border-b border-white/10 bg-black/30">
        <TradeTicker tournamentId={t.id} participants={parts} max={20} />
      </div>

      {/* Scene */}
      <div className="relative px-8 py-6 h-[calc(100vh-160px)]">
        <AnimatePresence mode="wait">
          {scene === "podium" && (
            <motion.div
              key="podium"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.6 }}
              className="h-full flex flex-col items-center justify-center gap-8"
            >
              <h2 className="text-4xl font-black uppercase tracking-widest text-primary">Top 3</h2>
              <div className="flex items-end gap-8">
                {[1, 0, 2].map((idx) => {
                  const p = top3[idx];
                  if (!p) return <div key={idx} className="w-48" />;
                  const heights = [240, 320, 200];
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ y: 50, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: idx * 0.15 }}
                      className="flex flex-col items-center"
                    >
                      <AvatarPortrait
                        user={p.user}
                        mood={p.rank === 1 ? "celebrate" : "happy"}
                        width={idx === 0 ? 230 : 190}
                        height={idx === 0 ? 370 : 300}
                        ring={p.rank === 1 ? "ring-4 ring-yellow-400/70" : p.rank === 2 ? "ring-2 ring-slate-300/70" : "ring-2 ring-amber-500/70"}
                      />
                      <div className="text-xl font-bold mt-3">{p.user?.full_name || "—"}</div>
                      <div className="text-sm text-muted-foreground">{p.user?.country}</div>
                      <div className={`text-2xl font-black font-mono mt-1 ${p.profit_pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {p.profit_pct >= 0 ? "+" : ""}{Number(p.profit_pct).toFixed(2)}%
                      </div>
                      <div
                        style={{ height: heights[idx] }}
                        className={`mt-4 w-40 rounded-t-2xl flex items-start justify-center pt-4 font-black text-5xl relative ${
                          p.rank === 1 ? "bg-gradient-to-t from-yellow-600 to-yellow-400 text-black" : p.rank === 2 ? "bg-gradient-to-t from-slate-500 to-slate-300 text-black" : "bg-gradient-to-t from-amber-700 to-amber-500 text-black"
                        }`}
                      >
                        {p.rank === 1 && <Crown className="h-12 w-12 absolute -top-12 left-1/2 -translate-x-1/2 animate-bounce" />}
                        #{p.rank}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {scene === "leaderboard" && (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.6 }}
              className="h-full flex flex-col"
            >
              <h2 className="text-3xl font-black uppercase tracking-widest text-primary mb-4">Top 10</h2>
              <div className="grid grid-cols-2 gap-3 flex-1">
                {top10.map((p) => {
                  const pos = p.profit_pct >= 0;
                  return (
                    <motion.div
                      key={p.id}
                      layout
                      className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur"
                    >
                      <div className="text-3xl font-black text-primary w-14 text-center">#{p.rank}</div>
                      <AvatarPortrait
                        user={p.user}
                        mood={pos ? "happy" : Number(p.profit_pct) < -5 ? "worried" : "idle"}
                        width={60}
                        height={96}
                        ring="ring-1 ring-white/20"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate">{p.user?.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{p.user?.country} · {p.trades_count} trades</div>
                      </div>
                      <div className={`text-xl font-black font-mono ${pos ? "text-emerald-400" : "text-red-400"}`}>
                        {pos ? "+" : ""}{Number(p.profit_pct).toFixed(2)}%
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {scene === "spotlight" && spot && (
            <motion.div
              key={`spot-${spot.id}`}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ duration: 0.7 }}
              className="h-full flex items-center justify-center gap-12"
            >
              <AvatarPortrait
                user={spot.user}
                mood={spot.profit_pct >= 0 ? "celebrate" : "worried"}
                width={360}
                height={580}
                ring="ring-4 ring-primary/60"
              />
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-primary mb-2">Spotlight</div>
                <div className="text-5xl font-black mb-2">{spot.user?.full_name || "—"}</div>
                <div className="text-lg text-muted-foreground mb-6">{spot.user?.country}</div>
                <div className="grid grid-cols-2 gap-6 text-2xl font-mono">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase">Rank</div>
                    <div className="font-black text-primary">#{spot.rank}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase">P/L</div>
                    <div className={`font-black flex items-center gap-2 ${spot.profit_pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {spot.profit_pct >= 0 ? <TrendingUp /> : <TrendingDown />}
                      {spot.profit_pct >= 0 ? "+" : ""}{Number(spot.profit_pct).toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase">Trades</div>
                    <div className="font-black">{spot.trades_count}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase">WR</div>
                    <div className="font-black">{Number(spot.winrate).toFixed(0)}%</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
