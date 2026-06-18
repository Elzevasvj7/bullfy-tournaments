import { useTracks, useParticipants, type TrackReferenceOrPlaceholder } from "@livekit/components-react";
import { Track, type Participant, type TrackPublication } from "livekit-client";
import { useMemo, useRef } from "react";
import { MicOff } from "lucide-react";
import HostCameraBubble from "./HostCameraBubble";

interface BroadcastStageProps {
  isHost?: boolean;
}

/**
 * BroadcastStage — exclusive layout for "broadcast" (Stream) mode.
 *
 * Rules:
 * - Viewers see ONLY publishers (Host + Co-hosts). Never themselves, never other viewers.
 * - Host sees ONLY publishers (himself + co-hosts he invited). Never viewers.
 * - 1 publisher  -> fullscreen.
 * - 2 publishers -> 50/50 split (host left, co-host right).
 * - 3+ publishers -> main publisher (host) large, others as a strip below.
 * - When a single publisher is sharing screen AND has camera on, screen goes fullscreen
 *   and camera floats as a draggable circular bubble (PiP). Each viewer controls position locally.
 *
 * Host/co-host detection: participant.permissions?.canPublish === true.
 */
const BroadcastStage = ({ isHost = false }: BroadcastStageProps) => {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );
  const allParticipants = useParticipants();
  const containerRef = useRef<HTMLDivElement>(null);

  const { publisherTiles, screenShareWithCamera } = useMemo(() => {
    const publishers = allParticipants.filter((p) => {
      const canPublish = p.permissions?.canPublish === true;
      if (!canPublish) return false;
      if (p.isLocal) return isHost;
      return true;
    });

    // Build per-participant track maps
    const camByIdentity = new Map<string, TrackReferenceOrPlaceholder>();
    const screenByIdentity = new Map<string, TrackReferenceOrPlaceholder>();
    const publisherIdentities = new Set(publishers.map((p) => p.identity));

    for (const t of tracks) {
      if (!publisherIdentities.has(t.participant.identity)) continue;
      if (t.source === Track.Source.ScreenShare) {
        screenByIdentity.set(t.participant.identity, t);
      } else if (t.source === Track.Source.Camera) {
        camByIdentity.set(t.participant.identity, t);
      }
    }

    const byIdentity = new Map<string, { participant: Participant; trackRef?: TrackReferenceOrPlaceholder }>();
    for (const p of publishers) {
      const screen = screenByIdentity.get(p.identity);
      const cam = camByIdentity.get(p.identity);
      // Prefer screen as the main tile
      byIdentity.set(p.identity, { participant: p, trackRef: screen ?? cam });
    }

    const list = Array.from(byIdentity.values());
    list.sort((a, b) => {
      if (a.participant.isLocal && !b.participant.isLocal) return -1;
      if (!a.participant.isLocal && b.participant.isLocal) return 1;
      return (a.participant.name || a.participant.identity).localeCompare(
        b.participant.name || b.participant.identity
      );
    });

    // Detect: a single publisher sharing screen AND publishing camera → bubble overlay
    let bubble: { participant: Participant; cameraPublication: TrackPublication } | null = null;
    if (publishers.length === 1) {
      const only = publishers[0];
      const screen = screenByIdentity.get(only.identity);
      const cam = camByIdentity.get(only.identity);
      const camPub = cam?.publication;
      if (screen && camPub && !camPub.isMuted) {
        bubble = { participant: only, cameraPublication: camPub as TrackPublication };
      }
    }

    return { publisherTiles: list, screenShareWithCamera: bubble };
  }, [tracks, allParticipants, isHost]);

  if (publisherTiles.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-black text-white/60">
        <p className="text-sm">
          {isHost ? "Activa tu cámara para iniciar la transmisión" : "Esperando al host..."}
        </p>
      </div>
    );
  }

  // 1 publisher → fullscreen (with optional camera bubble overlay when sharing screen)
  if (publisherTiles.length === 1) {
    const t = publisherTiles[0];
    return (
      <div ref={containerRef} className="h-full w-full bg-black p-2 relative">
        <BroadcastTile participant={t.participant} trackRef={t.trackRef} />
        {screenShareWithCamera && (
          <HostCameraBubble
            participant={screenShareWithCamera.participant}
            cameraPublication={screenShareWithCamera.cameraPublication}
            containerRef={containerRef}
          />
        )}
      </div>
    );
  }

  // 2 publishers → 50/50 split
  if (publisherTiles.length === 2) {
    return (
      <div className="h-full w-full bg-black p-2 grid grid-cols-1 md:grid-cols-2 gap-2">
        {publisherTiles.map((t, i) => (
          <BroadcastTile key={`${t.participant.identity}-${i}`} participant={t.participant} trackRef={t.trackRef} />
        ))}
      </div>
    );
  }

  // 3+ publishers → main + horizontal strip
  const [main, ...rest] = publisherTiles;
  return (
    <div className="h-full w-full bg-black p-2 flex flex-col gap-2">
      <div className="flex-1 min-h-0">
        <BroadcastTile participant={main.participant} trackRef={main.trackRef} large />
      </div>
      <div className="h-24 sm:h-28 shrink-0 flex gap-2 overflow-x-auto pb-1">
        {rest.map((t, i) => (
          <div key={`${t.participant.identity}-${i}`} className="w-40 shrink-0 aspect-video">
            <BroadcastTile participant={t.participant} trackRef={t.trackRef} />
          </div>
        ))}
      </div>
    </div>
  );
};

interface BroadcastTileProps {
  participant: Participant;
  trackRef?: TrackReferenceOrPlaceholder;
  large?: boolean;
}

const BroadcastTile = ({ participant, trackRef, large }: BroadcastTileProps) => {
  const publication = trackRef?.publication;
  const isVideoEnabled = !!publication && !publication.isMuted;
  const isMicMuted = !participant.isMicrophoneEnabled;
  const isLocal = participant.isLocal;
  const videoTrack = publication?.track;
  const displayName = participant.name || participant.identity;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden bg-black ring-1 ring-white/10">
      {isVideoEnabled && videoTrack ? (
        <video
          ref={(el) => {
            if (el && videoTrack) {
              videoTrack.attach(el);
            }
          }}
          autoPlay
          playsInline
          muted={isLocal}
          className="absolute inset-0 w-full h-full object-cover sm:object-contain"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#062B63] to-[#031633]">
          <div
            className={`rounded-full bg-white/10 flex items-center justify-center text-white font-bold ${
              large ? "size-32 text-4xl" : "size-20 text-2xl"
            }`}
          >
            {initials}
          </div>
        </div>
      )}

      {/* Bottom name bar */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2 flex items-center gap-2">
        {isMicMuted && <MicOff className="w-3.5 h-3.5 text-red-400 shrink-0" />}
        <span className="text-xs text-white font-medium truncate">
          {displayName}
          {isLocal && " (Tú)"}
        </span>
      </div>
    </div>
  );
};

export default BroadcastStage;
