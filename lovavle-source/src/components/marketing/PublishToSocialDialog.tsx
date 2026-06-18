import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Send, CalendarClock, Instagram, Youtube } from "lucide-react";
import { toast } from "@/lib/toastUtils";

interface SocialConnection {
  id: string;
  platform: string;
  platform_username: string | null;
  status: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clipId: string | null;
  defaultCaption?: string;
}

export default function PublishToSocialDialog({ open, onOpenChange, clipId, defaultCaption = "" }: Props) {
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [connectionId, setConnectionId] = useState<string>("");
  const [caption, setCaption] = useState(defaultCaption);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [optimizing, setOptimizing] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCaption(defaultCaption);
    setHashtags([]);
    setScheduleDate("");
    (async () => {
      const { data } = await supabase
        .from("social_connections")
        .select("id, platform, platform_username, status")
        .eq("status", "active");
      setConnections(data || []);
      if (data?.length) setConnectionId(data[0].id);
    })();
  }, [open, defaultCaption]);

  const selected = connections.find((c) => c.id === connectionId);

  const handleOptimize = async () => {
    if (!selected) return toast.error("Selecciona una cuenta");
    setOptimizing(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-social-caption", {
        body: { base_caption: caption || "Nuevo clip", platform: selected.platform },
      });
      if (error) throw error;
      if (!data.ok) throw new Error(data.error);
      setCaption(data.caption);
      setHashtags(data.hashtags || []);
      toast.success("Caption optimizado para " + selected.platform);
    } catch (e: any) {
      toast.error("Error: " + (e.message || ""));
    } finally {
      setOptimizing(false);
    }
  };

  const handlePublish = async () => {
    if (!clipId || !connectionId) return toast.error("Faltan datos");
    setPublishing(true);
    try {
      const fullCaption = hashtags.length ? `${caption}\n\n${hashtags.join(" ")}` : caption;
      const { data, error } = await supabase.functions.invoke("publish-to-social", {
        body: {
          clip_id: clipId,
          social_connection_id: connectionId,
          caption: fullCaption,
          scheduled_at: scheduleDate ? new Date(scheduleDate).toISOString() : null,
        },
      });
      if (error) throw error;
      if (!data.ok) throw new Error(data.error);
      toast.success(scheduleDate ? "Publicación programada" : "Publicado correctamente");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error: " + (e.message || ""));
    } finally {
      setPublishing(false);
    }
  };

  const platformIcon = (p: string) => {
    if (p === "instagram") return <Instagram className="w-3.5 h-3.5" />;
    if (p === "youtube") return <Youtube className="w-3.5 h-3.5" />;
    return <span className="text-xs font-bold">TT</span>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send className="w-4 h-4" /> Publicar Clip</DialogTitle>
          <DialogDescription>Optimiza el caption con IA y publica o programa</DialogDescription>
        </DialogHeader>

        {connections.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No tienes cuentas conectadas. Ve a Settings → Social para conectar.
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Cuenta</Label>
              <Select value={connectionId} onValueChange={setConnectionId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {connections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        {platformIcon(c.platform)} {c.platform} — @{c.platform_username || "?"}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>Caption</Label>
                <Button size="sm" variant="outline" onClick={handleOptimize} disabled={optimizing} className="gap-1.5 h-7">
                  {optimizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Optimizar para {selected?.platform || "plataforma"}
                </Button>
              </div>
              <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={4} />
              {hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {hashtags.map((h) => <Badge key={h} variant="secondary" className="text-xs">{h}</Badge>)}
                </div>
              )}
            </div>

            <div>
              <Label className="flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" /> Programar (opcional)</Label>
              <Input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} min={new Date().toISOString().slice(0, 16)} />
            </div>

            <Button onClick={handlePublish} disabled={publishing} className="w-full gap-2">
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {scheduleDate ? "Programar" : "Publicar Ahora"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
