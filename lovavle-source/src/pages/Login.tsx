import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { toast } from "@/hooks/use-toast";
import { LogIn } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import logoSrc from "@/assets/logo-bullfy.png";
import { LoginMarketNetwork } from "@/components/shared/LoginMarketNetwork";
import { MOCK_AUTH_ENABLED } from "@/lib/mockAuth";

const Login = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isApproved } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      if (isApproved) {
        navigate("/", { replace: true });
      } else {
        navigate("/pendiente", { replace: true });
      }
    }
  }, [user, authLoading, isApproved, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Error de autenticación", description: error.message, variant: "destructive" });
    } else {
      navigate("/");
    }
  };

  const handleMockLogin = () => {
    navigate("/", { replace: true });
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    const siteUrl = import.meta.env.VITE_SUPABASE_URL
      ? "https://bullfyibsystem.lovable.app"
      : window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${siteUrl}/reset-password`,
    });
    setForgotLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Email enviado", description: "Revisa tu bandeja de entrada para restablecer tu contraseña" });
      setForgotMode(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative isolate overflow-hidden">
      <LoginMarketNetwork />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.24),transparent_38%),linear-gradient(180deg,hsl(var(--background)/0.62)_0%,hsl(var(--background)/0.48)_46%,hsl(var(--background)/0.74)_100%)]" />
      <div className="w-full max-w-md bg-gradient-card/88 backdrop-blur-sm rounded-xl border border-border shadow-card p-8 space-y-6 relative z-10">
        <div className="text-center space-y-3">
          <img src={logoSrc} alt="Bullfy" className="h-32 mx-auto" />
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">IB AUTOMATED SYSTEM</p>
        </div>

        {forgotMode ? (
          <>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label>Correo electrónico</Label>
                <Input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={forgotLoading}
                className="w-full bg-gradient-gold text-primary-foreground font-semibold shadow-gold hover:opacity-90"
              >
                {forgotLoading ? "Enviando..." : "Enviar enlace de recuperación"}
              </Button>
            </form>
            <p className="text-center text-sm text-muted-foreground">
              <button onClick={() => setForgotMode(false)} className="text-primary hover:underline font-medium">
                Volver al inicio de sesión
              </button>
            </p>
          </>
        ) : (
          <>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label>Correo electrónico</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Contraseña</Label>
                  <button
                    type="button"
                    onClick={() => { setForgotMode(true); setForgotEmail(email); }}
                    className="text-xs text-primary hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-gold text-primary-foreground font-semibold shadow-gold hover:opacity-90 gap-2"
              >
                <LogIn className="w-4 h-4" />
                {loading ? "Ingresando..." : "Iniciar sesión"}
              </Button>
            </form>

            {MOCK_AUTH_ENABLED ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleMockLogin}
              >
                Entrar en modo mock
              </Button>
            ) : null}

            <p className="text-center text-sm text-muted-foreground">
              ¿Eres Business Developer?{" "}
              <Link to="/registro" className="text-primary hover:underline font-medium">
                Regístrate aquí
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default Login;
