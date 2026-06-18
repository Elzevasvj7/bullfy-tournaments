import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Languages, X } from "lucide-react";

const LANGS = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "ru", label: "Русский" },
];

interface Props {
  roomId: string;
}

interface SegmentRow {
  id: string;
  original_text: string;
  source_lang: string;
  created_at: string;
}

/**
 * Subtitles overlay for VIEWERS in a stream.
 * Subscribes to live_translation_segments for the room, translates each
 * incoming segment to the user's selected language, and shows the latest 2.
 */
const ViewerTranslationOverlay = ({ roomId }: Props) => {
  const [enabled, setEnabled] = useState(false);
  const [target, setTarget] = useState<string>(() => {
    return localStorage.getItem("bullfy-translation-lang") || "en";
  });
  const [lines, setLines] = useState<string[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    localStorage.setItem("bullfy-translation-lang", target);
  }, [target]);

  const translate = useCallback(async (row: SegmentRow) => {
    if (seenRef.current.has(row.id)) return;
    seenRef.current.add(row.id);
    try {
      const { data } = await supabase.functions.invoke("translate-segment", {
        body: { text: row.original_text, source_lang: row.source_lang, target_lang: target },
      });
      if (data?.ok && data.translation) {
        setLines((prev) => [...prev, data.translation as string].slice(-2));
      }
    } catch (err) {
      console.warn("[Translation] error:", err);
    }
  }, [target]);

  useEffect(() => {
    if (!enabled || !roomId) return;
    seenRef.current = new Set();
    setLines([]);

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("live_translation_segments")
        .select("id, original_text, source_lang, created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(2);
      if (cancelled || error || !data) return;
      data.reverse().forEach((row) => translate(row as SegmentRow));
    })();

    const channel = supabase
      .channel(`translation-${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_translation_segments", filter: `room_id=eq.${roomId}` },
        (payload) => translate(payload.new as SegmentRow)
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [enabled, roomId, translate]);

  if (!enabled) {
    return (
      <Button
        size="sm"
        variant="secondary"
        className="absolute top-3 right-3 z-30 gap-1.5 text-xs bg-background/80 backdrop-blur"
        onClick={() => setEnabled(true)}
      >
        <Languages className="w-3.5 h-3.5" /> Subtítulos
      </Button>
    );
  }

  return (
    <>
      <div className="absolute top-3 right-3 z-30 flex items-center gap-2 bg-background/80 backdrop-blur rounded-md px-2 py-1">
        <Languages className="w-3.5 h-3.5 text-primary" />
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger className="h-7 text-xs border-0 bg-transparent px-1 w-auto gap-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGS.map((l) => (
              <SelectItem key={l.code} value={l.code} className="text-xs">{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button onClick={() => setEnabled(false)} className="p-0.5 rounded hover:bg-muted">
          <X className="w-3 h-3" />
        </button>
      </div>

      {lines.length > 0 && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 max-w-[90%] pointer-events-none">
          <div className="bg-black/70 text-white text-sm md:text-base px-4 py-2 rounded-md text-center backdrop-blur space-y-1">
            {lines.map((line, i) => (
              <p key={i} className={i === lines.length - 1 ? "" : "opacity-60 text-xs"}>{line}</p>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default ViewerTranslationOverlay;
