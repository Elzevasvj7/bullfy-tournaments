import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Clock, LogOut } from "lucide-react";

const PendingApproval = () => {
  const { signOut, profile, loading, isApproved, user } = useAuth();
  const navigate = useNavigate();

  // Redirect to dashboard if user is actually approved
  useEffect(() => {
    if (!loading && user && isApproved) {
      navigate("/", { replace: true });
    }
    if (!loading && !user) {
      navigate("/login", { replace: true });
    }
  }, [loading, user, isApproved, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gradient-card rounded-xl border border-border shadow-card p-8 space-y-6 text-center">
        <Clock className="w-16 h-16 text-primary mx-auto" />
        <h1 className="text-2xl font-display font-bold text-foreground">Cuenta pendiente de aprobación</h1>
        <p className="text-muted-foreground">
          Hola <span className="text-foreground font-medium">{profile?.nombre}</span>, tu cuenta ha sido registrada exitosamente.
          Un administrador debe aprobar tu acceso antes de que puedas usar el sistema.
        </p>
        <Button variant="outline" onClick={handleSignOut} className="gap-2">
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
};

export default PendingApproval;
