import { useState, useCallback, useRef } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";

export function useStreamTranscription(roomId: string, hostId: string) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fullTranscriptRef = useRef("");
  const [fullTranscript, setFullTranscript] = useState("");

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: () => {
      // handled via scribe.partialTranscript
    },
    onCommittedTranscript: (data) => {
      const text = data.text?.trim();
      if (text) {
        fullTranscriptRef.current += (fullTranscriptRef.current ? " " : "") + text;
        setFullTranscript(fullTranscriptRef.current);
      }
    },
    onError: (err) => {
      console.error("Scribe error:", err);
      setError("Error en transcripción");
    },
  });

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("elevenlabs-scribe-token");
      if (fnError || !data?.token) {
        throw new Error("No se pudo obtener token de transcripción");
      }

      await scribe.connect({
        token: data.token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err: any) {
      setError(err.message || "Error al conectar transcripción");
    } finally {
      setIsConnecting(false);
    }
  }, [scribe]);

  const disconnect = useCallback(() => {
    scribe.disconnect();
  }, [scribe]);

  const submitForAnalysis = useCallback(async () => {
    const transcript = fullTranscriptRef.current;
    if (!transcript || transcript.length < 50) return;

    // Step 1: Persist the transcript directly to DB FIRST (fast, ~50ms).
    // This guarantees the transcript is saved even if the component unmounts
    // before the analyze edge function finishes. A DB trigger will then
    // invoke analyze-stream-context to process it asynchronously.
    try {
      await supabase
        .from("live_stream_analysis")
        .upsert(
          {
            room_id: roomId,
            host_id: hostId,
            transcript,
            processing_status: "pending",
          },
          { onConflict: "room_id" }
        );
    } catch (err) {
      console.error("Failed to persist transcript:", err);
    }

    // Step 2: Best-effort direct invocation (may be aborted on unmount,
    // but the DB trigger will pick it up regardless).
    try {
      await supabase.functions.invoke("analyze-stream-context", {
        body: { room_id: roomId, host_id: hostId, transcript },
      });
    } catch (err) {
      console.error("Failed to submit stream analysis (will retry via trigger):", err);
    }
  }, [roomId, hostId]);

  return {
    isConnected: scribe.isConnected,
    isConnecting,
    partialTranscript: scribe.partialTranscript || "",
    fullTranscript,
    error,
    connect,
    disconnect,
    submitForAnalysis,
  };
}
