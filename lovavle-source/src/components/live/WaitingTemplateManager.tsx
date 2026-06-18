import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/toastUtils";
import { Plus, Trash2, Star, Edit2, Image, Video, Eye, Loader2 } from "lucide-react";

interface WaitingTemplate {
  id: string;
  name: string;
  bg_path: string | null;
  bg_type: string;
  title: string;
  subtitle: string | null;
  show_countdown: boolean;
  is_default: boolean;
  created_at: string;
}

const WaitingTemplateManager = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<WaitingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formTitle, setFormTitle] = useState("Comenzamos pronto...");
  const [formSubtitle, setFormSubtitle] = useState("");
  const [formBgType, setFormBgType] = useState<"image" | "video">("image");
  const [formBgPath, setFormBgPath] = useState("");
  const [formShowCountdown, setFormShowCountdown] = useState(true);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from("live_waiting_templates")
      .select("*")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    setTemplates((data as WaitingTemplate[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const resetForm = () => {
    setFormName("");
    setFormTitle("Comenzamos pronto...");
    setFormSubtitle("");
    setFormBgType("image");
    setFormBgPath("");
    setFormShowCountdown(true);
    setEditingId(null);
  };

  const openEdit = (t: WaitingTemplate) => {
    setFormName(t.name);
    setFormTitle(t.title);
    setFormSubtitle(t.subtitle || "");
    setFormBgType(t.bg_type as "image" | "video");
    setFormBgPath(t.bg_path || "");
    setFormShowCountdown(t.show_countdown);
    setEditingId(t.id);
    setShowCreate(true);
  };

  const handleUploadBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `waiting-rooms/${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("live-backgrounds").upload(path, file);
    if (error) {
      toast.error("Error al subir archivo: " + error.message);
    } else {
      const { data: urlData } = supabase.storage.from("live-backgrounds").getPublicUrl(path);
      setFormBgPath(urlData.publicUrl);
      toast.success("Archivo subido");
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formTitle.trim()) {
      toast.error("Nombre y título son requeridos");
      return;
    }
    setSaving(true);

    const payload = {
      name: formName.trim(),
      title: formTitle.trim(),
      subtitle: formSubtitle.trim() || null,
      bg_type: formBgType,
      bg_path: formBgPath || null,
      show_countdown: formShowCountdown,
      created_by: user?.id,
    };

    if (editingId) {
      const { error } = await supabase
        .from("live_waiting_templates")
        .update(payload)
        .eq("id", editingId);
      if (error) toast.error("Error: " + error.message);
      else toast.success("Plantilla actualizada");
    } else {
      const { error } = await supabase
        .from("live_waiting_templates")
        .insert(payload);
      if (error) toast.error("Error: " + error.message);
      else toast.success("Plantilla creada");
    }

    setSaving(false);
    setShowCreate(false);
    resetForm();
    fetchTemplates();
  };

  const toggleDefault = async (id: string, current: boolean) => {
    if (current) return; // Can't unset default without setting another
    const { error } = await supabase
      .from("live_waiting_templates")
      .update({ is_default: true })
      .eq("id", id);
    if (error) toast.error("Error: " + error.message);
    else {
      toast.success("Plantilla marcada como default");
      fetchTemplates();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("live_waiting_templates").delete().eq("id", id);
    if (error) toast.error("Error: " + error.message);
    else {
      toast.success("Plantilla eliminada");
      fetchTemplates();
    }
  };

  const getPreviewTemplate = () => templates.find(t => t.id === previewId);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Plantillas de Sala de Espera</h3>
          <p className="text-sm text-muted-foreground">Configura fondos, textos y countdown para las salas de espera de Bullfy Live</p>
        </div>
        <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Nueva Plantilla</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Plantilla" : "Nueva Plantilla"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nombre interno</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ej: Trading Session Default" />
              </div>
              <div>
                <Label>Título (visible al espectador)</Label>
                <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Comenzamos pronto..." />
              </div>
              <div>
                <Label>Subtítulo (opcional)</Label>
                <Input value={formSubtitle} onChange={e => setFormSubtitle(e.target.value)} placeholder="Prepárate para una sesión increíble" />
              </div>
              <div>
                <Label>Tipo de fondo</Label>
                <Select value={formBgType} onValueChange={(v) => setFormBgType(v as "image" | "video")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Imagen</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Archivo de fondo</Label>
                <Input type="file" accept={formBgType === "image" ? "image/*" : "video/*"} onChange={handleUploadBg} disabled={uploading} />
                {uploading && <p className="text-xs text-muted-foreground mt-1">Subiendo...</p>}
                {formBgPath && (
                  <p className="text-xs text-primary mt-1 truncate">✓ {formBgPath.split("/").pop()}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formShowCountdown} onCheckedChange={setFormShowCountdown} />
                <Label>Mostrar countdown por defecto</Label>
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? "Guardando..." : editingId ? "Actualizar" : "Crear Plantilla"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Image className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No hay plantillas de sala de espera</p>
            <p className="text-sm text-muted-foreground mt-1">Crea la primera para que los hosts la usen al crear sus salas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <Card key={t.id} className={t.is_default ? "border-primary" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="truncate">{t.name}</span>
                  <div className="flex items-center gap-1">
                    {t.is_default && <Badge className="text-xs bg-primary/20 text-primary border-primary/30">Default</Badge>}
                    <Badge variant="outline" className="text-xs gap-1">
                      {t.bg_type === "video" ? <Video className="w-2.5 h-2.5" /> : <Image className="w-2.5 h-2.5" />}
                      {t.bg_type}
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Preview thumbnail */}
                {t.bg_path && t.bg_type === "image" && (
                  <div className="relative h-24 rounded-md overflow-hidden bg-muted">
                    <img src={t.bg_path} alt={t.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <p className="text-white text-sm font-bold text-center px-2">{t.title}</p>
                    </div>
                  </div>
                )}
                {t.bg_path && t.bg_type === "video" && (
                  <div className="relative h-24 rounded-md overflow-hidden bg-muted">
                    <video src={t.bg_path} className="w-full h-full object-cover" muted />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <p className="text-white text-sm font-bold text-center px-2">{t.title}</p>
                    </div>
                  </div>
                )}
                {!t.bg_path && (
                  <div className="h-24 rounded-md bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <p className="text-sm font-semibold text-center px-2">{t.title}</p>
                  </div>
                )}

                {t.subtitle && <p className="text-xs text-muted-foreground truncate">{t.subtitle}</p>}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {t.show_countdown && <Badge variant="outline" className="text-xs">Countdown</Badge>}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(t)} className="gap-1 h-7">
                    <Edit2 className="w-3 h-3" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPreviewId(t.id)} className="gap-1 h-7">
                    <Eye className="w-3 h-3" /> Preview
                  </Button>
                  {!t.is_default && (
                    <Button size="sm" variant="ghost" onClick={() => toggleDefault(t.id, t.is_default)} className="gap-1 h-7">
                      <Star className="w-3 h-3" /> Default
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)} className="gap-1 h-7 text-destructive">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewId} onOpenChange={(o) => { if (!o) setPreviewId(null); }}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          {(() => {
            const t = getPreviewTemplate();
            if (!t) return null;
            return (
              <div className="relative h-[400px] bg-black flex items-center justify-center overflow-hidden">
                {t.bg_path && t.bg_type === "image" && (
                  <img src={t.bg_path} alt="" className="absolute inset-0 w-full h-full object-cover" />
                )}
                {t.bg_path && t.bg_type === "video" && (
                  <video src={t.bg_path} autoPlay loop muted className="absolute inset-0 w-full h-full object-cover" />
                )}
                {!t.bg_path && (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-background to-primary/10" />
                )}
                <div className="absolute inset-0 bg-black/50" />
                <div className="relative z-10 text-center space-y-4 px-8">
                  <h2 className="text-3xl font-bold text-white">{t.title}</h2>
                  {t.subtitle && <p className="text-lg text-white/80">{t.subtitle}</p>}
                  {t.show_countdown && (
                    <div className="flex items-center justify-center gap-3">
                      {["00", "15", "30"].map((n, i) => (
                        <div key={i} className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 min-w-[60px]">
                          <span className="text-2xl font-mono font-bold text-white">{n}</span>
                          <p className="text-xs text-white/60 mt-1">{["HRS", "MIN", "SEG"][i]}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WaitingTemplateManager;
