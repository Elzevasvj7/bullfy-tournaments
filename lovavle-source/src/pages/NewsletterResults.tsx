import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Trophy, BarChart3, CheckCircle2, XCircle, ChevronDown, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import bullfyLogo from "@/assets/logo-bullfy-blue.svg";

/* ── tiny confetti ── */
const Confetti = () => {
  const particles = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 1.2,
        dur: 2 + Math.random() * 1.5,
        size: 4 + Math.random() * 6,
        color: ["#146EF5", "#83CBFF", "#00C853", "#FF1744", "#FFD600"][
          Math.floor(Math.random() * 5)
        ],
      })),
    [],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -20, x: `${p.x}vw`, opacity: 1, rotate: 0 }}
          animate={{ y: "110vh", opacity: 0, rotate: 360 }}
          transition={{ duration: p.dur, delay: p.delay, ease: "easeIn" }}
          style={{
            position: "absolute",
            width: p.size,
            height: p.size,
            borderRadius: p.size > 7 ? "50%" : "2px",
            backgroundColor: p.color,
          }}
        />
      ))}
    </div>
  );
};

/* ── neural pulse for pending state ── */
const NeuralPulse = () => (
  <div className="relative flex items-center justify-center h-32">
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        className="absolute rounded-full border border-primary/30"
        initial={{ width: 20, height: 20, opacity: 0.8 }}
        animate={{ width: 120 + i * 40, height: 120 + i * 40, opacity: 0 }}
        transition={{
          duration: 2.5,
          delay: i * 0.6,
          repeat: Infinity,
          ease: "easeOut",
        }}
      />
    ))}
    <motion.div
      className="w-4 h-4 rounded-full bg-primary shadow-brand"
      animate={{ scale: [1, 1.3, 1] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    />
  </div>
);

/* ── countdown helper ── */
const Countdown = ({ createdAt }: { createdAt: string }) => {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    const target = new Date(createdAt).getTime() + 24 * 60 * 60 * 1000;
    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setRemaining(`${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAt]);
  return (
    <p className="text-xs font-mono text-primary tabular-nums">{remaining}</p>
  );
};

/* ── main page ── */
const NewsletterResults = () => {
  const { id } = useParams<{ id: string }>();
  const [edition, setEdition] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const [edRes, resRes, lbRes] = await Promise.all([
        (supabase.from as any)("newsletter_editions").select("*").eq("id", id).single(),
        (supabase.from as any)("newsletter_prediction_results").select("*").eq("edition_id", id).single(),
        (supabase.from as any)("newsletter_predictions")
          .select("user_name, user_email, selected_option, is_correct, points_earned")
          .eq("edition_id", id)
          .order("points_earned", { ascending: false })
          .limit(20),
      ]);
      setEdition(edRes.data);
      setResult(resRes.data);
      setLeaderboard(lbRes.data || []);
      setLoading(false);
      if (resRes.data) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 4000);
      }
    };
    load();
  }, [id]);

  /* ── loading ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 font-sans">
        <motion.img
          src={bullfyLogo}
          alt="Bullfy"
          className="h-12"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  /* ── not found ── */
  if (!edition) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center font-sans gap-5">
        <img src={bullfyLogo} alt="Bullfy" className="h-12" />
        <p className="text-muted-foreground text-sm">Edición no encontrada.</p>
      </div>
    );
  }

  const options = edition.prediction_options || [];
  const distribution = result?.option_distribution || {};
  const total = result?.total_responses || 0;
  const maxPoints = leaderboard.length > 0 ? leaderboard[0].points_earned : 1;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {showConfetti && <Confetti />}

      {/* ── Header ── */}
      <motion.header
        className="bg-gradient-brand py-10 px-4 text-center relative overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        {/* subtle animated circles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="absolute rounded-full border border-white/5"
              style={{
                width: 200 + i * 120,
                height: 200 + i * 120,
                top: "50%",
                left: "50%",
                transform: "translate(-50%,-50%)",
              }}
              animate={{ scale: [1, 1.08, 1], opacity: [0.15, 0.05, 0.15] }}
              transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
        </div>

        <motion.img
          src={bullfyLogo}
          alt="Bullfy"
          className="h-12 mx-auto mb-4 brightness-0 invert relative z-10"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        />
        <motion.h1
          className="text-2xl md:text-3xl font-display font-bold text-white tracking-tight relative z-10"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          Resultados de Predicción
        </motion.h1>
        <motion.p
          className="text-[11px] font-mono uppercase tracking-[0.25em] text-white/50 mt-2 relative z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Bullfy Markets Newsletter
        </motion.p>

        {/* market candle separator */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-1"
          style={{ background: "linear-gradient(90deg, #00C853, #FFD600, #FF1744)" }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
        />
      </motion.header>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        {/* ── Question Card ── */}
        <motion.div
          className="rounded-xl border border-border bg-card shadow-card p-6 md:p-8 space-y-6"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <h2 className="text-lg md:text-xl font-display font-bold text-foreground">
            🎯 {edition.prediction_question}
          </h2>

          {result ? (
            <div className="space-y-6">
              {/* ── Correct Answer ── */}
              <motion.div
                className="p-5 rounded-lg border border-emerald-500/20"
                style={{ background: "linear-gradient(135deg, hsl(145 60% 50% / 0.08), hsl(145 60% 50% / 0.02))" }}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.6, type: "spring" }}
              >
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> Respuesta correcta
                </p>
                <p className="text-xl font-display font-bold mt-2">
                  {options.find((o: any) => o.key === result.correct_answer)?.label || result.correct_answer}
                </p>
              </motion.div>

              {/* ── Evidence (accordion) ── */}
              <div className="rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setEvidenceOpen(!evidenceOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <span>⚖️ Evidencia — Dra. Amara Okafor</span>
                  <motion.div animate={{ rotate: evidenceOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="w-4 h-4" />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {evidenceOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-3">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {result.evidence_summary}
                        </p>
                        {result.evidence_urls?.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {result.evidence_urls.map((url: string, i: number) => (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Badge variant="outline" className="gap-1 text-[10px] hover:bg-primary/10 cursor-pointer transition-colors">
                                  <ExternalLink className="w-2.5 h-2.5" />
                                  Fuente {i + 1}
                                </Badge>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Distribution ── */}
              <div className="space-y-4">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" /> Distribución — {total} participantes
                </p>
                {options.map((opt: any, idx: number) => {
                  const count = distribution[opt.key] || 0;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  const isCorrect = opt.key === result.correct_answer;
                  return (
                    <motion.div
                      key={opt.key}
                      className="space-y-1.5"
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.8 + idx * 0.15 }}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 font-medium">
                          {isCorrect ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-destructive/40" />
                          )}
                          <span className="font-mono text-muted-foreground">{opt.key}</span>
                          {opt.label}
                        </span>
                        <span className="font-mono text-muted-foreground">{pct}% ({count})</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3.5 overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${isCorrect ? "bg-emerald-500" : "bg-destructive/30"}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: 1 + idx * 0.15, duration: 0.8, ease: "easeOut" }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ── Pending State ── */
            <div className="text-center py-8 space-y-4">
              <NeuralPulse />
              <p className="text-sm text-muted-foreground">
                Verificación pendiente. Los resultados se publican automáticamente en:
              </p>
              <Countdown createdAt={edition.created_at} />
            </div>
          )}
        </motion.div>

        {/* ── Leaderboard ── */}
        {leaderboard.length > 0 && result && (
          <motion.div
            className="rounded-xl border border-border bg-card shadow-card p-6"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.5 }}
          >
            <h3 className="text-sm font-display font-bold flex items-center gap-2 mb-5">
              <Trophy className="w-4 h-4 text-yellow-500" /> Ranking de Predicciones
            </h3>
            <div className="space-y-1">
              {leaderboard.map((p, i) => {
                const medalBg =
                  i === 0
                    ? "bg-yellow-500/10 border-yellow-500/20"
                    : i === 1
                      ? "bg-slate-300/10 border-slate-400/20"
                      : i === 2
                        ? "bg-amber-700/10 border-amber-700/20"
                        : "border-transparent";
                const barW = maxPoints > 0 ? (p.points_earned / maxPoints) * 100 : 0;

                return (
                  <motion.div
                    key={i}
                    className={`flex items-center justify-between py-2.5 px-3 rounded-lg text-xs border hover:bg-muted/40 transition-colors ${medalBg}`}
                    initial={{ x: -15, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 1.4 + i * 0.06 }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-bold text-muted-foreground w-6 text-center shrink-0">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                      </span>
                      <span className="font-medium truncate">
                        {p.user_name || p.user_email?.split("@")[0]}
                      </span>
                      {p.is_correct ? (
                        <Badge className="text-[8px] font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0 shrink-0">
                          ✓ ACERTÓ
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[8px] font-mono text-destructive/50 shrink-0">
                          ✗
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden hidden sm:block">
                        <motion.div
                          className="h-full bg-primary/60 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${barW}%` }}
                          transition={{ delay: 1.6 + i * 0.06, duration: 0.5 }}
                        />
                      </div>
                      <span className="font-mono font-bold text-primary">
                        {p.points_earned} pts
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Footer ── */}
        <motion.footer
          className="text-center py-8 space-y-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
        >
          <img src={bullfyLogo} alt="Bullfy" className="h-8 mx-auto opacity-30" />
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            © {new Date().getFullYear()} Bullfy Ltd. • bullfytech.online
          </p>
        </motion.footer>
      </div>
    </div>
  );
};

export default NewsletterResults;