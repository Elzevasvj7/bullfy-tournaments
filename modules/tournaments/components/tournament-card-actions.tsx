"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Loader2,
  LogIn,
  ShieldCheck,
  Swords,
  UserPlus,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ArenaState } from "@/modules/arena";
import type { CurrentSessionUser } from "@/modules/auth/types";
import type { Tournament } from "../types";

type TournamentCardActionsProps = {
  arenaHref?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  sessionUser?: CurrentSessionUser | null;
  tournament: Tournament;
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export function TournamentCardActions({
  arenaHref,
  secondaryHref,
  secondaryLabel = "Ver detalles",
  sessionUser = null,
  tournament,
}: TournamentCardActionsProps) {
  const router = useRouter();
  const [arena, setArena] = useState<ArenaState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let active = true;

    fetch(`/api/demo/tournaments/${tournament.slug}/arena`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { arena?: ArenaState } | null) => {
        if (active && payload?.arena) {
          setArena(payload.arena);
        }
      })
      .catch(() => {
        if (active) {
          setArena(null);
        }
      });

    return () => {
      active = false;
    };
  }, [tournament.slug]);

  const joined = arena?.currentParticipantJoined === true;
  const entryBalance = getDemoWalletBalance(tournament.entryCurrency, sessionUser);
  const hasEnoughBalance = tournament.entryFee <= entryBalance;
  const canConfirm = Boolean(sessionUser) && accepted && hasEnoughBalance && !isJoining;
  const tournamentArenaHref =
    arenaHref ?? `/tournaments/${tournament.slug}/arena`;
  const tournamentSecondaryHref =
    secondaryHref ?? `/tournaments/${tournament.slug}`;

  async function joinTournament() {
    if (!canConfirm) {
      if (!sessionUser) {
        router.push(`/login?next=${encodeURIComponent("/")}`);
      }

      return;
    }

    setError(null);
    setIsJoining(true);

    try {
      const response = await fetch(
        `/api/demo/tournaments/${tournament.slug}/join`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        arena?: ArenaState;
        error?: string;
      };

      if (!response.ok || !payload.arena) {
        throw new Error(payload.error ?? "No se pudo unir al torneo");
      }

      setArena(payload.arena);
      setModalOpen(false);
      setAccepted(false);
      router.push(tournamentArenaHref);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo unir al torneo.",
      );
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <>
      <div className="mt-3 grid gap-2">
        {joined ? (
          <Link
            href={tournamentArenaHref}
            className="relative flex h-10 items-center justify-center gap-2 overflow-hidden border border-cyan-200/70 bg-cyan-300 text-sm font-black uppercase tracking-[0.16em] text-black transition duration-300 hover:bg-cyan-100 group-hover/card:shadow-[0_0_28px_rgb(0_229_255_/_0.32)]"
          >
            <Swords className="size-4" />
            Abrir cockpit
          </Link>
        ) : (
          <Button
            type="button"
            onClick={() => {
              if (!sessionUser) {
                router.push(`/login?next=${encodeURIComponent("/")}`);
                return;
              }

              setError(null);
              setAccepted(false);
              setModalOpen(true);
            }}
            className="h-10 justify-center gap-2 rounded-none border border-cyan-200/70 bg-cyan-300 text-sm font-black uppercase tracking-[0.16em] text-black transition duration-300 hover:bg-cyan-100 group-hover/card:bg-[var(--card-accent)] group-hover/card:shadow-[0_0_30px_rgb(var(--card-accent-rgb)_/_0.34)]"
          >
            <UserPlus className="size-4" />
            Unirme al torneo
          </Button>
        )}
        <Link
          href={tournamentSecondaryHref}
          className="flex h-9 items-center justify-center gap-2 border border-white/10 bg-black/30 text-xs font-black uppercase tracking-[0.16em] text-slate-300 transition duration-300 hover:border-cyan-300/45 hover:text-cyan-100 group-hover/card:border-[rgb(var(--card-accent-rgb)/0.28)]"
        >
          <Eye className="size-4" />
          {secondaryLabel}
        </Link>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="scrollbar-app p-4 max-h-[calc(100dvh-2rem)] max-w-md overflow-y-auto border-cyan-300/20 bg-[#07131d] text-white shadow-[0_30px_100px_rgba(0,0,0,0.55)] sm:max-w-md">
          <DialogHeader>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">
              Confirmar inscripcion
            </p>
            <DialogTitle className="text-xl font-black uppercase text-white">
              {tournament.name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Confirma las reglas, costo y saldo antes de unirte al torneo.
            </DialogDescription>
          </DialogHeader>

            <div className="mt-4 grid gap-3">
              <div className="grid grid-cols-2 gap-2">
                <JoinMetric
                  icon={WalletCards}
                  label="Entrada"
                  value={
                    tournament.entryFee === 0
                      ? "Gratis"
                      : `${moneyFormatter.format(tournament.entryFee)} ${tournament.entryCurrency}`
                  }
                />
                <JoinMetric
                  icon={CheckCircle2}
                  label="Tu saldo"
                  tone={hasEnoughBalance ? "positive" : "negative"}
                  value={`${moneyFormatter.format(entryBalance)} ${tournament.entryCurrency}`}
                />
              </div>

              {!hasEnoughBalance ? (
                <div className="flex gap-2 rounded-md border border-amber-300/25 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  Saldo insuficiente para inscribirte en esta demo. Puedes
                  revisa los detalles del torneo antes de inscribirte.
                </div>
              ) : null}
              {!sessionUser ? (
                <div className="flex gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/10 p-3 text-xs leading-5 text-cyan-100">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  Inicia sesion para confirmar tu inscripcion como participante.
                </div>
              ) : null}

              <div className="rounded-md border border-white/10 bg-black/25 p-3">
                <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">
                  <ShieldCheck className="size-3.5" />
                  Reglas clave
                </p>
                <div className="grid gap-2 text-xs text-slate-300">
                  <RuleLine label="Mercado" value={tournament.rules.market} />
                  <RuleLine
                    label="Balance inicial"
                    value={`$${moneyFormatter.format(tournament.rules.minBalance)}`}
                  />
                  <RuleLine
                    label="Participantes"
                    value={`${tournament.participantsCount}/${tournament.rules.maxParticipants}`}
                  />
                  <RuleLine
                    label="Simbolos"
                    value={tournament.rules.allowedAssets.join(", ")}
                  />
                </div>
              </div>

              <label className="flex gap-3 rounded-md border border-cyan-300/15 bg-cyan-300/5 p-3 text-xs leading-5 text-slate-300">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                  className="mt-1 size-4 shrink-0 accent-cyan-300"
                />
                <span>
                  Entiendo que esta inscripción bloquea mi entrada como
                  participante en la demo, que las operaciones pasan por MT5 y
                  que el resultado del torneo depende del PnL generado durante
                  la arena.
                </span>
              </label>
            </div>

            {error ? (
              <p className="mt-3 rounded-md border border-red-300/25 bg-red-400/10 p-2 text-xs text-red-100">
                {error}
              </p>
            ) : null}

          <DialogFooter className="grid gap-2 border-t-0 bg-transparent p-4 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(tournamentSecondaryHref)}
                className="h-10 justify-center gap-2"
              >
                <Eye className="size-4" />
                {secondaryLabel}
              </Button>
              <Button
                type="button"
                onClick={joinTournament}
                disabled={!canConfirm}
                className="h-10 justify-center gap-2"
              >
                {isJoining ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LogIn className="size-4" />
                )}
                Confirmar
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function JoinMetric({
  icon: Icon,
  label,
  tone = "neutral",
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  tone?: "neutral" | "positive" | "negative";
  value: string;
}) {
  const color =
    tone === "positive"
      ? "text-lime-300"
      : tone === "negative"
        ? "text-red-300"
        : "text-white";

  return (
    <div className="rounded-md border border-white/10 bg-black/25 p-3">
      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        <Icon className="size-3.5 text-cyan-200" />
        {label}
      </p>
      <p className={`mt-2 font-mono text-sm font-black ${color}`}>{value}</p>
    </div>
  );
}

function RuleLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded border border-white/10 bg-black/20 px-2.5 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-mono font-black text-white">{value}</span>
    </div>
  );
}

function getDemoWalletBalance(
  currency: Tournament["entryCurrency"],
  sessionUser: CurrentSessionUser | null,
) {
  if (!sessionUser) {
    return 0;
  }

  return currency === "USD"
    ? sessionUser.walletBalanceUsd
    : sessionUser.bmoneyBalance;
}
