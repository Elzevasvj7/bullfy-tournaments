import { useState, type ComponentType, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Coins,
  Copy,
  LayoutDashboard,
  LogOut,
  Menu,
  PersonStanding,
  Shield,
  ShieldCheck,
  Swords,
  Trophy,
  User as UserIcon,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import type { TournamentUser, TournamentWallet } from "@/hooks/useTournamentAuth";
import bullfyWordmark from "@/assets/bullfy-logo-full.png";
import { tournamentRoutes } from "@/tournament-core/shared/routes";

const WHITE_FILTER = "brightness(0) invert(1)";

const navItems: Array<{
  label: string;
  to: string;
  end?: boolean;
  icon: ComponentType<{ className?: string }>;
}> = [
  { label: "Lobby", to: tournamentRoutes.lobby, end: true, icon: Trophy },
  { label: "Rankings", to: tournamentRoutes.rankings, icon: Zap },
  { label: "Clanes", to: tournamentRoutes.clans, icon: Shield },
  { label: "Versus", to: tournamentRoutes.versus, icon: Swords },
];

type TournamentHeaderProps = {
  user: TournamentUser | null;
  wallet: TournamentWallet | null;
  onLogout: () => void | Promise<void>;
  notificationSlot?: ReactNode;
};

export function TournamentHeader({
  notificationSlot,
  onLogout,
  user,
  wallet,
}: TournamentHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const walletBalance = Number(wallet?.balance_usd ?? 0);
  const bmoneyBalance = Number(wallet?.bmoney_balance ?? 0);
  const bullfyPoints = Number(user?.bullfy_points ?? 0);

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 px-3 pt-3">
      <nav className="mx-auto w-full max-w-[1500px] rounded-2xl border border-[#00E5FF]/15 bg-[#0A1129]/70 py-2 shadow-[0_0_30px_rgba(0,229,255,0.08)] backdrop-blur-xl">
        <div className="flex min-h-16 items-center justify-between gap-3 px-3 py-2 sm:px-5">
          <Logo />

          <div className="hidden min-w-0 flex-1 items-center gap-1 xl:flex">
            {navItems.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </div>

          <div className="ml-auto hidden min-w-0 items-center gap-2 xl:flex">
            <CreateTournamentLink />
            <Link to={tournamentRoutes.wallet}>
              <HeaderBalance label="Wallet Real" value={`$${walletBalance.toFixed(0)}`} tone="blue" />
            </Link>
            <Link to={tournamentRoutes.wallet}>
              <HeaderBalance label="BMoney" value={`${bmoneyBalance.toFixed(0)} BM$`} tone="green" />
            </Link>
            <Link to={tournamentRoutes.dashboard}>
              <HeaderBalance label="Bullfy Points" value={`${bullfyPoints} BP`} tone="gold" />
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {user ? (
              <>
                {notificationSlot}
                <ProfileMenu
                  bmoneyBalance={bmoneyBalance}
                  bullfyPoints={bullfyPoints}
                  onLogout={onLogout}
                  user={user}
                  walletBalance={walletBalance}
                />
              </>
            ) : (
              <AuthActions />
            )}

            <button
              type="button"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Cerrar menu" : "Abrir menu"}
              onClick={() => setMobileOpen((current) => !current)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-slate-300 transition hover:border-cyan-300/30 hover:text-white xl:hidden"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <div className="grid gap-4 border-t border-white/10 px-3 pb-4 pt-3 sm:px-5 xl:hidden">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {navItems.map((item) => (
                <NavItem key={item.to} {...item} onClick={closeMobileMenu} />
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <CreateTournamentLink onClick={closeMobileMenu} />
              <Link to={tournamentRoutes.wallet} onClick={closeMobileMenu}>
                <HeaderBalance label="Wallet Real" value={`$${walletBalance.toFixed(0)}`} tone="blue" />
              </Link>
              <Link to={tournamentRoutes.wallet} onClick={closeMobileMenu}>
                <HeaderBalance label="BMoney" value={`${bmoneyBalance.toFixed(0)} BM$`} tone="green" />
              </Link>
              <Link to={tournamentRoutes.dashboard} onClick={closeMobileMenu}>
                <HeaderBalance label="Bullfy Points" value={`${bullfyPoints} BP`} tone="gold" />
              </Link>
            </div>
          </div>
        ) : null}
      </nav>
    </header>
  );
}

function Logo() {
  return (
    <Link
      to={tournamentRoutes.lobby}
      className="group inline-flex shrink-0 flex-col gap-1 items-center justify-center leading-none"
    >
      <img
        src={bullfyWordmark}
        alt="Bullfy"
        className="w-14 object-contain transition-transform group-hover:scale-[1.02]"
        style={{ filter: WHITE_FILTER }}
      />
      <span className="text-[11px] font-black uppercase tracking-[0.22em] text-[#00E5FF]">
        Tournament
      </span>
    </Link>
  );
}

function NavItem({
  end,
  icon: Icon,
  label,
  onClick,
  to,
}: {
  end?: boolean;
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  to: string;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex h-10 items-center gap-2 px-3 text-[11px] font-black uppercase tracking-[0.14em] transition ${
          isActive
            ? "text-[#00E5FF] border-b-2 border-[#00E5FF]"
            : "text-gray-400 hover:text-white"
        }`
      }
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

function CreateTournamentLink({ onClick }: { onClick?: () => void }) {
  return (
    <NavLink
      to={tournamentRoutes.create}
      onClick={onClick}
      className={({ isActive }) =>
        `flex h-10 items-center justify-center gap-1.5 rounded-lg border px-4 text-[11px] font-black uppercase tracking-[0.12em] transition ${
          isActive
            ? "border-[#B6FF3D] bg-[#B6FF3D]/10 text-[#B6FF3D] shadow-[0_0_22px_rgba(182,255,61,0.55)]"
            : "border-[#B6FF3D]/60 bg-[#B6FF3D]/5 text-[#B6FF3D] shadow-[0_0_18px_rgba(182,255,61,0.35)] hover:shadow-[0_0_26px_rgba(182,255,61,0.55)]"
        }`
      }
    >
      <Zap className="h-3.5 w-3.5" />
      Crear torneo
    </NavLink>
  );
}

function HeaderBalance({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "blue" | "green" | "gold";
  value: string;
}) {
  const toneClass = {
    blue: "border-cyan-300/20 bg-cyan-300/10 text-cyan-200",
    green: "border-lime-300/20 bg-lime-300/10 text-lime-200",
    gold: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  }[tone];

  return (
    <div className={`flex h-10 min-w-32 items-center justify-between gap-3 rounded-lg border px-3 transition hover:bg-white/5 ${toneClass}`}>
      <span className="text-[10px] font-black uppercase tracking-[0.12em]">
        {label}
      </span>
      <span className="text-xs font-bold text-white">{value}</span>
    </div>
  );
}

function AuthActions() {
  return (
    <>
      <Link
        to={tournamentRoutes.login}
        className="text-xs font-black uppercase tracking-widest text-white transition-colors hover:text-[#00E5FF]"
      >
        Ingresar
      </Link>
      <Link
        to={tournamentRoutes.register}
        className="rounded-xl bg-[#00E5FF] px-4 py-2.5 text-xs font-black uppercase tracking-widest text-[#060B1F] shadow-[0_0_20px_rgba(0,229,255,0.45)] transition-all hover:brightness-110 sm:px-6"
      >
        Registrarme
      </Link>
    </>
  );
}

function ProfileMenu({
  bmoneyBalance,
  bullfyPoints,
  onLogout,
  user,
  walletBalance,
}: {
  bmoneyBalance: number;
  bullfyPoints: number;
  onLogout: () => void | Promise<void>;
  user: TournamentUser;
  walletBalance: number;
}) {
  const nav = useNavigate();

  async function handleLogout() {
    await onLogout();
    nav(tournamentRoutes.lobby);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="relative flex h-10 items-center justify-center rounded-lg border border-white/10 bg-black/20 px-3 text-xs font-bold uppercase tracking-wider text-slate-300 transition hover:border-cyan-300/30 hover:bg-white/10 hover:text-white"
        >
          <UserIcon className="mr-1 h-4 w-4" /> Perfil
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-72 border-[#00E5FF]/20 bg-[#0A1129]/95 text-white backdrop-blur-xl"
      >
        <DropdownMenuLabel className="flex items-center gap-3 py-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#00E5FF]/40 bg-[#00E5FF]/15 font-black text-[#00E5FF]">
            {(user.full_name || user.email || "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{user.full_name}</div>
            <div className="t-mono truncate text-[10px] text-slate-400">{user.email}</div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        <div className="space-y-1.5 px-2 py-1.5 text-xs">
          <ProfileStat icon={Trophy} label="Bullfy Points" value={`${bullfyPoints} BP`} tone="green" />
          <ProfileStat icon={Coins} label="BMoney" value={`${bmoneyBalance.toFixed(0)} BM$`} tone="green" />
          <ProfileStat icon={Wallet} label="Wallet Real" value={`$${walletBalance.toFixed(2)}`} tone="blue" />
          {user.referral_code ? <ReferralCode code={user.referral_code} /> : null}
        </div>
        <DropdownMenuSeparator className="bg-white/10" />
        <MenuRoute icon={LayoutDashboard} label="Dashboard" to={tournamentRoutes.dashboard} />
        <MenuRoute icon={Wallet} label="Wallet" to={tournamentRoutes.wallet} />
        <MenuRoute icon={PersonStanding} label="Poses & Bailes" to={tournamentRoutes.poses} />
        <MenuRoute icon={ShieldCheck} label="KYC" to={tournamentRoutes.kyc} />
        <MenuRoute
          icon={ShieldCheck}
          label={user.is_verified_user ? "Usuario verificado" : "Verificarme ($25)"}
          to={tournamentRoutes.verify}
        />
        {user.clan_id ? (
          <MenuRoute icon={Trophy} label="Mi clan" to={tournamentRoutes.clan(user.clan_id)} />
        ) : (
          <MenuRoute icon={Trophy} label="Unirme a un clan" to={tournamentRoutes.clans} />
        )}
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-300"
        >
          <LogOut className="mr-2 h-4 w-4" /> Cerrar sesion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ReferralCode({ code }: { code: string }) {
  return (
    <div className="mt-1 flex items-center justify-between gap-2 border-t border-white/10 pt-1">
      <span className="text-slate-400">Referido</span>
      <button
        onClick={() => {
          const link = `https://bullfytech.online/tournament/register?ref=${code}`;
          navigator.clipboard.writeText(link);
          toast({ title: "Link copiado", description: link });
        }}
        className="flex items-center gap-1 font-mono text-[11px] font-bold text-white hover:text-[#00E5FF]"
      >
        {code} <Copy className="h-3 w-3" />
      </button>
    </div>
  );
}

function MenuRoute({
  icon: Icon,
  label,
  to,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  to: string;
}) {
  const nav = useNavigate();

  return (
    <DropdownMenuItem
      onClick={() => nav(to)}
      className="cursor-pointer focus:bg-white/10 focus:text-white"
    >
      <Icon className="mr-2 h-4 w-4" /> {label}
    </DropdownMenuItem>
  );
}

function ProfileStat({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  tone: "blue" | "green";
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-slate-400">
        <Icon className={`h-3 w-3 ${tone === "blue" ? "text-[#00E5FF]" : "text-[#B6FF3D]"}`} />
        {label}
      </span>
      <span className={`font-bold ${tone === "blue" ? "text-[#00E5FF]" : "text-[#B6FF3D]"}`}>
        {value}
      </span>
    </div>
  );
}
