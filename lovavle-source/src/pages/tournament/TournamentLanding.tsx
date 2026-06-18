import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Trophy, Users, Zap, Shield, Coins, Award, ChevronRight, Sparkles,
} from "lucide-react";

const SITE_URL = "https://bullfytech.online";
const PAGE_URL = `${SITE_URL}/tournament/landing`;
const TITLE = "Bullfy Tournament — Compite, gana premios y construye tu carrera de trader";
const DESCRIPTION =
  "Torneos de trading con premios reales en USDT, MT5 demo y real, ranking global, KYC y pagos seguros. Únete gratis y demuestra tu nivel.";

function setMeta(name: string, content: string, attr: "name" | "property" = "name") {
  let el = document.head.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function injectJsonLd(id: string, data: Record<string, unknown>) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export default function TournamentLanding() {
  const [active, setActive] = useState<any[]>([]);

  useEffect(() => {
    document.title = TITLE;
    setMeta("description", DESCRIPTION);
    setMeta("keywords", "torneo trading, competencia trading, MT5, premios USDT, ranking traders, prop firm, bullfy");
    setMeta("og:title", TITLE, "property");
    setMeta("og:description", DESCRIPTION, "property");
    setMeta("og:type", "website", "property");
    setMeta("og:url", PAGE_URL, "property");
    setMeta("og:image", `${SITE_URL}/pwa-512x512.png`, "property");
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", TITLE);
    setMeta("twitter:description", DESCRIPTION);
    setLink("canonical", PAGE_URL);

    injectJsonLd("ld-org", {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Bullfy Tournament",
      url: SITE_URL,
      logo: `${SITE_URL}/pwa-512x512.png`,
    });
    injectJsonLd("ld-faq", {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });

    (async () => {
      const { data } = await supabase.from("tournaments")
        .select("id, slug, name, type, status, starts_at, prize_pool_usd, max_participants")
        .eq("approval_status", "approved")
        .in("status", ["scheduled", "running"])
        .order("starts_at", { ascending: true })
        .limit(6);
      setActive(data || []);
    })();
  }, []);

  return (
    <div className="tournament-neon min-h-screen text-white">
      {/* Persistent background video */}
      <video
        className="fixed inset-0 w-screen h-screen object-cover z-0 pointer-events-none"
        autoPlay loop muted playsInline preload="auto"
        poster="/videos/tournament-poster.jpg"
        aria-hidden
      >
        <source src="/videos/tournament-bg.webm" type="video/webm" />
        <source src="/videos/tournament-bg.mp4" type="video/mp4" />
      </video>
      <div className="fixed inset-0 z-0 bg-[#060B1F]/35 pointer-events-none" aria-hidden />
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-[#060B1F]/10 via-[#060B1F]/25 to-[#060B1F]/60 pointer-events-none" aria-hidden />
      {/* Top nav minimal */}
      <nav className="relative z-30 max-w-7xl mx-auto flex items-center justify-between px-4 md:px-6 py-5">
        <Link to="/tournament/landing" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg p-[2px] bg-gradient-to-tr from-[#00E5FF] to-[#FF2EC4] shadow-[0_0_18px_rgba(0,229,255,0.35)]">
            <div className="w-full h-full bg-[#060B1F] rounded-[7px] flex items-center justify-center">
              <div className="w-4 h-4 bg-[#00E5FF] rounded-sm rotate-45 shadow-[0_0_10px_#00E5FF] group-hover:rotate-90 transition-transform" />
            </div>
          </div>
          <span className="t-display font-black text-lg md:text-xl tracking-tighter">
            BULLFY <span className="text-[#00E5FF]">TOURNAMENT</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/tournament/login" className="hidden sm:inline text-[11px] font-black uppercase tracking-widest text-gray-300 hover:text-white transition-colors">
            Ingresar
          </Link>
          <Link
            to="/tournament/register"
            className="px-5 py-2.5 rounded-xl bg-[#00E5FF] text-[#060B1F] font-black text-[11px] uppercase tracking-widest shadow-[0_0_20px_rgba(0,229,255,0.45)] hover:brightness-110 transition-all"
          >
            Registrarme
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="t-scanlines z-10" />

        <div className="relative z-20 max-w-6xl mx-auto px-4 py-20 md:py-32 text-center">
          <div className="inline-flex items-center gap-3 px-5 py-2 mb-8 rounded-full bg-[#FF2EC4]/10 border border-[#FF2EC4]/30 text-[#FF2EC4] text-[10px] font-black uppercase tracking-[0.3em]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF2EC4] animate-pulse shadow-[0_0_8px_#FF2EC4]" />
            Live Season Active
          </div>

          <h1 className="t-display text-5xl md:text-7xl lg:text-8xl font-black mb-6 leading-[0.95] tracking-tighter">
            <span className="t-glitch" data-text="COMPITE. GANA.">COMPITE. GANA.</span>
            <br />
            <span className="t-shimmer">DOMINA LOS MERCADOS.</span>
          </h1>

          <p className="t-display text-base md:text-xl font-black tracking-[0.18em] text-[#00E5FF] mb-6 uppercase">
            Donde el trading es un octágono de lucha
          </p>

          <p className="text-base md:text-lg text-gray-400 mb-10 max-w-2xl mx-auto font-light leading-relaxed">
            Torneos de trading con premios reales en{" "}
            <span className="text-white font-bold">USDT</span>, MT5 demo y real, ranking global y pagos seguros. Demuestra tu nivel en{" "}
            <span className="text-[#B6FF3D] font-bold">Bullfy Points</span>.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/tournament/register"
              className="px-9 py-4 rounded-2xl bg-white text-[#060B1F] font-black text-base tracking-tight hover:scale-105 transition-transform shadow-[0_20px_40px_rgba(0,0,0,0.4)] inline-flex items-center gap-2"
            >
              CREAR CUENTA GRATIS <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              to="/tournament"
              className="px-9 py-4 rounded-2xl border border-[#00E5FF]/30 bg-[#00E5FF]/5 backdrop-blur-md font-bold text-base text-white hover:bg-[#00E5FF]/10 transition-all"
            >
              VER TORNEOS ACTIVOS
            </Link>
          </div>

          <div className="mt-14 grid grid-cols-3 max-w-2xl mx-auto gap-6">
            <Stat n="10K+" l="Traders activos" color="#00E5FF" />
            <Stat n="$250K" l="En premios" color="#B6FF3D" />
            <Stat n="24/7" l="Mercados abiertos" color="#FF2EC4" />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 py-20 md:py-28">
        <div className="text-center mb-14">
          <p className="text-[10px] font-black text-[#00E5FF] uppercase tracking-[0.4em] mb-3">Por qué Bullfy</p>
          <h2 className="t-display text-4xl md:text-6xl font-black leading-[0.95]">
            UNA ARENA <span className="text-[#00E5FF]">SIN FILTROS.</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group relative rounded-3xl bg-[#0a1129] border border-white/5 p-7 overflow-hidden transition-all hover:translate-y-[-4px] hover:border-[#00E5FF]/30"
            >
              <div
                className="h-1 absolute top-0 left-0 right-0"
                style={{ background: `linear-gradient(to right, ${f.color}, transparent)` }}
              />
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{ background: `${f.color}1a`, border: `1px solid ${f.color}33` }}
              >
                <f.icon className="h-6 w-6" style={{ color: f.color }} />
              </div>
              <h3 className="t-display text-xl font-black mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TORNEOS ACTIVOS */}
      {active.length > 0 && (
        <section className="relative z-10 border-y border-white/5 bg-[#0a1129]/40 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 py-20">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="text-[10px] font-black text-[#B6FF3D] uppercase tracking-[0.4em] mb-2">Live now</p>
                <h2 className="t-display text-3xl md:text-5xl font-black">
                  TORNEOS EN <span className="text-[#B6FF3D]">VIVO</span>
                </h2>
              </div>
              <Link to="/tournament" className="text-[11px] font-black uppercase tracking-widest text-[#00E5FF] hover:text-white transition-colors hidden md:inline">
                Ver todos →
              </Link>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {active.map((t) => {
                const accent = t.type === "elite" ? "#FF2EC4" : t.type === "paid" ? "#00E5FF" : "#B6FF3D";
                return (
                  <div key={t.id} className="rounded-3xl bg-[#060B1F] border border-white/5 overflow-hidden hover:translate-y-[-4px] transition-transform">
                    <div className="h-1" style={{ background: accent, boxShadow: `0 0 12px ${accent}` }} />
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border" style={{ color: accent, borderColor: `${accent}33`, background: `${accent}0d` }}>
                          {t.type}
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${t.status === "running" ? "text-[#B6FF3D]" : "text-gray-500"}`}>
                          {t.status === "running" ? "En curso" : "Próximo"}
                        </span>
                      </div>
                      <h3 className="t-display text-xl font-black mb-1 line-clamp-1">{t.name}</h3>
                      <p className="text-[11px] text-gray-500 t-mono mb-4">
                        Inicia {new Date(t.starts_at).toLocaleDateString()}
                      </p>
                      <div className="flex items-center justify-between text-sm mb-4">
                        <span className="flex items-center gap-1.5 text-gray-400 text-xs">
                          <Users className="h-3.5 w-3.5" /> Hasta <span className="t-mono">{t.max_participants}</span>
                        </span>
                        <span className="t-mono font-black text-lg" style={{ color: accent }}>
                          ${Number(t.prize_pool_usd || 0).toLocaleString()}
                        </span>
                      </div>
                      <Link
                        to={`/tournament/t/${t.slug}`}
                        className="block w-full py-3 rounded-xl border border-white/10 bg-white/5 font-black text-[11px] tracking-[0.2em] text-center text-white hover:bg-white hover:text-[#060B1F] transition-all"
                      >
                        VER DETALLES
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* HOW IT WORKS */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 py-20 md:py-28">
        <div className="text-center mb-14">
          <p className="text-[10px] font-black text-[#FF2EC4] uppercase tracking-[0.4em] mb-3">Onboarding</p>
          <h2 className="t-display text-4xl md:text-6xl font-black leading-[0.95]">
            CÓMO <span className="text-[#FF2EC4]">FUNCIONA.</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-4 gap-6">
          {STEPS.map((s, i) => (
            <div key={s.title} className="relative rounded-3xl bg-[#0a1129] border border-white/5 p-7">
              <div className="t-display t-mono text-6xl font-black text-[#00E5FF]/15 absolute top-3 right-4 leading-none">
                0{i + 1}
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00E5FF] to-[#FF2EC4] flex items-center justify-center font-black text-[#060B1F] mb-4 shadow-[0_0_18px_rgba(0,229,255,0.35)]">
                {i + 1}
              </div>
              <h3 className="t-display text-lg font-black mb-2">{s.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 border-y border-white/5 bg-[#0a1129]/40 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-20">
          <div className="text-center mb-12">
            <p className="text-[10px] font-black text-[#00E5FF] uppercase tracking-[0.4em] mb-3">Help center</p>
            <h2 className="t-display text-4xl md:text-5xl font-black">
              PREGUNTAS <span className="text-[#00E5FF]">FRECUENTES.</span>
            </h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl bg-[#060B1F] border border-white/5 p-6 open:border-[#00E5FF]/30 transition-colors"
              >
                <summary className="cursor-pointer list-none flex items-start justify-between gap-4">
                  <h3 className="t-display font-black text-base md:text-lg">{f.q}</h3>
                  <ChevronRight className="h-5 w-5 text-[#00E5FF] shrink-0 mt-0.5 transition-transform group-open:rotate-90" />
                </summary>
                <p className="text-sm text-gray-400 mt-4 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative z-10">
        <div className="max-w-4xl mx-auto px-4 py-24 text-center">
          <div className="relative rounded-[2.5rem] overflow-hidden border border-white/5 bg-[#0a1129]/60 backdrop-blur-sm p-12 md:p-20">
            <div className="t-scanlines" />
            <div className="relative z-10">
              <h2 className="t-display text-4xl md:text-6xl font-black mb-4 leading-[0.95]">
                ¿LISTO PARA <br />
                <span className="t-shimmer">ENTRAR A LA ARENA?</span>
              </h2>
              <p className="text-gray-400 mb-10 max-w-xl mx-auto">
                Crea tu cuenta gratis y entra al próximo torneo. Sin tarjeta, sin compromiso.
              </p>
              <Link
                to="/tournament/register"
                className="inline-flex items-center gap-2 px-10 py-5 rounded-2xl bg-white text-[#060B1F] font-black text-base tracking-tight hover:scale-105 transition-transform shadow-[0_20px_40px_rgba(0,0,0,0.5)]"
              >
                EMPEZAR AHORA <ChevronRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/5 py-8 text-center text-[10px] uppercase tracking-[0.3em] text-gray-500">
        © {new Date().getFullYear()} Bullfy Tournament · powered by Bullfy
      </footer>
    </div>
  );
}

function Stat({ n, l, color }: { n: string; l: string; color: string }) {
  return (
    <div>
      <div className="t-display t-mono text-3xl md:text-4xl font-black" style={{ color, textShadow: `0 0 18px ${color}40` }}>{n}</div>
      <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mt-1">{l}</div>
    </div>
  );
}

const FEATURES = [
  { icon: Trophy, title: "Premios reales en USDT", desc: "Compite por bolsas en cripto, retira a tu wallet TRC20 cuando ganes.", color: "#00E5FF" },
  { icon: Zap, title: "MT5 demo y real", desc: "Operamos en MetaTrader 5 con cuentas dedicadas para cada torneo.", color: "#B6FF3D" },
  { icon: Shield, title: "Anti-fraude con IA", desc: "Detección automática de copy-trading, multi-cuenta y violaciones de reglas.", color: "#FF2EC4" },
  { icon: Award, title: "Logros y Bullfy Points", desc: "Sube de nivel, desbloquea logros y canjea BP por premios exclusivos.", color: "#B6FF3D" },
  { icon: Users, title: "Comunidad global", desc: "Chat en vivo por torneo, perfiles públicos y rankings actualizados al instante.", color: "#00E5FF" },
  { icon: Coins, title: "Pagos seguros", desc: "Stripe y Coinsbuy para entrada, KYC verificado para premios grandes.", color: "#FF2EC4" },
];

const STEPS = [
  { title: "Regístrate", desc: "Crea tu cuenta con email y verifica con OTP en segundos." },
  { title: "Elige torneo", desc: "Gratuito, de pago o élite. Hay para todos los niveles." },
  { title: "Opera en MT5", desc: "Recibes credenciales demo o real según el torneo." },
  { title: "Cobra tu premio", desc: "Top 3 reciben USDT directo a su wallet." },
];

const FAQS = [
  { q: "¿Es gratis participar?", a: "Sí. Tenemos torneos 100% gratuitos con premios en Bullfy Points y otros de pago con bolsas en USDT." },
  { q: "¿Cómo se previene el fraude?", a: "Usamos detección automática de IPs duplicadas, copy-trading entre cuentas y violaciones de reglas (drawdown, lotaje). Premios sujetos a auditoría." },
  { q: "¿Necesito KYC?", a: "Solo para retirar premios mayores a 100 USDT o participar en torneos élite. Es rápido y se hace una vez." },
  { q: "¿En qué plataforma se opera?", a: "MetaTrader 5. Te entregamos credenciales de cuenta demo o real al inscribirte." },
  { q: "¿Cuándo cobro?", a: "Tras el cierre del torneo y validación anti-fraude (24-72h), el premio se acredita a tu wallet interna y puedes retirarlo a USDT TRC20." },
  { q: "¿Puedo abrir disputa?", a: "Sí. Desde tu panel de Progreso puedes abrir una disputa que nuestro equipo revisará en menos de 5 días hábiles." },
];
