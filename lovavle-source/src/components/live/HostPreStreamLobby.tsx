import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, CameraOff, Mic, MicOff, Radio, X } from "lucide-react";
import JoinRequestsPanel from "./JoinRequestsPanel";
import logoSrc from "@/assets/logo-bullfy.png";

interface HostPreStreamLobbyProps {
  roomId: string;
  roomTitle: string;
  roomType: "meeting" | "webinar_pro" | "bullfy_family";
  starting: boolean;
  onStart: () => void;
  onCancel: () => void;
  invitationButton?: React.ReactNode;
}

/**
 * Pre-stream lobby for the host.
 * Shows a local camera/mic preview + the JoinRequestsPanel so the host can approve
 * waiting guests BEFORE going live. Approved guests stay in their waiting screen
 * until the host clicks "Iniciar transmisión".
 */
const HostPreStreamLobby = ({
  roomId,
  roomTitle,
  roomType,
  starting,
  onStart,
  onCancel,
  invitationButton,
}: HostPreStreamLobbyProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Acquire local preview stream (independent of LiveKit)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (e: any) {
        setError(e?.message || "No se pudo acceder a cámara/micrófono");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const toggleCam = () => {
    const next = !camOn;
    setCamOn(next);
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
  };

  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
  };

  const modeLabel =
    roomType === "meeting" ? "Meeting" : roomType === "webinar_pro" ? "Webinar Pro" : "Bullfy Family";

  return (
    <div className="flex flex-col h-full bg-[#031633] text-slate-100 rounded-lg overflow-hidden border border-white/10">
      {/* Header */}
      <header className="h-14 border-b border-white/10 bg-[#062B63]/50 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <img src={logoSrc} alt="Bullfy" className="h-7 w-auto" />
          <div className="h-4 w-px bg-white/10" />
          <Badge variant="outline" className="border-amber-400/40 text-amber-300 bg-amber-500/10 text-[10px]">
            SALA DE ESPERA
          </Badge>
          <h1 className="text-sm font-medium tracking-tight truncate">{roomTitle}</h1>
          <Badge variant="secondary" className="text-[10px]">{modeLabel}</Badge>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {invitationButton}
          <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1.5 h-8 text-xs text-white/70 hover:text-white">
            <X className="w-3.5 h-3.5" /> Cancelar
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-auto min-h-0">
        {/* Left: Camera preview */}
        <section className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-white/10">
            {error ? (
              <div className="absolute inset-0 flex items-center justify-center text-center p-6">
                <div>
                  <CameraOff className="w-10 h-10 text-red-400 mx-auto mb-2" />
                  <p className="text-sm text-white/80">{error}</p>
                  <p className="text-xs text-white/50 mt-1">Permite el acceso a cámara y micrófono.</p>
                </div>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity ${camOn ? "opacity-100" : "opacity-0"}`}
                />
                {!camOn && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#062B63] to-[#031633]">
                    <div className="size-24 rounded-full bg-white/10 flex items-center justify-center">
                      <CameraOff className="w-10 h-10 text-white/60" />
                    </div>
                  </div>
                )}
                <div className="absolute top-3 left-3">
                  <span className="px-2 py-0.5 bg-primary text-[10px] font-bold text-white uppercase rounded">Tú (Host)</span>
                </div>
              </>
            )}
          </div>

          {/* Preview controls */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant={camOn ? "default" : "outline"}
              size="sm"
              onClick={toggleCam}
              className="gap-1.5"
            >
              {camOn ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
              {camOn ? "Cámara on" : "Cámara off"}
            </Button>
            <Button
              variant={micOn ? "default" : "outline"}
              size="sm"
              onClick={toggleMic}
              className="gap-1.5"
            >
              {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              {micOn ? "Mic on" : "Mic off"}
            </Button>
          </div>

          {/* Big start button */}
          <div className="mt-2 flex justify-center">
            <Button
              size="lg"
              onClick={onStart}
              disabled={starting}
              className="gap-2 px-8 h-12 text-base bg-red-600 hover:bg-red-700 text-white shadow-[0_0_24px_rgba(239,68,68,0.45)]"
            >
              <Radio className="w-5 h-5" />
              {starting ? "Iniciando..." : "Iniciar transmisión en vivo"}
            </Button>
          </div>

          <p className="text-center text-[11px] text-white/50">
            Los invitados aprobados verán la sala de espera hasta que pulses "Iniciar transmisión".
          </p>
        </section>

        {/* Right: Join requests + tips */}
        <aside className="w-full lg:w-[340px] shrink-0 space-y-3">
          <JoinRequestsPanel roomId={roomId} />

          <Card className="bg-[#062B63]/40 border-white/10 text-slate-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-white/70">Antes de iniciar</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-white/70 space-y-1.5">
              <p>• Comparte el link de invitación a tus participantes.</p>
              <p>• Aprueba a los invitados o activa "Auto-aceptar".</p>
              <p>• Cuando estés listo, pulsa <span className="text-white font-semibold">Iniciar transmisión</span>.</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
};

export default HostPreStreamLobby;
