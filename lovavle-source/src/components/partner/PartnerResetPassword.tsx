import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/lib/toastUtils";
import { KeyRound, CheckCircle } from "lucide-react";
import { usePortalBranding, usePortalBrandingCss, usePortalFavicon, dimHex } from "@/hooks/usePortalBranding";
import { portalBasePath } from "@/lib/portalRouting";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { LoginMarketNetwork, hexToRgba } from "@/components/shared/LoginMarketNetwork";

interface PartnerResetPasswordProps {
  portal: { id: string; nombre_portal: string; display_name: string };
}

const PartnerResetPassword = ({ portal }: PartnerResetPasswordProps) => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { branding } = usePortalBranding(portal.id);
  usePortalBrandingCss(branding);
  usePortalFavicon(portal.nombre_portal, branding.logo_url);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const displayName = branding.display_name_override || portal.display_name;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);

    const { data, error } = await supabase.functions.invoke("partner-reset-password", {
      body: { action: "reset", token, new_password: password },
    });

    setLoading(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Error al restablecer contraseña");
    } else {
      setSuccess(true);
    }
  };

  if (!token) {
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
        <Card className="w-full max-w-md border-0 shadow-2xl relative z-10">
          <CardContent className="pt-6 text-center space-y-4">
            <h2 className="text-xl font-bold">Enlace inválido</h2>
            <p className="text-muted-foreground">Este enlace de recuperación no es válido.</p>
            <a href={portalBasePath(portal.nombre_portal) || "/"} className="text-primary hover:underline text-sm">
              Volver al inicio de sesión
            </a>
          </CardContent>
        </Card>
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
      <div className="w-full max-w-md space-y-6 relative z-10">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-display font-bold text-white">{displayName}</h1>
          <p className="text-sm text-white/60">Restablecer contraseña</p>
        </div>

        <Card className="border-0 shadow-2xl">
          <CardContent className="pt-6">
            {success ? (
              <div className="text-center space-y-4 py-4">
                <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
                <h3 className="text-lg font-semibold">¡Contraseña actualizada!</h3>
                <p className="text-sm text-muted-foreground">Ya puedes iniciar sesión con tu nueva contraseña.</p>
                <a href={portalBasePath(portal.nombre_portal) || "/"}>
                  <Button className="w-full text-white" style={{ backgroundColor: dimHex(branding.primary_color, 0.7) }}>
                    Ir al inicio de sesión
                  </Button>
                </a>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <Label>Nueva contraseña</Label>
                  <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} />
                </div>
                <div>
                  <Label>Confirmar contraseña</Label>
                  <PasswordInput value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repite tu contraseña" required />
                </div>
                <Button type="submit" disabled={loading} className="w-full text-white gap-2" style={{ backgroundColor: dimHex(branding.primary_color, 0.7) }}>
                  <KeyRound className="w-4 h-4" />
                  {loading ? "Actualizando..." : "Cambiar contraseña"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PartnerResetPassword;
