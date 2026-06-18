import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Maximize, Minimize, Radio, Users, MessageSquare,
  Star, BarChart3, DollarSign, Layers, TrendingUp, Target, Zap, Shield,
  Eye, Award, Mic, MonitorPlay, ImageIcon, Play
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const TOTAL_SLIDES = 10;

/* ──────────────────────── individual slides ──────────────────────── */

const Slide1 = () => (
  <div className="flex flex-col items-center justify-center h-full relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-[#062B63] via-[#0a3a7d] to-[#062B63]" />
    <div className="absolute top-1/4 left-1/4 w-[250px] h-[250px] md:w-[500px] md:h-[500px] rounded-full bg-[#146EF5]/10 blur-[80px] md:blur-[120px]" />
    <div className="absolute bottom-1/4 right-1/4 w-[200px] h-[200px] md:w-[400px] md:h-[400px] rounded-full bg-[#83CBFF]/8 blur-[60px] md:blur-[100px]" />
    <div className="relative z-10 text-center space-y-4 md:space-y-8 px-5 md:px-8">
      <div className="flex items-center justify-center gap-4 mb-2 md:mb-4">
        <Radio className="w-10 h-10 md:w-16 md:h-16 text-[#146EF5]" />
      </div>
      <h1 className="font-[Figtree] text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-extrabold text-white tracking-tight leading-tight">
        bullfy <span className="text-[#146EF5]">live</span>
      </h1>
      <p className="font-[Figtree] text-base sm:text-lg md:text-2xl lg:text-3xl text-[#83CBFF] max-w-3xl mx-auto leading-relaxed">
        el futuro del streaming para IBs y partners
      </p>
      <div className="flex items-center justify-center gap-2 pt-4 md:pt-8">
        <div className="w-2 h-2 rounded-full bg-[#146EF5] animate-pulse" />
        <span className="font-['Geist_Mono'] text-[10px] md:text-sm text-[#A0B1BD] uppercase tracking-widest">
          Presentación Ejecutiva 2026
        </span>
      </div>
    </div>
  </div>
);

const Slide2 = () => (
  <div className="flex h-full relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-r from-[#062B63] to-[#0a3570]" />
    <div className="relative z-10 flex flex-col lg:flex-row items-center justify-center gap-8 md:gap-16 px-5 md:px-16 w-full py-8 md:py-0 overflow-y-auto">
      <div className="flex-1 space-y-4 md:space-y-8 max-w-2xl">
        <span className="font-['Geist_Mono'] text-[10px] md:text-sm text-[#146EF5] uppercase tracking-widest">El Problema</span>
        <h2 className="font-[Figtree] text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
          los IBs necesitan <span className="text-[#83CBFF]">nuevas herramientas</span>
        </h2>
        <p className="font-[Figtree] text-sm md:text-xl text-[#A0B1BD] leading-relaxed">
          el modelo tradicional de captación está agotado. los IBs dependen de plataformas externas sin integración, pierden leads y no pueden medir el impacto real de su contenido.
        </p>
      </div>
      <div className="flex-1 max-w-md space-y-3 md:space-y-6 w-full">
        {[
          { icon: Eye, text: "sin visibilidad real del engagement", color: "#F96167" },
          { icon: Target, text: "leads perdidos en plataformas externas", color: "#F9E795" },
          { icon: BarChart3, text: "imposible medir ROI del contenido", color: "#83CBFF" },
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.2 }}
            className="flex items-center gap-3 md:gap-5 bg-white/5 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 border border-white/10"
          >
            <div className="w-10 h-10 md:w-14 md:h-14 rounded-lg md:rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${item.color}20` }}>
              <item.icon className="w-5 h-5 md:w-7 md:h-7" style={{ color: item.color }} />
            </div>
            <span className="font-[Figtree] text-sm md:text-lg text-white/90">{item.text}</span>
          </motion.div>
        ))}
      </div>
    </div>
  </div>
);

const Slide3 = () => (
  <div className="flex h-full relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-[#062B63] via-[#0b3d82] to-[#062B63]" />
    <div className="absolute top-0 right-0 w-[300px] h-[300px] md:w-[600px] md:h-[600px] rounded-full bg-[#146EF5]/8 blur-[80px] md:blur-[150px]" />
    <div className="relative z-10 flex flex-col items-center justify-center w-full px-5 md:px-16 text-center space-y-6 md:space-y-10 py-8 md:py-0 overflow-y-auto">
      <span className="font-['Geist_Mono'] text-[10px] md:text-sm text-[#146EF5] uppercase tracking-widest">La Solución</span>
      <h2 className="font-[Figtree] text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white max-w-4xl leading-tight">
        streaming integrado con <span className="text-[#146EF5]">captación de leads</span> en tiempo real
      </h2>
      <p className="font-[Figtree] text-sm md:text-xl text-[#A0B1BD] max-w-3xl leading-relaxed">
        bullfy live convierte cada transmisión en una máquina de generación de leads calificados, con métricas, monetización y control total desde un solo lugar.
      </p>
      <div className="grid grid-cols-3 gap-3 md:gap-8 pt-2 md:pt-4 max-w-4xl w-full">
        {[
          { value: "100%", label: "INTEGRADO" },
          { value: "REAL-TIME", label: "LEADS" },
          { value: "360°", label: "MÉTRICAS" },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.15 }}
            className="bg-white/5 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-8 border border-[#146EF5]/30"
          >
            <div className="font-['Geist_Mono'] text-lg md:text-3xl font-bold text-[#146EF5] mb-1 md:mb-2">{s.value}</div>
            <div className="font-['Geist_Mono'] text-[8px] md:text-xs text-[#A0B1BD] uppercase tracking-widest">{s.label}</div>
          </motion.div>
        ))}
      </div>
    </div>
  </div>
);

const Slide4 = () => (
  <div className="flex h-full relative overflow-hidden">
    <div className="absolute inset-0 bg-[#062B63]" />
    <div className="relative z-10 flex flex-col items-center justify-center w-full px-5 md:px-16 space-y-6 md:space-y-10 py-8 md:py-0 overflow-y-auto">
      <span className="font-['Geist_Mono'] text-[10px] md:text-sm text-[#146EF5] uppercase tracking-widest">Funcionalidades</span>
      <h2 className="font-[Figtree] text-2xl sm:text-3xl md:text-5xl font-bold text-white text-center">todo lo que un streamer necesita</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 max-w-5xl w-full">
        {[
          { icon: Mic, title: "co-streaming", desc: "invita co-hosts con un código" },
          { icon: MessageSquare, title: "chat en vivo", desc: "interacción instantánea" },
          { icon: Star, title: "votaciones", desc: "rating 1-5 estrellas en vivo" },
          { icon: Layers, title: "overlays", desc: "logos, animaciones, CTAs" },
          { icon: MonitorPlay, title: "grabaciones", desc: "guarda y reutiliza streams" },
          { icon: ImageIcon, title: "ads rotativos", desc: "banners automáticos" },
        ].map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-7 border border-white/10 hover:border-[#146EF5]/50 transition-colors"
          >
            <f.icon className="w-6 h-6 md:w-8 md:h-8 text-[#146EF5] mb-2 md:mb-4" />
            <h3 className="font-[Figtree] text-sm md:text-lg font-semibold text-white mb-1 md:mb-2">{f.title}</h3>
            <p className="font-[Figtree] text-xs md:text-sm text-[#A0B1BD]">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </div>
);

const Slide5 = () => (
  <div className="flex h-full relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-[#062B63] to-[#0a3570]" />
    <div className="relative z-10 flex flex-col lg:flex-row items-center justify-center gap-8 md:gap-16 px-5 md:px-16 w-full py-8 md:py-0 overflow-y-auto">
      <div className="flex-1 space-y-4 md:space-y-8 max-w-xl">
        <span className="font-['Geist_Mono'] text-[10px] md:text-sm text-[#146EF5] uppercase tracking-widest">Generación de Leads</span>
        <h2 className="font-[Figtree] text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight">
          cada viewer es un <span className="text-[#83CBFF]">lead potencial</span>
        </h2>
        <p className="font-[Figtree] text-sm md:text-lg text-[#A0B1BD] leading-relaxed">
          el sistema captura automáticamente datos de engagement, tiempo de visualización, interacciones y los convierte en leads calificados asignables a BDs.
        </p>
      </div>
      <div className="flex-1 max-w-lg w-full">
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl md:rounded-3xl border border-white/10 p-5 md:p-8 space-y-4 md:space-y-6">
          {[
            { step: "01", title: "viewer entra al stream", color: "#83CBFF" },
            { step: "02", title: "interactúa: chat, votos, reacciones", color: "#146EF5" },
            { step: "03", title: "sistema califica y asigna score", color: "#146EF5" },
            { step: "04", title: "lead asignado a BD para follow-up", color: "#83CBFF" },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.15 }}
              className="flex items-center gap-3 md:gap-5"
            >
              <div className="font-['Geist_Mono'] text-lg md:text-2xl font-bold shrink-0" style={{ color: s.color }}>{s.step}</div>
              <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
              <span className="font-[Figtree] text-xs md:text-base text-white/90 text-right">{s.title}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const Slide6 = () => (
  <div className="flex h-full relative overflow-hidden">
    <div className="absolute inset-0 bg-[#062B63]" />
    <div className="absolute bottom-0 left-0 w-[250px] h-[250px] md:w-[500px] md:h-[500px] rounded-full bg-[#146EF5]/6 blur-[80px] md:blur-[120px]" />
    <div className="relative z-10 flex flex-col items-center justify-center w-full px-5 md:px-16 space-y-6 md:space-y-10 py-8 md:py-0 overflow-y-auto">
      <span className="font-['Geist_Mono'] text-[10px] md:text-sm text-[#146EF5] uppercase tracking-widest">Monetización</span>
      <h2 className="font-[Figtree] text-2xl sm:text-3xl md:text-5xl font-bold text-white text-center">streamear <span className="text-[#146EF5]">genera ingresos</span></h2>
      <div className="grid grid-cols-2 gap-3 md:gap-6 max-w-5xl w-full">
        {[
          { icon: DollarSign, value: "$X", label: "POR LEAD", desc: "pago directo por cada lead calificado" },
          { icon: Play, value: "BONO", label: "POR STREAMS", desc: "al alcanzar umbral de transmisiones" },
          { icon: Eye, value: "BONO", label: "POR VISTAS", desc: "recompensa por audiencia acumulada" },
          { icon: Zap, value: "BONO", label: "INTERACCIONES", desc: "engagement = más ganancias" },
        ].map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.12 }}
            className="bg-gradient-to-b from-[#146EF5]/10 to-transparent rounded-xl md:rounded-2xl p-4 md:p-7 border border-[#146EF5]/20 text-center"
          >
            <div className="w-10 h-10 md:w-14 md:h-14 rounded-lg md:rounded-xl bg-[#146EF5]/20 flex items-center justify-center mx-auto mb-2 md:mb-4">
              <m.icon className="w-5 h-5 md:w-7 md:h-7 text-[#146EF5]" />
            </div>
            <div className="font-['Geist_Mono'] text-base md:text-xl font-bold text-[#83CBFF] mb-0.5 md:mb-1">{m.value}</div>
            <div className="font-['Geist_Mono'] text-[8px] md:text-[10px] text-[#A0B1BD] uppercase tracking-widest mb-1 md:mb-3">{m.label}</div>
            <p className="font-[Figtree] text-[11px] md:text-sm text-white/70 hidden sm:block">{m.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </div>
);

const Slide7 = () => (
  <div className="flex h-full relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-[#062B63] via-[#0b3d82] to-[#062B63]" />
    <div className="relative z-10 flex flex-col lg:flex-row items-center justify-center gap-8 md:gap-16 px-5 md:px-16 w-full py-8 md:py-0 overflow-y-auto">
      <div className="flex-1 space-y-4 md:space-y-8 max-w-xl">
        <span className="font-['Geist_Mono'] text-[10px] md:text-sm text-[#146EF5] uppercase tracking-widest">Partner Portals</span>
        <h2 className="font-[Figtree] text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight">
          cada IB tiene su <span className="text-[#146EF5]">propio portal</span>
        </h2>
        <p className="font-[Figtree] text-sm md:text-lg text-[#A0B1BD] leading-relaxed">
          portales personalizados donde los clientes acceden a streams exclusivos según su tier. el IB controla el acceso, contenido y branding.
        </p>
      </div>
      <div className="flex-1 max-w-md space-y-3 md:space-y-5 w-full">
        {[
          { tier: "FREE", features: "acceso a streams públicos", color: "#A0B1BD" },
          { tier: "PREMIUM", features: "streams exclusivos + grabaciones", color: "#146EF5" },
          { tier: "VIP", features: "co-streams + contenido premium + prioridad", color: "#83CBFF" },
        ].map((t, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.2 }}
            className="bg-white/5 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 border-l-4 border border-white/10"
            style={{ borderLeftColor: t.color }}
          >
            <div className="font-['Geist_Mono'] text-xs md:text-sm font-bold uppercase tracking-widest mb-1 md:mb-2" style={{ color: t.color }}>{t.tier}</div>
            <span className="font-[Figtree] text-sm md:text-base text-white/80">{t.features}</span>
          </motion.div>
        ))}
      </div>
    </div>
  </div>
);

const Slide8 = () => (
  <div className="flex h-full relative overflow-hidden">
    <div className="absolute inset-0 bg-[#062B63]" />
    <div className="relative z-10 flex flex-col items-center justify-center w-full px-5 md:px-16 space-y-6 md:space-y-10 py-8 md:py-0 overflow-y-auto">
      <span className="font-['Geist_Mono'] text-[10px] md:text-sm text-[#146EF5] uppercase tracking-widest">Analytics</span>
      <h2 className="font-[Figtree] text-2xl sm:text-3xl md:text-5xl font-bold text-white text-center">métricas que <span className="text-[#83CBFF]">importan</span></h2>
      <div className="grid grid-cols-2 gap-3 md:gap-8 max-w-5xl w-full">
        {[
          { label: "VIEWERS EN VIVO", value: "∞", sub: "tracking real-time" },
          { label: "RATING PROMEDIO", value: "★", sub: "votación de audiencia" },
          { label: "LEADS GENERADOS", value: "#", sub: "por stream y período" },
          { label: "EARNINGS", value: "$", sub: "ganancias acumuladas" },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.12 }}
            className="bg-white/5 rounded-xl md:rounded-2xl p-5 md:p-8 border border-white/10 text-center"
          >
            <div className="font-['Geist_Mono'] text-3xl md:text-5xl font-bold text-[#146EF5] mb-2 md:mb-3">{s.value}</div>
            <div className="font-['Geist_Mono'] text-[8px] md:text-xs text-[#83CBFF] uppercase tracking-widest mb-1 md:mb-2">{s.label}</div>
            <p className="font-[Figtree] text-xs md:text-sm text-[#A0B1BD]">{s.sub}</p>
          </motion.div>
        ))}
      </div>
      <p className="font-[Figtree] text-sm md:text-lg text-[#A0B1BD] max-w-3xl text-center pt-2 md:pt-4">
        dashboards de rendimiento, rankings entre streamers y tracking detallado de ganancias. todo en tiempo real.
      </p>
    </div>
  </div>
);

const Slide9 = () => (
  <div className="flex h-full relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-[#062B63] to-[#0a3570]" />
    <div className="relative z-10 flex flex-col lg:flex-row items-center justify-center gap-8 md:gap-16 px-5 md:px-16 w-full py-8 md:py-0 overflow-y-auto">
      <div className="flex-1 space-y-4 md:space-y-8 max-w-xl">
        <span className="font-['Geist_Mono'] text-[10px] md:text-sm text-[#146EF5] uppercase tracking-widest">Ads System</span>
        <h2 className="font-[Figtree] text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight">
          publicidad <span className="text-[#146EF5]">inteligente</span> durante streams
        </h2>
        <p className="font-[Figtree] text-sm md:text-lg text-[#A0B1BD] leading-relaxed">
          banners rotativos que aparecen automáticamente durante las transmisiones. configura campañas con frecuencia y duración personalizables.
        </p>
        <div className="space-y-2 md:space-y-4 pt-2 md:pt-4">
          {[
            "múltiples campañas simultáneas",
            "frecuencia y duración configurables",
            "segmentación por Partner Portal",
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-2 md:gap-3">
              <Shield className="w-4 h-4 md:w-5 md:h-5 text-[#146EF5] shrink-0" />
              <span className="font-[Figtree] text-sm md:text-base text-white/80">{f}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 max-w-md w-full">
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl md:rounded-3xl border border-white/10 p-5 md:p-8 relative overflow-hidden">
          <div className="aspect-video bg-[#0a3570] rounded-lg md:rounded-xl flex items-center justify-center mb-4 md:mb-6">
            <Play className="w-10 h-10 md:w-16 md:h-16 text-[#146EF5]/50" />
          </div>
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="bg-gradient-to-r from-[#146EF5] to-[#83CBFF] rounded-lg md:rounded-xl p-3 md:p-4 text-center"
          >
            <span className="font-['Geist_Mono'] text-xs md:text-sm font-bold text-white uppercase tracking-wider">
              ← Banner Ad Rotativo →
            </span>
          </motion.div>
        </div>
      </div>
    </div>
  </div>
);

const Slide10 = () => (
  <div className="flex flex-col items-center justify-center h-full relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-[#062B63] via-[#146EF5]/20 to-[#062B63]" />
    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[350px] h-[350px] md:w-[700px] md:h-[700px] rounded-full bg-[#146EF5]/10 blur-[80px] md:blur-[150px]" />
    <div className="relative z-10 text-center space-y-6 md:space-y-10 px-5 md:px-8 max-w-4xl">
      <Radio className="w-12 h-12 md:w-20 md:h-20 text-[#146EF5] mx-auto" />
      <h2 className="font-[Figtree] text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-extrabold text-white leading-tight">
        el streaming que <span className="text-[#146EF5]">genera negocio</span>
      </h2>
      <p className="font-[Figtree] text-base md:text-2xl text-[#83CBFF]">
        bullfy live ya está listo. construyamos juntos el futuro.
      </p>
      <div className="flex items-center justify-center gap-2 md:gap-3 pt-4 md:pt-8">
        <Award className="w-4 h-4 md:w-5 md:h-5 text-[#A0B1BD]" />
        <span className="font-['Geist_Mono'] text-[10px] md:text-sm text-[#A0B1BD] uppercase tracking-widest">
          Bullfy Tech — 2026
        </span>
      </div>
    </div>
  </div>
);

const SLIDES = [Slide1, Slide2, Slide3, Slide4, Slide5, Slide6, Slide7, Slide8, Slide9, Slide10];

/* ──────────────────────── swipe hook ──────────────────────── */

function useSwipe(onLeft: () => void, onRight: () => void) {
  const touchStart = useRef<number | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX;
  }, []);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(diff) > 50) {
      if (diff < 0) onLeft();
      else onRight();
    }
    touchStart.current = null;
  }, [onLeft, onRight]);
  return { onTouchStart, onTouchEnd };
}

/* ──────────────────────── main component ──────────────────────── */

const Presentacion = () => {
  const [current, setCurrent] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const goNext = useCallback(() => setCurrent((c) => Math.min(TOTAL_SLIDES - 1, c + 1)), []);
  const goPrev = useCallback(() => setCurrent((c) => Math.max(0, c - 1)), []);
  const swipeHandlers = useSwipe(goNext, goPrev);

  const go = useCallback((dir: 1 | -1) => {
    setCurrent((c) => Math.max(0, Math.min(TOTAL_SLIDES - 1, c + dir)));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); go(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      if (e.key === "F5") { e.preventDefault(); toggleFullscreen(); }
      if (e.key === "Escape" && isFullscreen) document.exitFullscreen?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, isFullscreen]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen();
    else document.exitFullscreen();
  };

  const CurrentSlide = SLIDES[current];

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen bg-[#062B63] overflow-hidden select-none"
      {...swipeHandlers}
    >
      {/* slide */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: isMobile ? 30 : 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: isMobile ? -30 : -60 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <CurrentSlide />
        </motion.div>
      </AnimatePresence>

      {/* controls */}
      <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 md:gap-4 z-50">
        <button
          onClick={() => go(-1)}
          disabled={current === 0}
          className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white/70 hover:bg-white/20 disabled:opacity-30 transition-all"
        >
          <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
        </button>
        <div className="flex items-center gap-1.5 md:gap-2">
          {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1.5 md:h-2 rounded-full transition-all duration-300 ${i === current ? "w-5 md:w-8 bg-[#146EF5]" : "w-1.5 md:w-2 bg-white/30 hover:bg-white/50"}`}
            />
          ))}
        </div>
        <button
          onClick={() => go(1)}
          disabled={current === TOTAL_SLIDES - 1}
          className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white/70 hover:bg-white/20 disabled:opacity-30 transition-all"
        >
          <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
        </button>
      </div>

      {/* slide counter + fullscreen */}
      <div className="absolute top-4 md:top-6 right-4 md:right-6 flex items-center gap-2 md:gap-3 z-50">
        <span className="font-['Geist_Mono'] text-[10px] md:text-xs text-white/50 uppercase tracking-widest">
          {String(current + 1).padStart(2, "0")} / {TOTAL_SLIDES}
        </span>
        {!isMobile && (
          <button
            onClick={toggleFullscreen}
            className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white/60 hover:bg-white/20 transition-all"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
};

export default Presentacion;
