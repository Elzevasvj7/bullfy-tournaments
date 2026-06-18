import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook for HOST: listens to live transcription chunks (broadcast by
 * AutoStreamTranscription via window event) and publishes them as
 * translation segments. Does NOT instantiate its own ElevenLabs Scribe
 * to avoid microphone conflicts with the active transcription.
 */
export function useTranslationPublisher(params: {
  roomId: string;
  hostId: string;
  enabled: boolean;
  sourceLang?: string;
}) {
  const { roomId, hostId, enabled, sourceLang = "es" } = params;
  const indexRef = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [lastPublishedAt, setLastPublishedAt] = useState<number | null>(null);
  const [lastDetectedAt, setLastDetectedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail as { roomId: string; hostId: string; text: string };
      if (!detail || detail.roomId !== roomId) return;
      const newPart = (detail.text || "").trim();
      if (!newPart || newPart.length < 3) return;
      setLastDetectedAt(Date.now());

      const idx = indexRef.current++;
      try {
        const { error: insertErr } = await supabase.from("live_translation_segments").insert({
          room_id: roomId,
          host_id: hostId,
          original_text: newPart,
          source_lang: sourceLang,
          segment_index: idx,
        });
        if (insertErr) {
          console.warn("[useTranslationPublisher] insert error:", insertErr);
          setError(insertErr.message);
        } else {
          setLastPublishedAt(Date.now());
          setError(null);
        }
      } catch (err: unknown) {
        console.warn("[useTranslationPublisher] insert failed:", err);
        setError(err instanceof Error ? err.message : "Error publicando segmento");
      }
    };

    window.addEventListener("bullfy-transcription-chunk", handler);
    return () => window.removeEventListener("bullfy-transcription-chunk", handler);
  }, [enabled, roomId, hostId, sourceLang]);

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { roomId: string; text: string };
      if (detail?.roomId === roomId && detail.text?.trim()) setLastDetectedAt(Date.now());
    };
    window.addEventListener("bullfy-transcription-live", handler);
    return () => window.removeEventListener("bullfy-transcription-live", handler);
  }, [enabled, roomId]);

  return {
    isActive: enabled,
    isConnecting: false,
    error,
    lastPublishedAt,
    lastDetectedAt,
  };
}
