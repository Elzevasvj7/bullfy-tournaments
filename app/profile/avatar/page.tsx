import Link from "next/link";
import {
  ArrowLeft,
  Box,
  Camera,
  CheckCircle2,
  ExternalLink,
  Save,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCurrentSessionUser } from "@/modules/auth/services/session-user";
import { AppHeader } from "@/shared/components/app-header";

export default async function ProfileAvatarPage() {
  const sessionUser = await getCurrentSessionUser();
  const initials =
    sessionUser?.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "BU";

  return (
    <main className="tournament-neon min-h-screen overflow-hidden text-white">
      <AvatarBackground />
      <div className="relative z-10">
        <AppHeader active="perfil" user={sessionUser} />

        <section className="mx-auto w-full max-w-7xl px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 text-sm font-black text-slate-400 transition hover:text-bullfy-neon-blue"
          >
            <ArrowLeft className="size-4" />
            Volver al perfil
          </Link>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_24rem]">
            <section className="relative overflow-hidden rounded-lg border border-bullfy-neon-blue/20 bg-bullfy-panel/82 p-5 shadow-glass-blue backdrop-blur-xl">
              <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-bullfy-neon-blue/70" />
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <Badge className="border-bullfy-neon-blue/30 bg-bullfy-neon-blue/10 text-bullfy-neon-blue">
                    Avatar Studio
                  </Badge>
                  <h1 className="mt-4 max-w-4xl text-4xl font-black uppercase leading-none tracking-normal sm:text-6xl">
                    Crea tu identidad 3D
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
                    Esta pantalla deja listo el flujo para integrar Ready Player
                    Me, Avaturn o la API final de avatares digitales. En la demo
                    se muestra el estado, preview y acciones esperadas.
                  </p>
                </div>
                <Badge className="border-amber-300/30 bg-amber-300/10 text-amber-100">
                  Demo UI
                </Badge>
              </div>

              <div className="mt-7 grid gap-5 lg:grid-cols-[22rem_1fr]">
                <div className="relative mx-auto flex aspect-[3/4] w-full max-w-sm items-center justify-center overflow-hidden rounded-lg border border-bullfy-neon-blue/25 bg-black/35 shadow-[0_0_70px_rgba(0,229,255,0.12)]">
                  <div className="absolute inset-x-10 top-10 h-24 rounded-full bg-bullfy-neon-blue/20 blur-3xl" />
                  <div className="absolute bottom-0 h-44 w-44 rounded-t-full border border-bullfy-neon-blue/25 bg-bullfy-neon-blue/10" />
                  <div className="absolute bottom-8 h-32 w-24 rounded-t-[3rem] border border-white/10 bg-white/5" />
                  <div className="relative z-10 flex size-28 items-center justify-center rounded-full border border-amber-200/50 bg-amber-200/10 text-4xl font-black text-amber-100 shadow-[0_0_42px_rgba(251,191,36,0.16)]">
                    {initials}
                  </div>
                </div>

                <div className="grid content-start gap-4">
                  <StudioStep
                    icon={Camera}
                    title="Selfie o seed visual"
                    description="El proveedor generara la base del avatar desde foto, seed o configuracion inicial."
                    status="Pendiente"
                  />
                  <StudioStep
                    icon={Wand2}
                    title="Editor externo"
                    description="Lovable abre un studio embebido y escucha el evento de exportacion del avatar 3D."
                    status="Listo para integrar"
                  />
                  <StudioStep
                    icon={Box}
                    title="Export GLB / avatar_3d_url"
                    description="La URL del modelo se guardara en el usuario para ArenaTV, podio, perfil y poses."
                    status="Contrato definido"
                  />
                  <StudioStep
                    icon={Save}
                    title="Guardar avatar"
                    description="Despues de exportar, se persistira avatar_config y avatar_3d_url en el backend final."
                    status="Mock"
                  />

                  <div className="mt-2 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className={cn(
                        buttonVariants({ variant: "neonBlue", size: "lg" }),
                        "h-10 justify-center",
                      )}
                    >
                      <Sparkles className="size-4" />
                      Iniciar studio mock
                    </button>
                    <a
                      href="https://bullfy.readyplayer.me/avatar?frameApi&clearCache"
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "lg" }),
                        "h-10 justify-center",
                      )}
                    >
                      <ExternalLink className="size-4" />
                      Proveedor externo
                    </a>
                  </div>
                </div>
              </div>
            </section>

            <aside className="grid content-start gap-5">
              <section className="rounded-lg border border-white/10 bg-bullfy-panel/82 p-5 shadow-glass-blue backdrop-blur-xl">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  Estado actual
                </p>
                <div className="mt-4 grid gap-3">
                  <StatusLine label="Avatar 3D" value="No creado" />
                  <StatusLine label="Pose activa" value="Idle" />
                  <StatusLine label="Animacion" value="Pendiente" />
                  <StatusLine label="Cache local" value="No disponible" />
                </div>
              </section>

              <section className="rounded-lg border border-amber-300/20 bg-amber-300/8 p-5 shadow-glass-blue backdrop-blur-xl">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-amber-100">
                  <CheckCircle2 className="size-4" />
                  Contrato futuro
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Campos esperados: `avatar_config`, `avatar_3d_url`,
                  proveedor, pose preferida y fecha de ultima exportacion.
                </p>
              </section>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function AvatarBackground() {
  return (
    <div className="absolute inset-0 z-0">
      <video
        autoPlay
        loop
        muted
        playsInline
        poster="/videos/tournament-poster.jpg"
        className="h-full w-full object-cover opacity-24"
      >
        <source src="/videos/tournament-bg.webm" type="video/webm" />
        <source src="/videos/tournament-bg.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,9,18,0.74),rgba(4,9,18,0.94)_36%,rgba(4,9,18,0.99)),radial-gradient(circle_at_18%_12%,rgba(0,229,255,0.18),transparent_28%),radial-gradient(circle_at_84%_18%,rgba(251,191,36,0.12),transparent_24%)]" />
    </div>
  );
}

function StudioStep({
  description,
  icon: Icon,
  status,
  title,
}: {
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: string;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-bullfy-neon-blue/25 bg-bullfy-neon-blue/10 text-bullfy-neon-blue">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black text-white">{title}</p>
            <Badge className="border-white/10 bg-white/5 text-slate-300">
              {status}
            </Badge>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/25 px-3 py-2">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-black text-white">{value}</span>
    </div>
  );
}
