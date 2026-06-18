import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Users, LayoutDashboard, FileText, Settings, UserCog, LogOut, Wrench, UserPlus, Sparkles, Target, Bell, X, Megaphone, BarChart3, KeyRound, Radio, BookOpen, Crosshair, MonitorSmartphone, Building2, FlaskConical, Trophy, DollarSign, Wallet, Calculator } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import SidebarBanner from "@/components/SidebarBanner";
import NotificationBell from "@/components/NotificationBell";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import logoSrc from "@/assets/logo-bullfy.png";
import HelpChatButton from "@/components/HelpChatButton";
import ChangePasswordDialog from "@/components/shared/ChangePasswordDialog";
import ThemeToggle from "@/components/ThemeToggle";

const MOTIVATIONAL_MESSAGES = [
  "Cada IB que configuras hoy es un paso más hacia el crecimiento del equipo 🚀",
  "La consistencia supera al talento. ¡Sigue así! 💪",
  "Un buen seguimiento hoy evita problemas mañana 📋",
  "Los detalles marcan la diferencia entre lo bueno y lo excelente ✨",
  "Tu trabajo impacta directamente en el éxito de nuestros partners 🤝",
  "La organización es la base de la productividad 🗂️",
  "Hoy es un gran día para cerrar pendientes 🎯",
  "Documenta bien hoy, agradécetelo mañana 📝",
  "La excelencia no es un acto, es un hábito 🏆",
  "Cada proceso bien hecho fortalece la operación completa ⚙️",
  "No busques atajos, busca resultados duraderos 🔑",
  "El éxito del equipo se construye con pequeñas victorias diarias 🌟",
  "Comunica con claridad, ejecuta con precisión 🎯",
  "La proactividad es tu mejor herramienta 🛠️",
  "Un equipo fuerte se construye con disciplina y buena actitud 💎",
  "Prioriza lo importante, no solo lo urgente ⏳",
  "La calidad de tu trabajo habla por ti 🗣️",
  "Colaborar es multiplicar resultados 🤲",
  "Mantén el foco: lo que mides, mejora 📊",
  "Hoy tienes la oportunidad de superar tus propios estándares 🔥",
  "La atención al detalle genera confianza en nuestros partners 🔍",
  "Recuerda: cada interacción cuenta para la experiencia del IB 💼",
  "El orden en los procesos libera tiempo para lo estratégico 🧠",
  "Sé el ejemplo que inspira al resto del equipo 🌱",
  "La mejora continua empieza con una decisión diaria 📈",
];

const getMessageIndex = (userId: string = "default") => {
  const now = Math.floor(Date.now() / (5 * 60 * 1000));
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return Math.abs((now + hash) % MOTIVATIONAL_MESSAGES.length);
};

const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const { isAdmin, isGlobalAdmin, isOperaciones, isBD, isMarketing, isVentas, isAdminVentas, isAccountingUser, isAccountant, isDirectivo, profile, signOut, user } = useAuth();
  const { supported: pushSupported, permission: pushPermission, requestPermission } = usePushNotifications();
  const [pushDismissed, setPushDismissed] = useState(() => localStorage.getItem("push-banner-dismissed") === "true");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const showPushBanner = pushSupported && pushPermission === "default" && !pushDismissed;

  const handleEnablePush = async () => {
    await requestPermission();
    setPushDismissed(true);
    localStorage.setItem("push-banner-dismissed", "true");
  };

  const dismissPushBanner = () => {
    setPushDismissed(true);
    localStorage.setItem("push-banner-dismissed", "true");
  };

  const [motivationalMsg, setMotivationalMsg] = useState(() => MOTIVATIONAL_MESSAGES[getMessageIndex(user?.id)]);

  useEffect(() => {
    const update = () => setMotivationalMsg(MOTIVATIONAL_MESSAGES[getMessageIndex(user?.id)]);
    update();
    const interval = setInterval(update, 60 * 1000); // check every minute
    return () => clearInterval(interval);
  }, [user?.id]);

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard", iconColor: "#146EF5", show: true },
    { to: "/ibs", icon: Users, label: "IBs", iconColor: "#22C55E", show: true },
    { to: "/deals", icon: FileText, label: "Deals", iconColor: "#22C55E", show: true },
    { to: "/sub-ibs", icon: UserPlus, label: "Sub IBs", iconColor: "#22C55E", show: true },
    { to: "/IbBullfyExperience", icon: Sparkles, label: "IB Experience", iconColor: "#8B5CF6", show: true },
    { to: "/experience-leads", icon: Target, label: "Leads Experience", iconColor: "#F59E0B", show: isAdmin || isOperaciones || isBD },
    { to: "/operaciones", icon: Wrench, label: "Operaciones", iconColor: "#F59E0B", show: true },
    { to: "/marketing", icon: Megaphone, label: "Marketing", iconColor: "#8B5CF6", show: isAdmin || isMarketing },
    { to: "/live", icon: Radio, label: "Bullfy Live", iconColor: "#EF4444", show: true },
    { to: "/leads", icon: Crosshair, label: "Lead System", iconColor: "#F59E0B", show: isAdmin || isMarketing || isVentas || isAdminVentas },
    { to: "/estadisticas", icon: BarChart3, label: "Estadísticas", iconColor: "#06B6D4", show: isAdmin },
    { to: "/conexion-mt5", icon: MonitorSmartphone, label: "Conexión MT5", iconColor: "#3B82F6", show: isAdmin },
    { to: "/Broker_Prop", icon: Building2, label: "Broker_Prop ATFX", iconColor: "#F59E0B", show: isGlobalAdmin },
    { to: "/simulaciones", icon: FlaskConical, label: "Simulaciones", iconColor: "#A855F7", show: isAdmin },
    { to: "/tournament/landing", icon: Trophy, label: "Torneos", iconColor: "#D4AF37", show: true },
    { to: "/manual", icon: BookOpen, label: "Manual", iconColor: "#06B6D4", show: true },
    { to: "/finanzas", icon: DollarSign, label: "Finanzas", iconColor: "#22C55E", show: isAdmin },
    { to: "/contabilidad", icon: Calculator, label: "Contabilidad", iconColor: "#3B82F6", show: isGlobalAdmin || isAccountingUser || isAccountant || isDirectivo },
    { to: "/retiros", icon: Wallet, label: "Retiros", iconColor: "#10B981", show: isAdmin },
    { to: "/usuarios", icon: UserCog, label: "Usuarios", iconColor: "#64748B", show: isAdmin },
    { to: "/settings", icon: Settings, label: "Configuración", iconColor: "#64748B", show: isAdmin },
  ].filter((item) => item.show);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <img src={logoSrc} alt="Bullfy" className="h-8" />
          <span className="text-muted-foreground font-mono text-xs uppercase tracking-wider">IB SYSTEM</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-primary/10 text-primary shadow-gold"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <item.icon className="w-4 h-4" style={{ color: isActive ? undefined : item.iconColor }} />
                {item.label}
              </Link>
            );
          })}

          <SidebarBanner userId={user?.id} isGlobalAdmin={isGlobalAdmin} />
        </nav>
        <div className="p-4 border-t border-border space-y-3">
          <div className="px-3 py-2">
            <p className="text-xs font-mono uppercase tracking-wide text-foreground truncate">{profile?.nombre || "Usuario"}</p>
            <p className="text-xs text-muted-foreground/60 truncate">{profile?.correo}</p>
          </div>
          <ThemeToggle />
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
        {/* Desktop top bar */}
        <header className="hidden md:flex flex-col px-8 py-5 border-b border-border bg-card/50">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-foreground">
              {navItems.find((item) => item.to === location.pathname)?.label || "Dashboard"}
            </h1>
            <NotificationBell size="large" showLabel />
          </div>
          <div className="mt-2">
            <p className="text-sm text-foreground font-medium">
              Bienvenido de nuevo, <span className="text-primary">{profile?.nombre || "Usuario"}</span>
            </p>
            <p className="text-2xl font-bold italic mt-1" style={{ color: '#D4AF37' }}>{motivationalMsg}</p>
          </div>
        </header>

        {/* Mobile header */}
        <header className="md:hidden border-b border-border bg-card">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <img src={logoSrc} alt="Bullfy" className="h-6" />
              <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider">IB SYSTEM</span>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <button onClick={signOut} className="p-2 rounded-lg text-muted-foreground hover:text-destructive">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
          <nav className="flex items-center gap-1 px-3 pb-2 overflow-x-auto scrollbar-hide">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all shrink-0 ${
                    isActive
                      ? "bg-primary/10 text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5" style={{ color: isActive ? undefined : item.iconColor }} />
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
                  <p className="text-xs text-muted-foreground">Recibe alertas en tu teléfono cuando haya nuevos IBs, cambios de estado y más.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" onClick={handleEnablePush} className="text-xs">
                  Activar
                </Button>
                <button onClick={dismissPushBanner} className="p-1 rounded hover:bg-secondary text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          {children}
          <HelpChatButton />
        </main>
      </div>
      <ChangePasswordDialog open={showChangePassword} onOpenChange={setShowChangePassword} />
    </div>
  );
};

export default DashboardLayout;
