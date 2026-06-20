import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Crown,
  Flame,
  Gauge,
  Gem,
  Radio,
  RadioTower,
  ShieldCheck,
  Swords,
  Trophy,
  UsersRound,
  WalletCards,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TournamentVipLandingMotion } from "./tournament-vip-landing-motion";
import {
  AnimatedLeaderboard,
  FinalArenaStatus,
  LiveBadge,
  MagneticButton,
  MarketPulse,
} from "./tournament-vip-motion-widgets";

const WHITE_FILTER = "brightness(0) invert(1)";

const heroSignals = [
  { label: "Cupos", value: "VIP", icon: Crown },
  { label: "Modo", value: "Clan + Trader", icon: UsersRound },
  { label: "Acceso", value: "Privado", icon: ShieldCheck },
];

const valueProps = [
  {
    icon: Trophy,
    title: "Entrada lista para competir",
    text: "El flujo recoge identidad, contacto, referido y datos competitivos antes de abrir la arena.",
  },
  {
    icon: Swords,
    title: "Clan desde el primer dia",
    text: "El usuario no llega solo: define nombre, tag, manifiesto y modo de reclutamiento del clan.",
  },
  {
    icon: Gauge,
    title: "Onboarding con friccion correcta",
    text: "Los pasos separan datos, verificacion y fundacion para evitar formularios largos sin contexto.",
  },
];

const ecosystemNodes = [
  {
    icon: UsersRound,
    label: "Clanes",
    value: "Roster activo",
    detail: "Tags, capitanes, invitaciones y reputacion publica.",
  },
  {
    icon: Swords,
    label: "Arenas",
    value: "Matchmaking",
    detail: "Retos, guerras y torneos con energia de evento en vivo.",
  },
  {
    icon: WalletCards,
    label: "Wallet",
    value: "BMoney",
    detail: "Entrada, premios y movimientos conectados al perfil.",
  },
  {
    icon: BarChart3,
    label: "Rankings",
    value: "Leaderboard",
    detail: "Puntos, PnL, rachas y clasificacion por clan/trader.",
  },
];

const liveFeed = [
  "CLAN NEXUS entro al lobby VIP",
  "Reto 4v4 pendiente de confirmacion",
  "Ranking actualizado: +320 pts",
  "Arena bloqueada para capitanes",
];

const itinerary = [
  "Aplicacion VIP",
  "Verificacion email/SMS",
  "Fundacion de clan",
  "Activacion de arena",
];

export function TournamentVipLanding() {
  return (
    <main
      data-vip-landing
      className="tournament-neon overflow-hidden text-white"
    >
      <TournamentVipLandingMotion />
      <HeroSection />
      <section
        className="relative z-10 border-y border-white/10 bg-[#081125] px-4 py-14 sm:px-6 lg:px-8"
      >
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
          {valueProps.map((item) => (
            <article
              key={item.title}
              data-gsap="value-card"
              className="group border border-white/10 bg-black/20 p-6 transition-colors hover:border-[#00E5FF]/45"
            >
              <div className="flex size-12 items-center justify-center border border-[#00E5FF]/35 bg-[#00E5FF]/10 text-[#00E5FF] shadow-[0_0_28px_rgba(0,229,255,0.12)]">
                <item.icon className="size-5" />
              </div>
              <h2 className="mt-6 text-2xl font-black uppercase leading-none">
                {item.title}
              </h2>
              <p className="mt-4 text-sm leading-6 text-slate-400">
                {item.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* <section
        data-gsap="ecosystem-section"
        className="vip-ecosystem-section relative z-10 overflow-hidden bg-[#050914] px-4 py-16 sm:px-6 lg:px-8"
      >
        <div className="vip-ecosystem-grid" aria-hidden />
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div data-gsap="ecosystem-copy" className="relative z-10">
            <Badge variant="neonBlue" className="h-7 px-4">
              <Radio className="size-3" />
              ecosistema en vivo
            </Badge>
            <h2 className="mt-5 max-w-2xl text-4xl font-black uppercase leading-[0.9] sm:text-6xl">
              Cada registro prende una pieza del circuito.
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
              No es un formulario aislado: usuario, clan, wallet, rankings y
              arena empiezan a moverse como una red competitiva desde el primer
              click.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <LiveMetric label="slots vip" value="24" />
              <LiveMetric label="clanes listos" value="08" />
            </div>
            <AnimatedLeaderboard />
          </div>

          <div className="relative min-h-[34rem]">
            <div data-gsap="ecosystem-core" className="vip-core">
              <div className="vip-core-ring" />
              <div className="relative z-10 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#00E5FF]">
                  Bullfy OS
                </p>
                <p className="mt-2 text-4xl font-black text-white">LIVE</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-[#B6FF3D]">
                  tournament pulse
                </p>
              </div>
            </div>

            <div className="vip-node-grid">
              {ecosystemNodes.map((node, index) => (
                <article
                  key={node.label}
                  data-gsap="ecosystem-node"
                  className="vip-node"
                  style={{ ["--node-index" as string]: index }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex size-11 items-center justify-center border border-[#00E5FF]/35 bg-[#00E5FF]/10 text-[#00E5FF]">
                      <node.icon className="size-5" />
                    </div>
                    <Zap className="size-4 text-[#B6FF3D]" />
                  </div>
                  <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                    {node.label}
                  </p>
                  <h3 className="mt-2 text-xl font-black uppercase leading-none">
                    {node.value}
                  </h3>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    {node.detail}
                  </p>
                </article>
              ))}
            </div>

            <div data-gsap="live-feed" className="vip-live-feed">
              {liveFeed.map((item) => (
                <div key={item} className="vip-feed-row">
                  <span className="size-2 bg-[#B6FF3D]" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section> */}

      <section
        data-gsap="route-section"
        className="relative z-10 overflow-hidden bg-[#050915] px-4 py-16 sm:px-6 lg:px-8"
      >
        <div
          data-gsap="scan-beam"
          className="vip-scan-beam"
          aria-hidden
        />
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div data-gsap="route-copy">
            <Badge variant="neonGreen" className="h-7 px-4">
              ruta de ingreso
            </Badge>
            <h2 className="mt-5 max-w-2xl text-4xl font-black uppercase leading-[0.95] sm:text-5xl">
              Un registro que se siente como invitacion, no como tramite.
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
              Esta pagina esta pensada para compartirse con usuarios VIP. La
              landing calienta el contexto y el CTA abre un registro dedicado,
              separado del registro publico actual.
            </p>
          </div>

          <div className="grid gap-3">
            {itinerary.map((item, index) => (
              <div
                key={item}
                data-gsap="route-row"
                className="grid grid-cols-[4rem_1fr] items-center border border-white/10 bg-[#0A1129]/70"
              >
                <div className="flex h-full min-h-20 items-center justify-center border-r border-white/10 bg-black/20 text-2xl font-black text-[#B6FF3D]">
                  0{index + 1}
                </div>
                <div className="flex items-center justify-between gap-4 px-5">
                  <p className="text-lg font-black uppercase">{item}</p>
                  {index === itinerary.length - 1 ? (
                    <BadgeCheck className="size-5 text-[#B6FF3D]" />
                  ) : (
                    <RadioTower className="size-5 text-[#00E5FF]" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 border-t border-white/10 bg-[#B6FF3D] px-4 py-12 text-[#071102] sm:px-6 lg:px-8">
        <div
          data-gsap="final-cta"
          className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em]">
              listo para enviar
            </p>
            <h2 className="mt-2 text-3xl font-black uppercase leading-none sm:text-4xl">
              Comparte el enlace VIP y mide conversion.
            </h2>
            <FinalArenaStatus />
          </div>
          <MagneticButton>
            <Button
              render={<Link href="/register-tournament/signup" />}
              nativeButton={false}
              variant="neonBlueSolid"
              size="lg"
              className="h-12 justify-center border-[#071102] bg-[#071102] px-6 text-white hover:bg-[#101827]"
            >
              Abrir registro
              <ArrowRight className="size-4" />
            </Button>
          </MagneticButton>
        </div>
      </section>
    </main>
  );
}

function HeroSection() {
  return (
    <section
      data-gsap="hero"
      className="relative min-h-[88svh] overflow-hidden px-4 pb-12 pt-5 sm:px-6 lg:px-8"
    >
      <div data-gsap="hero-media" className="absolute inset-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          poster="/videos/tournament-poster.jpg"
          className="h-full w-full object-cover opacity-55"
        >
          <source src="/videos/tournament-bg.webm" type="video/webm" />
          <source src="/videos/tournament-bg.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,7,18,0.98),rgba(3,7,18,0.76)_46%,rgba(3,7,18,0.40)_72%,rgba(3,7,18,0.92))]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#081125] to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(88svh-4rem)] max-w-7xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/"
            data-gsap="hero-logo"
            className="inline-flex items-center gap-3"
          >
            <Image
              src="/assets/bullfy-logo-full.png"
              alt="Bullfy"
              width={92}
              height={92}
              priority
              className="object-contain"
              style={{ filter: WHITE_FILTER, height: "auto", width: "auto" }}
            />
          </Link>
          <Button
            render={<Link href="/login" />}
            nativeButton={false}
            variant="outline"
            className="hidden h-10 border-white/15 bg-black/20 text-white hover:bg-white/10 sm:flex"
          >
            Entrar
          </Button>
        </header>

        <div className="grid flex-1 content-center gap-9 py-14">
          <div className="max-w-4xl">
            <div>
              <LiveBadge>acceso privado de torneo</LiveBadge>
            </div>
            <h1
              data-gsap="hero-title"
              className="mt-6 max-w-5xl text-5xl font-black uppercase leading-[0.86] tracking-normal sm:text-7xl lg:text-8xl"
            >
              Bullfy VIP Tournament Access
            </h1>
            <p
              data-gsap="hero-copy"
              className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg"
            >
              Una landing privada para registrar traders seleccionados,
              verificar su acceso y fundar su clan antes de entrar al circuito.
            </p>
            <div
              data-gsap="hero-actions"
              className="mt-8 flex flex-col gap-3 sm:flex-row"
            >
              <MagneticButton>
                <Button
                  render={<Link href="/register-tournament/signup" />}
                  nativeButton={false}
                  variant="neonGreenSolid"
                  size="lg"
                  className="h-12 justify-center px-6 animated-button victoria-one [--bg-button-animation:#B6FF3D] [--border-button-animation:#B6FF3D] hover:text-black!"
                >
                  Crear usuario y clan
                  <ArrowRight className="size-4" />
                </Button>
              </MagneticButton>
            </div>
          </div>

          <div id="vip-flow" className="grid max-w-4xl gap-3 sm:grid-cols-3">
            {heroSignals.map((signal) => (
              <div
                key={signal.label}
                data-gsap="hero-signal"
                className="border border-white/10 bg-black/30 p-4 backdrop-blur"
              >
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  <signal.icon className="size-4 text-[#B6FF3D]" />
                  {signal.label}
                </div>
                <p className="mt-2 text-2xl font-black uppercase">
                  {signal.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Gem
        data-gsap="hero-orbit"
        className="absolute bottom-10 right-8 z-10 hidden size-6 text-[#00E5FF]/70 md:block"
      />
      <Flame
        data-gsap="hero-orbit"
        className="absolute right-[18%] top-36 z-10 hidden size-5 text-[#B6FF3D]/70 lg:block"
      />
      <WalletCards
        data-gsap="hero-orbit"
        className="absolute bottom-28 right-[24%] z-10 hidden size-5 text-white/55 lg:block"
      />
    </section>
  );
}

function LiveMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-black/25 p-4">
      <p className="text-3xl font-black text-[#B6FF3D]">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
    </div>
  );
}
