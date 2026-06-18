import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { toast } from "@/hooks/use-toast";
import { UserPlus } from "lucide-react";
import logoSrc from "@/assets/logo-bullfy.png";
import { LoginMarketNetwork } from "@/components/shared/LoginMarketNetwork";

const Registro = () => {
  const navigate = useNavigate();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNombre = nombre.trim();
    const trimmedEmail = email.trim();
    if (!trimmedNombre || trimmedNombre.length > 100) {
      toast({ title: "Error", description: "El nombre debe tener entre 1 y 100 caracteres", variant: "destructive" });
      return;
    }
    if (!trimmedEmail || trimmedEmail.length > 255) {
      toast({ title: "Error", description: "Correo inválido", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Las contraseñas no coinciden", variant: "destructive" });
      return;
    }
    if (password.length < 8) {
      toast({ title: "Error", description: "La contraseña debe tener al menos 8 caracteres", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: { data: { nombre: trimmedNombre } },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Error de registro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Registro exitoso", description: "Tu cuenta está pendiente de aprobación por un administrador." });
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative isolate overflow-hidden">
      <LoginMarketNetwork />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.24),transparent_38%),linear-gradient(180deg,hsl(var(--background)/0.62)_0%,hsl(var(--background)/0.48)_46%,hsl(var(--background)/0.74)_100%)]" />
      <div className="w-full max-w-md bg-gradient-card/88 backdrop-blur-sm rounded-xl border border-border shadow-card p-8 space-y-6 relative z-10">
        <div className="text-center space-y-3">
          <img src={logoSrc} alt="Bullfy" className="h-10 mx-auto" />
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">REGISTRO DE BUSINESS DEVELOPER</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre completo</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tu nombre completo"
              maxLength={100}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Correo electrónico</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              maxLength={255}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Contraseña</Label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              required
              minLength={8}
            />
          </div>
          <div className="space-y-2">
            <Label>Confirmar contraseña</Label>
            <PasswordInput
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite tu contraseña"
              required
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-gold text-primary-foreground font-semibold shadow-gold hover:opacity-90 gap-2"
          >
            <UserPlus className="w-4 h-4" />
            {loading ? "Registrando..." : "Registrarse"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="text-primary hover:underline font-medium">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Registro;
