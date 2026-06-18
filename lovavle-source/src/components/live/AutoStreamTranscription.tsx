import { useCallback, useEffect, useRef } from "react";
import { useStreamTranscription } from "@/hooks/useStreamTranscription";
import { Badge } from "@/components/ui/badge";
import { Mic, Brain } from "lucide-react";

interface Props {
  roomId: string;
  hostId: string;
  isActive: boolean;
}

/**
 * Auto-activating transcription component.
 * Connects automatically on mount, submits on stream end or unmount.
 */
const AutoStreamTranscription = ({ roomId, hostId, isActive }: Props) => {
  const {
    isConnected,
    isConnecting,
    partialTranscript,
    fullTranscript,
    error,
    connect,
    disconnect,
    submitForAnalysis,
  } = useStreamTranscription(roomId, hostId);

  const submittedRef = useRef(false);
  const transcriptRef = useRef("");
  const submitRef = useRef(submitForAnalysis);
  const disconnectRef = useRef(disconnect);
  const wasActiveRef = useRef(false);
  const lastAutoSaveLenRef = useRef(0);
  const lastBroadcastRef = useRef("");

  // Keep refs fresh so cleanup/event handlers always see latest values
  useEffect(() => {
    transcriptRef.current = fullTranscript;
    submitRef.current = submitForAnalysis;
    disconnectRef.current = disconnect;
  }, [fullTranscript, submitForAnalysis, disconnect]);

  // Broadcast each new committed chunk so the translation publisher (if active) can pick it up
  useEffect(() => {
    const liveText = partialTranscript.trim();
    if (liveText.length >= 3) {
      window.dispatchEvent(new CustomEvent("bullfy-transcription-live", { detail: { roomId, hostId, text: liveText } }));
    }
  }, [partialTranscript, roomId, hostId]);

  useEffect(() => {
    const full = fullTranscript;
    if (!full) return;
    const prev = lastBroadcastRef.current;
    if (full === prev) return;
    const newPart = prev && full.startsWith(prev) ? full.slice(prev.length).trim() : full.trim();
    lastBroadcastRef.current = full;
    if (newPart && newPart.length >= 3) {
      window.dispatchEvent(new CustomEvent("bullfy-transcription-chunk", { detail: { roomId, hostId, text: newPart } }));
    }
  }, [fullTranscript, roomId, hostId]);

  const trySubmit = useCallback(() => {
    if (!submittedRef.current && transcriptRef.current.length > 50) {
      submittedRef.current = true;
      submitRef.current();
    }
  }, []);

  // Connect only while host microphone is enabled.
  // When mic turns OFF after being ON, submit transcript immediately.
  useEffect(() => {
    if (isActive && !isConnected && !isConnecting) {
      wasActiveRef.current = true;
      connect();
      return;
    }

    if (!isActive && isConnected) {
      disconnect();
    }

    // Mic just turned off → safety submit (host may end stream right after)
    if (!isActive && wasActiveRef.current) {
      trySubmit();
    }
  }, [connect, disconnect, isActive, isConnected, isConnecting, trySubmit]);

  // Auto-save transcript to DB every 30s while connected (safety net for abrupt closes)
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      const len = transcriptRef.current.length;
      if (len > 50 && len - lastAutoSaveLenRef.current > 100) {
        lastAutoSaveLenRef.current = len;
        // Fire-and-forget; uses upsert on room_id
        submitRef.current();
        // Reset submitted flag so the FINAL submit on end can still run
        submittedRef.current = false;
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [isConnected]);

  // Auto-submit on stream end (host pressed "Finalizar")
  useEffect(() => {
    const handleEnd = () => trySubmit();
    window.addEventListener("bullfy-end-stream", handleEnd);
    return () => window.removeEventListener("bullfy-end-stream", handleEnd);
  }, [trySubmit]);

  // Cleanup on unmount — uses refs so values are always fresh
  useEffect(() => {
    return () => {
      trySubmit();
      disconnectRef.current();
    };
  }, [trySubmit]);

  const wordCount = fullTranscript.split(/\s+/).filter(Boolean).length;

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-1">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5 text-primary" />
          Transcripción IA
        </h4>
        {isConnected && (
          <Badge variant="secondary" className="text-[10px] animate-pulse">
            <Mic className="w-2.5 h-2.5 mr-1" /> Escuchando
          </Badge>
        )}
        {isConnecting && (
          <Badge variant="outline" className="text-[10px]">Conectando...</Badge>
        )}
      </div>

      {error && (
        <p className="text-[10px] text-destructive">{error}</p>
      )}

      {!isActive && (
        <p className="text-[10px] text-muted-foreground">
          La transcripción se activa solo cuando enciendes tu micrófono.
        </p>
      )}

      {isConnected && (
        <>
          <div className="text-[10px] text-muted-foreground">
            {wordCount} palabras capturadas
          </div>
          {partialTranscript && (
            <p className="text-[10px] text-foreground/60 italic truncate">
              ...{partialTranscript}
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default AutoStreamTranscription;
