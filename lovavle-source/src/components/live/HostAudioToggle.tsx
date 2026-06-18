import { useCallback, useEffect, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { Volume2, VolumeX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Host-side audio toggle. Mirrors ViewerAudioToggle but rendered for the host
 * so they can hear remote participants. Required because <RoomAudioRenderer />
 * needs an explicit user gesture to start playback in some browsers.
 */
const HostAudioToggle = () => {
  const lkRoom = useRoomContext();
  const [canPlay, setCanPlay] = useState(lkRoom.canPlaybackAudio);
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sync = (next: boolean) => setCanPlay(next);
    lkRoom.on(RoomEvent.AudioPlaybackStatusChanged, sync);
    return () => {
      lkRoom.off(RoomEvent.AudioPlaybackStatusChanged, sync);
    };
  }, [lkRoom]);

  const handleToggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const enable = muted || !canPlay;
      if (!enable) {
        setMuted(true);
        document.querySelectorAll<HTMLMediaElement>("audio").forEach((el) => {
          el.muted = true;
        });
      } else {
        setMuted(false);
        if (!lkRoom.canPlaybackAudio) {
          await lkRoom.startAudio();
        }
        document.querySelectorAll<HTMLMediaElement>("audio").forEach((el) => {
          el.muted = false;
          el.play?.().catch(() => undefined);
        });
        setCanPlay(true);
      }
    } catch (err) {
      console.error("HostAudioToggle error:", err);
    } finally {
      setBusy(false);
    }
  }, [busy, muted, canPlay, lkRoom]);

  const isActive = canPlay && !muted;

  return (
    <Button
      type="button"
      size="sm"
      variant={isActive ? "secondary" : "default"}
      onClick={handleToggle}
      disabled={busy}
      className="h-12 px-3 rounded-lg bg-zinc-800 border-b-2 border-white/10 hover:bg-zinc-700 flex flex-col items-center justify-center gap-1 text-white"
      title={isActive ? "Silenciar audio entrante" : "Habilitar audio entrante"}
    >
      {busy ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isActive ? (
        <Volume2 className="w-4 h-4" />
      ) : (
        <VolumeX className="w-4 h-4 text-amber-400" />
      )}
      <span className="text-[9px] font-bold uppercase tracking-wider">{isActive ? "Audio" : "Mute"}</span>
    </Button>
  );
};

export default HostAudioToggle;
