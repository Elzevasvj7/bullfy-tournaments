import Link from "next/link";
import { Clock3, Coins, Sparkles, Trophy, Wallet, Zap } from "lucide-react";
import type { CurrentSessionUser } from "@/modules/auth/types";
import { AppHeader } from "@/shared/components/app-header";
import { cn } from "@/lib/utils";
import type { WalletAccount, WalletMovement } from "../types";
import { WalletMovementsTable } from "./wallet-movements-table";
import { WalletTopUpCard } from "./wallet-topup-card";
import { Card, CardContent } from "@/components/ui/card";

type WalletShellProps = {
  active: "usd" | "bmoney" | "history";
  children: React.ReactNode;
  eyebrow: string;
  sessionUser?: CurrentSessionUser | null;
  title: string;
};

type WalletUsdPageProps = {
  paymentIntentId?: string;
  paymentState?: "cancel" | "success";
  sessionUser?: CurrentSessionUser | null;
  topUpAmountUsd: number;
  wallet: WalletAccount;
};

type WalletBmoneyPageProps = {
  sessionUser?: CurrentSessionUser | null;
  wallet: WalletAccount;
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export function WalletUsdPage({
  paymentIntentId,
  paymentState,
  sessionUser = null,
  topUpAmountUsd,
  wallet,
}: WalletUsdPageProps) {
  const usdMovements = wallet.movements.filter(
    (movement) => movement.currency === "USD",
  );

  return (
    <WalletShell
      active="usd"
      eyebrow="Wallet Real"
      sessionUser={sessionUser}
      title="Recargar USD"
    >
      {paymentState ? (
        <PaymentReturnBanner
          paymentIntentId={paymentIntentId}
          state={paymentState}
        />
      ) : null}
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)]">
        <section className="relative overflow-hidden border border-bullfy-neon-blue/30 rounded-lg bg-[#071022]/88 p-5 shadow-[0_26px_80px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-7">
          <div className="absolute inset-x-0 top-0 h-1 bg-cyan-300" />
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-cyan-200">
                <Wallet className="size-5" />
                <span className="text-xs font-black uppercase tracking-[0.2em]">
                  Vault Elite
                </span>
              </div>
              <p className="t-mono mt-5 text-5xl font-black tracking-normal text-white drop-shadow-[0_0_18px_rgba(0,229,255,0.24)] md:text-6xl">
                ${moneyFormatter.format(wallet.balances.realBalance)}
              </p>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">
                Balance usado para torneos Elite, premios en USD y retiros
                cuando el modulo de payout este activo.
              </p>
              <div>
                <a className="btn animated-button victoria-one" href="https://victoria.one/bullfy">HOLA</a>
              </div>
            </div>

            <div className="grid min-w-0 gap-3 sm:grid-cols-3 lg:w-[32rem]">
              <MetricCell label="Bloqueado" tone="cyan" value="$0.00" />
              <MetricCell
                label="Pendiente"
                tone="slate"
                value={`$${moneyFormatter.format(
                  wallet.balances.pendingRewards,
                )}`}
              />
              <MetricCell
                label="Reclamable"
                tone="green"
                value={`$${moneyFormatter.format(
                  wallet.balances.claimableRewards,
                )}`}
              />
              <div className="sm:col-span-3">
                <WalletTopUpCard amountUsd={topUpAmountUsd} />
              </div>
            </div>
          </div>
        </section>
      </section>
      <WalletMovementPanel
        active="usd"
        emptyText="Sin movimientos USD."
        href="/wallet/history"
        movements={usdMovements.slice(0, 6)}
        title="Ultimos movimientos USD"
      />
    </WalletShell>
  );
}

export function WalletBmoneyPage({
  sessionUser = null,
  wallet,
}: WalletBmoneyPageProps) {
  const bmoneyMovements = wallet.movements.filter(
    (movement) => movement.currency === "DEMO",
  );

  return (
    <WalletShell
      active="bmoney"
      eyebrow="Economia Ficticia"
      sessionUser={sessionUser}
      title="BMoney"
    >
      <section className="relative border border-bullfy-neon-green/30 overflow-hidden rounded-lg bg-[#071022]/88 p-5 shadow-[0_26px_80px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-7">
        <div className="absolute inset-x-0 top-0 h-1 bg-lime-300" />
        <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
          <div>
            <div className="flex items-center gap-2 text-lime-200">
              <Coins className="size-5" />
              <span className="text-xs font-black uppercase tracking-[0.2em]">
                Lobby currency
              </span>
            </div>
            <p className="t-mono mt-5 text-5xl font-black tracking-normal text-white drop-shadow-[0_0_18px_rgba(182,255,61,0.24)] md:text-6xl">
              {compactFormatter.format(wallet.balances.demoBalance)} BM$
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
              Moneda competitiva para torneos BMoney, bonos, ranking y eventos
              no Elite.
            </p>
          </div>

          <div className="grid">
            <MetricCell
              label="Bullfy Points"
              tone="gold"
              value={`${compactFormatter.format(wallet.balances.bullfyPoints)} BP`}
            />
          </div>
        </div>

        <div className="relative z-10 mt-7 grid gap-3 md:grid-cols-4">
          <BmoneySource icon={Trophy} label="Premios" value="+ BM$" />
          <BmoneySource icon={Sparkles} label="Bonos" value="+ BM$" />
          <BmoneySource icon={Clock3} label="ArenaTV" value="+ BM$" />
          <BmoneySource icon={Zap} label="Cashback" value="+ BM$" />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)]">
        <WalletMovementPanel
          active="bmoney"
          emptyText="Sin movimientos BMoney."
          href="/wallet/history"
          movements={bmoneyMovements.slice(0, 6)}
          title="Ultimos movimientos BMoney"
        />
      </section>
    </WalletShell>
  );
}

export function WalletShell({
  active,
  children,
  eyebrow,
  sessionUser = null,
  title,
}: WalletShellProps) {
  return (
    <main className="tournament-neon relative min-h-screen overflow-hidden text-white">
      <WalletBackground />
      <div className="relative z-10">
        <AppHeader active="wallet" user={sessionUser} />
      </div>
      <section className="relative z-10 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex bg-[#ff2ec4]/12 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#ff2ec4]">
              {eyebrow}
            </p>
            <h1 className="t-display mt-4 text-5xl font-black uppercase leading-[0.9] tracking-normal md:text-7xl">
              <span className="t-glitch" data-text={title}>
                {title}
              </span>
            </h1>
            <p className="mt-3 max-w-2xl text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Economia de arena / pagos / premios / torneos
            </p>
          </div>
          <WalletSectionNav active={active} />
        </div>
        <div className="mt-5 space-y-5">{children}</div>
      </section>
    </main>
  );
}

function WalletBackground() {
  return (
    <>
      <video
        aria-hidden
        autoPlay
        className="pointer-events-none fixed inset-0 z-0 h-screen w-screen object-cover"
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
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[#050716]/62"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[#050716]/24"
      />
    </>
  );
}

function WalletSectionNav({ active }: { active: WalletShellProps["active"] }) {
  const items = [
    { href: "/wallet", key: "usd", label: "USD" },
    { href: "/wallet/bmoney", key: "bmoney", label: "BMoney" },
    { href: "/wallet/history", key: "history", label: "Historial" },
  ] as const;

  return (
    <nav className="polygon-shape grid grid-cols-3 gap-1.5 px-2 py-2 [--polygon-bg:#0a1129b8]">
      {items.map((item) => (
        <Link
          key={item.key}
          className={cn(
            "polygon-shape px-5 py-3 text-center text-xs font-black uppercase tracking-[0.14em] transition [--polygon-bg:transparent] hover:[--polygon-bg:#ffffff14]",
            active === item.key
              ? "text-[#060B1F] [--polygon-bg:#00E5FF] hover:text-white"
              : "text-slate-400 hover:text-white",
            active === item.key &&
              item.key === "bmoney" &&
              "text-[#060B1F] [--polygon-bg:#B6FF3D]",
          )}
          href={item.href}
        >
          <span className="block">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

function MetricCell({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "cyan" | "gold" | "green" | "slate";
  value: string;
}) {
  const toneClass = {
    cyan: "bg-cyan-300/8 text-slate-500",
    gold: "bg-amber-300/8 text-amber-200 border-amber-300/30",
    green: "bg-lime-300/8 text-slate-500",
    slate: "bg-white/5 text-slate-500",
  }[tone];

  return (
    <div className={`rounded-md p-3 ${toneClass}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 truncate text-xl font-black text-white">{value}</p>
    </div>
  );
}

function BmoneySource({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md bg-black/24 p-4 transition hover:bg-lime-300/8">
      <Icon className="size-4 text-lime-200" />
      <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function PaymentReturnBanner({
  paymentIntentId,
  state,
}: {
  paymentIntentId?: string;
  state: "cancel" | "success";
}) {
  const isSuccess = state === "success";

  return (
    <section
      className={`rounded-lg p-4 ${
        isSuccess ? "bg-cyan-300/10" : "bg-amber-300/10"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-white">
            {isSuccess ? "Pago enviado a validacion" : "Pago no completado"}
          </p>
          {paymentIntentId ? (
            <p className="mt-1 text-xs text-slate-400">{paymentIntentId}</p>
          ) : null}
        </div>
        {paymentIntentId ? (
          <Link
            className="inline-flex min-h-9 items-center justify-center bg-white/8 px-5 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/12"
            href="/wallet/history"
          >
            Ver historial
          </Link>
        ) : null}
      </div>
    </section>
  );
}

export function WalletMovementPanel({
  active,
  emptyText,
  href,
  movements,
  title,
}: {
  emptyText: string;
  href?: string;
  movements: WalletMovement[];
  title: string;
  active: WalletShellProps["active"];
}) {
  return (
    <section className="relative overflow-hidden rounded-lg">
      <Card>
        <CardContent>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <h2 className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">
              {title}
            </h2>
            {href ? (
              <Link
                className={cn(
                  "polygon-shape px-5 py-3 text-center text-xs font-black uppercase tracking-[0.14em] text-slate-400 transition [--polygon-bg:transparent] hover:text-[#060B1F]",
                  active === "usd" && "hover:[--polygon-bg:#00E5FF]",
                  active === "bmoney" && "hover:[--polygon-bg:#B6FF3D]",
                )}
                href={href}
              >
                <span className="block">Ver todo</span>
              </Link>
            ) : null}
          </div>
          <WalletMovementsTable emptyText={emptyText} movements={movements} />
        </CardContent>
      </Card>
    </section>
  );
}
