import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toastUtils";
import { Copy, Link2, Plus, Trash2, ExternalLink, Globe, Lock, Share2 } from "lucide-react";
import { portalPublicOrigin } from "@/lib/portalRouting";

interface InviteCode {
  id: string;
  code: string;
  used_by_name: string | null;
  used_at: string | null;
  expires_at: string;
  is_public: boolean;
}

const InviteCodeManager = ({ roomId }: { roomId: string }) => {
  const { user, isAdmin, isGlobalAdmin, isBD, isMarketing, isVentas } = useAuth();
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [isPublicStream, setIsPublicStream] = useState(false);
  const [togglingPublic, setTogglingPublic] = useState(false);
  // Base del link de invitado: dominio propio del portal white-label (club) o,
  // si no, el origin actual (bullfytech.online). Evita mandar invitados del
  // club a bullfytech (que mostraría marca Bullfy y FOUC).
  const [linkBase, setLinkBase] = useState<string>(
    typeof window !== "undefined" ? window.location.origin : "https://bullfytech.online",
  );

  const canSharePublic = isAdmin || isGlobalAdmin || isBD || isMarketing || isVentas;

  const getGuestLink = (code: string) => {
    return `${linkBase}/live/guest?code=${code}&room=${roomId}`;
  };

  const getPublicLink = () => {
    return `${linkBase}/live/guest?room=${roomId}&public=true`;
  };

  const fetchCodes = async () => {
    const { data } = await supabase
      .from("live_invite_codes")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false });
    setCodes((data as InviteCode[]) || []);
  };

  const fetchPublicStatus = async () => {
    const { data } = await supabase
      .from("live_rooms")
      .select("is_public_stream, partner_portals(nombre_portal)")
      .eq("id", roomId)
      .single();
    if (data) {
      setIsPublicStream(data.is_public_stream);
      const slug = (data as any).partner_portals?.nombre_portal;
      const origin = portalPublicOrigin(slug);
      if (origin) setLinkBase(origin);
    }
  };

  useEffect(() => {
    if (open) {
      fetchCodes();
      fetchPublicStatus();
    }
  }, [open]);

  const togglePublicStream = async (enabled: boolean) => {
    setTogglingPublic(true);
    const { error } = await supabase
      .from("live_rooms")
      .update({ is_public_stream: enabled })
      .eq("id", roomId);
    
    if (error) {
      toast.error("Error: " + error.message);
    } else {
      setIsPublicStream(enabled);
      if (enabled) {
        navigator.clipboard.writeText(getPublicLink());
        toast.success("Stream público activado — link copiado al portapapeles");
      } else {
        toast.success("Stream público desactivado");
      }
    }
    setTogglingPublic(false);
  };

  const generateCode = async (isPublic: boolean) => {
    if (!user) return;
    setCreating(true);
    const code = Math.random().toString(36).slice(2, 10).toUpperCase();
    const ttl = isPublic ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const expires = new Date(Date.now() + ttl).toISOString();

    const { error } = await supabase.from("live_invite_codes").insert({
      room_id: roomId,
      code,
      created_by: user.id,
      expires_at: expires,
      is_public: isPublic,
    });

    if (error) toast.error("Error: " + error.message);
    else {
      const link = getGuestLink(code);
      navigator.clipboard.writeText(link);
      toast.success(
        isPublic
          ? "Código público creado y link copiado"
          : "Código privado creado y link copiado"
      );
      fetchCodes();
    }
    setCreating(false);
  };

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(getGuestLink(code));
    toast.success("Link de invitación copiado");
  };

  const deleteCode = async (id: string) => {
    await supabase.from("live_invite_codes").delete().eq("id", id);
    fetchCodes();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Link2 className="w-3 h-3" /> Invitar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Códigos de Invitación</DialogTitle>
        </DialogHeader>

        {/* Public Stream toggle — only for internal roles */}
        {canSharePublic && (
          <div className="border border-primary/20 rounded-lg p-3 space-y-2 bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-primary shrink-0" />
                <Label className="text-sm font-medium">Stream Equipo Interno (sin autenticación)</Label>
              </div>
              <Switch
                checked={isPublicStream}
                onCheckedChange={togglePublicStream}
                disabled={togglingPublic}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Cualquier persona con el link puede ver el stream sin registrarse. No genera leads.
            </p>
            {isPublicStream && (
              <div className="flex items-center gap-1.5 min-w-0">
                <ExternalLink className="w-3 h-3 shrink-0 text-primary" />
                <span className="text-xs text-primary truncate min-w-0 flex-1" title={getPublicLink()}>
                  {getPublicLink()}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0 h-6 w-6"
                  onClick={() => {
                    navigator.clipboard.writeText(getPublicLink());
                    toast.success("Link público copiado");
                  }}
                  title="Copiar link"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          Genera códigos <strong>privados</strong> (un solo uso) o <strong>públicos</strong> (uso ilimitado) para compartir tu stream.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => generateCode(false)} disabled={creating} variant="outline" className="gap-2">
            <Lock className="w-4 h-4" /> Código Privado
          </Button>
          <Button onClick={() => generateCode(true)} disabled={creating} className="gap-2">
            <Globe className="w-4 h-4" /> Código Público
          </Button>
        </div>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {codes.map(c => {
            const isUsed = !c.is_public && !!c.used_at;
            const isExpired = new Date(c.expires_at) < new Date();
            const isAvailable = c.is_public ? !isExpired : !isUsed && !isExpired;

            return (
              <div key={c.id} className="p-2.5 rounded border border-border space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono font-bold">{c.code}</code>
                    {c.is_public ? (
                      <Badge className="text-xs bg-primary/20 text-primary border-primary/30 gap-1">
                        <Globe className="w-2.5 h-2.5" /> Público
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Lock className="w-2.5 h-2.5" /> Privado
                      </Badge>
                    )}
                    {isUsed && (
                      <Badge variant="secondary" className="text-xs">Usado por {c.used_by_name}</Badge>
                    )}
                    {isExpired && (
                      <Badge variant="outline" className="text-xs text-destructive">Expirado</Badge>
                    )}
                    {isAvailable && !c.is_public && (
                      <Badge className="text-xs bg-green-600">Disponible</Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {isAvailable && (
                      <Button size="icon" variant="ghost" onClick={() => copyLink(c.code)} title="Copiar link">
                        <Copy className="w-3 h-3" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => deleteCode(c.id)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </div>
                {isAvailable && (
                  <button
                    onClick={() => copyLink(c.code)}
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline cursor-pointer w-full text-left truncate"
                    title={getGuestLink(c.code)}
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    <span className="truncate">{getGuestLink(c.code)}</span>
                  </button>
                )}
              </div>
            );
          })}
          {codes.length === 0 && <p className="text-sm text-center text-muted-foreground py-4">No hay códigos aún</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InviteCodeManager;
