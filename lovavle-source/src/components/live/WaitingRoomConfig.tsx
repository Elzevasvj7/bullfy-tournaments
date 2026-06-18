import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toastUtils";
import { Image, Video, Check, Edit2, Loader2, Star } from "lucide-react";

interface WaitingTemplate {
  id: string;
  name: string;
  bg_path: string | null;
  bg_type: string;
  title: string;
  subtitle: string | null;
  show_countdown: boolean;
  is_default: boolean;
}

interface WaitingRoomConfigProps {
  roomId: string;
  onSaved?: () => void;
}

const WaitingRoomConfig = ({ roomId, onSaved }: WaitingRoomConfigProps) => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<WaitingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [mode, setMode] = useState<"template" | "custom">("template");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [countdownTo, setCountdownTo] = useState("");

  // Custom fields
  const [customTitle, setCustomTitle] = useState("Comenzamos pronto...");
  const [customSubtitle, setCustomSubtitle] = useState("");
  const [customBgType, setCustomBgType] = useState<"image" | "video">("image");
  const [customBgPath, setCustomBgPath] = useState("");

  useEffect(() => {
    const load = async () => {
      // Fetch templates
      const { data: tpls } = await supabase
        .from("live_waiting_templates")
        .select("*")
        .order("is_default", { ascending: false })
        .order("name");
      const templates = (tpls as WaitingTemplate[]) || [];
      setTemplates(templates);

      // Fetch current room config
      const { data: room } = await supabase
        .from("live_rooms")
        .select("waiting_mode, waiting_template_id, waiting_bg_path, waiting_bg_type, waiting_title, waiting_subtitle, waiting_countdown_to")
        .eq("id", roomId)
        .single();

      // Fetch this host's saved waiting-room preferences (used as the
      // fallback when the room hasn't been configured explicitly yet).
      const prefsRes = user
        ? await supabase
            .from("live_host_waiting_preferences")
            .select("waiting_mode, waiting_template_id, waiting_bg_path, waiting_bg_type, waiting_title, waiting_subtitle")
            .eq("user_id", user.id)
            .maybeSingle()
        : { data: null as any };
      const prefs = prefsRes.data as any;

      const roomHasConfig = !!(room && (room.waiting_template_id || room.waiting_bg_path || room.waiting_title || room.waiting_subtitle));
      const source: any = roomHasConfig ? room : (prefs || room);

      if (source) {
        setMode((source.waiting_mode as "template" | "custom") || "template");
        setSelectedTemplateId(source.waiting_template_id || templates.find(t => t.is_default)?.id || null);
        setCustomTitle(source.waiting_title || "Comenzamos pronto...");
        setCustomSubtitle(source.waiting_subtitle || "");
        setCustomBgType((source.waiting_bg_type as "image" | "video") || "image");
        setCustomBgPath(source.waiting_bg_path || "");
        if (room?.waiting_countdown_to) {
          // El valor en BD es UTC (ISO). El input datetime-local espera hora
          // LOCAL: ajustamos por el offset para no desfasar (antes mostraba la
          // hora UTC como si fuera local → al re-guardar se corría +offset).
          const d = new Date(room.waiting_countdown_to);
          const localStr = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
          setCountdownTo(localStr);
        }
      } else {
        const def = templates.find(t => t.is_default);
        if (def) setSelectedTemplateId(def.id);
      }

      setLoading(false);
    };
    load();
  }, [roomId, user]);

  const handleUploadBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `waiting-rooms/${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("live-backgrounds").upload(path, file);
    if (error) {
      toast.error("Error al subir: " + error.message);
    } else {
      const { data: urlData } = supabase.storage.from("live-backgrounds").getPublicUrl(path);
      setCustomBgPath(urlData.publicUrl);
      toast.success("Archivo subido");
    }
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const update: any = {
      waiting_mode: mode,
      waiting_template_id: mode === "template" ? selectedTemplateId : null,
      waiting_bg_path: mode === "custom" ? (customBgPath || null) : null,
      waiting_bg_type: mode === "custom" ? customBgType : null,
      waiting_title: mode === "custom" ? customTitle : null,
      waiting_subtitle: mode === "custom" ? (customSubtitle || null) : null,
      waiting_countdown_to: countdownTo ? new Date(countdownTo).toISOString() : null,
    };

    const { error } = await supabase.from("live_rooms").update(update).eq("id", roomId);
    if (error) {
      toast.error("Error: " + error.message);
      setSaving(false);
      return;
    }

    // Persist the same choice as the host's default preference so future
    // rooms (and re-opens of this config) start from their last selection.
    if (user) {
      const prefPayload = {
        user_id: user.id,
        waiting_mode: mode,
        waiting_template_id: mode === "template" ? selectedTemplateId : null,
        waiting_bg_path: mode === "custom" ? (customBgPath || null) : null,
        waiting_bg_type: mode === "custom" ? customBgType : null,
        waiting_title: mode === "custom" ? customTitle : null,
        waiting_subtitle: mode === "custom" ? (customSubtitle || null) : null,
      };
      const { error: prefErr } = await supabase
        .from("live_host_waiting_preferences")
        .upsert(prefPayload, { onConflict: "user_id" });
      if (prefErr) console.warn("[WaitingRoomConfig] preferences upsert failed", prefErr);
    }

    toast.success("Sala de espera configurada");
    onSaved?.();
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <Image className="w-4 h-4 text-primary" /> Sala de Espera
      </h4>

      {/* Mode selector */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={mode === "template" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("template")}
          className="gap-2"
        >
          <Star className="w-3 h-3" /> Usar Plantilla
        </Button>
        <Button
          variant={mode === "custom" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("custom")}
          className="gap-2"
        >
          <Edit2 className="w-3 h-3" /> Personalizar
        </Button>
      </div>

      {mode === "template" && (
        <div className="space-y-3">
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay plantillas disponibles. Se usará un fondo genérico.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {templates.map(t => (
                <Card
                  key={t.id}
                  className={`cursor-pointer transition-all ${selectedTemplateId === t.id ? "border-primary ring-1 ring-primary" : "hover:border-primary/30"}`}
                  onClick={() => setSelectedTemplateId(t.id)}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    {/* Thumbnail */}
                    <div className="w-16 h-10 rounded bg-muted shrink-0 overflow-hidden">
                      {t.bg_path && t.bg_type === "image" ? (
                        <img src={t.bg_path} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                          {t.bg_type === "video" ? <Video className="w-4 h-4 text-muted-foreground" /> : <Image className="w-4 h-4 text-muted-foreground" />}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{t.title}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {t.is_default && <Badge variant="outline" className="text-xs">Default</Badge>}
                      {selectedTemplateId === t.id && <Check className="w-4 h-4 text-primary" />}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === "custom" && (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Título</Label>
            <Input value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder="Comenzamos pronto..." />
          </div>
          <div>
            <Label className="text-xs">Subtítulo (opcional)</Label>
            <Input value={customSubtitle} onChange={e => setCustomSubtitle(e.target.value)} placeholder="Prepárate para la sesión" />
          </div>
          <div>
            <Label className="text-xs">Tipo de fondo</Label>
            <Select value={customBgType} onValueChange={(v) => setCustomBgType(v as "image" | "video")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="image">Imagen</SelectItem>
                <SelectItem value="video">Video</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Archivo de fondo</Label>
            <Input type="file" accept={customBgType === "image" ? "image/*" : "video/*"} onChange={handleUploadBg} disabled={uploading} />
            {uploading && <p className="text-xs text-muted-foreground">Subiendo...</p>}
            {customBgPath && <p className="text-xs text-primary truncate mt-1">✓ Archivo cargado</p>}
          </div>
        </div>
      )}

      {/* Countdown — available in both modes */}
      <div>
        <Label className="text-xs">Hora de inicio (countdown)</Label>
        <Input type="datetime-local" value={countdownTo} onChange={e => setCountdownTo(e.target.value)} />
        <p className="text-xs text-muted-foreground mt-1">Opcional. Los espectadores verán una cuenta regresiva hasta esta hora.</p>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full" size="sm">
        {saving ? "Guardando..." : "Guardar Configuración"}
      </Button>

      {/* Mini preview */}
      {(mode === "template" && selectedTemplate) && (
        <div className="relative h-20 rounded-md overflow-hidden bg-black">
          {selectedTemplate.bg_path && selectedTemplate.bg_type === "image" && (
            <img src={selectedTemplate.bg_path} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          {!selectedTemplate.bg_path && (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/10" />
          )}
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <p className="text-white text-xs font-bold">{selectedTemplate.title}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WaitingRoomConfig;
