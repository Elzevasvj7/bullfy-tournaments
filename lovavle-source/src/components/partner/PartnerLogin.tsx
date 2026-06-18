import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/lib/toastUtils";
import { Radio, LogIn, UserPlus, Loader2 } from "lucide-react";
import { usePortalBranding, usePortalBrandingCss, usePortalFavicon, dimHex } from "@/hooks/usePortalBranding";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { portalBasePath } from "@/lib/portalRouting";
import PartnerRegisterForm from "./PartnerRegisterForm";
import { LoginMarketNetwork, hexToRgba } from "@/components/shared/LoginMarketNetwork";

interface PartnerLoginProps {
  portal: { id: string; nombre_portal: string; display_name: string; ib_id: string };
}

const PartnerLogin = ({ portal }: PartnerLoginProps) => {
  const navigate = useNavigate();
  const { branding, loading: brandingLoading } = usePortalBranding(portal.id);
  usePortalBrandingCss(branding);
  usePortalFavicon(portal.nombre_portal, branding.logo_url);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleSystemLogin = async () => {
    setLoading(true);
    const normalizedEmail = loginEmail.trim().toLowerCase();

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: loginPassword,
    });

    if (error) {
      await handlePartnerLogin(normalizedEmail);
    } else if (authData.user) {
      // Master Admin (global_admin) tiene acceso completo a todos los portales
      const { data: isGlobalAdmin } = await supabase.rpc("has_role", {
        _user_id: authData.user.id,
        _role: "global_admin",
      });

      if (!isGlobalAdmin) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("ib_id")
          .eq("id", authData.user.id)
          .single();

        if (profile?.ib_id !== portal.ib_id) {
          await supabase.auth.signOut();
          toast.error("No tienes acceso a este portal");
          setLoading(false);
          return;
        }
      }
      navigate(`${portalBasePath(portal.nombre_portal)}/admin`);
    }
    setLoading(false);
  };

  const handlePartnerLogin = async (normalizedEmail: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("partner-portal-login", {
        body: {
          portal_id: portal.id,
          email: normalizedEmail,
          password: loginPassword,
        },
      });

      if (error) {
        toast.error("No se pudo validar el acceso. Intenta nuevamente.");
        return;
      }

      if (!data?.ok || !data?.user) {
        toast.error(data?.error || "Credenciales inválidas");
        return;
      }

      sessionStorage.setItem(`partner_session_${portal.id}`, JSON.stringify({
        userId: data.user.id,
        nombre: data.user.nombre,
        portalId: portal.id,
      }));
      navigate(`${portalBasePath(portal.nombre_portal)}/app`);
    } catch {
      toast.error("No se pudo validar el acceso. Intenta nuevamente.");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    await supabase.functions.invoke("partner-reset-password", {
      body: { action: "request", email: forgotEmail.trim().toLowerCase(), portal_id: portal.id, portal_slug: portal.nombre_portal },
    });
    setForgotLoading(false);
    toast.success("Si el correo está registrado, recibirás un enlace de recuperación.");
    setForgotMode(false);
  };

  const displayName = branding.display_name_override || portal.display_name;

  // Evita el FOUC (flash azul Bullfy → color de marca): no pintamos el login
  // con los colores DEFAULT mientras el branding del portal aún se resuelve.
  // En visitas repetidas el branding viene del cache (localStorage) y esto es
  // instantáneo; en la primera visita se ve un breve spinner neutro —
  // continuo con el spinner de carga del portal— en vez del azul incorrecto.
  // El fondo usa --background, que para portales con branding conocido ya fue
  // fijado por el bootstrap inline de index.html antes del primer paint.
  if (brandingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative isolate overflow-hidden">
      <LoginMarketNetwork primaryColor={branding.primary_color} />

      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${hexToRgba(branding.primary_color, 0.1)} 0%, rgba(4,10,22,0.14) 42%, rgba(3,8,18,0.38) 100%)`,
          zIndex: 0,
        }}
      />

      <div className="w-full max-w-md space-y-6 relative z-10 animate-fade-in">
        <div className="text-center space-y-3">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt={displayName} className="h-28 mx-auto object-contain" />
          ) : (
            <Radio className="w-20 h-20 mx-auto" style={{ color: branding.primary_color }} />
          )}
          <h1 className="text-3xl font-display font-bold text-white">{displayName}</h1>
        </div>

        <Card className="border border-white/10 bg-card/95 backdrop-blur-md shadow-2xl">
          <CardContent className="pt-6">
            <Tabs defaultValue="login">
              <TabsList className="w-full">
                <TabsTrigger value="login" className="flex-1 gap-1"><LogIn className="w-3 h-3" /> Ingresar</TabsTrigger>
                <TabsTrigger value="register" className="flex-1 gap-1"><UserPlus className="w-3 h-3" /> Registrarse</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-4 mt-4">
                {forgotMode ? (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <p className="text-sm text-muted-foreground">Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.</p>
                    <div><Label>Email</Label><Input value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} type="email" placeholder="tu@email.com" required /></div>
                    <Button type="submit" className="w-full text-white" style={{ backgroundColor: dimHex(branding.primary_color, 0.7) }} disabled={forgotLoading}>
                      {forgotLoading ? "Enviando..." : "Enviar enlace de recuperación"}
                    </Button>
                    <p className="text-center">
                      <button type="button" onClick={() => setForgotMode(false)} className="text-sm text-primary hover:underline">Volver al inicio de sesión</button>
                    </p>
                  </form>
                ) : (
                  <>
                    <div><Label>Email</Label><Input value={loginEmail} onChange={e => setLoginEmail(e.target.value)} type="email" placeholder="tu@email.com" /></div>
                    <div><Label>Contraseña</Label><PasswordInput value={loginPassword} onChange={e => setLoginPassword(e.target.value)} /></div>
                    <Button
                      className="w-full text-white"
                      style={{ backgroundColor: dimHex(branding.primary_color, 0.7) }}
                      onClick={handleSystemLogin}
                      disabled={loading}
                    >
                      {loading ? "Ingresando..." : "Ingresar"}
                    </Button>
                    <p className="text-center">
                      <button type="button" onClick={() => { setForgotMode(true); setForgotEmail(loginEmail); }} className="text-xs text-primary hover:underline">
                        ¿Olvidaste tu contraseña?
                      </button>
                    </p>
                  </>
                )}
              </TabsContent>

              <TabsContent value="register" className="mt-4">
                <PartnerRegisterForm portalId={portal.id} primaryColor={branding.primary_color} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PartnerLogin;
