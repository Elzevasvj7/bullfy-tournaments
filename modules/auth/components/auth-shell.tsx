import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Sparkles, Trophy, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const WHITE_FILTER = "brightness(0) invert(1)";

export function AuthShell({
  children,
  eyebrow,
  title,
  description,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <main className="tournament-neon relative min-h-screen overflow-hidden text-white">
      <VideoBackground />
      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-350 gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_28rem] lg:px-8">
        <section className="flex min-h-[28rem] flex-col justify-between gap-8 py-4 lg:py-10">
          <Link href="/" className="w-fit">
            <Image
              src="/assets/bullfy-logo-full.png"
              alt="Bullfy"
              width={82}
              height={82}
              priority
              className="object-contain"
              style={{ filter: WHITE_FILTER }}
            />
          </Link>

          <div className="max-w-2xl">
            <Badge className="border-bullfy-neon-blue/30 bg-bullfy-neon-blue/10 text-bullfy-neon-blue">
              {eyebrow}
            </Badge>
            <h1 className="mt-5 max-w-3xl text-4xl font-black uppercase leading-[0.95] tracking-normal sm:text-6xl lg:text-7xl">
              {title}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              {description}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <AuthSignal
              icon={Wallet}
              label="Wallet"
              value="USD + BMoney"
            />
            <AuthSignal
              icon={Trophy}
              label="Torneos"
              value="Lobby, versus, clanes"
            />
            <AuthSignal
              icon={ShieldCheck}
              label="Ready"
              value="KYC y Elite luego"
            />
          </div>
        </section>

        <section className="flex items-center">
          <Card className="w-full border-bullfy-neon-blue/20 bg-bullfy-panel/82 shadow-glass-blue backdrop-blur-xl">
            {children}
          </Card>
        </section>
      </div>
    </main>
  );
}

function AuthSignal({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-3 backdrop-blur">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
        <Icon className="size-3.5 text-bullfy-neon-green" />
        {label}
      </div>
      <p className="mt-2 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function VideoBackground() {
  return (
    <div className="absolute inset-0">
      <video
        autoPlay
        loop
        muted
        playsInline
        poster="/videos/tournament-poster.jpg"
        className="h-full w-full object-cover opacity-45"
      >
        <source src="/videos/tournament-bg.webm" type="video/webm" />
        <source src="/videos/tournament-bg.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,229,255,0.20),transparent_30%),linear-gradient(90deg,rgba(4,8,22,0.96),rgba(4,8,22,0.70)_48%,rgba(4,8,22,0.95))]" />
      <Sparkles className="absolute bottom-8 left-8 hidden size-5 text-bullfy-neon-green/60 md:block" />
    </div>
  );
}
