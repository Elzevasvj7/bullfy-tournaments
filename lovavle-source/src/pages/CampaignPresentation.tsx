import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Brain, BarChart3, Users, Shield, Target, TrendingUp, Hash, Clock, MessageSquare, CheckCircle2, AlertTriangle, ThumbsUp, ThumbsDown, Sparkles, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

/* ─── Scrollable slide wrapper — allows content to scroll when it overflows ─── */
const ScrollableSlide = ({ children, bg }: { children: React.ReactNode; bg: React.ReactNode }) => (
  <div className="h-full w-full relative">
    {bg}
    <ScrollArea className="h-full w-full">
      <div className="relative z-10 min-h-full flex flex-col items-center px-6 md:px-12 py-12 pb-20">
        {children}
      </div>
    </ScrollArea>
  </div>
);

/* ─── Slide: Intro with full campaign summary ─── */
const SlideIntro = ({ data }: { data: any }) => (
  <ScrollableSlide bg={
    <>
      <div className="absolute inset-0 bg-gradient-to-br from-[#062B63] via-[#0a3a7d] to-[#062B63]" />
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-[#146EF5]/10 blur-[120px]" />
    </>
  }>
    <Brain className="w-16 h-16 text-[#146EF5] mx-auto mb-4" />
    <h1 className="font-[Figtree] text-5xl md:text-7xl font-extrabold text-white tracking-tight text-center">
      bullfy <span className="text-[#146EF5]">brain</span>
    </h1>
    <p className="font-[Figtree] text-xl md:text-2xl text-[#83CBFF] max-w-3xl mx-auto mt-4 text-center">
      Análisis Multi-Agente de Campaña
    </p>

    {/* Campaign Summary Card — full text, no truncation */}
    <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 max-w-3xl w-full mt-10 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <FileText className="w-6 h-6 text-[#146EF5]" />
        <h2 className="text-xl font-semibold text-white">{data.campaign_name}</h2>
      </div>
      {data.copy_text && (
        <div className="space-y-2">
          <span className="font-['Geist_Mono'] text-[10px] text-[#146EF5] uppercase tracking-widest">Contenido de la Campaña</span>
          <p className="text-sm text-[#A0B1BD] leading-relaxed whitespace-pre-wrap">{data.copy_text}</p>
        </div>
      )}
      {data.image_url && (
        <div className="space-y-2">
          <span className="font-['Geist_Mono'] text-[10px] text-[#146EF5] uppercase tracking-widest">Asset Visual</span>
          <img src={data.image_url} alt="Campaign asset" className="max-h-48 rounded-lg border border-white/10" />
        </div>
      )}
    </div>

    <div className="flex items-center justify-center gap-2 pt-6">
      <div className="w-2 h-2 rounded-full bg-[#146EF5] animate-pulse" />
      <span className="font-['Geist_Mono'] text-xs text-[#A0B1BD] uppercase tracking-widest">
        {data.analysis_data?.agent_count || 18} Agentes • Debate Neural
      </span>
    </div>
  </ScrollableSlide>
);

/* ─── Slide: Consensus ─── */
const SlideConsensus = ({ data }: { data: any }) => {
  const mod = data.analysis_data?.moderator;
  if (!mod) return null;
  const score = mod.consensus_score || 0;
  return (
    <ScrollableSlide bg={<div className="absolute inset-0 bg-gradient-to-br from-[#062B63] to-[#0a3570]" />}>
      <span className="font-['Geist_Mono'] text-sm text-[#146EF5] uppercase tracking-widest">Veredicto</span>
      <h2 className="font-[Figtree] text-4xl md:text-6xl font-bold text-white mt-4">Consenso del Debate</h2>
      <div className="flex flex-col md:flex-row items-center gap-8 mt-8">
        <div className="relative w-40 h-40 shrink-0">
          <svg viewBox="0 0 120 120" className="w-full h-full">
            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
            <circle cx="60" cy="60" r="54" fill="none" stroke="#146EF5" strokeWidth="8"
              strokeDasharray={`${score * 3.39} 339`} strokeLinecap="round" transform="rotate(-90 60 60)" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-bold text-white">{score}</span>
          </div>
        </div>
        <div className="space-y-3">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <span className="text-xs text-[#A0B1BD] uppercase">Potencial Viral</span>
            <p className="text-lg font-bold text-[#83CBFF]">{mod.viral_potential || "N/A"}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <span className="text-xs text-[#A0B1BD] uppercase">Tasa de Aprobación</span>
            <p className="text-lg font-bold text-[#83CBFF]">{mod.approval_rate || "N/A"}</p>
          </div>
        </div>
      </div>
      {mod.summary && (
        <p className="text-base text-[#A0B1BD] max-w-3xl text-center mt-8 leading-relaxed">{mod.summary}</p>
      )}
    </ScrollableSlide>
  );
};

/* ─── Slide: Expert vs Audience ─── */
const SlideExpertVsAudience = ({ data }: { data: any }) => {
  const mod = data.analysis_data?.moderator;
  if (!mod) return null;
  return (
    <ScrollableSlide bg={<div className="absolute inset-0 bg-[#062B63]" />}>
      <span className="font-['Geist_Mono'] text-sm text-[#146EF5] uppercase tracking-widest">Perspectivas</span>
      <h2 className="font-[Figtree] text-3xl md:text-5xl font-bold text-white mt-4">Expertos vs Audiencia</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl w-full mt-8">
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
          className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-[#146EF5]/30">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-[#146EF5]" />
            <h3 className="text-xl font-semibold text-white">Expertos</h3>
          </div>
          <p className="text-[#A0B1BD] leading-relaxed">{mod.expert_consensus || "Sin datos"}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}
          className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-[#83CBFF]/30">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-8 h-8 text-[#83CBFF]" />
            <h3 className="text-xl font-semibold text-white">Audiencia</h3>
          </div>
          <p className="text-[#A0B1BD] leading-relaxed">{mod.audience_consensus || "Sin datos"}</p>
        </motion.div>
      </div>
      {mod.biggest_debate && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-6 max-w-3xl w-full mt-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <span className="text-sm font-semibold text-yellow-400">Mayor Punto de Debate</span>
          </div>
          <p className="text-sm text-[#A0B1BD] leading-relaxed">{mod.biggest_debate}</p>
        </div>
      )}
    </ScrollableSlide>
  );
};

/* ─── Slide: Agents — scrollable, NO text truncation ─── */
const SlideAgents = ({ data, roleFilter }: { data: any; roleFilter: "expert" | "persona" }) => {
  const agents = Object.values(data.analysis_data?.agents || {}).filter((a: any) => a.role === roleFilter) as any[];
  const title = roleFilter === "expert" ? "Panel de Expertos" : "Voces de la Audiencia";
  const subtitle = roleFilter === "expert" ? "Especialistas en marketing, copy, estrategia y compliance" : "13 perfiles demográficos diversos";

  const verdictColor = (v: string) => {
    if (v === "aprobado" || v === "me_encanta") return "#22c55e";
    if (v === "aprobado_con_reservas" || v === "interesante") return "#3b82f6";
    if (v === "rechazado" || v === "me_molesta") return "#ef4444";
    return "#eab308";
  };

  return (
    <ScrollableSlide bg={<div className="absolute inset-0 bg-gradient-to-br from-[#062B63] to-[#0a3570]" />}>
      <span className="font-['Geist_Mono'] text-sm text-[#146EF5] uppercase tracking-widest">{title}</span>
      <p className="text-sm text-[#A0B1BD] mb-6 mt-1">{subtitle}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl w-full">
        {agents.map((agent: any, i: number) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10" style={{ borderLeftWidth: 4, borderLeftColor: agent.color }}>
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl shrink-0">{agent.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{agent.name}</p>
                <p className="text-[11px] text-[#A0B1BD] leading-relaxed mt-0.5">{agent.profile}</p>
              </div>
              <span className="text-sm font-bold shrink-0 mt-0.5" style={{ color: verdictColor(agent.result?.verdict) }}>
                {agent.result?.score ?? "?"}/100
              </span>
            </div>
            {/* Full analysis text — no line-clamp */}
            {agent.result?.analysis && (
              <p className="text-xs text-[#A0B1BD] leading-relaxed">{agent.result.analysis}</p>
            )}
            {agent.result?.first_reaction && (
              <p className="text-xs italic text-[#83CBFF] mt-2 leading-relaxed">"{agent.result.first_reaction}"</p>
            )}
            {/* Show strengths/weaknesses for experts */}
            {agent.result?.strengths?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {agent.result.strengths.map((s: string, si: number) => (
                  <span key={si} className="text-[10px] bg-green-500/10 text-green-400 rounded-full px-2 py-0.5">✅ {s}</span>
                ))}
              </div>
            )}
            {agent.result?.weaknesses?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {agent.result.weaknesses.map((w: string, wi: number) => (
                  <span key={wi} className="text-[10px] bg-red-500/10 text-red-400 rounded-full px-2 py-0.5">⚠️ {w}</span>
                ))}
              </div>
            )}
            {/* Show action indicators for personas */}
            {(agent.result?.would_click !== undefined || agent.result?.would_share !== undefined) && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {agent.result?.would_click && <span className="text-[10px] bg-green-500/10 text-green-400 rounded-full px-2 py-0.5">Haría clic ✓</span>}
                {agent.result?.would_share && <span className="text-[10px] bg-blue-500/10 text-blue-400 rounded-full px-2 py-0.5">Compartiría ✓</span>}
                {agent.result?.would_follow && <span className="text-[10px] bg-purple-500/10 text-purple-400 rounded-full px-2 py-0.5">Seguiría ✓</span>}
                {agent.result?.emotional_response && (
                  <span className="text-[10px] bg-white/5 text-[#A0B1BD] rounded-full px-2 py-0.5">{agent.result.emotional_response}</span>
                )}
              </div>
            )}
            {agent.result?.what_would_improve_it && (
              <p className="text-[11px] text-[#83CBFF] mt-2">💡 {agent.result.what_would_improve_it}</p>
            )}
          </motion.div>
        ))}
      </div>
    </ScrollableSlide>
  );
};

/* ─── Slide: Recommendations ─── */
const SlideRecommendations = ({ data }: { data: any }) => {
  const mod = data.analysis_data?.moderator;
  if (!mod) return null;
  return (
    <ScrollableSlide bg={<div className="absolute inset-0 bg-[#062B63]" />}>
      <span className="font-['Geist_Mono'] text-sm text-[#146EF5] uppercase tracking-widest">Recomendaciones</span>
      <h2 className="font-[Figtree] text-3xl md:text-5xl font-bold text-white mt-4">Plan de Acción</h2>
      <div className="space-y-4 max-w-3xl w-full mt-8">
        {(mod.final_recommendations || []).map((r: any, i: number) => (
          <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.15 }}
            className="flex items-start gap-4 bg-white/5 rounded-xl p-5 border border-white/10">
            <div className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold uppercase ${
              r.priority === "alta" ? "bg-red-500/20 text-red-400" : r.priority === "media" ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"
            }`}>{r.priority}</div>
            <p className="text-sm text-[#A0B1BD] leading-relaxed">{r.recommendation}</p>
          </motion.div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full mt-6">
        {mod.universal_praise?.length > 0 && (
          <div className="bg-green-500/5 rounded-xl p-5 border border-green-500/20">
            <h3 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Elogios Universales</h3>
            <ul className="space-y-2">{mod.universal_praise.map((p: string, i: number) => <li key={i} className="text-xs text-[#A0B1BD] leading-relaxed">✅ {p}</li>)}</ul>
          </div>
        )}
        {mod.deal_breakers?.length > 0 && (
          <div className="bg-red-500/5 rounded-xl p-5 border border-red-500/20">
            <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Deal Breakers</h3>
            <ul className="space-y-2">{mod.deal_breakers.map((d: string, i: number) => <li key={i} className="text-xs text-[#A0B1BD] leading-relaxed">🚨 {d}</li>)}</ul>
          </div>
        )}
      </div>
    </ScrollableSlide>
  );
};

/* ─── Slide: Metrics ─── */
const SlideMetrics = ({ data }: { data: any }) => {
  const mod = data.analysis_data?.moderator;
  if (!mod) return null;
  return (
    <ScrollableSlide bg={<div className="absolute inset-0 bg-gradient-to-br from-[#062B63] via-[#0b3d82] to-[#062B63]" />}>
      <span className="font-['Geist_Mono'] text-sm text-[#146EF5] uppercase tracking-widest">Métricas</span>
      <h2 className="font-[Figtree] text-3xl md:text-5xl font-bold text-white mt-4">Engagement & Segmentos</h2>
      {mod.predicted_engagement && Object.keys(mod.predicted_engagement).length > 0 && (
        <div className="flex flex-wrap gap-4 justify-center mt-8">
          {Object.entries(mod.predicted_engagement).map(([platform, level]) => (
            <div key={platform} className="bg-white/5 rounded-xl px-6 py-4 border border-white/10 text-center min-w-[120px]">
              <p className="text-xs text-[#A0B1BD] uppercase mb-1">{platform}</p>
              <p className="text-lg font-bold text-[#146EF5]">{level as string}</p>
            </div>
          ))}
        </div>
      )}
      {mod.target_segments_ranking?.length > 0 && (
        <div className="max-w-3xl w-full space-y-3 mt-6">
          {mod.target_segments_ranking.map((seg: any, i: number) => (
            <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white font-medium">{seg.segment}</span>
                <span className="text-sm font-bold text-[#146EF5]">{seg.score}/100</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-[#146EF5] rounded-full" style={{ width: `${seg.score}%` }} />
              </div>
              <p className="text-xs text-[#A0B1BD] mt-1 leading-relaxed">{seg.reasoning}</p>
            </div>
          ))}
        </div>
      )}
      {(mod.hashtag_suggestions?.length > 0 || mod.best_posting_times?.length > 0) && (
        <div className="flex flex-wrap gap-3 justify-center mt-6">
          {(mod.best_posting_times || []).map((t: string, i: number) => (
            <span key={`t-${i}`} className="bg-white/5 text-[#A0B1BD] rounded-full px-4 py-1.5 text-sm border border-white/10">🕐 {t}</span>
          ))}
          {(mod.hashtag_suggestions || []).map((h: string, i: number) => (
            <span key={`h-${i}`} className="bg-[#146EF5]/10 text-[#83CBFF] rounded-full px-4 py-1.5 text-sm border border-[#146EF5]/20">{h}</span>
          ))}
        </div>
      )}
    </ScrollableSlide>
  );
};

/* ─── Main Page ─── */
const CampaignPresentation = () => {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const load = async () => {
      if (!slug) { setError("No slug"); setLoading(false); return; }
      const { data: row, error: e } = await supabase
        .from("campaign_presentations")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (e || !row) { setError("Presentación no encontrada"); }
      else setData(row);
      setLoading(false);
    };
    load();
  }, [slug]);

  const slides = useMemo(() => {
    if (!data) return [];
    return [
      <SlideIntro data={data} />,
      <SlideConsensus data={data} />,
      <SlideExpertVsAudience data={data} />,
      <SlideAgents data={data} roleFilter="expert" />,
      <SlideAgents data={data} roleFilter="persona" />,
      <SlideRecommendations data={data} />,
      <SlideMetrics data={data} />,
    ];
  }, [data]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") setCurrent(c => Math.min(c + 1, slides.length - 1));
      if (e.key === "ArrowLeft") setCurrent(c => Math.max(c - 1, 0));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [slides.length]);

  const [touchStart, setTouchStart] = useState<number | null>(null);

  if (loading) return (
    <div className="min-h-screen bg-[#062B63] flex items-center justify-center">
      <div className="text-center space-y-4">
        <Brain className="w-12 h-12 text-[#146EF5] mx-auto animate-pulse" />
        <p className="text-[#A0B1BD]">Cargando presentación...</p>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-[#062B63] flex items-center justify-center">
      <div className="text-center space-y-4">
        <Brain className="w-12 h-12 text-red-400 mx-auto" />
        <p className="text-[#A0B1BD]">{error || "No encontrada"}</p>
      </div>
    </div>
  );

  return (
    <div
      className="h-screen w-screen bg-[#062B63] overflow-hidden relative select-none"
      onTouchStart={e => setTouchStart(e.touches[0].clientX)}
      onTouchEnd={e => {
        if (touchStart === null) return;
        const diff = e.changedTouches[0].clientX - touchStart;
        if (Math.abs(diff) > 60) {
          if (diff < 0) setCurrent(c => Math.min(c + 1, slides.length - 1));
          else setCurrent(c => Math.max(c - 1, 0));
        }
        setTouchStart(null);
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -60 }}
          transition={{ duration: 0.4 }}
          className="h-full w-full"
        >
          {slides[current]}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 z-50">
        <button onClick={() => setCurrent(c => Math.max(c - 1, 0))} disabled={current === 0}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white disabled:opacity-30 transition-all">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${i === current ? "bg-[#146EF5] w-6" : "bg-white/30 hover:bg-white/50"}`} />
          ))}
        </div>
        <button onClick={() => setCurrent(c => Math.min(c + 1, slides.length - 1))} disabled={current === slides.length - 1}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white disabled:opacity-30 transition-all">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Slide counter */}
      <div className="absolute top-4 right-4 z-50 font-['Geist_Mono'] text-xs text-white/40">
        {current + 1} / {slides.length}
      </div>

      {/* Bullfy Brain branding */}
      <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
        <Brain className="w-5 h-5 text-[#146EF5]" />
        <span className="font-[Figtree] text-sm font-semibold text-white/60">Bullfy Brain</span>
      </div>
    </div>
  );
};

export default CampaignPresentation;
