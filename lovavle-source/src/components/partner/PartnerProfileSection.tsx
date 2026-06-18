import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Camera, Loader2, Link2, Copy, Check } from "lucide-react";
import { toast } from "@/lib/toastUtils";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { portalBasePath } from "@/lib/portalRouting";

interface Props {
  userId: string;
  userName: string;
  email: string;
  portalId: string;
  portalSlug: string;
  avatarUrl: string | null;
  showReferral?: boolean;   // solo cuentas con MLM activado ven el link de referido
  onAvatarChange: (url: string) => void;
}

const PartnerProfileSection = ({ userId, userName, email, portalId, portalSlug, avatarUrl, showReferral = false, onAvatarChange }: Props) => {
  const [uploading, setUploading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const base = `${window.location.origin}${portalBasePath(portalSlug) || "/"}`;
  // Referido simple (NO MLM): disponible para TODOS los usuarios. Solo registra
  // de parte de quién llega cada nuevo usuario (lo ve el IB en su panel).
  const referralLink = `${base}?invite=${userId}`;
  // Link MLM: solo para cuentas con MLM activado. Vincula al nuevo usuario en la
  // red MLM del referidor (comisiones por niveles). Es "otra cosa".
  const mlmLink = `${base}?ref=${userId}`;

  const handleCopy = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`${label} copiado`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const initials = userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Solo se permiten imágenes"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("La imagen no puede superar 2MB"); return; }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", userId);

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/partner-upload-avatar`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: formData,
        }
      );

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Error al subir");

      onAvatarChange(data.publicUrl);
      toast.success("Foto de perfil actualizada");
    } catch (err: any) {
      toast.error("Error al subir la foto: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error("Las contraseñas no coinciden"); return; }
    if (newPassword.length < 6) { toast.error("La contraseña debe tener al menos 6 caracteres"); return; }

    setSavingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke("partner-reset-password", {
        body: {
          action: "change_password_self",
          email,
          portal_id: portalId,
          current_password: currentPassword,
          new_password: newPassword,
        },
      });

      if (error || !data?.ok) {
        toast.error(data?.error || "La contraseña actual no es correcta");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Contraseña actualizada correctamente");
    } catch (err: any) {
      toast.error("Error al cambiar la contraseña: " + err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">Mi Perfil</h2>
        <p className="text-sm text-muted-foreground mt-1">Configura tu foto y contraseña</p>
      </div>

      {/* Avatar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Foto de perfil</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-5">
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center border-2 border-border">
              {avatarUrl ? (
                <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-primary">{initials}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {uploading
                ? <Loader2 className="w-3.5 h-3.5 text-black animate-spin" />
                : <Camera className="w-3.5 h-3.5 text-black" />
              }
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{userName}</p>
            <p className="text-sm text-muted-foreground truncate">{email}</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-xs text-primary hover:underline mt-1 disabled:opacity-50"
            >
              {uploading ? "Subiendo..." : "Cambiar foto"}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Link de referido simple — SIEMPRE visible (todos los usuarios) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            Link de referido
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">Comparte este link para invitar personas al portal. Cuando alguien se registre con él, el administrador sabrá que llegó de tu parte.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted rounded px-3 py-2 truncate font-mono text-muted-foreground">
              {referralLink}
            </code>
            <Button size="sm" variant="outline" onClick={() => handleCopy(referralLink, "ref", "Link de referido")} className="shrink-0 gap-1.5">
              {copiedKey === "ref" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedKey === "ref" ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Link MLM — solo para cuentas con MLM activado (otra cosa: red de comisiones) */}
      {showReferral && (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            Link de red MLM
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">Link de tu red MLM. Quien se registre con este link quedará vinculado a ti para comisiones por niveles. Es distinto al link de referido.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted rounded px-3 py-2 truncate font-mono text-muted-foreground">
              {mlmLink}
            </code>
            <Button size="sm" variant="outline" onClick={() => handleCopy(mlmLink, "mlm", "Link MLM")} className="shrink-0 gap-1.5">
              {copiedKey === "mlm" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedKey === "mlm" ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Password */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cambiar contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current-pwd">Contraseña actual</Label>
              <PasswordInput
                id="current-pwd"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Tu contraseña actual"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pwd">Nueva contraseña</Label>
              <PasswordInput
                id="new-pwd"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-pwd">Confirmar contraseña</Label>
              <PasswordInput
                id="confirm-pwd"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repite la nueva contraseña"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="w-full"
            >
              {savingPassword
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</>
                : "Guardar contraseña"
              }
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PartnerProfileSection;
