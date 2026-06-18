import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/toastUtils";
import { Plus, Copy, Check, Trash2, Film, Upload, Eye, Link, MessageSquare, Video } from "lucide-react";

interface FakeStream {
  id: string;
  title: string;
  slug: string;
  video_path: string;
  video_source: string;
  cta_url: string | null;
  cta_text: string | null;
  fake_viewer_min: number;
  fake_viewer_max: number;
  chat_messages: any[];
  is_active: boolean;
  created_at: string;
  recording_id: string | null;
}

interface Recording {
  id: string;
  file_path: string;
  room_title?: string;
  duration_seconds: number | null;
  created_at: string;
}

interface FakeStreamManagerProps {
  portalId?: string;
}

const FakeStreamManager = ({ portalId }: FakeStreamManagerProps) => {
  const { user } = useAuth();
  const [streams, setStreams] = useState<FakeStream[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [ctaText, setCtaText] = useState("Únete ahora");
  const [videoSource, setVideoSource] = useState<"upload" | "recording">("upload");
  const [selectedRecording, setSelectedRecording] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [chatMessages, setChatMessages] = useState<{ time: number; name: string; text: string }[]>([
    { time: 5, name: "Carlos M.", text: "🔥 Excelente contenido!" },
    { time: 15, name: "Ana G.", text: "¿Cómo puedo empezar?" },
    { time: 30, name: "Luis R.", text: "Increíble oportunidad" },
    { time: 45, name: "María P.", text: "Ya me registré 🎯" },
    { time: 60, name: "Pedro S.", text: "Gracias por la info!" },
  ]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, [portalId]);

  const loadData = async () => {
    // Load fake streams
    let query = supabase.from("live_fake_streams").select("*").order("created_at", { ascending: false });
    if (portalId) query = query.eq("portal_id", portalId);
    const { data: streamsData } = await query;
    if (streamsData) setStreams(streamsData as any);

    // Load recordings for selection
    const { data: recsData } = await supabase
      .from("live_recordings")
      .select("*, live_rooms(title)")
      .order("created_at", { ascending: false });
    if (recsData) {
      setRecordings(recsData.map((r: any) => ({
        ...r,
        room_title: r.live_rooms?.title,
      })));
    }
    setLoading(false);
  };

  const generateSlug = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Math.random().toString(36).slice(2, 6);

  const handleCreate = async () => {
    if (!title.trim() || !user) return;
    setCreating(true);

    let videoPath = "";

    if (videoSource === "upload" && uploadFile) {
      const ext = uploadFile.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("fake-stream-videos").upload(path, uploadFile);
      if (error) {
        toast.error("Error al subir video: " + error.message);
        setCreating(false);
        return;
      }
      videoPath = path;
    } else if (videoSource === "recording" && selectedRecording) {
      const rec = recordings.find(r => r.id === selectedRecording);
      if (rec) videoPath = rec.file_path;
    } else {
      toast.error("Selecciona un video");
      setCreating(false);
      return;
    }

    const slug = generateSlug(title);

    const { error } = await supabase.from("live_fake_streams").insert({
      title: title.trim(),
      slug,
      video_path: videoPath,
      video_source: videoSource,
      recording_id: videoSource === "recording" ? selectedRecording : null,
      portal_id: portalId || null,
      cta_url: ctaUrl.trim() || null,
      cta_text: ctaText.trim() || "Únete ahora",
      fake_viewer_min: 80,
      fake_viewer_max: 105,
      chat_messages: chatMessages,
      created_by: user.id,
    });

    if (error) {
      toast.error("Error: " + error.message);
    } else {
      toast.success("Falso en vivo creado");
      setShowCreate(false);
      resetForm();
      loadData();
    }
    setCreating(false);
  };

  const resetForm = () => {
    setTitle("");
    setCtaUrl("");
    setCtaText("Únete ahora");
    setVideoSource("upload");
    setSelectedRecording("");
    setUploadFile(null);
  };

  const toggleActive = async (stream: FakeStream) => {
    await supabase.from("live_fake_streams").update({ is_active: !stream.is_active }).eq("id", stream.id);
    loadData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("live_fake_streams").delete().eq("id", id);
    toast.success("Eliminado");
    loadData();
  };

  const getPublicOrigin = () => "https://bullfytech.online";

  const copyLink = (slug: string) => {
    const url = `${getPublicOrigin()}/live/fake/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    toast.success("Link copiado");
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const addChatMessage = () => {
    const lastTime = chatMessages.length > 0 ? chatMessages[chatMessages.length - 1].time : 0;
    setChatMessages([...chatMessages, { time: lastTime + 15, name: "", text: "" }]);
  };

  const updateChatMessage = (idx: number, field: string, value: any) => {
    const updated = [...chatMessages];
    (updated[idx] as any)[field] = field === "time" ? Number(value) : value;
    setChatMessages(updated);
  };

  const removeChatMessage = (idx: number) => {
    setChatMessages(chatMessages.filter((_, i) => i !== idx));
  };

  if (loading) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Film className="w-5 h-5 text-primary" /> Falsos en Vivo
          </h3>
          <p className="text-sm text-muted-foreground">Videos pregrabados que simulan un stream en vivo para embudos</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Crear Falso en Vivo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nuevo Falso en Vivo</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Título</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Sesión Exclusiva de Trading" />
              </div>

              {/* Video Source */}
              <div className="space-y-2">
                <Label>Fuente del Video</Label>
                <Select value={videoSource} onValueChange={(v: any) => setVideoSource(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upload">
                      <span className="flex items-center gap-2"><Upload className="w-3 h-3" /> Subir video</span>
                    </SelectItem>
                    <SelectItem value="recording">
                      <span className="flex items-center gap-2"><Film className="w-3 h-3" /> Grabación de Bullfy Live</span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {videoSource === "upload" && (
                  <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                    <input
                      type="file"
                      accept="video/*"
                      onChange={e => setUploadFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="fake-video-upload"
                    />
                    <label htmlFor="fake-video-upload" className="cursor-pointer">
                      <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {uploadFile ? uploadFile.name : "Click para seleccionar video"}
                      </p>
                    </label>
                  </div>
                )}

                {videoSource === "recording" && (
                  <Select value={selectedRecording} onValueChange={setSelectedRecording}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una grabación" />
                    </SelectTrigger>
                    <SelectContent>
                      {recordings.map(r => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.room_title || "Stream"} — {new Date(r.created_at).toLocaleDateString()}
                        </SelectItem>
                      ))}
                      {recordings.length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Sin grabaciones disponibles</div>
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* CTA */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>URL del CTA (embudo)</Label>
                  <Input value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} placeholder="https://..." />
                </div>
                <div>
                  <Label>Texto del botón CTA</Label>
                  <Input value={ctaText} onChange={e => setCtaText(e.target.value)} placeholder="Únete ahora" />
                </div>
              </div>

              {/* Chat Messages */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Mensajes de Chat Simulado
                  </Label>
                  <Button size="sm" variant="outline" onClick={addChatMessage} className="gap-1 h-7 text-xs">
                    <Plus className="w-3 h-3" /> Agregar
                  </Button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={msg.time}
                        onChange={e => updateChatMessage(idx, "time", e.target.value)}
                        className="w-16 h-8 text-xs"
                        placeholder="seg"
                      />
                      <Input
                        value={msg.name}
                        onChange={e => updateChatMessage(idx, "name", e.target.value)}
                        className="w-28 h-8 text-xs"
                        placeholder="Nombre"
                      />
                      <Input
                        value={msg.text}
                        onChange={e => updateChatMessage(idx, "text", e.target.value)}
                        className="flex-1 h-8 text-xs"
                        placeholder="Mensaje..."
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeChatMessage(idx)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleCreate} disabled={creating || !title.trim()} className="w-full">
                {creating ? "Creando..." : "Crear Falso en Vivo"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* List */}
      {streams.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Video className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground text-sm">No hay falsos en vivo creados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {streams.map(stream => (
            <Card key={stream.id} className={!stream.is_active ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Film className="w-4 h-4 text-primary" />
                    {stream.title}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant={stream.is_active ? "default" : "secondary"}>
                      {stream.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                    <Switch checked={stream.is_active} onCheckedChange={() => toggleActive(stream)} />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" /> {stream.fake_viewer_min}-{stream.fake_viewer_max} viewers
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> {(stream.chat_messages as any[])?.length || 0} mensajes
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {stream.video_source === "upload" ? "Video subido" : "Grabación"}
                  </Badge>
                </div>

                {stream.cta_url && (
                  <p className="text-xs text-muted-foreground truncate">
                    CTA → {stream.cta_url}
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="gap-1 flex-1" onClick={() => copyLink(stream.slug)}>
                    {copiedSlug === stream.slug ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    {copiedSlug === stream.slug ? "Copiado" : "Copiar Link"}
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1" onClick={() => window.open(`${getPublicOrigin()}/live/fake/${stream.slug}`, "_blank")}>
                    <Link className="w-3 h-3" /> Preview
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar falso en vivo?</AlertDialogTitle>
                        <AlertDialogDescription>Se eliminará permanentemente este falso en vivo y su link dejará de funcionar.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(stream.id)}>Eliminar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <p className="text-[10px] text-muted-foreground">
                  {new Date(stream.created_at).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FakeStreamManager;
