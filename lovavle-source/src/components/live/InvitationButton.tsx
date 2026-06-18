import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toastUtils";
import { Copy, Link2, ShieldCheck, ShieldAlert } from "lucide-react";
import { portalPublicOrigin } from "@/lib/portalRouting";

/**
 * Invitation button for private rooms (meeting / webinar_pro / bullfy_family).
 * - Generates a direct guest link (no auth required, no invite code).
 * - Toggles `allow_anyone_with_link`:
 *   - OFF: guest must request approval (knock-to-enter).
 *   - ON: anyone with the link enters directly.
 */
const InvitationButton = ({ roomId }: { roomId: string }) => {
  const [open, setOpen] = useState(false);
  const [allowAnyone, setAllowAnyone] = useState(false);
  const [loading, setLoading] = useState(false);
  // Dominio propio del portal white-label (club) o el origin actual.
  const [linkBase, setLinkBase] = useState<string>(
    typeof window !== "undefined" ? window.location.origin : "https://bullfytech.online",
  );

  const guestLink = `${linkBase}/live/guest?room=${roomId}&knock=1`;

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("live_rooms")
      .select("allow_anyone_with_link, partner_portals(nombre_portal)")
      .eq("id", roomId)
      .single();
    if (data) {
      setAllowAnyone(!!(data as any).allow_anyone_with_link);
      const origin = portalPublicOrigin((data as any).partner_portals?.nombre_portal);
      if (origin) setLinkBase(origin);
    }
  };

  useEffect(() => {
    if (open) fetchSettings();
  }, [open]);

  const toggleAllow = async (enabled: boolean) => {
    setLoading(true);
    const { error } = await supabase
      .from("live_rooms")
      .update({ allow_anyone_with_link: enabled } as any)
      .eq("id", roomId);
    if (error) {
      toast.error("Error: " + error.message);
    } else {
      setAllowAnyone(enabled);
      toast.success(
        enabled
          ? "Acceso directo activado — cualquier persona con el link entra al instante"
          : "Acceso restringido — los invitados deberán solicitar aprobación"
      );
    }
    setLoading(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(guestLink);
    toast.success("Link de invitación copiado");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Link2 className="w-3 h-3" /> Invitación
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar a la sala</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Comparte este link con quien quieras invitar. Los invitados sin cuenta también pueden entrar.
          </p>

          {/* Link */}
          <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/30">
            <Label className="text-xs text-muted-foreground">Link de invitación</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-background border border-border rounded px-2 py-1.5 truncate" title={guestLink}>
                {guestLink}
              </code>
              <Button size="icon" variant="outline" className="shrink-0 h-8 w-8" onClick={copyLink}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Access mode toggle */}
          <div className="border border-primary/20 rounded-lg p-3 space-y-2 bg-primary/5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {allowAnyone ? (
                  <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                )}
                <Label className="text-sm font-medium">Acceso directo con el link</Label>
              </div>
              <Switch
                checked={allowAnyone}
                onCheckedChange={toggleAllow}
                disabled={loading}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {allowAnyone
                ? "⚠️ Cualquier persona con el link entrará automáticamente sin tu aprobación."
                : "🔒 Los invitados verán una pantalla de espera y tú deberás aprobarlos uno a uno."}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvitationButton;
