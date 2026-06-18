"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Copy,
  LayoutDashboard,
  LogOut,
  Menu,
  PersonStanding,
  Shield,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  User,
  UserIcon,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logoutTournamentUserAction } from "@/modules/auth/services/auth.action";
import type { CurrentSessionUser } from "@/modules/auth/types";

type AppHeaderProps = {
  active?:
    | "lobby"
    | "rankings"
    | "clanes"
    | "versus"
    | "torneos"
    | "wallet"
    | "chat"
    | "perfil";
  user?: CurrentSessionUser | null;
};

const navItems: Array<{
  label: string;
  href: string;
  key: NonNullable<AppHeaderProps["active"]>;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { label: "Lobby", href: "/", key: "torneos", icon: Trophy },
  { label: "Rankings", href: "/rankings", key: "rankings", icon: Zap },
  { label: "Clanes", href: "/clans", key: "clanes", icon: Shield },
  { label: "Versus", href: "/versus", key: "versus", icon: Swords },
];

const profileMenuItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Wallet", href: "/wallet", icon: Wallet },
  { label: "Perfil", href: "/profile", icon: User },
  { label: "Poses & Bailes", href: "#", icon: PersonStanding },
  { label: "KYC", href: "#", icon: ShieldCheck },
  { label: "Verificarme ($25)", href: "#", icon: ShieldCheck },
  { label: "Unirme a un clan", href: "#", icon: Trophy },
];

const notificationItems = [
  {
    id: "notif_verify",
    title: "Verificacion disponible",
    message: "Completa KYC para activar torneos Elite y retiros.",
    read: false,
    icon: ShieldCheck,
  },
  {
    id: "notif_bp",
    title: "Bullfy Points listos",
    message: "Ya tienes puntos para entrar al siguiente torneo BMoney.",
    read: false,
    icon: Trophy,
  },
  {
    id: "notif_clan",
    title: "Invitacion de clan",
    message: "Alpha Desk envio una invitacion pendiente.",
    read: true,
    icon: Swords,
  },
];

const WHITE_FILTER = "brightness(0) invert(1)";
const compactFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

function Logo() {
  return (
    <Link
      href="/"
      className="flex shrink-0 flex-col items-center justify-center leading-none"
    >
      <Image
        src={"/assets/bullfy-logo-full.png"}
        alt="Bullfy"
        width={51}
        height={51}
        priority
        className="object-contain transition-transform group-hover:scale-[1.02]"
        style={{ filter: WHITE_FILTER }}
      />
      <span className="mt-1 text-[11px] font-black uppercase tracking-[0.22em] text-bullfy-neon-blue">
        Tournament
      </span>
    </Link>
  );
}

function formatCompact(value: number) {
  return compactFormatter.format(value);
}

export function AppHeader({ active = "torneos", user = null }: AppHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState(notificationItems);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((item) => !item.read).length;

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (!notificationsRef.current?.contains(target)) {
        setNotificationsOpen(false);
      }

      if (!profileRef.current?.contains(target)) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);

    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function markAllNotificationsRead() {
    setNotifications((current) =>
      current.map((item) => ({ ...item, read: true })),
    );
  }

  return (
    <header className="sticky top-0 z-50 px-3 pt-3">
      <div className="mx-auto w-full max-w-375 rounded-2xl border border-bullfy-glass-border bg-bullfy-panel/70 shadow-glass-blue backdrop-blur-xl">
        <div className="flex min-h-16 items-center justify-between gap-3 px-3 py-2 sm:px-5">
          <Logo />

          <nav className="hidden min-w-0 flex-1 items-center gap-1 xl:flex ">
            {navItems.map((item) => (
              <HeaderNavItem
                key={item.key}
                active={active === item.key}
                item={item}
              />
            ))}
          </nav>

          <div className="ml-auto hidden min-w-0 items-center gap-2 2xl:flex">
            <Link
              href="/tournaments/create"
              className={cn(
                buttonVariants({ size: "lg", variant: "neonGreen" }),
                "text-[11px] font-black uppercase tracking-[0.12em]",
              )}
            >
              <Zap className="size-3.5" />
              Crear torneo
            </Link>
            <Link href="/wallet">
              <HeaderBalance
                label="Wallet Real"
                value={`$${formatCompact(user?.walletBalanceUsd ?? 0)}`}
                tone="blue"
              />
            </Link>
            <Link href="/wallet/bmoney">
              <HeaderBalance
                label="BMoney"
                value={formatCompact(user?.bmoneyBalance ?? 0)}
                tone="green"
              />
            </Link>
            <Link href="/wallet/bmoney">
              <HeaderBalance
                label="Bullfy Points"
                value={formatCompact(user?.bullfyPoints ?? 0)}
                tone="gold"
              />
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <NotificationMenu
              items={notifications}
              onMarkAllRead={markAllNotificationsRead}
              open={notificationsOpen}
              refObject={notificationsRef}
              setOpen={setNotificationsOpen}
              unreadCount={unreadCount}
            />

            <ProfileMenu
              open={profileOpen}
              refObject={profileRef}
              setOpen={setProfileOpen}
              user={user}
            />

            <button
              type="button"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Cerrar menu" : "Abrir menu"}
              onClick={() => setMobileOpen((current) => !current)}
              className="flex size-10 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-slate-300 transition hover:border-cyan-300/30 hover:text-white 2xl:hidden"
            >
              {mobileOpen ? (
                <X className="size-4" />
              ) : (
                <Menu className="size-4" />
              )}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <div className="grid gap-4 border-t border-white/10 px-3 pb-4 pt-3 sm:px-5 2xl:hidden">
            <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:hidden">
              {navItems.map((item) => (
                <HeaderNavItem
                  key={item.key}
                  active={active === item.key}
                  item={item}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
            </nav>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Link
                href="/tournaments/create"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  buttonVariants({ size: "lg", variant: "neonGreen" }),
                  "h-10 justify-center text-[11px] font-black uppercase tracking-[0.12em]",
                )}
              >
                <Zap className="size-3.5" />
                Crear torneo
              </Link>
              <Link href="/wallet" onClick={() => setMobileOpen(false)}>
                <HeaderBalance
                  label="Wallet Real"
                  value={`$${formatCompact(user?.walletBalanceUsd ?? 0)}`}
                  tone="blue"
                />
              </Link>
              <Link href="/wallet/bmoney" onClick={() => setMobileOpen(false)}>
                <HeaderBalance
                  label="BMoney"
                  value={formatCompact(user?.bmoneyBalance ?? 0)}
                  tone="green"
                />
              </Link>
              <Link href="/wallet/bmoney" onClick={() => setMobileOpen(false)}>
                <HeaderBalance
                  label="Bullfy Points"
                  value={formatCompact(user?.bullfyPoints ?? 0)}
                  tone="gold"
                />
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}

function HeaderNavItem({
  active,
  item,
  onClick,
}: {
  active: boolean;
  item: (typeof navItems)[number];
  onClick?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`group flex h-10 min-w-0 items-center justify-center gap-1.5  px-3 text-[11px] font-black uppercase tracking-[0.12em] transition ${
      active
            ? "text-[#00E5FF] border-b-2 border-[#00E5FF]"
            : "text-gray-400 hover:text-white"
      }`}
    >
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function NotificationMenu({
  items,
  onMarkAllRead,
  open,
  refObject,
  setOpen,
  unreadCount,
}: {
  items: typeof notificationItems;
  onMarkAllRead: () => void;
  open: boolean;
  refObject: React.RefObject<HTMLDivElement | null>;
  setOpen: (open: boolean) => void;
  unreadCount: number;
}) {
  return (
    <div ref={refObject} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label="Notificaciones"
        onClick={() => setOpen(!open)}
        className="relative flex size-10 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-slate-300 transition hover:border-cyan-300/30 hover:text-white"
      >
        <Bell className="size-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-bullfy-neon-green px-1 text-[10px] font-black text-[#071102]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-bullfy-neon-blue/20 bg-bullfy-panel/95 text-white shadow-glass-blue backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <p className="text-sm font-black uppercase tracking-[0.12em]">
              Notificaciones
            </p>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 transition hover:text-white"
              >
                <CheckCheck className="size-3" />
                Marcar
              </button>
            ) : null}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    "grid w-full grid-cols-[auto_1fr_auto] gap-3 border-b border-white/5 px-4 py-3 text-left transition last:border-b-0 hover:bg-white/5",
                    !item.read && "bg-bullfy-neon-blue/5",
                  )}
                >
                  <Icon className="mt-0.5 size-4 text-bullfy-neon-blue" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-white">
                      {item.title}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[11px] leading-5 text-slate-400">
                      {item.message}
                    </span>
                  </span>
                  {!item.read ? (
                    <span className="mt-1.5 size-2 rounded-full bg-bullfy-neon-green" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProfileMenu({
  open,
  refObject,
  setOpen,
  user,
}: {
  open: boolean;
  refObject: React.RefObject<HTMLDivElement | null>;
  setOpen: (open: boolean) => void;
  user: CurrentSessionUser | null;
}) {
  const router = useRouter();
  const initials =
    user?.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "BU";

  async function handleLogout() {
    await logoutTournamentUserAction();
    setOpen(false);
    router.push("/login");
    router.refresh();
  }

  return (
    <div ref={refObject} className="relative">
      <Button
        onClick={() => setOpen(!open)}
        size="sm"
        variant="ghost"
        className="relative flex size-10 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-slate-300 transition hover:border-cyan-300/30 hover:text-white"
      >
        <UserIcon className="h-4 w-4" />
      </Button>
      {open ? (
        <div className="absolute right-0 top-full mt-2 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-bullfy-neon-blue/20 bg-bullfy-panel/95 text-white shadow-glass-blue backdrop-blur-xl">
          {user ? (
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
            <div className="flex size-10 items-center justify-center rounded-full border border-bullfy-neon-blue/40 bg-bullfy-neon-blue/15 text-sm font-black text-bullfy-neon-blue">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{user.name}</p>
              <p className="truncate text-[10px] text-slate-400">
                {user.email}
              </p>
            </div>
            </div>
          ) : (
            <div className="border-b border-white/10 px-4 py-4">
              <p className="text-sm font-black text-white">Sesion requerida</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Entra para ver perfil, wallet y cockpit.
              </p>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className={cn(
                  buttonVariants({ size: "sm", variant: "neonBlue" }),
                  "mt-3 h-9 w-full justify-center",
                )}
              >
                Iniciar sesion
              </Link>
            </div>
          )}

          {user ? (
            <div className="grid gap-1 border-b border-white/10 px-3 py-3 text-xs">
            <ProfileStat
              icon={Trophy}
              label="Bullfy Points"
              value={`${formatCompact(user.bullfyPoints)} BP`}
              tone="green"
            />
            <ProfileStat
              icon={Sparkles}
              label="BMoney"
              value={`${formatCompact(user.bmoneyBalance)} BM$`}
              tone="green"
            />
            <ProfileStat
              icon={Wallet}
              label="Wallet Real"
              value={`$${formatCompact(user.walletBalanceUsd)}`}
              tone="blue"
            />
            <button
              type="button"
              className="mt-1 flex items-center justify-between gap-2 border-t border-white/10 pt-2 text-left text-[11px] text-slate-400 transition hover:text-bullfy-neon-blue"
            >
              <span>Referido</span>
              <span className="flex items-center gap-1 font-mono font-bold text-white">
                {user.referralCode} <Copy className="size-3" />
              </span>
            </button>
            </div>
          ) : null}

          <div className="p-2">
            {profileMenuItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
                >
                  <Icon className="size-4 text-cyan-200" />
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={handleLogout}
              disabled={!user}
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-bullfy-neon-red transition hover:bg-bullfy-neon-red/10"
            >
              <LogOut className="size-4" />
              Cerrar sesion
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProfileStat({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: "blue" | "green";
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-slate-400">
        <Icon
          className={`size-3 ${
            tone === "blue" ? "text-bullfy-neon-blue" : "text-bullfy-neon-green"
          }`}
        />
        {label}
      </span>
      <span
        className={`font-bold ${
          tone === "blue" ? "text-bullfy-neon-blue" : "text-bullfy-neon-green"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function HeaderBalance({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "green" | "gold";
}) {
  const toneClass = {
    blue: "border-cyan-300/20 bg-cyan-300/8 text-cyan-200",
    green: "border-lime-300/20 bg-lime-300/8 text-lime-200",
    gold: "border-amber-300/20 bg-amber-300/8 text-amber-200",
  }[tone];

  return (
    <div
      className={`flex h-10 min-w-32 items-center justify-between gap-3 rounded-lg border px-3 transition hover:bg-white/5 ${toneClass}`}
    >
      <span className="text-[10px] font-black uppercase tracking-[0.12em]">
        {label}
      </span>
      <span className="text-xs font-bold text-white">{value}</span>
    </div>
  );
}
