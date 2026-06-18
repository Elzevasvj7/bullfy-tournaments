import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toastUtils";
import { Upload, X, Image as ImageIcon, Video, Loader2, Paperclip } from "lucide-react";

export interface RequestAttachment {
  path: string;
  name: string;
  type: string;
  size: number;
}

interface Props {
  userId: string;
  value: RequestAttachment[];
  onChange: (files: RequestAttachment[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  disabled?: boolean;
}

const ALLOWED = ["image/jpeg","image/png","image/webp","image/gif","image/heic","video/mp4","video/quicktime","video/webm","video/x-m4v"];

const RequestAttachmentsUploader = ({ userId, value, onChange, maxFiles = 10, maxSizeMB = 50, disabled }: Props) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (value.length + arr.length > maxFiles) {
      toast.error(`Máximo ${maxFiles} archivos`);
      return;
    }
    setUploading(true);
    const uploaded: RequestAttachment[] = [];
    for (const f of arr) {
      if (!ALLOWED.includes(f.type)) {
        toast.error(`${f.name}: tipo no permitido`);
        continue;
      }
      if (f.size > maxSizeMB * 1024 * 1024) {
        toast.error(`${f.name}: supera ${maxSizeMB}MB`);
        continue;
      }
      const ext = f.name.split(".").pop() || "bin";
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
      const { error } = await supabase.storage.from("ib-request-attachments").upload(path, f, {
        contentType: f.type,
        upsert: false,
      });
      if (error) {
        toast.error(`Error subiendo ${f.name}: ${error.message}`);
        continue;
      }
      uploaded.push({ path, name: f.name, type: f.type, size: f.size });
    }
    if (uploaded.length) onChange([...value, ...uploaded]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = async (idx: number) => {
    const file = value[idx];
    await supabase.storage.from("ib-request-attachments").remove([file.path]);
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <Paperclip className="w-3.5 h-3.5" />
        Archivos de referencia (opcional)
      </Label>
      <p className="text-[11px] text-muted-foreground">
        Sube imágenes o videos como referencia para operaciones. Máx {maxFiles} archivos, {maxSizeMB}MB c/u.
      </p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled || uploading) return;
          if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-border bg-secondary/20"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED.join(",")}
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          disabled={disabled || uploading}
        />
        <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
        <p className="text-xs text-muted-foreground mb-2">Arrastra archivos o</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading || value.length >= maxFiles}
        >
          {uploading ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Subiendo...</> : "Seleccionar archivos"}
        </Button>
      </div>

      {value.length > 0 && (
        <div className="space-y-1.5">
          {value.map((f, i) => (
            <div key={f.path} className="flex items-center gap-2 p-2 rounded-md border border-border bg-secondary/30 text-xs">
              {f.type.startsWith("video/") ? <Video className="w-3.5 h-3.5 text-primary shrink-0" /> : <ImageIcon className="w-3.5 h-3.5 text-primary shrink-0" />}
              <span className="flex-1 truncate text-foreground">{f.name}</span>
              <span className="text-muted-foreground">{(f.size / 1024 / 1024).toFixed(2)}MB</span>
              <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeFile(i)} disabled={disabled}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RequestAttachmentsUploader;
