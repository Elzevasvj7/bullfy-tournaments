import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRoomContext, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toastUtils";
import { Circle, Square, Download, Sparkles } from "lucide-react";

interface StreamRecorderProps {
  roomId: string;
  userName: string;
}

const StreamRecorder = ({ roomId, userName }: StreamRecorderProps) => {
  const room = useRoomContext();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [autoClipEnabled, setAutoClipEnabled] = useState(false);
  const [hasAutoClipAccess, setHasAutoClipAccess] = useState(false);
  const [accessUserId, setAccessUserId] = useState<string | null>(null);

  // Load Video Studio auto-clip access + opt-in for current host
  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (!uid) return;
      setAccessUserId(uid);
      const { data } = await supabase
        .from("video_studio_access")
        .select("enabled, can_auto_clip, host_auto_clip_opt_in")
        .eq("user_id", uid)
        .maybeSingle();
      if (data?.enabled && data?.can_auto_clip) {
        setHasAutoClipAccess(true);
        setAutoClipEnabled(!!data.host_auto_clip_opt_in);
      }
    })();
  }, []);

  const toggleAutoClip = async (next: boolean) => {
    if (!accessUserId) return;
    setAutoClipEnabled(next);
    const { error } = await supabase
      .from("video_studio_access")
      .update({ host_auto_clip_opt_in: next })
      .eq("user_id", accessUserId);
    if (error) {
      setAutoClipEnabled(!next);
      toast.error("No se pudo guardar la preferencia");
    } else {
      toast.success(next ? "Auto-clips activados" : "Auto-clips desactivados");
    }
  };
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const recordingRef = useRef(false);
  const elapsedRef = useRef(0);
  const finalizeResolversRef = useRef<Array<() => void>>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const stopActiveRecording = useCallback((showToast = true) => {
    console.log("[StreamRecorder] stopRecording requested", {
      hasRecorder: !!recorderRef.current,
      state: recorderRef.current?.state,
      chunks: chunksRef.current.length,
    });

    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") {
      setRecording(false);
      recordingRef.current = false;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      finalizeResolversRef.current.push(finish);

      try { rec.requestData(); } catch (e) { console.warn("[StreamRecorder] requestData failed", e); }
      try { rec.stop(); } catch (e) { console.error("[StreamRecorder] stop() threw", e); finish(); }
      if (timerRef.current) clearInterval(timerRef.current);
      setRecording(false);
      recordingRef.current = false;
      if (showToast) toast.info("Deteniendo grabación, subiendo archivo…");
      setTimeout(finish, 60000);
    });
  }, []);

  // Listen for "stream is ending" requests and finalize recording first.
  useEffect(() => {
    const onFinalizeRequest = (e: Event) => {
      if (!recordingRef.current || !recorderRef.current || recorderRef.current.state === "inactive") return;
      try { (e as CustomEvent).preventDefault?.(); } catch {}
      window.dispatchEvent(new CustomEvent("stream-recording-finalizing"));
      const finalizer = stopActiveRecording(false).finally(() => {
        window.dispatchEvent(new CustomEvent("stream-recording-finalized"));
      });
      const detail = (e as CustomEvent<{ finalizers?: Promise<void>[] }>).detail;
      if (detail?.finalizers) detail.finalizers.push(finalizer);
    };
    window.addEventListener("stream-ending-request-finalize", onFinalizeRequest);
    return () => window.removeEventListener("stream-ending-request-finalize", onFinalizeRequest);
  }, [stopActiveRecording]);

  const startRecording = useCallback(async () => {
    try {
      // Get video element from the LiveKit layout
      const videoEl = document.querySelector(
        ".lk-grid-layout video, .lk-focus-layout video, [data-lk-source] video, video"
      ) as HTMLVideoElement | null;
      console.log("[StreamRecorder] startRecording", {
        videoFound: !!videoEl,
        videoReadyState: videoEl?.readyState,
        videoPaused: videoEl?.paused,
        captureStream: !!(videoEl as any)?.captureStream,
      });

      // Create AudioContext to mix all participant audio tracks
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const dest = audioCtx.createMediaStreamDestination();

      // Collect audio tracks from all remote participants via LiveKit
      const participants = Array.from(room.remoteParticipants.values());
      participants.forEach((p) => {
        p.audioTrackPublications.forEach((pub) => {
          const track = pub.track;
          if (track && track.mediaStream) {
            const source = audioCtx.createMediaStreamSource(track.mediaStream);
            source.connect(dest);
          }
        });
      });

      // Also capture local participant audio (microphone)
      const localAudioPubs = room.localParticipant.audioTrackPublications;
      localAudioPubs.forEach((pub) => {
        const track = pub.track;
        if (track && track.mediaStream) {
          const source = audioCtx.createMediaStreamSource(track.mediaStream);
          source.connect(dest);
        }
      });

      let stream: MediaStream;

      if (videoEl && (videoEl as any).captureStream) {
        // Capture video from the displayed element
        const videoStream = (videoEl as any).captureStream() as MediaStream;
        const vTracks = videoStream.getVideoTracks();
        console.log("[StreamRecorder] captureStream tracks:", vTracks.length);
        if (vTracks.length === 0) {
          throw new Error("El elemento de video aún no tiene contenido. Espera a que la cámara esté visible y vuelve a intentar.");
        }
        stream = new MediaStream([
          ...vTracks,
          ...dest.stream.getAudioTracks(),
        ]);
      } else {
        // Fallback: screen capture
        console.warn("[StreamRecorder] No video element with captureStream, falling back to getDisplayMedia");
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        stream = new MediaStream([
          ...displayStream.getVideoTracks(),
          ...dest.stream.getAudioTracks(),
          ...displayStream.getAudioTracks(),
        ]);
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : "video/webm",
      });

      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        console.log("[StreamRecorder] onstop fired", { chunks: chunksRef.current.length });
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const durationSec = elapsedRef.current;
        console.log("[StreamRecorder] blob built", { size: blob.size, durationSec });
        if (blob.size === 0) {
          toast.error("La grabación quedó vacía (no se capturó video). Revisa que la cámara esté visible al iniciar.");
        } else {
          await uploadRecording(blob, durationSec);
        }
        stream.getTracks().forEach((t) => t.stop());
        if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
          await audioCtxRef.current.close().catch((e) => console.warn("[StreamRecorder] AudioContext close ignored", e));
          audioCtxRef.current = null;
        }
        recorderRef.current = null;
        // Resolve any pending finalize promises
        const resolvers = finalizeResolversRef.current;
        finalizeResolversRef.current = [];
        resolvers.forEach((r) => r());
      };

      mediaRecorder.start(1000);
      recorderRef.current = mediaRecorder;
      setRecording(true);
      recordingRef.current = true;
      setElapsed(0);
      elapsedRef.current = 0;
      window.dispatchEvent(
        new CustomEvent("stream-recording-started", {
          detail: { startedAt: new Date().toISOString(), roomId },
        })
      );
      timerRef.current = setInterval(() => setElapsed((s) => {
        const next = s + 1;
        elapsedRef.current = next;
        return next;
      }), 1000);
      toast.success("Grabación iniciada");
    } catch (err: any) {
      toast.error("Error al iniciar grabación: " + err.message);
    }
  }, [roomId, room]);

  const stopRecording = useCallback(() => {
    if (!recorderRef.current || recorderRef.current.state === "inactive") {
      toast.warning("No hay grabación activa");
      setRecording(false);
      recordingRef.current = false;
      return;
    }
    void stopActiveRecording(true);
  }, [stopActiveRecording]);


  const uploadRecording = async (blob: Blob, durationSeconds: number) => {
    setUploading(true);
    const uploadStartedAt = new Date().toISOString();
    window.dispatchEvent(
      new CustomEvent("stream-recording-upload-start", {
        detail: { startedAt: uploadStartedAt, durationSec: durationSeconds, roomId },
      })
    );
    try {
      const { data: session } = await supabase.auth.getSession();
      console.log("[StreamRecorder] uploadRecording: session?", !!session?.session);
      if (!session?.session) throw new Error("No hay sesión activa de Supabase para subir la grabación");

      const fileName = `${roomId}/${Date.now()}.webm`;
      console.log("[StreamRecorder] uploading to storage", { fileName, size: blob.size });
      const { error: uploadErr } = await supabase.storage
        .from("live-recordings")
        .upload(fileName, blob, { contentType: "video/webm" });

      if (uploadErr) {
        console.error("[StreamRecorder] storage upload error", uploadErr);
        throw uploadErr;
      }

      const { data: inserted, error: insertErr } = await supabase
        .from("live_recordings")
        .insert({
          room_id: roomId,
          file_path: fileName,
          file_size: blob.size,
          duration_seconds: durationSeconds,
          recorded_by: userName,
        })
        .select("id")
        .single();
      if (insertErr) {
        console.error("[StreamRecorder] DB insert error", insertErr);
        throw insertErr;
      }
      console.log("[StreamRecorder] live_recordings row created", inserted?.id);

      window.dispatchEvent(
        new CustomEvent("stream-recording-uploaded", {
          detail: {
            recordingId: inserted?.id,
            finishedAt: new Date().toISOString(),
            roomId,
            fileSize: blob.size,
            durationSec: durationSeconds,
          },
        })
      );

      toast.success("Grabación guardada exitosamente");

      // Fire-and-forget: try to publish as Academy lesson if portal has feature enabled
      if (inserted?.id) {
        supabase.functions
          .invoke("save-recording-to-academy", { body: { recording_id: inserted.id } })
          .then(({ data, error }) => {
            if (error) return;
            if (data?.lesson_id) {
              toast.success("📚 Publicada como clase en Academy");
            }
          })
          .catch(() => {});
      }
    } catch (err: any) {
      window.dispatchEvent(
        new CustomEvent("stream-recording-upload-failed", {
          detail: { error: err?.message || String(err), finishedAt: new Date().toISOString(), roomId },
        })
      );
      toast.error("Error al guardar grabación: " + err.message);
      // Offer local download as fallback
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stream-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      toast.info("Se descargó localmente como respaldo");
    }
    setUploading(false);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2">
      {recording ? (
        <>
          <Badge variant="destructive" className="animate-pulse text-xs gap-1">
            <Circle className="w-2 h-2 fill-current" /> REC {formatTime(elapsed)}
          </Badge>
          <Button size="sm" variant="outline" onClick={stopRecording} className="gap-1 h-7 text-xs">
            <Square className="w-3 h-3" /> Detener
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={startRecording}
          disabled={uploading}
          className="gap-1 h-7 text-xs"
        >
          {uploading ? (
            "Subiendo..."
          ) : (
            <>
              <Circle className="w-3 h-3 text-destructive" /> Grabar
            </>
          )}
        </Button>
      )}
      {hasAutoClipAccess && (
        <div className="flex items-center gap-1.5 pl-2 ml-1 border-l border-border">
          <Sparkles className="w-3 h-3 text-primary" />
          <Switch
            id="auto-clip-toggle"
            checked={autoClipEnabled}
            onCheckedChange={toggleAutoClip}
            className="scale-75"
          />
          <Label htmlFor="auto-clip-toggle" className="text-[10px] cursor-pointer">
            Auto-clips
          </Label>
        </div>
      )}
      {/* Floating REC indicator + Stop button — always visible while recording,
          even when the user navigates to another sidebar tab or hides the panel. */}
      {(recording || uploading) && typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed top-3 right-3 z-[200] flex items-center gap-2 rounded-full bg-background/95 backdrop-blur-md border border-border shadow-2xl px-3 py-1.5"
            style={{ pointerEvents: "auto" }}
          >
            {recording ? (
              <>
                <Badge variant="destructive" className="animate-pulse text-xs gap-1">
                  <Circle className="w-2 h-2 fill-current" /> REC {formatTime(elapsed)}
                </Badge>
                <Button size="sm" variant="outline" onClick={stopRecording} className="gap-1 h-7 text-xs">
                  <Square className="w-3 h-3" /> Detener
                </Button>
              </>
            ) : (
              <Badge variant="outline" className="text-xs gap-1">
                <Circle className="w-2 h-2 animate-pulse text-primary" /> Subiendo grabación…
              </Badge>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};

export default StreamRecorder;
