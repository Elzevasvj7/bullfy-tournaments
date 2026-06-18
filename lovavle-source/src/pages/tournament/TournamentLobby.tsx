import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Users, Calendar, DollarSign, Trophy, Sparkles, Timer, History } from "lucide-react";
import { useTournamentAuth } from "@/hooks/useTournamentAuth";

type Tournament = {
  id: string; slug: string; name: string; description: string | null;
  type: "free" | "paid" | "elite"; modality: "pro" | "standard"; status: string;
  starts_at: string; ends_at: string; entry_fee_usd: number;
  entry_fee_bmoney?: number; league?: "bmoney" | "elite";
  max_participants: number; banner_url: string | null;
  prize_pool_usd: number; bullfy_points_pool: number;
};

const typeLabel: Record<string, string> = { free: "Gratuito", paid: "De pago", elite: "Élite" };

function accentForType(t: Tournament["type"]) {
  if (t === "elite") return { color: "#FF2EC4", glow: "rgba(255,46,196,0.25)" };
  if (t === "paid") return { color: "#00E5FF", glow: "rgba(0,229,255,0.25)" };
  return { color: "#B6FF3D", glow: "rgba(182,255,61,0.22)" };
}

function fmtCountdown(target: string) {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return "00:00:00";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function TournamentCard({ t }: { t: Tournament }) {
  const accent = accentForType(t.type);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const target = t.status === "running" ? t.ends_at : t.starts_at;
  const countdownLabel = t.status === "running" ? "Finaliza en" : "Empieza en";

  return (
    <div
      className="group relative rounded-3xl bg-[#0a1129] border border-white/5 overflow-hidden transition-all hover:translate-y-[-6px]"
      style={{ boxShadow: `0 0 0 transparent` }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 20px 60px -15px ${accent.glow}`; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ""; }}
    >
      <div
        className="h-1.5"
        style={{
          background: t.type === "elite"
            ? accent.color
            : `linear-gradient(to right, ${accent.color}, #FF2EC4)`,
          boxShadow: t.type === "elite" ? `0 0 15px ${accent.color}` : undefined,
        }}
      />
      {t.type === "elite" && (
        <div className="absolute top-0 right-0 px-5 py-2 bg-[#FF2EC4] text-[#060B1F] text-[10px] font-black uppercase tracking-widest rounded-bl-2xl">
          Elite VIP
        </div>
      )}

      <div className="p-7">
        <div className="flex justify-between items-start mb-6 gap-3">
          <div className="min-w-0">
            <h3 className="t-display text-2xl font-black mb-1 truncate">{t.name}</h3>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
              <span style={{ color: accent.color }}>{t.modality}</span>
              <span className="w-1 h-1 rounded-full bg-gray-700" />
              <span className={t.status === "running" ? "text-[#B6FF3D]" : "text-gray-400"}>
                {t.status === "running" ? "En curso" : "Próximo"}
              </span>
            </div>
          </div>
          <div
            className="shrink-0 px-3 py-1 rounded-lg text-[10px] font-black italic uppercase border"
            style={{
              color: accent.color,
              background: `${accent.color}1a`,
              borderColor: `${accent.color}33`,
            }}
          >
            {typeLabel[t.type]}
          </div>
        </div>

        {t.description && (
          <p className="text-xs text-gray-400 mb-6 line-clamp-2 leading-relaxed">{t.description}</p>
        )}

        <div className="grid grid-cols-2 gap-4 mb-7">
          <div className="space-y-1">
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
              <Timer className="h-3 w-3" /> {countdownLabel}
            </p>
            <p className="text-lg font-bold text-white t-mono">{fmtCountdown(target)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
              <Users className="h-3 w-3" /> Slots
            </p>
            <p className="text-lg font-bold text-white">
              <span className="t-mono">{t.max_participants}</span>
              <span className="text-gray-600 text-sm"> max</span>
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
              <Calendar className="h-3 w-3" /> Inicio
            </p>
            <p className="text-sm font-bold text-white t-mono">
              {new Date(t.starts_at).toLocaleDateString()}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
              <DollarSign className="h-3 w-3" /> Entrada
            </p>
            <p className="text-sm font-bold text-white t-mono">
              {t.league === "bmoney"
                ? (Number(t.entry_fee_bmoney || 0) > 0 ? `${t.entry_fee_bmoney} BM$` : "Gratis")
                : (t.entry_fee_usd > 0 ? `$${t.entry_fee_usd}` : "Gratis")}
            </p>
          </div>
        </div>

        <div
          className="p-6 rounded-2xl mb-7 relative overflow-hidden border"
          style={{
            background: `${accent.color}0d`,
            borderColor: `${accent.color}1f`,
          }}
        >
          <div className="absolute top-2 right-2 opacity-10">
            <Trophy className="w-12 h-12" style={{ color: accent.color }} />
          </div>
          <p
            className="text-[10px] font-black uppercase tracking-[0.2em] mb-1"
            style={{ color: accent.color }}
          >
            Prize Pool Total
          </p>
          <p className="t-display text-4xl font-black text-white">
            <span className="t-mono">{t.bullfy_points_pool.toLocaleString()}</span>{" "}
            <span className="text-base text-gray-500 font-bold">BP</span>
          </p>
          {t.prize_pool_usd > 0 && (
            <p className="text-sm text-gray-400 mt-1 t-mono">
              + ${t.prize_pool_usd.toLocaleString()} USD
            </p>
          )}
        </div>

        <Link
          to={`/tournament/t/${t.slug}`}
          className="block w-full py-4 rounded-xl border border-white/10 bg-white/5 font-black text-xs tracking-[0.2em] text-center text-white transition-all hover:bg-white hover:text-[#060B1F]"
        >
          VER DETALLES
        </Link>
      </div>
    </div>
  );
}

export default function TournamentLobby() {
  const { user } = useTournamentAuth();
  const [list, setList] = useState<Tournament[]>([]);
  const [leagueFilter, setLeagueFilter] = useState<"bmoney" | "elite">("bmoney");
  const [history, setHistory] = useState<(Tournament & { my_rank?: number | null; my_prize_usd?: number; my_points?: number })[]>([]);
  const [loading, setLoading] = useState(true);

  const mockTournaments: Tournament[] = [
    {
      id: "1",
      slug: "bullfy-tournament-1",
      name: "Torneo de Bullfy 1",
      description: "Torneo de Bullfy 1 para los que quieran probar la experiencia de bullfighting.",
      type: "free",
      modality: "pro",
      status: "scheduled",
      starts_at: "2023-05-01T00:00:00.000Z",
      ends_at: "2023-05-31T00:00:00.000Z",
      entry_fee_usd: 0,
      entry_fee_bmoney: 0,
      league: "bmoney",
      max_participants: 100,
      banner_url: null,
      prize_pool_usd: 0,
      bullfy_points_pool: 0,
    },
    {
      id: "2",
      slug: "bullfy-tournament-2",
      name: "Torneo de Bullfy 2",
      description: "Torneo de Bullfy 2 para los que quieran probar la experiencia de bullfighting.",
      type: "free",
      modality: "pro",
      status: "scheduled",
      starts_at: "2023-06-01T00:00:00.000Z",
      ends_at: "2023-06-30T00:00:00.000Z",
      entry_fee_usd: 0,
      entry_fee_bmoney: 0,
      league: "bmoney",
      max_participants: 100,
      banner_url: null,
      prize_pool_usd: 0,
      bullfy_points_pool: 0,
    },
    {
      id: "3",
      slug: "bullfy-tournament-3",
      name: "Torneo de Bullfy 3",
      description: "Torneo de Bullfy 3 para los que quieran probar la experiencia de bullfighting.",
      type: "free",
      modality: "pro",
      status: "scheduled",
      starts_at: "2023-07-01T00:00:00.000Z",
      ends_at: "2023-07-31T00:00:00.000Z",
      entry_fee_usd: 0,
      entry_fee_bmoney: 0,
      league: "elite",
      max_participants: 100,
      banner_url: null,
      prize_pool_usd: 0,
      bullfy_points_pool: 0,
    },
  ];
  useEffect(() => {
    (async () => {
      const nowIso = new Date().toISOString();
      const { data } = await supabase.from("tournaments")
        .select("id, slug, name, description, type, modality, status, starts_at, ends_at, entry_fee_usd, entry_fee_bmoney, league, max_participants, banner_url, prize_pool_usd, bullfy_points_pool")
        .eq("approval_status", "approved")
        .in("status", ["scheduled", "running"])
        .gt("ends_at", nowIso)
        .order("starts_at", { ascending: true })
        .limit(100);
      setList((data as Tournament[]) || []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!user?.id) { setHistory([]); return; }
    (async () => {
      const { data: parts } = await supabase
        .from("tournament_participants")
        .select("tournament_id, final_rank, prize_won_usd, points_won")
        .eq("user_id", user.id);
      const ids = (parts || []).map((p: any) => p.tournament_id);
      if (!ids.length) { setHistory([]); return; }
      const { data: ts } = await supabase.from("tournaments")
        .select("id, slug, name, description, type, modality, status, starts_at, ends_at, entry_fee_usd, max_participants, banner_url, prize_pool_usd, bullfy_points_pool")
        .in("id", ids)
        .in("status", ["finished", "settled", "cancelled"])
        .order("ends_at", { ascending: false })
        .limit(30);
      const pMap = new Map((parts || []).map((p: any) => [p.tournament_id, p]));
      setHistory(((ts as Tournament[]) || []).map((t) => {
        const p: any = pMap.get(t.id);
        return { ...t, my_rank: p?.final_rank ?? null, my_prize_usd: Number(p?.prize_won_usd || 0), my_points: Number(p?.points_won || 0) };
      }));
    })();
  }, [user?.id]);


  return (
    <div className="space-y-12 relative">
      {/* HERO */}
      <header className="relative z-10 rounded-[2.5rem] overflow-hidden border border-white/5 bg-[#0a1129]/30 backdrop-blur-sm p-10 md:p-16 text-center shadow-2xl">
        <div className="t-scanlines z-10" />

        <div className="relative z-20">
          <div className="inline-flex items-center gap-3 px-5 py-2 mb-8 rounded-full bg-[#FF2EC4]/10 border border-[#FF2EC4]/30 text-[#FF2EC4] text-[10px] font-black uppercase tracking-[0.3em]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF2EC4] animate-pulse shadow-[0_0_8px_#FF2EC4]" />
            Live Season Active
          </div>

          <h1 className="t-display text-5xl md:text-7xl lg:text-8xl font-black mb-6 leading-[0.95] tracking-tighter">
            <span className="t-glitch" data-text="COMPITE. GANA.">COMPITE. GANA.</span>
            <br />
            <span className="t-shimmer">DOMINA.</span>
          </h1>

          <p className="t-display text-base md:text-xl font-black tracking-[0.18em] text-[#00E5FF] mb-6 uppercase">
            Donde el trading es un octágono de lucha
          </p>

          <p className="text-base md:text-lg text-gray-400 mb-10 max-w-2xl mx-auto font-light leading-relaxed">
            Domina los mercados en tiempo real. Gana premios masivos en{" "}
            <span className="text-white font-bold">USDT</span> y{" "}
            <span className="text-[#B6FF3D] font-bold">Bullfy Points</span> operando en las condiciones más extremas.
          </p>
        </div>
      </header>

      {/* TORNEOS */}
      <section className="relative z-10">
        <div className="flex items-end justify-between mb-8 px-2 gap-4 flex-wrap">
          <div>
            <h2 className="t-display text-3xl md:text-4xl font-black">
              TORNEOS <span className="text-[#00E5FF]">OPEN</span>
            </h2>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-1">
              Sector de alto rendimiento
            </p>
          </div>
          <div className="inline-flex rounded-2xl border border-white/10 bg-[#0a1129]/60 p-2">
            <button
              onClick={() => setLeagueFilter("bmoney")}
              className={`px-10 py-4 rounded-xl text-[22px] font-black uppercase tracking-widest transition-all ${
                leagueFilter === "bmoney" ? "bg-[#B6FF3D] text-[#060B1F]" : "text-gray-400 hover:text-white"
              }`}
            >Lobby BMoney</button>
            <button
              onClick={() => setLeagueFilter("elite")}
              className={`px-10 py-4 rounded-xl text-[22px] font-black uppercase tracking-widest transition-all ${
                leagueFilter === "elite" ? "bg-[#00E5FF] text-[#060B1F]" : "text-gray-400 hover:text-white"
              }`}
            >Lobby Élite</button>
          </div>
        </div>

        <p className="text-xs text-gray-400 mb-6 px-2">
          {leagueFilter === "bmoney"
            ? "Dinero ficticio. Sin riesgo. Premios en BM$ y Bullfy Points (×1)."
            : "Dinero real USD. Requiere KYC. Premios en USD retirables + Bullfy Points (×5)."}
        </p>

        {(() => {
          const filtered = mockTournaments.filter((t) => (t.league || "elite") === leagueFilter);
          if (loading) return <div className="text-gray-500 t-mono text-sm">Loading sector data…</div>;
          if (filtered.length === 0) return (
            <div className="text-gray-500 py-16 text-center border border-dashed border-white/10 rounded-2xl">
              Aún no hay torneos {leagueFilter === "bmoney" ? "BMoney" : "Élite"}. Vuelve pronto.
            </div>
          );
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filtered.map((t) => <TournamentCard key={t.id} t={t} />)}
            </div>
          );
        })()}
      </section>

      {/* HISTORIAL — solo torneos en los que el usuario participó */}
      {user && history.length > 0 && (
        <section className="relative z-10">
          <div className="flex items-end justify-between mb-8 px-2">
            <div>
              <h2 className="t-display text-3xl md:text-4xl font-black flex items-center gap-3">
                <History className="h-7 w-7 text-[#B6FF3D]" />
                MI <span className="text-[#B6FF3D]">HISTORIAL</span>
              </h2>
              <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-1">
                Torneos finalizados en los que participaste
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {history.map((t) => (
              <Link
                key={t.id}
                to={`/tournament/t/${t.slug}`}
                className="group relative rounded-2xl bg-[#0a1129]/80 border border-white/5 p-6 hover:border-[#B6FF3D]/40 transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <h3 className="t-display text-xl font-black truncate">{t.name}</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mt-1">
                      {new Date(t.ends_at).toLocaleDateString()} · {typeLabel[t.type]}
                    </p>
                  </div>
                  {t.my_rank ? (
                    <div className="shrink-0 px-3 py-1 rounded-lg text-[11px] font-black bg-[#B6FF3D]/10 border border-[#B6FF3D]/30 text-[#B6FF3D]">
                      #{t.my_rank}
                    </div>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Premio</p>
                    <p className="t-mono font-bold text-white">${(t.my_prize_usd || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Puntos</p>
                    <p className="t-mono font-bold text-[#B6FF3D]">{(t.my_points || 0).toLocaleString()} BP</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
