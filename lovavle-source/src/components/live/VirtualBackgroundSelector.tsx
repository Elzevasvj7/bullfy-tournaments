import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/lib/toastUtils";
import { Trash2, Upload, CircleOff, Sparkles } from "lucide-react";

interface VirtualBg {
  id: string;
  name: string;
  file_path: string;
  bg_type: string;
  is_default: boolean;
}

interface VirtualBackgroundSelectorProps {
  videoTrack?: any;
}

/**
 * Dynamically loads @livekit/track-processors-js at runtime.
 * Returns null if the package is not installed.
 */
const getProcessors = (() => {
  let cached: any = undefined;
  return async () => {
    if (cached !== undefined) return cached;
    try {
      // @ts-ignore - CDN import (package renamed to @livekit/track-processors)
      cached = await import(/* @vite-ignore */ "https://esm.sh/@livekit/track-processors@0.7.2");
    } catch {
      cached = null;
    }
    return cached;
  };
})();

const VirtualBackgroundSelector = ({ videoTrack }: VirtualBackgroundSelectorProps) => {
  const { user } = useAuth();
  const [backgrounds, setBackgrounds] = useState<VirtualBg[]>([]);
  const [activeBg, setActiveBg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadBackgrounds();
  }, []);

  const loadBackgrounds = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("live_virtual_backgrounds")
      .select("*")
      .or(`is_default.eq.true,uploaded_by.eq.${user.id}`)
      .order("is_default", { ascending: false });
    if (data) setBackgrounds(data as any);
  };

  const handleUploadBg = async (file: File) => {
    if (!user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("live-backgrounds").upload(path, file);
    if (error) {
      toast.error("Error al subir fondo");
      setUploading(false);
      return;
    }
    await supabase.from("live_virtual_backgrounds").insert({
      name: file.name.replace(/\.[^.]+$/, ""),
      file_path: path,
      bg_type: "image",
      uploaded_by: user.id,
    });
    toast.success("Fondo agregado");
    loadBackgrounds();
    setUploading(false);
  };

  const handleDeleteBg = async (bg: VirtualBg) => {
    await supabase.storage.from("live-backgrounds").remove([bg.file_path]);
    await supabase.from("live_virtual_backgrounds").delete().eq("id", bg.id);
    if (activeBg === bg.id) await removeBackground();
    toast.success("Fondo eliminado");
    loadBackgrounds();
  };

  const applyBlur = useCallback(async (strength: "light" | "heavy") => {
    if (!videoTrack) { toast.error("No hay cámara activa"); return; }
    const mod = await getProcessors();
    if (!mod?.BackgroundProcessor) { toast.error("Procesador de fondos no disponible"); return; }
    try {
      const processor = mod.BackgroundProcessor({ mode: 'background-blur', blurRadius: strength === "light" ? 10 : 20 });
      await videoTrack.setProcessor(processor);
      setActiveBg(`blur-${strength}`);
      toast.success(`Blur ${strength === "light" ? "suave" : "fuerte"} aplicado`);
    } catch (err: any) {
      toast.error("Error al aplicar blur: " + (err.message || "No soportado"));
    }
  }, [videoTrack]);

  const applyImage = useCallback(async (bg: VirtualBg) => {
    if (!videoTrack) { toast.error("No hay cámara activa"); return; }
    const mod = await getProcessors();
    if (!mod?.BackgroundProcessor) { toast.error("Procesador de fondos no disponible"); return; }
    try {
      const { data } = supabase.storage.from("live-backgrounds").getPublicUrl(bg.file_path);
      const processor = mod.BackgroundProcessor({ mode: 'virtual-background', imagePath: data.publicUrl });
      await videoTrack.setProcessor(processor);
      setActiveBg(bg.id);
      toast.success("Fondo aplicado");
    } catch (err: any) {
      toast.error("Error: " + (err.message || "No soportado"));
    }
  }, [videoTrack]);

  const removeBackground = useCallback(async () => {
    if (!videoTrack) return;
    try {
      await videoTrack.stopProcessor();
      setActiveBg(null);
      toast.success("Fondo removido");
    } catch {}
  }, [videoTrack]);

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="w-4 h-4 text-primary" /> Fondos Virtuales
          </Label>
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={e => e.target.files?.[0] && handleUploadBg(e.target.files[0])}
              className="hidden"
              id="bg-upload"
            />
            <label htmlFor="bg-upload">
              <Button size="sm" variant="outline" className="gap-1 h-7 text-xs cursor-pointer" asChild disabled={uploading}>
                <span><Upload className="w-3 h-3" /> {uploading ? "Subiendo..." : "Subir"}</span>
              </Button>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {/* None */}
          <button
            onClick={removeBackground}
            className={`aspect-square rounded-lg border-2 flex flex-col items-center justify-center text-xs gap-1 transition-colors ${
              activeBg === null ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
            }`}
          >
            <CircleOff className="w-5 h-5 text-muted-foreground" />
            <span className="text-[10px]">Ninguno</span>
          </button>

          {/* Blur light */}
          <button
            onClick={() => applyBlur("light")}
            className={`aspect-square rounded-lg border-2 flex flex-col items-center justify-center text-xs gap-1 transition-colors ${
              activeBg === "blur-light" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
            }`}
          >
            <div className="w-8 h-8 rounded bg-gradient-to-br from-muted to-muted-foreground/20 blur-[2px]" />
            <span className="text-[10px]">Blur Suave</span>
          </button>

          {/* Blur heavy */}
          <button
            onClick={() => applyBlur("heavy")}
            className={`aspect-square rounded-lg border-2 flex flex-col items-center justify-center text-xs gap-1 transition-colors ${
              activeBg === "blur-heavy" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
            }`}
          >
            <div className="w-8 h-8 rounded bg-gradient-to-br from-muted to-muted-foreground/20 blur-[4px]" />
            <span className="text-[10px]">Blur Fuerte</span>
          </button>

          {/* Custom backgrounds */}
          {backgrounds.map(bg => {
            const { data } = supabase.storage.from("live-backgrounds").getPublicUrl(bg.file_path);
            return (
              <div key={bg.id} className="relative group">
                <button
                  onClick={() => applyImage(bg)}
                  className={`aspect-square rounded-lg border-2 overflow-hidden w-full transition-colors ${
                    activeBg === bg.id ? "border-primary" : "border-border hover:border-primary/50"
                  }`}
                >
                  <img src={data.publicUrl} alt={bg.name} className="w-full h-full object-cover" />
                </button>
                {!bg.is_default && (
                  <button
                    onClick={() => handleDeleteBg(bg)}
                    className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {!videoTrack && (
          <p className="text-[10px] text-muted-foreground text-center">
            Activa tu cámara para usar fondos virtuales
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default VirtualBackgroundSelector;
