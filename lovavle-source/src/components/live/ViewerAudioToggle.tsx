import { useCallback, useEffect, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { Volume2, VolumeX, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLiveKitReady } from "@/hooks/useLiveKitReady";

const MEDIA_SELECTOR = "audio, video";

interface ViewerAudioToggleProps {
  /** "footer" = full-width pill (legacy). "header" = compact icon button */
  variant?: "footer" | "header";
}

const ViewerAudioToggle = ({ variant = "header" }: ViewerAudioToggleProps = {}) => {
  const lkRoom = useRoomContext();
  const isLkReady = useLiveKitReady(lkRoom);
  const [canPlayAudio, setCanPlayAudio] = useState(lkRoom.canPlaybackAudio);
  const [manuallyMuted, setManuallyMuted] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const applyMediaState = useCallback((muted: boolean) => {
    const mediaElements = document.querySelectorAll<HTMLMediaElement>(MEDIA_SELECTOR);

    mediaElements.forEach((media) => {
      media.muted = muted;
      media.volume = muted ? 0 : 1;

      if (!muted) {
        media.play?.().catch(() => undefined);
      }
    });
  }, []);

  useEffect(() => {
    applyMediaState(manuallyMuted || !canPlayAudio);
  }, [applyMediaState, canPlayAudio, manuallyMuted]);

  useEffect(() => {
    if (!lkRoom || !isLkReady) return;

    const syncPlaybackState = (nextCanPlayAudio: boolean) => {
      setCanPlayAudio(nextCanPlayAudio);
    };

    lkRoom.on(RoomEvent.AudioPlaybackStatusChanged, syncPlaybackState);

    return () => {
      lkRoom.off(RoomEvent.AudioPlaybackStatusChanged, syncPlaybackState);
    };
  }, [lkRoom, isLkReady]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      applyMediaState(manuallyMuted || !canPlayAudio);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [applyMediaState, canPlayAudio, manuallyMuted]);

  const handleToggleAudio = useCallback(async () => {
    if (isToggling) return;

    setIsToggling(true);

    try {
      const shouldEnableAudio = manuallyMuted || !canPlayAudio;

      if (!shouldEnableAudio) {
        setManuallyMuted(true);
        applyMediaState(true);
        return;
      }

      setManuallyMuted(false);

      if (!lkRoom.canPlaybackAudio) {
        await lkRoom.startAudio();
      }

      const audioContext = (lkRoom as unknown as { audioContext?: AudioContext }).audioContext;
      if (audioContext && audioContext.state !== "running") {
        await audioContext.resume();
      }

      setCanPlayAudio(true);
      applyMediaState(false);
    } catch (error) {
      console.error("Failed to toggle viewer audio:", error);
      setCanPlayAudio(false);
    } finally {
      setIsToggling(false);
    }
  }, [applyMediaState, canPlayAudio, isToggling, lkRoom, manuallyMuted]);

  const isAudioActive = canPlayAudio && !manuallyMuted;

  if (variant === "header") {
    return (
      <Button
        type="button"
        size="sm"
        variant={isAudioActive ? "secondary" : "default"}
        onClick={handleToggleAudio}
        disabled={isToggling}
        className="h-8 px-2.5 gap-1.5 text-xs rounded-md"
        title={isAudioActive ? "Deshabilitar audio" : "Habilitar audio"}
      >
        {isToggling ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isAudioActive ? (
          <Volume2 className="h-3.5 w-3.5" />
        ) : (
          <VolumeX className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">Audio</span>
      </Button>
    );
  }

  return (
    <div className="shrink-0 flex justify-center px-3 py-2 bg-black/80 border-t border-white/10">
      <Button
        type="button"
        size="sm"
        variant={isAudioActive ? "secondary" : "default"}
        onClick={handleToggleAudio}
        disabled={isToggling}
        className="h-9 w-full max-w-sm rounded-full border border-border px-4 shadow-lg"
      >
        {isToggling ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Procesando audio...
          </>
        ) : isAudioActive ? (
          <>
            <VolumeX className="h-4 w-4" /> Deshabilitar audio
          </>
        ) : (
          <>
            <Volume2 className="h-4 w-4" /> Habilitar audio
          </>
        )}
      </Button>
    </div>
  );
};

export default ViewerAudioToggle;