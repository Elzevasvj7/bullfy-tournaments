import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/lib/toastUtils";
import {
  FileText, FileImage, FileSpreadsheet, FileVideo, File as FileIcon,
  Trash2, Upload, Download, Save, X, Paperclip, BarChart3,
} from "lucide-react";
import type { LocalParticipant } from "livekit-client";

interface CTAFile {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  button_text: string;
  file_path: string;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

interface Props {
  localParticipant?: LocalParticipant | null;
}

const MAX_SIZE = 100 * 1024 * 1024; // 100 MB

const getFileIcon = (mime: string) => {
  if (mime.startsWith("image/")) return FileImage;
  if (mime.startsWith("video/")) return FileVideo;
  if (mime.includes("pdf")) return FileText;
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv")) return FileSpreadsheet;
  if (mime.includes("word") || mime.includes("document") || mime.includes("text")) return FileText;
  return FileIcon;
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const HostCTAFilesPanel = ({ localParticipant }: Props) => {
  const [files, setFiles] = useState<CTAFile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [buttonText, setButtonText] = useState("Descargar");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadStats, setDownloadStats] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) return;
    const { data } = await supabase
      .from("host_cta_files")
      .select("*")
      .eq("user_id", session.session.user.id)
      .order("created_at", { ascending: false });
    if (data) setFiles(data as CTAFile[]);
  }, []);

  const loadStats = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) return;
    const { data } = await supabase
      .from("cta_file_downloads")
      .select("cta_file_id")
      .eq("host_id", session.session.user.id);
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach((d: any) => {
        counts[d.cta_file_id] = (counts[d.cta_file_id] || 0) + 1;
      });
      setDownloadStats(counts);
    }
  }, []);

  useEffect(() => {
    loadFiles();
    loadStats();
  }, [loadFiles, loadStats]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setButtonText("Descargar");
    setSelectedFile(null);
    setEditingId(null);
    setShowForm(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_SIZE) {
      toast.error("El archivo supera 100 MB");
      return;
    }
    setSelectedFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const startEdit = (f: CTAFile) => {
    setEditingId(f.id);
    setTitle(f.title);
    setDescription(f.description || "");
    setButtonText(f.button_text);
    setSelectedFile(null);
    setShowForm(true);
  };

  const saveFile = async () => {
    if (!title.trim()) {
      toast.error("Título requerido");
      return;
    }
    if (!editingId && !selectedFile) {
      toast.error("Selecciona un archivo");
      return;
    }

    setUploading(true);
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) {
      setUploading(false);
      return;
    }
    const userId = session.session.user.id;

    try {
      if (editingId) {
        const { error } = await supabase
          .from("host_cta_files")
          .update({
            title: title.trim(),
            description: description.trim() || null,
            button_text: buttonText.trim() || "Descargar",
          })
          .eq("id", editingId);
        if (error) throw error;
        toast.success("CTA actualizado");
      } else if (selectedFile) {
        const ext = selectedFile.name.split(".").pop() || "bin";
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("live-cta-files")
          .upload(path, selectedFile, {
            contentType: selectedFile.type || "application/octet-stream",
          });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("live-cta-files").getPublicUrl(path);

        const { error: insErr } = await supabase.from("host_cta_files").insert({
          user_id: userId,
          title: title.trim(),
          description: description.trim() || null,
          button_text: buttonText.trim() || "Descargar",
          file_path: path,
          file_url: urlData.publicUrl,
          file_name: selectedFile.name,
          file_size: selectedFile.size,
          mime_type: selectedFile.type || "application/octet-stream",
        });
        if (insErr) throw insErr;
        toast.success("Archivo subido");
      }

      resetForm();
      await loadFiles();
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (f: CTAFile) => {
    if (!confirm(`¿Eliminar "${f.title}"?`)) return;
    if (activeId === f.id) toggleBroadcast(f, false);
    await supabase.storage.from("live-cta-files").remove([f.file_path]);
    await supabase.from("host_cta_files").delete().eq("id", f.id);
    setFiles((prev) => prev.filter((x) => x.id !== f.id));
    toast.success("Eliminado");
  };

  const sendDataMessage = useCallback(
    (payload: object) => {
      if (!localParticipant) return;
      const data = new TextEncoder().encode(JSON.stringify(payload));
      localParticipant.publishData(data, { reliable: true });
    },
    [localParticipant]
  );

  const toggleBroadcast = useCallback(
    (f: CTAFile, activate: boolean) => {
      if (!localParticipant) {
        toast.error("Conéctate al stream primero");
        return;
      }
      if (activate) {
        setActiveId(f.id);
        const payload = {
          type: "cta",
          action: "show",
          ctaKind: "file",
          fileId: f.id,
          title: f.title,
          description: f.description || "",
          buttonText: f.button_text,
          fileUrl: f.file_url,
          fileName: f.file_name,
          fileSize: f.file_size,
          mimeType: f.mime_type,
        };
        sendDataMessage(payload);
        window.dispatchEvent(new CustomEvent("bullfy-cta", { detail: payload }));
        toast.success("Archivo activado para los viewers");
      } else {
        setActiveId(null);
        const payload = { type: "cta", action: "hide" };
        sendDataMessage(payload);
        window.dispatchEvent(new CustomEvent("bullfy-cta", { detail: payload }));
        toast.info("Archivo ocultado");
      }
    },
    [localParticipant, sendDataMessage]
  );

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-primary" /> Archivos descargables (CTA)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!showForm && (
          <Button size="sm" variant="outline" className="w-full gap-1" onClick={() => setShowForm(true)}>
            <Upload className="w-3 h-3" /> Subir nuevo archivo
          </Button>
        )}

        {showForm && (
          <div className="space-y-2 p-3 border border-dashed border-border rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-primary">
                {editingId ? "Editando" : "Nuevo archivo"}
              </span>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={resetForm}>
                <X className="w-3 h-3" />
              </Button>
            </div>

            {!editingId && (
              <div>
                <Label className="text-xs">Archivo (máx 100 MB)</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFilePick}
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,video/mp4,video/webm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-1 h-8 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-3 h-3" />
                  {selectedFile ? `${selectedFile.name} (${formatSize(selectedFile.size)})` : "Seleccionar archivo"}
                </Button>
              </div>
            )}

            <div>
              <Label className="text-xs">Título</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Guía PDF Trading 2026"
                className="h-8 text-sm"
              />
            </div>

            <div>
              <Label className="text-xs">Descripción que verá el viewer</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descarga gratis la guía completa..."
                className="text-sm min-h-[60px]"
              />
            </div>

            <div>
              <Label className="text-xs">Texto del botón</Label>
              <Input
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                placeholder="Descargar"
                className="h-8 text-sm"
              />
            </div>

            <Button size="sm" onClick={saveFile} disabled={uploading} className="w-full gap-1" variant="outline">
              <Save className="w-3 h-3" />
              {uploading ? "Guardando..." : editingId ? "Actualizar" : "Subir y guardar"}
            </Button>
          </div>
        )}

        {files.length === 0 && !showForm && (
          <p className="text-xs text-muted-foreground text-center py-2">No hay archivos subidos</p>
        )}

        {files.map((f) => {
          const Icon = getFileIcon(f.mime_type);
          const isActive = activeId === f.id;
          const downloads = downloadStats[f.id] || 0;
          return (
            <div
              key={f.id}
              className={`flex flex-col gap-2 p-2 rounded-lg border text-sm ${
                isActive ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Icon className="w-5 h-5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{f.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {f.file_name} · {formatSize(f.file_size)}
                  </p>
                  {downloads > 0 && (
                    <p className="text-xs text-primary flex items-center gap-1 mt-0.5">
                      <BarChart3 className="w-3 h-3" /> {downloads} descarga{downloads !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/40">
                <Switch checked={isActive} onCheckedChange={(c) => toggleBroadcast(f, c)} />
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => window.open(f.file_url, "_blank")}
                    title="Vista previa"
                  >
                    <Download className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar" onClick={() => startEdit(f)}>
                    <Upload className="w-3.5 h-3.5 text-muted-foreground rotate-180" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Eliminar" onClick={() => deleteFile(f)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default HostCTAFilesPanel;
