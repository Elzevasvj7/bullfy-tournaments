import { useState, useRef } from "react";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Video, Upload, CheckCircle, Loader2, X } from "lucide-react";
import IBContextBanner from "../IBContextBanner";

const MAX_SIZE_MB = 500;

const StepKickoffVideo = () => {
  const { formData, updateFormData, isTestMode } = useOnboardingStore();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleToggle = (val: boolean) => {
    updateFormData({ tiene_video_kickoff: val });
    if (!val) {
      updateFormData({ video_kickoff_file: null, video_kickoff_path: null });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast({ title: "Archivo muy grande", description: `Máximo ${MAX_SIZE_MB}MB`, variant: "destructive" });
      return;
    }

    if (!file.type.startsWith("video/")) {
      toast({ title: "Formato inválido", description: "Solo se permiten archivos de video", variant: "destructive" });
      return;
    }

    if (isTestMode) {
      updateFormData({ video_kickoff_file: file, video_kickoff_path: `test/${file.name}` });
      toast({ title: "🧪 Video seleccionado (Test)", description: file.name });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}_${formData.nombre_ib.replace(/\s+/g, "_")}.${ext}`;

      const { error } = await supabase.storage
        .from("kickoff-videos")
        .upload(path, file, { upsert: false });

      if (error) throw error;

      updateFormData({ video_kickoff_file: file, video_kickoff_path: path });
      toast({ title: "✅ Video subido", description: file.name });
    } catch (err: any) {
      toast({ title: "Error subiendo video", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (formData.video_kickoff_path && !isTestMode) {
      await supabase.storage.from("kickoff-videos").remove([formData.video_kickoff_path]);
    }
    updateFormData({ video_kickoff_file: null, video_kickoff_path: null });
    if (fileRef.current) fileRef.current.value = "";
  };

  const hasVideo = !!formData.video_kickoff_path;

  return (
    <div className="space-y-6">
      <IBContextBanner />
      <div>
        <h3 className="text-lg font-display font-bold text-foreground">Video Entrevista Kick-off</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Sube el video de la entrevista kick-off para tener un registro de lo acordado con el IB.
        </p>
      </div>

      <div className="rounded-lg border border-border p-6 space-y-5">
        <p className="text-sm font-medium text-foreground">¿Hay video de Kick-off para este IB?</p>
        <div className="flex gap-3">
          <Button
            type="button"
            variant={formData.tiene_video_kickoff ? "default" : "outline"}
            onClick={() => handleToggle(true)}
            className={formData.tiene_video_kickoff ? "bg-gradient-gold text-primary-foreground" : ""}
          >
            Sí
          </Button>
          <Button
            type="button"
            variant={!formData.tiene_video_kickoff ? "default" : "outline"}
            onClick={() => handleToggle(false)}
            className={!formData.tiene_video_kickoff ? "bg-gradient-gold text-primary-foreground" : ""}
          >
            No
          </Button>
        </div>

        {formData.tiene_video_kickoff && (
          <div className="space-y-4 pt-2">
            {!hasVideo ? (
              <div className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center gap-3 hover:border-primary/50 transition-colors">
                <Video className="w-10 h-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">
                  Arrastra el video aquí o haz clic para seleccionarlo
                </p>
                <p className="text-xs text-muted-foreground">
                  Formatos: MP4, MOV, AVI, WebM — Máx {MAX_SIZE_MB}MB
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="gap-2"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? "Subiendo..." : "Seleccionar Video"}
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-accent/30 bg-accent/5 p-4">
                <CheckCircle className="w-5 h-5 text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {formData.video_kickoff_file?.name || formData.video_kickoff_path}
                  </p>
                  <p className="text-xs text-muted-foreground">Video cargado correctamente</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleRemove}
                  className="shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StepKickoffVideo;
