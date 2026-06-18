import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Crown, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Radio, LogOut, Eye, Users, GraduationCap, Network, Rocket, ShoppingCart, CalendarDays, CalendarClock, UserCircle2 } from "lucide-react";
import { usePortalBranding, usePortalBrandingCss, usePortalFavicon, isWhiteLabelPortal } from "@/hooks/usePortalBranding";
import { PortalBrandProvider, brandText } from "@/lib/portalBrand";
import { portalBasePath } from "@/lib/portalRouting";
import AcademyClient from "@/components/partner/AcademyClient";
import PortalStoreClient from "@/components/partner/PortalStoreClient";
import BullfyTradingRoom from "@/components/partner/BullfyTradingRoom";
import MLMClient from "@/components/partner/MLMClient";
import PartnerProfileSection from "@/components/partner/PartnerProfileSection";
import PortalEventsClient from "@/components/partner/PortalEventsClient";
import PortalClassesClient from "@/components/partner/PortalClassesClient";

interface PartnerClientLayoutProps {
  portal: { id: string; nombre_portal: string; display_name: string };
}

interface LiveRoom {
  id: string;
  title: string;
  description: string | null;
  status: string;
  viewer_count: number;
  livekit_room_name: string;
  required_tiers: string[] | null;
}

type ClientSection = "perfil" | "live" | "trading" | "store" | "academy" | "clases" | "eventos" | "mlm";

const ComingSoon = () => (
  <Card>
    <CardContent className="py-16 text-center">
      <Rocket className="w-14 h-14 mx-auto text-primary mb-4 animate-bounce" />
      <h3 className="text-xl font-display font-bold text-foreground mb-2">Estamos por lanzar cosas asombrosas</h3>
      <p className="text-muted-foreground text-sm">Esta sección estará disponible muy pronto. ¡Mantente atento!</p>
    </CardContent>
  </Card>
);

const PartnerClientLayout = ({ portal }: PartnerClientLayoutProps) => {
  const navigate = useNavigate();
  const { branding } = usePortalBranding(portal.id);
  usePortalBrandingCss(branding);
  usePortalFavicon(portal.nombre_portal, branding.logo_url);
  const [session, setSession] = useState<{ userId: string; nombre: string } | null>(null);
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [section, setSection] = useState<ClientSection>("perfil");
  const [userTier, setUserTier] = useState<string>("general");
  const [commerceEnabled, setCommerceEnabled] = useState(false);
  // MLM activado para esta cuenta: hoy se gobierna con can_be_business_partner
  // (lo marca Bullfy en /usuarios). Si es false, se ocultan el botón MLM y el
  // link de referido del perfil.
  const [mlmEnabled, setMlmEnabled] = useState(false);
  const [userProfile, setUserProfile] = useState<{ email: string; avatar_url: string | null } | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(`partner_session_${portal.id}`);
    if (!stored) {
      navigate(portalBasePath(portal.nombre_portal) || "/");
      return;
    }
    setSession(JSON.parse(stored));
    const parsed = JSON.parse(stored);
    fetchRooms();
    // Fetch user tier and commerce access
    supabase
      .from("partner_users")
      .select("tier, email, avatar_url, can_be_business_partner")
      .eq("id", parsed.userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.tier) setUserTier(data.tier);
        if (data) setUserProfile({ email: (data as any).email ?? "", avatar_url: (data as any).avatar_url ?? null });
        setMlmEnabled((data as any)?.can_be_business_partner === true);
      });
    // Check commerce enabled via portal's ib_id
    supabase
      .from("partner_portals")
      .select("ib_id")
      .eq("id", portal.id)
      .maybeSingle()
      .then(async ({ data: portalData }) => {
        if (portalData?.ib_id) {
          const { data: commerceData } = await supabase
            .from("portal_commerce_access")
            .select("enabled")
            .eq("ib_id", portalData.ib_id)
            .maybeSingle();
          setCommerceEnabled(commerceData?.enabled === true);
        }
      });
  }, []);

  const fetchRooms = async () => {
    const { data } = await supabase
      .from("live_rooms")
      .select("id, title, description, status, viewer_count, livekit_room_name, required_tiers")
      .eq("portal_id", portal.id)
      .in("status", ["live", "waiting"]);
    setRooms((data as LiveRoom[]) || []);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(`partner_session_${portal.id}`);
    navigate(`/partner/${portal.nombre_portal}`);
  };

  if (!session) return null;

  const wl = isWhiteLabelPortal(portal.nombre_portal);

  const navItems: { key: ClientSection; label: string; icon: React.ElementType; highlight?: boolean }[] = [
    { key: "perfil", label: "Mi Perfil", icon: UserCircle2, highlight: true },
    { key: "live", label: brandText(wl, "Bullfy Live"), icon: Radio },
    { key: "trading", label: "Trading Room", icon: Crown },
    ...(commerceEnabled ? [{ key: "store" as ClientSection, label: "Tienda", icon: ShoppingCart }] : []),
    { key: "academy", label: "Academy", icon: GraduationCap },
    { key: "clases", label: "Calendario de clases", icon: CalendarClock },
    { key: "eventos", label: "Eventos", icon: CalendarDays },
    ...(mlmEnabled ? [{ key: "mlm" as ClientSection, label: "MLM", icon: Network }] : []),
  ];

  return (
    <PortalBrandProvider value={{ isWhiteLabel: wl }}>
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card shrink-0">
        <div className="px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt={portal.display_name} className="h-12 sm:h-14 object-contain shrink-0" />
            ) : (
              <Radio className="w-5 h-5 shrink-0" style={{ color: branding.primary_color }} />
            )}
            <h1 className="font-display font-bold text-foreground text-sm sm:text-base truncate">
              {branding.display_name_override || portal.display_name}
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline truncate max-w-[160px]">Hola, {session.nombre}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1 px-2">
              <LogOut className="w-3 h-3" /> <span className="hidden sm:inline">Salir</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-14 sm:w-52 border-r border-border bg-card/50 flex flex-col shrink-0">
          {navItems.map((item, idx) => {
            const active = section === item.key;
            const isPerfil = item.key === "perfil";
            return (
              <div key={item.key}>
                {idx === 1 && <div className="border-t border-border mx-2 my-1" />}
                <button
                  onClick={() => setSection(item.key)}
                  className={`flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-medium transition-colors border-l-2 w-full text-left ${
                    active
                      ? "border-primary text-primary bg-primary/5"
                      : isPerfil
                        ? "border-transparent text-foreground hover:bg-muted/40 bg-muted/20"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  {isPerfil ? (
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden border border-primary/30">
                      {userProfile?.avatar_url ? (
                        <img src={userProfile.avatar_url} alt={session.nombre} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[9px] font-bold text-primary">
                          {session.nombre.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <item.icon className={`w-4 h-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  )}
                  <span className={`hidden sm:inline truncate ${isPerfil ? "font-semibold" : ""}`}>{item.label}</span>
                </button>
              </div>
            );
          })}
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        {section === "live" && (
          <>
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground">Streams en Vivo</h2>
              <p className="text-sm text-muted-foreground mt-1">Sesiones disponibles para ti</p>
            </div>

            {rooms.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rooms.map(room => {
                  const hasTierRestriction = room.required_tiers && room.required_tiers.length > 0;
                  const userHasAccess = !hasTierRestriction || room.required_tiers!.includes(userTier);
                  const tierLabels: Record<string, string> = { general: "General", vip: "VIP", platino: "Platino" };

                  return (
                    <Card key={room.id} className={userHasAccess ? "border-destructive/30" : "border-border opacity-75"}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center justify-between">
                          {room.title}
                          <div className="flex items-center gap-1.5">
                            {hasTierRestriction && (
                              <Badge variant="outline" className="text-[10px] gap-1">
                                {userHasAccess ? <Shield className="w-2.5 h-2.5 text-blue-500" /> : <Lock className="w-2.5 h-2.5" />}
                                {room.required_tiers!.map(t => tierLabels[t] || t).join(" · ")}
                              </Badge>
                            )}
                            {room.status === "live" ? (
                              <Badge variant="destructive" className="text-xs animate-pulse">EN VIVO</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs animate-pulse">SALA DE ESPERA</Badge>
                            )}
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {room.description && <p className="text-sm text-muted-foreground mb-3">{room.description}</p>}
                        {userHasAccess ? (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Users className="w-3 h-3" /> {room.viewer_count} viewers
                            </span>
                            <Button
                              size="sm"
                              className="gap-1"
                              onClick={() => {
                                const params = new URLSearchParams({
                                  room: room.id,
                                  portalUser: "true",
                                  name: session!.nombre,
                                  portalId: portal.id,
                                  partnerUserId: session!.userId,
                                  returnUrl: `${portalBasePath(portal.nombre_portal)}/app`,
                                });
                                navigate(`/live/guest?${params.toString()}`);
                              }}
                            >
                              <Eye className="w-3 h-3" /> Ver Stream
                            </Button>
                          </div>
                        ) : (
                          <div className="text-center py-2">
                            <Lock className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                            <p className="text-xs text-muted-foreground">Contenido exclusivo para miembros {room.required_tiers!.map(t => tierLabels[t] || t).join(" / ")}</p>
                            <p className="text-xs text-primary mt-1">Contacta al administrador para mejorar tu membresía</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Radio className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No hay streams en vivo en este momento</p>
                  <p className="text-sm text-muted-foreground mt-1">Vuelve más tarde para ver contenido en vivo</p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {section === "trading" && session && (
          <BullfyTradingRoom portalId={portal.id} userId={session.userId} userName={session.nombre} />
        )}

        {section === "store" && commerceEnabled && session && (
          <PortalStoreClient portalId={portal.id} userId={session.userId} userName={session.nombre} />
        )}

        {section === "academy" && session && (
          <AcademyClient portalId={portal.id} userId={session.userId} userName={session.nombre} commerceEnabled={commerceEnabled} />
        )}

        {section === "eventos" && session && (
          <PortalEventsClient
            portalId={portal.id}
            userId={session.userId}
            userTier={userTier}
            commerceEnabled={commerceEnabled}
          />
        )}

        {section === "clases" && session && (
          <PortalClassesClient
            portalId={portal.id}
            userId={session.userId}
            userTier={userTier}
          />
        )}

        {section === "mlm" && session && mlmEnabled && (
          <MLMClient
            portalId={portal.id}
            portalSlug={portal.nombre_portal}
            userId={session.userId}
            userName={session.nombre}
          />
        )}

        {section === "perfil" && session && userProfile && (
          <PartnerProfileSection
            userId={session.userId}
            userName={session.nombre}
            email={userProfile.email}
            portalId={portal.id}
            portalSlug={portal.nombre_portal}
            avatarUrl={userProfile.avatar_url}
            showReferral={mlmEnabled}
            onAvatarChange={url => setUserProfile(prev => prev ? { ...prev, avatar_url: url } : null)}
          />
        )}
        </div>
        </main>
      </div>
    </div>
    </PortalBrandProvider>
  );
};

export default PartnerClientLayout;
