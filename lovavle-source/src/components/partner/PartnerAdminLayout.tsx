import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LiveDashboard from "@/components/live/LiveDashboard";
import PartnerTierManager from "@/components/live/PartnerTierManager";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "@/lib/toastUtils";
import { Users, Radio, CheckCircle, XCircle, ArrowLeft, LogOut, GraduationCap, Network, Rocket, Crown, Paintbrush, Copy, Check, Link, Wallet, Video, Share2, Send, Loader2, ChevronLeft, ChevronRight, Menu, ShoppingCart, Settings as SettingsIcon, Plug, CalendarDays, CalendarClock, UserPlus, BadgeCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PortalBrandingConfig from "@/components/partner/PortalBrandingConfig";
import RecordingToClassToggle from "@/components/partner/RecordingToClassToggle";
import AcademyAdmin from "@/components/partner/AcademyAdmin";
import PartnerWallet from "@/components/partner/PartnerWallet";
import MLMClient from "@/components/partner/MLMClient";
import VideoStudioDashboard from "@/components/marketing/VideoStudioDashboard";
import PortalBrollLibrary from "@/components/marketing/PortalBrollLibrary";
import SocialCredentialsConfig from "@/components/partner/SocialCredentialsConfig";
import PortalVideoBrandConfig from "@/components/marketing/PortalVideoBrandConfig";
import PortalStoreAdmin from "@/components/partner/PortalStoreAdmin";
import MLMConfigAdmin from "@/components/partner/MLMConfigAdmin";
import PortalEventsAdmin from "@/components/partner/PortalEventsAdmin";
import PortalClassesAdmin from "@/components/partner/PortalClassesAdmin";
import PartnerReferralsAdmin from "@/components/partner/PartnerReferralsAdmin";
import PortalMembershipsAdmin from "@/components/partner/PortalMembershipsAdmin";
import BullfyReferralLinkCard from "@/components/partner/BullfyReferralLinkCard";
import BullfyTradingRoom from "@/components/partner/BullfyTradingRoom";

import { usePortalBranding, usePortalBrandingCss, usePortalFavicon, isWhiteLabelPortal } from "@/hooks/usePortalBranding";
import { PortalBrandProvider, brandText } from "@/lib/portalBrand";
import { portalBasePath } from "@/lib/portalRouting";

interface PartnerAdminLayoutProps {
  portal: { id: string; nombre_portal: string; display_name: string; ib_id: string };
}

interface PartnerUser {
  id: string;
  nombre: string;
  email: string;
  status: string;
  tier: string;
  created_at: string;
}

interface LiveRoom {
  id: string;
  title: string;
  status: string;
  viewer_count: number;
  created_at: string;
}

type AdminSection = "dashboard" | "live" | "tiers" | "referrals" | "academy" | "classes" | "events" | "store" | "memberships" | "wallet" | "mlm" | "branding" | "video-studio" | "social" | "mt5-bridge";

const ComingSoon = () => (
  <Card>
    <CardContent className="py-16 text-center">
      <Rocket className="w-14 h-14 mx-auto text-primary mb-4 animate-bounce" />
      <h3 className="text-xl font-display font-bold text-foreground mb-2">Estamos por lanzar cosas asombrosas</h3>
      <p className="text-muted-foreground text-sm">Esta sección estará disponible muy pronto. ¡Mantente atento!</p>
    </CardContent>
  </Card>
);

const PartnerAdminLayout = ({ portal }: PartnerAdminLayoutProps) => {
  const wl = isWhiteLabelPortal(portal.nombre_portal);
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<PartnerUser[]>([]);
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [section, setSection] = useState<AdminSection>("dashboard");
  const { branding } = usePortalBranding(portal.id);
  usePortalBrandingCss(branding);
  usePortalFavicon(portal.nombre_portal, branding.logo_url);
  const [copied, setCopied] = useState(false);
  const [videoStudioEnabled, setVideoStudioEnabled] = useState(false);
  const [tierStreamsEnabled, setTierStreamsEnabled] = useState(false);
  const [commerceEnabled, setCommerceEnabled] = useState(false);
  const [sendingCredentials, setSendingCredentials] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [hostPartnerUserId, setHostPartnerUserId] = useState<string | null>(null);

  // Upsert "host" partner_user record so the admin can use BullfyTradingRoom (free).
  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;
    (async () => {
      const email = user.email!.toLowerCase();
      const { data: existing } = await supabase
        .from("partner_users")
        .select("id, is_host")
        .eq("portal_id", portal.id)
        .ilike("email", email)
        .maybeSingle();

      if (existing?.id) {
        if (!existing.is_host) {
          await supabase.from("partner_users").update({ is_host: true, status: "approved", tier: "host" }).eq("id", existing.id);
        }
        if (!cancelled) setHostPartnerUserId(existing.id);
        return;
      }

      const { data: created } = await supabase
        .from("partner_users")
        .insert({
          portal_id: portal.id,
          email,
          nombre: user.user_metadata?.full_name || user.email!.split("@")[0],
          // password_hash es NOT NULL en partner_users sin default. Los partner_users
          // "host" no usan password (entran al portal vía auth.users del admin),
          // pero igualmente hay que satisfacer la constraint. Sin esto, el INSERT
          // fallaba con "null value in column password_hash violates not-null
          // constraint" y el Trading Room quedaba en "Inicializando host..." infinito
          // para CUALQUIER IB admin. Bug confirmado el 2026-05-28 por Karlos.
          password_hash: "",
          status: "approved",
          tier: "host",
          is_host: true,
        } as any)
        .select("id")
        .maybeSingle();
      if (!cancelled && created?.id) setHostPartnerUserId(created.id);
    })();
    return () => { cancelled = true; };
  }, [user?.email, portal.id]);

  useEffect(() => {
    const checkPortalFeatures = async () => {
      const [portalRes, commerceRes] = await Promise.all([
        supabase
          .from("partner_portals")
          .select("video_studio_enabled, tier_streams_enabled, ib_id")
          .eq("id", portal.id)
          .maybeSingle(),
        supabase
          .from("portal_commerce_access")
          .select("enabled")
          .eq("ib_id", portal.ib_id)
          .maybeSingle(),
      ]);
      setVideoStudioEnabled(portalRes.data?.video_studio_enabled === true);
      setTierStreamsEnabled(portalRes.data?.tier_streams_enabled === true);
      setCommerceEnabled(commerceRes.data?.enabled === true);
    };
    checkPortalFeatures();
  }, [portal.id]);

  const registrationUrl = `${window.location.origin}${portalBasePath(portal.nombre_portal)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(registrationUrl);
    setCopied(true);
    toast.success("Link copiado al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    // No decidir mientras la auth todavía está resolviendo. Sin este guard,
    // al refrescar (F5) el primer render trae user=null/authLoading=true →
    // se disparaba el navigate a la página pública del portal y nunca volvíamos
    // al admin aunque la sesión sí existiera. Mismo patrón que el fix B1
    // (TOR-19) para las páginas de torneos.
    if (authLoading) return;
    if (!user) {
      navigate(portalBasePath(portal.nombre_portal) || "/");
      return;
    }
    fetchUsers();
    fetchRooms();
  }, [user, authLoading]);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("partner_users")
      .select("*")
      .eq("portal_id", portal.id)
      .or("is_host.is.null,is_host.eq.false")
      .order("created_at", { ascending: false });
    setUsers((data as PartnerUser[]) || []);
  };

  const fetchRooms = async () => {
    const { data } = await supabase
      .from("live_rooms")
      .select("*")
      .eq("portal_id", portal.id)
      .order("created_at", { ascending: false });
    setRooms((data as LiveRoom[]) || []);
  };

  const handleApprove = async (userId: string) => {
    await supabase.from("partner_users").update({ status: "approved" }).eq("id", userId);
    // C7: notificar al usuario que su cuenta fue aprobada — best-effort.
    supabase.functions.invoke("portal-notifications", {
      body: { event: "approval_granted", portal_id: portal.id, partner_user_id: userId },
    }).catch(() => {});
    toast.success("Usuario aprobado");
    fetchUsers();
  };

  const handleReject = async (userId: string) => {
    await supabase.from("partner_users").update({ status: "rejected" }).eq("id", userId);
    toast.success("Usuario rechazado");
    fetchUsers();
  };

  const handleTierChange = async (userId: string, tier: string) => {
    await supabase.from("partner_users").update({ tier }).eq("id", userId);
    toast.success(`Nivel actualizado a ${tier}`);
    fetchUsers();
  };

  const handleSendCredentials = async (userId: string) => {
    setSendingCredentials(userId);
    try {
      const { data, error } = await supabase.functions.invoke("partner-reset-password", {
        body: { action: "send_credentials", email: userId, portal_id: portal.id, portal_slug: portal.nombre_portal },
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success("Credenciales enviadas por correo electrónico");
      } else {
        toast.error(data?.error || "Error al enviar credenciales");
      }
    } catch (err: any) {
      toast.error("Error al enviar credenciales");
    } finally {
      setSendingCredentials(null);
    }
  };

  const pendingUsers = users.filter(u => u.status === "pending");
  const approvedUsers = users.filter(u => u.status === "approved");

  const baseNavItems: { key: AdminSection; label: string; icon: React.ElementType }[] = [
    { key: "dashboard", label: "Dashboard", icon: Users },
    { key: "live", label: brandText(wl, "Bullfy Live"), icon: Radio },
    { key: "tiers", label: "Clientes/Niveles", icon: Crown },
    { key: "referrals", label: "Panel de referidos", icon: UserPlus },
    { key: "academy", label: "Academy", icon: GraduationCap },
    { key: "classes", label: "Calendario de clases", icon: CalendarClock },
    { key: "events", label: "Eventos", icon: CalendarDays },
    ...(commerceEnabled ? [
      { key: "store" as AdminSection, label: "Tienda", icon: ShoppingCart },
      { key: "memberships" as AdminSection, label: "Gestión de Membresías", icon: BadgeCheck },
    ] : []),
    { key: "wallet", label: "Wallet", icon: Wallet },
    { key: "mlm", label: "MLM", icon: Network },
    { key: "branding", label: "Branding", icon: Paintbrush },
  ];

  const settingsNavItems: { key: AdminSection; label: string; icon: React.ElementType }[] = [
    { key: "mt5-bridge", label: brandText(wl, "Bullfy Trading Room"), icon: Plug },
  ];

  // Insertamos Video Studio + Redes Sociales justo antes de "mlm". Usamos
  // findIndex (no índices fijos) para que el cálculo no se rompa al agregar
  // ítems nuevos a baseNavItems (p. ej. "Panel de referidos").
  const mlmIdx = baseNavItems.findIndex(i => i.key === "mlm");
  const navItems = [
    ...(videoStudioEnabled
      ? [
          ...baseNavItems.slice(0, mlmIdx),
          { key: "video-studio" as AdminSection, label: "Video Studio", icon: Video },
          { key: "social" as AdminSection, label: "Redes Sociales", icon: Share2 },
          ...baseNavItems.slice(mlmIdx),
        ]
      : baseNavItems),
    ...settingsNavItems,
  ];

  const renderNavButtons = (onSelect?: () => void) => {
    const settingsKeys = new Set(settingsNavItems.map(s => s.key));
    return (
      <>
        {navItems.map((item, idx) => {
          const isFirstSettings = settingsKeys.has(item.key) && (idx === 0 || !settingsKeys.has(navItems[idx - 1].key));
          return (
            <div key={item.key}>
              {isFirstSettings && (!sidebarCollapsed || onSelect) && (
                <div className="px-4 pt-3 pb-1 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/70 border-t border-border mt-2">
                  <SettingsIcon className="w-3 h-3" />
                  Configuración
                </div>
              )}
              <button
                onClick={() => { setSection(item.key); onSelect?.(); }}
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors ${
                  section === item.key
                    ? "bg-primary/10 text-primary border-r-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0 ml-1" />
                {(!sidebarCollapsed || onSelect) && <span className="truncate">{item.label}</span>}
              </button>
            </div>
          );
        })}
      </>
    );
  };

  return (
    <PortalBrandProvider value={{ isWhiteLabel: wl }}>
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex ${sidebarCollapsed ? 'w-16' : 'w-60'} border-r border-border bg-card flex-col transition-all duration-200 shrink-0`}>
        {/* Sidebar header */}
        <div className="p-3 border-b border-border flex items-center gap-2">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {branding.logo_url ? (
                <img src={branding.logo_url} alt={portal.display_name} className="h-6 object-contain shrink-0" />
              ) : (
                <Radio className="w-4 h-4 shrink-0" style={{ color: branding.primary_color }} />
              )}
              <span className="font-display font-bold text-foreground text-sm truncate">
                {branding.display_name_override || portal.display_name}
              </span>
            </div>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {renderNavButtons()}
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-border p-2 space-y-1">
          <Button variant="ghost" size="sm" onClick={() => navigate("/live")} className={`w-full justify-start gap-2 ${sidebarCollapsed ? 'px-0 justify-center' : ''}`}>
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            {!sidebarCollapsed && <span>Sistema</span>}
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut} className={`w-full justify-start gap-2 text-destructive hover:text-destructive ${sidebarCollapsed ? 'px-0 justify-center' : ''}`}>
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {!sidebarCollapsed && <span>Salir</span>}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-12 border-b border-border bg-card flex items-center px-3 sm:px-4 gap-2 sm:gap-3">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden shrink-0">
                <Menu className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 flex flex-col">
              <div className="p-3 border-b border-border flex items-center gap-2">
                {branding.logo_url ? (
                  <img src={branding.logo_url} alt={portal.display_name} className="h-6 object-contain" />
                ) : (
                  <Radio className="w-4 h-4" style={{ color: branding.primary_color }} />
                )}
                <span className="font-display font-bold text-foreground text-sm truncate">
                  {branding.display_name_override || portal.display_name}
                </span>
              </div>
              <nav className="flex-1 py-2 overflow-y-auto">
                {renderNavButtons(() => setMobileNavOpen(false))}
              </nav>
              <div className="border-t border-border p-2 space-y-1">
                <Button variant="ghost" size="sm" onClick={() => navigate("/live")} className="w-full justify-start gap-2">
                  <ArrowLeft className="w-3.5 h-3.5" /> <span>Sistema</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start gap-2 text-destructive hover:text-destructive">
                  <LogOut className="w-3.5 h-3.5" /> <span>Salir</span>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <Badge variant="secondary">Admin</Badge>
          <span className="text-xs sm:text-sm text-muted-foreground truncate">
            {navItems.find(n => n.key === section)?.label || "Dashboard"}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        {section === "live" && (
          <div className="space-y-6">
            <LiveDashboard portalId={portal.id} tierStreamsEnabled={tierStreamsEnabled} />
            <div>
              <h2 className="text-xl font-display font-bold text-foreground">{brandText(wl, "Ganancias de Bullfy Live")}</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-3">Tus ganancias por leads y bonos de streaming.</p>
              <PartnerWallet portalId={portal.id} />
            </div>
          </div>
        )}

        {section === "tiers" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground">Clientes/Niveles</h2>
              <p className="text-sm text-muted-foreground mt-1">Gestiona tus clientes y sus niveles General, VIP y Platino</p>
            </div>
            <PartnerTierManager portalId={portal.id} />
          </div>
        )}

        {section === "referrals" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground">Panel de referidos</h2>
              <p className="text-sm text-muted-foreground mt-1">Descubre de parte de quién llega cada usuario y quiénes refieren más. Base para futuras campañas de recompensas por referidos.</p>
            </div>
            <PartnerReferralsAdmin portalId={portal.id} />
          </div>
        )}

        {section === "academy" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground">Academy</h2>
              <p className="text-sm text-muted-foreground mt-1">Gestiona cursos, módulos y lecciones de tu portal</p>
            </div>
            <AcademyAdmin portalId={portal.id} commerceEnabled={commerceEnabled} />
          </div>
        )}

        {section === "events" && (
          <PortalEventsAdmin portalId={portal.id} commerceEnabled={commerceEnabled} />
        )}

        {section === "classes" && (
          <PortalClassesAdmin portalId={portal.id} />
        )}

        {section === "store" && commerceEnabled && (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground">{brandText(wl, "Bullfy eCommerce")}</h2>
              <p className="text-sm text-muted-foreground mt-1">Gestiona tu tienda digital, productos, órdenes y dispersión de ingresos</p>
            </div>
            <PortalStoreAdmin portalId={portal.id} />
          </div>
        )}

        {section === "memberships" && commerceEnabled && (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground">Gestión de Membresías</h2>
              <p className="text-sm text-muted-foreground mt-1">Controla los vencimientos de las membresías y crea campañas de recordatorio automáticas.</p>
            </div>
            <PortalMembershipsAdmin portalId={portal.id} />
          </div>
        )}

        {section === "wallet" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground">Wallet</h2>
              <p className="text-sm text-muted-foreground mt-1">Tus ingresos por ventas, Academy, eventos y red — y tus retiros</p>
            </div>
            {hostPartnerUserId ? (
              <MLMClient
                portalId={portal.id}
                portalSlug={portal.nombre_portal}
                userId={hostPartnerUserId}
                userName={user?.user_metadata?.full_name || user?.email || "IB"}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Cargando tu wallet…</p>
            )}
          </div>
        )}

        {section === "mlm" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground">MLM</h2>
              <p className="text-sm text-muted-foreground mt-1">Sistema multinivel uni-nivel: niveles, comisiones, pool y refund window</p>
            </div>
            <MLMConfigAdmin portalId={portal.id} />
          </div>
        )}

        {section === "branding" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground">Branding del Portal</h2>
              <p className="text-sm text-muted-foreground mt-1">Personaliza colores, logo y apariencia de tu portal</p>
            </div>
            <PortalBrandingConfig portalId={portal.id} portalSlug={portal.nombre_portal} />
            <RecordingToClassToggle portalId={portal.id} />
          </div>
        )}

        {section === "video-studio" && videoStudioEnabled && (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground">AI Video Studio</h2>
              <p className="text-sm text-muted-foreground mt-1">Crea clips virales con IA y publícalos en tus redes sociales</p>
            </div>
            <VideoStudioDashboard portalId={portal.id} />
          </div>
        )}

        {section === "social" && videoStudioEnabled && (
          <div className="space-y-6">
            <SocialCredentialsConfig portalId={portal.id} />
            <PortalVideoBrandConfig portalId={portal.id} />
            <PortalBrollLibrary portalId={portal.id} />
          </div>
        )}

        {section === "mt5-bridge" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground">{brandText(wl, "Bullfy Trading Room")}</h2>
              <p className="text-sm text-muted-foreground mt-1">Conecta y gestiona tu cuenta MT5, copy-trading e IA. Acceso completo gratuito para hosts del portal.</p>
            </div>
            {hostPartnerUserId && user?.email ? (
              <BullfyTradingRoom
                portalId={portal.id}
                userId={hostPartnerUserId}
                userName={user.user_metadata?.full_name || user.email}
                isHost={true}
              />
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Inicializando host…
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {section === "dashboard" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6 flex items-center gap-3">
                  <Users className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{approvedUsers.length}</p>
                    <p className="text-sm text-muted-foreground">Clientes Activos</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 flex items-center gap-3">
                  <Users className="w-5 h-5 text-yellow-500" />
                  <div>
                    <p className="text-2xl font-bold">{pendingUsers.length}</p>
                    <p className="text-sm text-muted-foreground">Pendientes</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 flex items-center gap-3">
                  <Radio className="w-5 h-5 text-destructive" />
                  <div>
                    <p className="text-2xl font-bold">{rooms.filter(r => r.status === "live").length}</p>
                    <p className="text-sm text-muted-foreground">Streams Activos</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-2">
                  <Link className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Link de Registro</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">Comparte este link con tus clientes para que se registren en tu portal</p>
                <div className="flex items-center gap-2">
                  <Input value={registrationUrl} readOnly className="text-sm bg-secondary/50" />
                  <Button size="sm" variant="outline" onClick={handleCopyLink} className="gap-1.5 shrink-0">
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copiado" : "Copiar"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <BullfyReferralLinkCard portalId={portal.id} />
            {pendingUsers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Solicitudes Pendientes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingUsers.map(u => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.nombre}</TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleApprove(u.id)} className="gap-1">
                                <CheckCircle className="w-3 h-3" /> Aprobar
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleReject(u.id)} className="gap-1">
                                <XCircle className="w-3 h-3" /> Rechazar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Clientes del Portal</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                     <TableRow>
                        <TableHead>Nombre</TableHead>
                       <TableHead>Email</TableHead>
                       <TableHead>Estado</TableHead>
                       <TableHead>Nivel</TableHead>
                       <TableHead>Registro</TableHead>
                       <TableHead>Acciones</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {users.map(u => (
                       <TableRow key={u.id}>
                         <TableCell className="font-medium">{u.nombre}</TableCell>
                         <TableCell>{u.email}</TableCell>
                         <TableCell>
                           <Badge variant={u.status === "approved" ? "default" : u.status === "pending" ? "secondary" : "destructive"}>
                             {u.status === "approved" ? "Activo" : u.status === "pending" ? "Pendiente" : "Rechazado"}
                           </Badge>
                         </TableCell>
                         <TableCell>
                           <Select value={u.tier} onValueChange={(v) => handleTierChange(u.id, v)}>
                             <SelectTrigger className="h-8 w-28 text-xs">
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="general">General</SelectItem>
                               <SelectItem value="vip">VIP</SelectItem>
                               <SelectItem value="platino">Platino</SelectItem>
                             </SelectContent>
                           </Select>
                         </TableCell>
                         <TableCell className="text-sm text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                         <TableCell>
                           <Button
                             size="sm"
                             variant="outline"
                             className="gap-1.5"
                             disabled={sendingCredentials === u.id}
                             onClick={() => handleSendCredentials(u.id)}
                           >
                             {sendingCredentials === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                             {sendingCredentials === u.id ? "Enviando..." : "Enviar Credenciales"}
                           </Button>
                         </TableCell>
                       </TableRow>
                     ))}
                     {users.length === 0 && (
                       <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No hay clientes registrados</TableCell></TableRow>
                     )}
                   </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
        </div>
      </div>
    </div>
    </PortalBrandProvider>
  );
};

export default PartnerAdminLayout;
