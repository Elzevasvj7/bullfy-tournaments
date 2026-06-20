"use client";

import Image from "next/image";
import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WHITE_LOGO_FILTER } from "./constants";
import { TournamentWizardProvider, useTournamentWizard } from "./context";
import { StepTabs } from "./components/step-tabs";
import { WizardFooter } from "./components/wizard-footer";
import { ClanStep, IdentityStep, ReviewStep, VerifyStep } from "./steps";

export function TournamentRegisterWizard() {
  return (
    <TournamentWizardProvider>
      <TournamentWizardFrame />
    </TournamentWizardProvider>
  );
}

function TournamentWizardFrame() {
  const {
    actions: { handleSubmit },
    meta: { activeStep, progress },
    state: { error },
  } = useTournamentWizard();

  return (
    <main className="tournament-neon min-h-screen overflow-hidden text-white">
      <div className="absolute inset-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          poster="/videos/tournament-poster.jpg"
          className="h-full w-full object-cover opacity-30"
        >
          <source src="/videos/tournament-bg.webm" type="video/webm" />
          <source src="/videos/tournament-bg.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,7,18,0.98),rgba(3,7,18,0.90)_48%,rgba(3,7,18,0.98))]" />
      </div>

      <form
        onSubmit={handleSubmit}
        className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-4 py-5 sm:px-6 lg:px-8"
      >
        <section className="flex min-h-[42rem] flex-col">
          <header className="flex items-center justify-between gap-4">
            <Link href="/register-tournament" className="inline-flex">
              <Image
                src="/assets/bullfy-logo-full.png"
                alt="Bullfy"
                width={86}
                height={86}
                priority
                className="object-contain"
                style={{
                  filter: WHITE_LOGO_FILTER,
                  height: "auto",
                  width: "auto",
                }}
              />
            </Link>
            <Button
              render={<Link href="/register-tournament" />}
              nativeButton={false}
              variant="ghost"
              className="h-10 border border-white/10 bg-black/20 text-white hover:bg-white/10"
            >
              <ArrowLeft className="size-4" />
              Landing
            </Button>
          </header>

          <div className="mt-8 border border-white/10 bg-[#0A1129]/72 p-4 shadow-[0_0_42px_rgba(0,229,255,0.08)] backdrop-blur md:p-6">
            <div className="flex flex-col gap-5 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge variant="neonGreen" className="h-7 px-4">
                  acceso vip
                </Badge>
                <h1 className="mt-4 text-4xl font-black uppercase leading-[0.9] sm:text-5xl">
                  Registro Previo
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                  Crea el usuario, verifica el acceso y deja el clan fundado en
                  una sola secuencia privada.
                </p>
              </div>
              <div className="min-w-42 border border-white/10 bg-black/25 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Progreso
                </p>
                <div className="mt-3 h-2 bg-white/10">
                  <div
                    className="h-full bg-[#B6FF3D] transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>

            <StepTabs />

            <div className="mt-6">
              {activeStep.id === "identity" ? <IdentityStep /> : null}
              {activeStep.id === "verify" ? <VerifyStep /> : null}
              {activeStep.id === "clan" ? <ClanStep /> : null}
              {activeStep.id === "review" ? <ReviewStep /> : null}
            </div>

            {error ? (
              <div className="mt-5 flex gap-3 border border-[#FF3B5C]/35 bg-[#FF3B5C]/10 p-4 text-sm text-red-100">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-[#FF3B5C]" />
                {error}
              </div>
            ) : null}

            <WizardFooter />
          </div>
        </section>
      </form>
    </main>
  );
}
