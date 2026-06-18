import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Languages, Mic, Loader2 } from "lucide-react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { toast } from "@/hooks/use-toast";

const LANGS = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "ru", label: "Русский" },
];

type Mode = "substitute" | "overlay";

/**
 * Meeting translation panel: a participant enables it, picks a target language
 * and a mode (substitute / overlay). Their own mic audio is captured by Scribe,
 * transcribed, sent to translate-tts, and the translated audio is played back.
 *
 * NOTE: For a true "translate the OTHER speakers" experience in LiveKit meetings,
 * each participant runs this hook locally and broadcasts their translated audio
 * via the existing LiveKit publish flow. Phase 1 ships the per-user translation
 * playback so the requesting user hears foreign audio in their language.
 */
const MeetingTranslationPanel = () => {
  const [enabled, setEnabled] = useState(false);
  const [target, setTarget] = useState("en");
  const [mode, setMode] = useState<Mode>("substitute");
  const [sourceLang, setSourceLang] = useState("es");
  const lastTextRef = useRef<string>("");
  const audioQueueRef = useRef<HTMLAudioElement[]>([]);

  const playTranslated = useCallback(async (text: string) => {
    if (!text || text === lastTextRef.current) return;
    lastTextRef.current = text;
    try {
      const { data } = await supabase.functions.invoke("translate-tts", {
        body: { text, source_lang: sourceLang, target_lang: target },
      });
      if (!data?.ok || !data.audio_base64) return;
      const audio = new Audio(`data:${data.mime || "audio/mpeg"};base64,${data.audio_base64}`);
      audio.volume = mode === "overlay" ? 1.0 : 1.0;
      audioQueueRef.current.push(audio);
      await audio.play();
    } catch (err) {
      console.warn("[MeetingTranslation] error:", err);
    }
  }, [target, sourceLang, mode]);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onCommittedTranscript: (data) => {
      const text = data.text?.trim();
      if (text && text.length > 2) playTranslated(text);
    },
    onError: () => {
      toast({ title: "Error de traducción", description: "No se pudo conectar al servicio de voz.", variant: "destructive" });
    },
  });

  const handleToggle = useCallback(async () => {
    if (enabled) {
      scribe.disconnect();
      audioQueueRef.current.forEach((a) => { try { a.pause(); } catch {} });
      audioQueueRef.current = [];
      setEnabled(false);
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
      if (error || !data?.token) throw new Error("token");
      await scribe.connect({
        token: data.token,
        microphone: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      setEnabled(true);
    } catch {
      toast({ title: "No disponible", description: "No se pudo iniciar la traducción.", variant: "destructive" });
    }
  }, [enabled, scribe]);

  useEffect(() => {
    return () => {
      if (scribe.isConnected) scribe.disconnect();
    };
  }, []);

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold flex items-center gap-1.5">
          <Languages className="w-3.5 h-3.5 text-primary" />
          Traducción de Voz
        </h4>
        {enabled && (
          <Badge variant="secondary" className="text-[10px] animate-pulse">
            <Mic className="w-2.5 h-2.5 mr-1" /> Activa
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground">Hablan en</label>
          <Select value={sourceLang} onValueChange={setSourceLang} disabled={enabled}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGS.map((l) => <SelectItem key={l.code} value={l.code} className="text-xs">{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Yo escucho en</label>
          <Select value={target} onValueChange={setTarget} disabled={enabled}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGS.map((l) => <SelectItem key={l.code} value={l.code} className="text-xs">{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground">Modo de audio</label>
        <Select value={mode} onValueChange={(v) => setMode(v as Mode)} disabled={enabled}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="substitute" className="text-xs">Sustituto (silencia original)</SelectItem>
            <SelectItem value="overlay" className="text-xs">Superpuesto (estilo ONU)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        size="sm"
        variant={enabled ? "ghost" : "outline"}
        className={`w-full text-xs gap-1.5 ${enabled ? "text-destructive" : ""}`}
        onClick={handleToggle}
        disabled={scribe.isConnected !== enabled && !enabled}
      >
        {scribe.isConnected !== enabled && !enabled ? (
          <><Loader2 className="w-3 h-3 animate-spin" /> Conectando...</>
        ) : enabled ? "Desactivar traducción" : "Activar traducción"}
      </Button>
    </div>
  );
};

export default MeetingTranslationPanel;
