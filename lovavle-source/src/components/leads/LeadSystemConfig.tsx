import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Settings2, Volume2, Music, Mic, Upload, Trash2, Play, Loader2, Send } from "lucide-react";
import { toast } from "@/lib/toastUtils";
import BrandVoicesPanel from "./BrandVoicesPanel";

interface LeadSystemConfigData {
  welcome_message: string;
  welcome_voice: string;
  welcome_language: string;
  welcome_audio_url: string;
  welcome_mode: "tts" | "audio";
  hold_music_enabled: boolean;
  hold_music_url: string;
  end_call_message: string;
  telegram_enabled?: boolean;
  telegram_required_in_registration?: boolean;
}

const DEFAULT_CONFIG: LeadSystemConfigData = {
  welcome_message: "Gracias por atender, un asesor de Bullfy se comunicará con usted en breve. Por favor espere en la línea.",
  welcome_voice: "Polly.Mia",
  welcome_language: "es-MX",
  welcome_audio_url: "",
  welcome_mode: "tts",
  hold_music_enabled: true,
  hold_music_url: "https://api.twilio.com/cowbell.mp3",
  end_call_message: "La llamada ha terminado. Gracias por su tiempo.",
  telegram_enabled: false,
  telegram_required_in_registration: false,
};

const VOICE_OPTIONS = [
  { value: "Polly.Mia", label: "Mia (Española - Natural)" },
  { value: "Polly.Lupe", label: "Lupe (Latina - Natural)" },
  { value: "Polly.Penelope", label: "Penélope (Latina - Estándar)" },
  { value: "Polly.Miguel", label: "Miguel (Latino - Estándar)" },
  { value: "Polly.Andres", label: "Andrés (Latino - Neural)" },
  { value: "alice", label: "Alice (Twilio estándar)" },
];

const LANGUAGE_OPTIONS = [
  { value: "es-MX", label: "Español (México)" },
  { value: "es-ES", label: "Español (España)" },
  { value: "es-US", label: "Español (EE.UU.)" },
  { value: "en-US", label: "Inglés (EE.UU.)" },
  { value: "pt-BR", label: "Portugués (Brasil)" },
];

const HOLD_MUSIC_OPTIONS = [
  { value: "https://api.twilio.com/cowbell.mp3", label: "Twilio Cowbell (por defecto)" },
  { value: "http://com.twilio.sounds.music.s3.amazonaws.com/MARKOVICHAMP-B8.mp3", label: "Clásico suave" },
  { value: "http://com.twilio.sounds.music.s3.amazonaws.com/oldDog_-_endless_goodbye_%28instr.%29.mp3", label: "Ambient tranquilo" },
  { value: "http://com.twilio.sounds.music.s3.amazonaws.com/ClockworkWaltz.mp3", label: "Vals elegante" },
  { value: "custom", label: "URL personalizada" },
];

const LeadSystemConfig = () => {
  const qc = useQueryClient();
  const [config, setConfig] = useState<LeadSystemConfigData>(DEFAULT_CONFIG);
  const [customMusicUrl, setCustomMusicUrl] = useState("");
  const [selectedMusicOption, setSelectedMusicOption] = useState(DEFAULT_CONFIG.hold_music_url);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: savedConfig, isLoading } = useQuery({
    queryKey: ["lead-system-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_settings")
        .select("*")
        .eq("service_name", "lead_system_config")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (savedConfig?.config) {
      const c = savedConfig.config as unknown as LeadSystemConfigData;
      const merged = { ...DEFAULT_CONFIG, ...c };
      setConfig(merged);
      const isPreset = HOLD_MUSIC_OPTIONS.some(o => o.value !== "custom" && o.value === merged.hold_music_url);
      if (isPreset) {
        setSelectedMusicOption(merged.hold_music_url);
      } else {
        setSelectedMusicOption("custom");
        setCustomMusicUrl(merged.hold_music_url);
      }
    }
  }, [savedConfig]);

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      toast.error("Solo se permiten archivos de audio (MP3, WAV, etc.)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("El archivo no debe superar 10 MB");
      return;
    }

    setUploading(true);
    try {
      const fileName = `welcome-message-${Date.now()}.${file.name.split(".").pop()}`;

      // Delete previous file if exists
      if (config.welcome_audio_url) {
        const oldPath = config.welcome_audio_url.split("/call-audio/")[1];
        if (oldPath) {
          await supabase.storage.from("call-audio").remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from("call-audio")
        .upload(fileName, file, { contentType: file.type, upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("call-audio").getPublicUrl(fileName);

      setConfig(prev => ({
        ...prev,
        welcome_audio_url: urlData.publicUrl,
        welcome_mode: "audio",
      }));

      toast.success("Audio subido correctamente");
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error("Error al subir audio: " + (err.message || ""));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAudio = async () => {
    if (config.welcome_audio_url) {
      const path = config.welcome_audio_url.split("/call-audio/")[1];
      if (path) {
        await supabase.storage.from("call-audio").remove([path]);
      }
    }
    setConfig(prev => ({
      ...prev,
      welcome_audio_url: "",
      welcome_mode: "tts",
    }));
    toast.success("Audio eliminado");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const finalConfig = {
        ...config,
        hold_music_url: selectedMusicOption === "custom" ? customMusicUrl : selectedMusicOption,
      };

      if (savedConfig) {
        const { error } = await supabase
          .from("integration_settings")
          .update({ config: finalConfig as any, updated_at: new Date().toISOString() })
          .eq("id", savedConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("integration_settings")
          .insert({
            service_name: "lead_system_config",
            enabled: true,
            config: finalConfig as any,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-system-config"] });
      toast.success("Configuración de llamadas guardada");
    },
    onError: () => toast.error("Error al guardar configuración"),
  });

  if (isLoading) {
    return <div className="text-muted-foreground text-sm p-8 text-center">Cargando configuración...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings2 className="w-5 h-5 text-primary" />
        <div>
          <h3 className="text-lg font-semibold text-foreground">Configuración del Lead System</h3>
          <p className="text-sm text-muted-foreground">Configura el mensaje de bienvenida, voz y música de espera para todas las llamadas.</p>
        </div>
      </div>

      {/* Welcome Message */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Mic className="w-4 h-4 text-primary" />
            Mensaje de Bienvenida
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Este mensaje se reproduce automáticamente cuando el lead contesta la llamada, antes de conectar con el agente.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode selector */}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={config.welcome_mode === "audio" ? "default" : "outline"}
              className="gap-1.5"
              onClick={() => setConfig(prev => ({ ...prev, welcome_mode: "audio" }))}
            >
              <Upload className="w-3.5 h-3.5" />
              Audio grabado
            </Button>
            <Button
              type="button"
              size="sm"
              variant={config.welcome_mode === "tts" ? "default" : "outline"}
              className="gap-1.5"
              onClick={() => setConfig(prev => ({ ...prev, welcome_mode: "tts" }))}
            >
              <Volume2 className="w-3.5 h-3.5" />
              Texto a voz (TTS)
            </Button>
          </div>

          {/* Audio mode */}
          {config.welcome_mode === "audio" && (
            <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
              {config.welcome_audio_url ? (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Audio actual</Label>
                  <div className="flex items-center gap-3">
                    <audio controls className="flex-1 h-10" src={config.welcome_audio_url}>
                      Tu navegador no soporta audio.
                    </audio>
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="h-8 w-8 shrink-0"
                      onClick={handleRemoveAudio}
                      title="Eliminar audio"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No hay audio subido. Sube un archivo MP3 o WAV.</p>
              )}

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/mpeg,audio/wav,audio/mp3,audio/x-wav"
                  className="hidden"
                  onChange={handleAudioUpload}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  {uploading ? "Subiendo..." : "Subir audio MP3/WAV"}
                </Button>
                <p className="text-xs text-muted-foreground mt-1">Máx. 10 MB. Formatos: MP3, WAV.</p>
              </div>
            </div>
          )}

          {/* TTS mode */}
          {config.welcome_mode === "tts" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Mensaje</Label>
                <Textarea
                  value={config.welcome_message}
                  onChange={(e) => setConfig({ ...config, welcome_message: e.target.value })}
                  placeholder="Gracias por atender, un asesor se comunicará con usted..."
                  rows={3}
                  className="text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Voz</Label>
                  <Select value={config.welcome_voice} onValueChange={(v) => setConfig({ ...config, welcome_voice: v })}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VOICE_OPTIONS.map((v) => (
                        <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Idioma</Label>
                  <Select value={config.welcome_language} onValueChange={(v) => setConfig({ ...config, welcome_language: v })}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_OPTIONS.map((l) => (
                        <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Hold Music */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Music className="w-4 h-4 text-primary" />
            Música de Espera
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Música que se reproduce mientras se conecta al agente con el lead.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Activar música de espera</Label>
            <Switch
              checked={config.hold_music_enabled}
              onCheckedChange={(v) => setConfig({ ...config, hold_music_enabled: v })}
            />
          </div>

          {config.hold_music_enabled && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Seleccionar música</Label>
                <Select value={selectedMusicOption} onValueChange={setSelectedMusicOption}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOLD_MUSIC_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedMusicOption === "custom" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">URL del archivo de música (MP3)</Label>
                  <Input
                    value={customMusicUrl}
                    onChange={(e) => setCustomMusicUrl(e.target.value)}
                    placeholder="https://example.com/music.mp3"
                    className="text-sm"
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* End Call Message */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-primary" />
            Mensaje de Finalización
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Mensaje al terminar la llamada</Label>
            <Input
              value={config.end_call_message}
              onChange={(e) => setConfig({ ...config, end_call_message: e.target.value })}
              placeholder="La llamada ha terminado. Gracias."
              className="text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Telegram */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Send className="w-4 h-4 text-sky-500" />
            Telegram (saliente)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Permite a los vendedores iniciar conversaciones con leads vía mensaje, nota de voz TTS o llamada deep link. Bot: <span className="font-mono">@bullfy_contact_bot</span>
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs font-medium">Activar Telegram en Lead System</Label>
              <p className="text-[11px] text-muted-foreground">Habilita el botón Telegram en los leads y el panel de chat.</p>
            </div>
            <Switch
              checked={!!config.telegram_enabled}
              onCheckedChange={(v) => setConfig({ ...config, telegram_enabled: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs font-medium">Obligatorio en el registro del stream</Label>
              <p className="text-[11px] text-muted-foreground">Si está activo, el lead debe vincular Telegram al registrarse antes de entrar al stream.</p>
            </div>
            <Switch
              checked={!!config.telegram_required_in_registration}
              onCheckedChange={(v) => setConfig({ ...config, telegram_required_in_registration: v })}
              disabled={!config.telegram_enabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Voces de marca */}
      <BrandVoicesPanel />



      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Guardando..." : "Guardar Configuración"}
        </Button>
      </div>
    </div>
  );
};

export default LeadSystemConfig;
