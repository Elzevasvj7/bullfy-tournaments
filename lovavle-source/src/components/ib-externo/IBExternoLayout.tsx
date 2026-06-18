import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { UserPlus, LayoutDashboard, LogOut, Bell, X, Home, FileText, Download, Users, KeyRound, ExternalLink, Target } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import NotificationBell from "@/components/NotificationBell";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import logoSrc from "@/assets/logo-bullfy.png";
import ChangePasswordDialog from "@/components/shared/ChangePasswordDialog";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const IBExternoLayout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const { supported: pushSupported, permission: pushPermission, requestPermission } = usePushNotifications();
  const [pushDismissed, setPushDismissed] = useState(() => localStorage.getItem("push-banner-dismissed") === "true");
  const showPushBanner = pushSupported && pushPermission === "default" && !pushDismissed;
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.nombre || "IB");
  const [partnerSlug, setPartnerSlug] = useState<string | null>(null);

  // Fetch alias from sub_ibs or ibs + check partner portal
  useEffect(() => {
    const fetchData = async () => {
      if (profile?.sub_ib_id) {
        const [aliasRes, portalRes] = await Promise.all([
          supabase.from("sub_ibs").select("alias, nombre").eq("id", profile.sub_ib_id).single(),
          supabase.from("partner_portals").select("nombre_portal").eq("sub_ib_id", profile.sub_ib_id).eq("status", "active").maybeSingle(),
        ]);
        if (aliasRes.data) setDisplayName(aliasRes.data.alias || aliasRes.data.nombre || profile.nombre);
        setPartnerSlug(portalRes.data?.nombre_portal || null);
      } else if (profile?.ib_id) {
        const [aliasRes, portalRes] = await Promise.all([
          (supabase.from as any)("ibs").select("alias, nombre_ib").eq("id", profile.ib_id).single(),
          supabase.from("partner_portals").select("nombre_portal").eq("ib_id", profile.ib_id).eq("status", "active").maybeSingle(),
        ]);
        if (aliasRes.data) setDisplayName(aliasRes.data.alias || aliasRes.data.nombre_ib || profile.nombre);
        setPartnerSlug(portalRes.data?.nombre_portal || null);
      } else {
        setDisplayName(profile?.nombre || "IB");
        setPartnerSlug(null);
      }
    };
    fetchData();
  }, [profile]);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsAppInstalled(true);
    }
    window.addEventListener("appinstalled", () => setIsAppInstalled(true));

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsAppInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleEnablePush = async () => {
    await requestPermission();
    setPushDismissed(true);
    localStorage.setItem("push-banner-dismissed", "true");
  };

  const dismissPushBanner = () => {
    setPushDismissed(true);
    localStorage.setItem("push-banner-dismissed", "true");
  };

  const navItems = [
    { to: "/ib-portal", icon: Home, label: "Inicio" },
    { to: "/ib-portal/campanas", icon: Target, label: "Campañas" },
    { to: "/ib-portal/mis-sub-ibs", icon: Users, label: "Mis Sub IBs" },
    { to: "/ib-portal/solicitudes", icon: FileText, label: "Mis Solicitudes" },
    ...(partnerSlug ? [{ to: `/partner/${partnerSlug}`, icon: ExternalLink, label: "Partner Portal", external: true }] : []),
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <img src={logoSrc} alt="Bullfy" className="h-8" />
          <span className="text-muted-foreground font-mono text-xs uppercase tracking-wider">PORTAL IB</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isExternal = (item as any).external;
            const isActive = location.pathname === item.to || 
              (item.to !== "/ib-portal" && location.pathname.startsWith(item.to));
            const isExactHome = item.to === "/ib-portal" && location.pathname === "/ib-portal";
            const active = item.to === "/ib-portal" ? isExactHome : isActive;

            if (isExternal) {
              return (
                <a
                  key={item.to}
                  href={item.to}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-muted-foreground hover:text-foreground hover:bg-secondary"
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                  <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                </a>
              );
            }

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-primary/10 text-primary shadow-gold"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border space-y-3">
          {deferredPrompt && !isAppInstalled && (
            <Button variant="outline" onClick={handleInstallApp} className="w-full justify-start gap-2 text-sm border-primary/30 text-primary hover:bg-primary/10">
              <Download className="w-4 h-4" />
              Instalar App
            </Button>
          )}
          <div className="px-3 py-2">
            <p className="text-xs font-mono uppercase tracking-wide text-foreground truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground/60 truncate">{profile?.correo}</p>
          </div>
          <Button variant="ghost" onClick={() => setShowChangePassword(true)} className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground text-sm">
            <KeyRound className="w-4 h-4" />
            Cambiar contraseña
          </Button>
          <Button variant="ghost" onClick={signOut} className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive text-sm">
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="hidden md:flex items-center justify-between px-8 py-5 border-b border-border bg-card/50">
          <h1 className="text-xl font-semibold text-foreground">
            {navItems.find((item) => {
              if (item.to === "/ib-portal") return location.pathname === "/ib-portal";
              return location.pathname.startsWith(item.to);
            })?.label || "Portal IB"}
          </h1>
          <NotificationBell size="large" showLabel />
        </header>

        {/* Mobile header */}
        <header className="md:hidden border-b border-border bg-card">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <img src={logoSrc} alt="Bullfy" className="h-6" />
              <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider">PORTAL IB</span>
            </div>
            <div className="flex items-center gap-2">
              {deferredPrompt && !isAppInstalled && (
                <button onClick={handleInstallApp} className="p-2 rounded-lg text-primary hover:bg-primary/10">
                  <Download className="w-4 h-4" />
                </button>
              )}
              <NotificationBell />
              <button onClick={signOut} className="p-2 rounded-lg text-muted-foreground hover:text-destructive">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
          <nav className="flex items-center gap-1 px-3 pb-2 overflow-x-auto scrollbar-hide">
            {navItems.map((item) => {
              const isExternal = (item as any).external;
              const isActive = location.pathname === item.to ||
                (item.to !== "/ib-portal" && location.pathname.startsWith(item.to));
              const isExactHome = item.to === "/ib-portal" && location.pathname === "/ib-portal";
              const active = item.to === "/ib-portal" ? isExactHome : isActive;

              if (isExternal) {
                return (
                  <a
                    key={item.to}
                    href={item.to}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all shrink-0 text-muted-foreground hover:text-foreground hover:bg-secondary"
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    {item.label}
                  </a>
                );
              }

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all shrink-0 ${
                    active
                      ? "bg-primary/10 text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="flex-1 p-6 md:p-8 overflow-auto">
          {showPushBanner && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Activa las notificaciones push</p>
                  <p className="text-xs text-muted-foreground">Recibe alertas cuando haya cambios en tus solicitudes.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" onClick={handleEnablePush} className="text-xs">Activar</Button>
                <button onClick={dismissPushBanner} className="p-1 rounded hover:bg-secondary text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
      <ChangePasswordDialog open={showChangePassword} onOpenChange={setShowChangePassword} />
    </div>
  );
};

export default IBExternoLayout;
