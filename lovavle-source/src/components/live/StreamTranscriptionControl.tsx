import { useStreamTranscription } from "@/hooks/useStreamTranscription";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Brain, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";

interface Props {
  roomId: string;
  hostId: string;
}

const StreamTranscriptionControl = ({ roomId, hostId }: Props) => {
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

  // Auto-submit on stream end
  useEffect(() => {
    const handleEnd = () => {
      if (!submittedRef.current && fullTranscript.length > 50) {
        submittedRef.current = true;
        submitForAnalysis();
      }
    };
    window.addEventListener("bullfy-end-stream", handleEnd);
    return () => window.removeEventListener("bullfy-end-stream", handleEnd);
  }, [fullTranscript, submitForAnalysis]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isConnected) disconnect();
    };
  }, []);

  const wordCount = fullTranscript.split(/\s+/).filter(Boolean).length;

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-2">
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
      </div>

      {error && (
        <p className="text-[10px] text-destructive">{error}</p>
      )}

      {!isConnected ? (
        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs gap-1.5"
          onClick={connect}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <><Loader2 className="w-3 h-3 animate-spin" /> Conectando...</>
          ) : (
            <><Mic className="w-3 h-3" /> Activar Transcripción</>
          )}
        </Button>
      ) : (
        <>
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-xs gap-1.5 text-destructive"
            onClick={() => {
              if (!submittedRef.current && fullTranscript.length > 50) {
                submittedRef.current = true;
                submitForAnalysis();
              }
              disconnect();
            }}
          >
            <MicOff className="w-3 h-3" /> Detener
          </Button>
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

export default StreamTranscriptionControl;
