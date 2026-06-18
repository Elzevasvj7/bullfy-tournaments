import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toastUtils";
import { Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PasswordInput } from "@/components/shared/PasswordInput";

interface Props {
  open: boolean;
  onComplete: () => void;
}

/**
 * Forced password change dialog — shown when must_change_password is true.
 * Different from shared/ChangePasswordDialog which is voluntary.
 */
const ForcedChangePasswordDialog = ({ open, onComplete }: Props) => {
  const { refetchProfile } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error("Error al cambiar contraseña: " + error.message);
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ must_change_password: false }).eq("id", user.id);
    }

    await refetchProfile();
    toast.success("Contraseña actualizada exitosamente");
    setLoading(false);
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            Cambiar Contraseña
          </DialogTitle>
          <DialogDescription>
            Por seguridad, debes cambiar tu contraseña temporal antes de continuar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="forced-new-password">Nueva contraseña</Label>
            <PasswordInput
              id="forced-new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="forced-confirm-password">Confirmar contraseña</Label>
            <PasswordInput
              id="forced-confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
            />
          </div>
          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? "Guardando..." : "Cambiar Contraseña"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ForcedChangePasswordDialog;
