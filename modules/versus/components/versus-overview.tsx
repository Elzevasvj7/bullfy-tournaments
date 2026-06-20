"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  Check,
  Clock,
  Copy,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  SwordsIcon,
  X,
} from "lucide-react";
import { AppHeader } from "@/shared/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CurrentSessionUser } from "@/modules/auth/types";
import type {
  CreateVersusInput,
  VersusChallenge,
  VersusDashboard,
  VersusStatus,
  VersusTrader,
} from "../types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  ClashSwordsIcon,
  MotionRosterCard,
  TrophyShineIcon,
} from "./versus-motion-icons";

type VersusOverviewProps = {
  dashboard: VersusDashboard;
  sessionUser?: CurrentSessionUser | null;
};

type VersusTab = "all" | "pending" | "active" | "done";

const statusLabels: Record<VersusStatus, string> = {
  accepted: "Aceptado",
  cancelled: "Cancelado",
  expired: "Expirado",
  finished: "Finalizado",
  live: "En vivo",
  pending: "Pendiente",
  rejected: "Rechazado",
};

const dateFormatter = new Intl.DateTimeFormat("es-VE", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  timeZone: "America/Caracas",
});

function formatVersusDate(value: string) {
  return dateFormatter.format(new Date(value)).replace(/\u00a0/g, " ");
}

export function VersusOverview({
  dashboard,
  sessionUser = null,
}: VersusOverviewProps) {
  const reduceMotion = useReducedMotion();
  const [tab, setTab] = useState<VersusTab>("all");
  const [query, setQuery] = useState("");
  const [optimisticChallenges, setOptimisticChallenges] = useState<
    VersusChallenge[]
  >([]);
  const challenges = useMemo(
    () => [...optimisticChallenges, ...dashboard.challenges],
    [dashboard.challenges, optimisticChallenges],
  );
  const grouped = useMemo(
    () => ({
      active: challenges.filter((challenge) =>
        ["accepted", "live"].includes(challenge.status),
      ),
      done: challenges.filter((challenge) =>
        ["finished", "rejected", "expired", "cancelled"].includes(
          challenge.status,
        ),
      ),
      pending: challenges.filter((challenge) => challenge.status === "pending"),
    }),
    [challenges],
  );
  const visibleChallenges = useMemo(() => {
    const byTab =
      tab === "active"
        ? grouped.active
        : tab === "pending"
          ? grouped.pending
          : tab === "done"
            ? grouped.done
            : challenges;
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return byTab;
    }

    return byTab.filter((challenge) =>
      [
        challenge.challenger.name,
        challenge.opponent?.name,
        challenge.opponentEmail,
        challenge.opponentUsernameHint,
        challenge.message,
        challenge.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [challenges, grouped, query, tab]);

  function handleCreate(input: CreateVersusInput) {
    const challenger = dashboard.suggestedOpponents.find(
      (trader) => trader.id !== dashboard.currentUserId,
    );
    const mockUser: VersusTrader = {
      clanTag: "BULL",
      id: dashboard.currentUserId,
      name: "Karlos Guzman",
      score: 8.42,
      username: "karlosg",
      verified: true,
      winRate: 62,
    };

    setOptimisticChallenges((current) => [
      {
        challenger: mockUser,
        challengerScore: 0,
        createdAt: new Date().toISOString(),
        durationMinutes: input.durationMinutes,
        id: `optimistic_${Date.now()}`,
        inviteToken: `vs_${Date.now().toString(36)}`,
        message: input.message,
        opponent:
          input.opponentUsername && challenger
            ? {
                ...challenger,
                username: input.opponentUsername.replace("@", ""),
              }
            : undefined,
        opponentEmail: input.opponentEmail,
        opponentScore: 0,
        opponentUsernameHint: input.opponentUsername,
        stakeUsd: input.stakeUsd,
        status: "pending",
      },
      ...current,
    ]);
  }

  return (
    <main className="tournament-neon relative min-h-screen overflow-hidden text-white">
      <VersusBackground />
      <AppHeader active="versus" user={sessionUser} />

      <motion.section
        className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={reduceMotion ? undefined : { opacity: 1 }}
        transition={{ duration: 0.35 }}
      >
        <motion.header
          className="relative overflow-hidden border border-white/5 bg-[#0a1129]/35 p-8 shadow-2xl backdrop-blur-sm md:p-10"
          initial={reduceMotion ? false : { y: 18, scale: 0.99 }}
          animate={reduceMotion ? undefined : { y: 0, scale: 1 }}
          transition={{ duration: 0.46, ease: [0.2, 0.9, 0.2, 1] }}
        >
          <div className="t-scanlines z-10" />
          <div
            className="absolute inset-y-8 right-8 hidden w-px bg-gradient-to-b from-transparent via-[#00E5FF]/45 to-transparent lg:block"
            aria-hidden
          />
          <div className="relative z-20 grid gap-7 lg:grid-cols-[1fr_25rem] lg:items-end">
            <div>
              <div className="mb-8 inline-flex items-center gap-3 border border-[#FF2EC4]/30 bg-[#FF2EC4]/10 px-5 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#FF2EC4]">
                <SwordsIcon className="size-5" />1 vs 1 arena
              </div>
              <h1 className="t-display text-4xl font-black leading-[0.95] md:text-6xl">
                VERSUS{" "}
                <span className="t-shimmer">SIN ESCONDER HISTORIAL.</span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-400">
                Crea retos privados, acepta duelos, monitorea batallas en curso
                y revisa finalizados sin perder informacion clave.
              </p>
            </div>
            <div className="grid gap-4">
              <div className="grid grid-cols-3 gap-3">
                <VersusStat
                  label="Pendientes"
                  value={String(grouped.pending.length)}
                  tone="amber"
                  delay={0.05}
                />
                <VersusStat
                  label="En curso"
                  value={String(grouped.active.length)}
                  tone="lime"
                  delay={0.12}
                />
                <VersusStat
                  label="Historial"
                  value={String(grouped.done.length)}
                  tone="cyan"
                  delay={0.19}
                />
              </div>
            </div>
          </div>
        </motion.header>

        <section className="grid gap-6 xl:grid-cols-[24rem_1fr]">
          <aside className="space-y-5">
            <CreateVersusPanel onCreate={handleCreate} />
            <SuggestedOpponents traders={dashboard.suggestedOpponents} />
          </aside>

          <div className="space-y-5">
            <Card className="bg-[#0a1129]/60 border-[#00E5FF]/20">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  <TabButton
                    active={tab === "all"}
                    onClick={() => setTab("all")}
                  >
                    Todos ({challenges.length})
                  </TabButton>
                  <TabButton
                    active={tab === "pending"}
                    onClick={() => setTab("pending")}
                  >
                    Pendientes ({grouped.pending.length})
                  </TabButton>
                  <TabButton
                    active={tab === "active"}
                    onClick={() => setTab("active")}
                  >
                    En curso ({grouped.active.length})
                  </TabButton>
                  <TabButton
                    active={tab === "done"}
                    onClick={() => setTab("done")}
                  >
                    Finalizados ({grouped.done.length})
                  </TabButton>
                </div>

                <div className="relative w-full lg:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar rival, estado o mensaje"
                    className="h-11 border-white/10 bg-black/25 pl-9 text-white"
                  />
                </div>
              </div>
            </Card>

            {visibleChallenges.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-white/10 bg-[#0a1129]/50 py-16 text-center text-gray-500">
                No hay retos para este filtro.
              </div>
            ) : (
              <div className="grid gap-4">
                {visibleChallenges.map((challenge) => (
                  <VersusCard
                    key={challenge.id}
                    challenge={challenge}
                    currentUserId={dashboard.currentUserId}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </motion.section>
    </main>
  );
}

function VersusBackground() {
  return (
    <>
      <video
        aria-hidden
        autoPlay
        className="fixed inset-0 z-0 h-screen w-screen object-cover pointer-events-none"
        loop
        muted
        playsInline
        poster="/videos/tournament-poster.jpg"
        preload="auto"
      >
        <source src="/videos/tournament-bg.webm" type="video/webm" />
        <source src="/videos/tournament-bg.mp4" type="video/mp4" />
      </video>
      <div
        className="fixed inset-0 z-0 bg-[#060B1F]/50 pointer-events-none"
        aria-hidden
      />
      <div
        className="fixed inset-0 z-0 bg-gradient-to-b from-[#060B1F]/10 via-[#060B1F]/35 to-[#060B1F]/80 pointer-events-none"
        aria-hidden
      />
    </>
  );
}

function CreateVersusPanel({
  onCreate,
}: {
  onCreate: (input: CreateVersusInput) => void;
}) {
  const [opponentUsername, setOpponentUsername] = useState("");
  const [opponentEmail, setOpponentEmail] = useState("");
  const [stakeUsd, setStakeUsd] = useState("0");
  const [durationMinutes, setDurationMinutes] = useState("1440");
  const [message, setMessage] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!opponentUsername && !opponentEmail) {
      return;
    }

    onCreate({
      durationMinutes: Number(durationMinutes),
      message,
      opponentEmail: opponentEmail || undefined,
      opponentUsername: opponentUsername || undefined,
      stakeUsd: Number(stakeUsd),
    });
    setOpponentUsername("");
    setOpponentEmail("");
    setStakeUsd("0");
    setDurationMinutes("1440");
    setMessage("");
  }

  return (
    <Card className="bg-[#0a1129]/60 border-[#00E5FF]/20">
      <CardHeader>
        <h2 className="t-display flex items-center gap-2 text-lg font-black">
          <SwordsIcon className="size-6" />
          Nuevo reto
        </h2>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit}>
          <div className="mt-5 grid gap-4">
            <div>
              <Label>Username del rival</Label>
              <Input
                value={opponentUsername}
                onChange={(event) => setOpponentUsername(event.target.value)}
                placeholder="@tradermax"
                className="mt-2 h-11 border-white/10 bg-black/25 text-white"
              />
            </div>
            <div>
              <Label>Email si no tiene cuenta</Label>
              <Input
                value={opponentEmail}
                onChange={(event) => setOpponentEmail(event.target.value)}
                placeholder="rival@email.com"
                className="mt-2 h-11 border-white/10 bg-black/25 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Apuesta USDT</Label>
                <Input
                  min="0"
                  type="number"
                  value={stakeUsd}
                  onChange={(event) => setStakeUsd(event.target.value)}
                  className="mt-2 h-11 border-white/10 bg-black/25 text-white"
                />
              </div>
              <div>
                <Label>Duracion min.</Label>
                <Input
                  min="15"
                  type="number"
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(event.target.value)}
                  className="mt-2 h-11 border-white/10 bg-black/25 text-white"
                />
              </div>
            </div>
            <div>
              <Label>Mensaje</Label>
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="mt-2 min-h-24 border-white/10 bg-black/25 text-white"
              />
            </div>
            <Button
              type="submit"
              variant="neonGreenSolid"
              disabled={!opponentUsername && !opponentEmail}
              className="h-11 justify-center shadow-[0_0_18px_rgba(182,255,61,0.28)] transition hover:scale-[1.015]"
            >
              <Plus className="size-4" />
              Enviar reto
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SuggestedOpponents({ traders }: { traders: VersusTrader[] }) {
  return (
    <Card className="bg-[#0a1129]/60 border-[#00E5FF]/20">
      <CardHeader>
        <h2 className="t-display text-lg font-black">Rivales sugeridos</h2>
      </CardHeader>
      <CardContent>
        <div className="mt-4 grid gap-3">
          {traders.map((trader) => (
            <motion.div
              key={trader.id}
              className="flex items-center justify-between rounded-none border border-white/5 bg-black/20 p-3"
              whileHover={{ x: 4, borderColor: "rgba(0,229,255,0.28)" }}
              transition={{ duration: 0.18 }}
            >
              <TraderIdentity trader={trader} />
              <div className="text-right">
                <p className="t-mono text-sm font-black text-[#B6FF3D]">
                  {trader.score.toFixed(2)}%
                </p>
                <p className="text-[10px] text-gray-500">
                  WR {trader.winRate}%
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function VersusCard({
  challenge,
  currentUserId,
}: {
  challenge: VersusChallenge;
  currentUserId: string;
}) {
  const iAmChallenger = challenge.challenger.id === currentUserId;
  const rival = iAmChallenger ? challenge.opponent : challenge.challenger;
  const rivalLabel =
    rival?.name ??
    challenge.opponentEmail ??
    challenge.opponentUsernameHint ??
    "Invitado externo";
  const isDone = ["finished", "rejected", "expired", "cancelled"].includes(
    challenge.status,
  );
  const accent = getStatusAccent(challenge.status);
  const winnerName =
    challenge.winnerId === currentUserId
      ? "Tu"
      : challenge.winnerId === challenge.challenger.id
        ? challenge.challenger.name
        : challenge.opponent?.name;

  return (
    <MotionRosterCard className="group/versus-card relative overflow-hidden rounded-[2rem] border border-white/5 bg-[#0a1129]/80 shadow-2xl backdrop-blur-sm">
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover/versus-card:opacity-100"
        aria-hidden
        style={{
          background:
            "linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.045) 42%, rgba(182,255,61,0.08) 50%, transparent 58%)",
        }}
      />
      <div
        className="h-1.5"
        style={{
          background: `linear-gradient(to right, ${accent}, #FF2EC4)`,
          boxShadow: `0 0 15px ${accent}`,
        }}
      />
      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-none border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
              style={{
                background: `${accent}1a`,
                borderColor: `${accent}33`,
                color: accent,
              }}
            >
              {statusLabels[challenge.status]}
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-500">
              {iAmChallenger ? "Yo rete" : "Me retaron"}
            </span>
            <span className="text-[10px] text-gray-500">
              {formatVersusDate(challenge.createdAt)}
            </span>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <TraderBlock
              trader={challenge.challenger}
              score={challenge.challengerScore}
            />
            <div className="flex justify-center">
              <div className="flex size-16 items-center justify-center rounded-none border border-[#00E5FF]/15 bg-black/25 transition group-hover/versus-card:border-[#B6FF3D]/35">
                <SwordsIcon className="size-10" />
              </div>
            </div>
            <TraderBlock
              fallback={rivalLabel}
              score={challenge.opponentScore}
              trader={challenge.opponent}
              alignRight
            />
          </div>

          {challenge.message ? (
            <p className="mt-4 rounded-none border border-white/5 bg-black/20 p-3 text-sm italic text-gray-400">
              &quot;{challenge.message}&quot;
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 lg:w-56">
          <VersusMetric
            icon={TrophyShineIcon}
            label="Apuesta"
            value={
              challenge.stakeUsd > 0
                ? `$${challenge.stakeUsd} USDT`
                : "Sin apuesta"
            }
          />
          <VersusMetric
            icon={Clock}
            label="Duracion"
            value={`${challenge.durationMinutes / 60}h`}
          />
          {challenge.inviteToken && challenge.status === "pending" ? (
            <button className="flex items-center justify-center gap-2 rounded-none border border-[#00E5FF]/25 bg-[#00E5FF]/10 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#00E5FF]">
              <Copy className="size-3.5" />
              Copiar invite
            </button>
          ) : null}
          {challenge.tournamentSlug ? (
            <Link
              href={`/tournaments/${challenge.tournamentSlug}`}
              className="rounded-none border border-white/10 bg-white/5 px-3 py-2 text-center text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-white hover:text-[#060B1F]"
            >
              Ver torneo
            </Link>
          ) : null}
          {challenge.status === "pending" && !iAmChallenger ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="neonGreenSolid" size="sm">
                <Check className="size-3.5" />
                Aceptar
              </Button>
              <Button variant="neonRed" size="sm">
                <X className="size-3.5" />
                Rechazar
              </Button>
            </div>
          ) : null}
          {challenge.status === "pending" && iAmChallenger ? (
            <Button variant="neonRed" size="sm">
              Cancelar
            </Button>
          ) : null}
          {isDone && winnerName ? (
            <div className="rounded-none border border-[#B6FF3D]/20 bg-[#B6FF3D]/10 p-3 text-xs text-gray-300">
              Ganador:{" "}
              <span className="font-black text-[#B6FF3D]">{winnerName}</span>
            </div>
          ) : null}
        </div>
      </div>
    </MotionRosterCard>
  );
}

function TraderIdentity({ trader }: { trader: VersusTrader }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#00E5FF]/25 bg-[#00E5FF]/15 text-xs font-black text-[#00E5FF]">
        {trader.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-white">
          {trader.name}{" "}
          {trader.verified ? (
            <ShieldCheck className="inline size-3 text-[#00E5FF]" />
          ) : null}
        </p>
        <p className="text-[10px] text-gray-500">
          @{trader.username} {trader.clanTag ? `[${trader.clanTag}]` : ""}
        </p>
      </div>
    </div>
  );
}

function TraderBlock({
  alignRight,
  fallback,
  score,
  trader,
}: {
  alignRight?: boolean;
  fallback?: string;
  score: number;
  trader?: VersusTrader;
}) {
  return (
    <div
      className={cn(
        "rounded-none border border-white/5 bg-black/20 p-4",
        alignRight && "text-right",
      )}
    >
      {trader ? (
        <div
          className={cn(
            "flex items-center gap-3",
            alignRight && "flex-row-reverse",
          )}
        >
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[#00E5FF]/25 bg-[#00E5FF]/15 text-xs font-black text-[#00E5FF]">
            {trader.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold text-white">{trader.name}</p>
            <p className="text-[10px] text-gray-500">@{trader.username}</p>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "flex items-center gap-3",
            alignRight && "flex-row-reverse",
          )}
        >
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[#FF2EC4]/25 bg-[#FF2EC4]/15 text-[#FF2EC4]">
            <Mail className="size-4" />
          </div>
          <div>
            <p className="font-bold text-white">{fallback}</p>
            <p className="text-[10px] text-gray-500">Pendiente de vincular</p>
          </div>
        </div>
      )}
      <p className="t-mono mt-3 text-2xl font-black text-[#B6FF3D]">
        {score.toFixed(2)}%
      </p>
    </div>
  );
}

function VersusMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-none border border-white/5 bg-black/20 p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-gray-500">
        <Icon className="size-4" />
        {label}
      </p>
      <p className="t-mono mt-1 font-black text-white">{value}</p>
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-none border px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] transition",
        active
          ? "border-[#00E5FF]/50 bg-[#00E5FF]/15 text-white"
          : "border-white/10 bg-black/20 text-gray-400 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function VersusStat({
  delay = 0,
  label,
  tone,
  value,
}: {
  delay?: number;
  label: string;
  tone: "amber" | "cyan" | "lime";
  value: string;
}) {
  const reduceMotion = useReducedMotion();
  const color = {
    amber: "#fbbf24",
    cyan: "#00E5FF",
    lime: "#B6FF3D",
  }[tone];

  return (
    <motion.div
      className="rounded-none border border-white/5 bg-black/20 p-4 text-center"
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      whileHover={
        reduceMotion
          ? undefined
          : {
              scale: 1.035,
              boxShadow: `0 0 22px ${color}33`,
            }
      }
      transition={{ delay, duration: 0.28 }}
    >
      <motion.p
        className="t-display text-3xl font-black"
        style={{ color }}
        animate={
          reduceMotion
            ? undefined
            : {
                textShadow: [
                  `0 0 0 ${color}00`,
                  `0 0 12px ${color}66`,
                  `0 0 0 ${color}00`,
                ],
              }
        }
        transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 2 }}
      >
        {value}
      </motion.p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">
        {label}
      </p>
    </motion.div>
  );
}

function getStatusAccent(status: VersusStatus) {
  if (status === "live" || status === "accepted") {
    return "#B6FF3D";
  }

  if (status === "pending") {
    return "#00E5FF";
  }

  if (status === "finished") {
    return "#FF2EC4";
  }

  return "#7a8e9f";
}
