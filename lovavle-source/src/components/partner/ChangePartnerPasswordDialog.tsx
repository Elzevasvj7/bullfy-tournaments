import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toastUtils";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Copy, Check, KeyRound, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerUserId: string;
  partnerUserName: string;
  partnerUserEmail: string;
  portalId: string;
}

const generatePassword = (length = 10) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
};

const ChangePartnerPasswordDialog = ({ open, onOpenChange, partnerUserId, partnerUserName, partnerUserEmail, portalId }: Props) => {
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword(generatePassword(10));
      setCopied(false);
    }
  }, [open]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const handleSave = async () => {
    if (!password || password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("partner-reset-password", {
        body: {
          action: "admin_set_password",
          email: partnerUserId, // reusing field as target id (matches existing convention)
          portal_id: portalId,
          new_password: password,
        },
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error || "Error desconocido");
      toast.success(`Contraseña actualizada para ${partnerUserName}`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar contraseña");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" /> Cambiar contraseña
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{partnerUserName}</span> · {partnerUserEmail}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Label htmlFor="new-pass">Nueva contraseña</Label>
          <div className="flex items-center gap-2">
            <Input
              id="new-pass"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="font-mono"
            />
            <Button type="button" variant="outline" size="icon" title="Generar otra" onClick={() => setPassword(generatePassword(10))}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" title="Copiar" onClick={handleCopy}>
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Sugerimos una de 10 caracteres. Puedes editarla o escribir la que prefieras (mín. 8).
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando…</> : "Guardar contraseña"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePartnerPasswordDialog;
