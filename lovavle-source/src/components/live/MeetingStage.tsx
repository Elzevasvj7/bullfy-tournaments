import { useTracks, useSpeakingParticipants, useParticipants, type TrackReferenceOrPlaceholder } from "@livekit/components-react";
import { Track, type Participant } from "livekit-client";
import { useMemo } from "react";
import { MicOff, Pin } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import BroadcastStage from "./BroadcastStage";

interface MeetingStageProps {
  pinnedIdentity?: string | null;
  view?: "grid" | "speaker" | "auto";
  isHost?: boolean;
  /**
   * When true, switches to BroadcastStage which only renders publishers
   * (Host + Co-hosts). Used for room_type === "broadcast" (Stream).
   * Other modes (meeting / bullfy_family / webinar_pro) leave this off
   * and keep the full grid behavior.
   */
  publishersOnly?: boolean;
}

/**
 * Adaptive uniform 16:9 grid stage for meeting/webinar/bullfy_family.
 * Shows ALL participants (with or without video). Mobile auto-uses speaker layout
 * with a horizontal scroll strip of thumbnails.
 */
const MeetingStage = ({ pinnedIdentity, view = "auto", isHost = false, publishersOnly = false }: MeetingStageProps) => {
  // Stream / broadcast mode: delegate to BroadcastStage (host + co-hosts only).
  if (publishersOnly) {
    return <BroadcastStage isHost={isHost} />;
  }
  const isMobile = useIsMobile();
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );
  const allParticipants = useParticipants();
  const speakingParticipants = useSpeakingParticipants();

  // Build a unified list: every participant gets a tile.
  // If they have a camera/screen track, attach it; otherwise placeholder with avatar.
  const tiles = useMemo(() => {
    const byIdentity = new Map<string, { participant: Participant; trackRef?: TrackReferenceOrPlaceholder }>();
    // Seed with all participants
    for (const p of allParticipants) {
      byIdentity.set(p.identity, { participant: p });
    }
    // Override with track refs where present (prefer screen share over camera)
    for (const t of tracks) {
      const existing = byIdentity.get(t.participant.identity);
      const isScreen = t.source === Track.Source.ScreenShare;
      if (!existing || isScreen) {
        byIdentity.set(t.participant.identity, { participant: t.participant, trackRef: t });
      } else if (!existing.trackRef) {
        byIdentity.set(t.participant.identity, { participant: t.participant, trackRef: t });
      }
    }
    const list = Array.from(byIdentity.values());
    // Sort: pinned > speaking > host > others
    list.sort((a, b) => {
      if (a.participant.identity === pinnedIdentity) return -1;
      if (b.participant.identity === pinnedIdentity) return 1;
      const aSpeak = speakingParticipants.some((s) => s.identity === a.participant.identity);
      const bSpeak = speakingParticipants.some((s) => s.identity === b.participant.identity);
      if (aSpeak && !bSpeak) return -1;
      if (!aSpeak && bSpeak) return 1;
      return 0;
    });
    return list;
  }, [tracks, allParticipants, pinnedIdentity, speakingParticipants]);

  if (tiles.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-black text-white/60">
        <p className="text-sm">Esperando participantes...</p>
      </div>
    );
  }

  // Decide layout: mobile defaults to speaker; desktop uses requested view (auto -> grid)
  const effectiveView = view === "auto" ? (isMobile ? "speaker" : "grid") : view;

  // Speaker layout: main tile + horizontal scrollable strip of thumbnails
  if (effectiveView === "speaker") {
    const [main, ...rest] = tiles;
    return (
      <div className="h-full w-full flex flex-col gap-2 p-2 bg-black">
        <div className="flex-1 min-h-0 rounded-lg overflow-hidden bg-black border border-white/10">
          <UniformTile
            participant={main.participant}
            trackRef={main.trackRef}
            isPinned={pinnedIdentity === main.participant.identity}
            isSpeaking={speakingParticipants.some((s) => s.identity === main.participant.identity)}
            large
          />
        </div>
        {rest.length > 0 && (
          <div className="h-20 sm:h-24 shrink-0 flex gap-2 overflow-x-auto pb-1 snap-x">
            {rest.map((t, i) => {
              const isSpeaking = speakingParticipants.some((s) => s.identity === t.participant.identity);
              return (
                <div
                  key={`${t.participant.identity}-${i}`}
                  className="w-32 sm:w-40 shrink-0 aspect-video snap-start"
                >
                  <UniformTile
                    participant={t.participant}
                    trackRef={t.trackRef}
                    isPinned={pinnedIdentity === t.participant.identity}
                    isSpeaking={isSpeaking}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Grid layout — adaptive cols
  const count = tiles.length;
  let gridCols = "grid-cols-1";
  if (count === 2) gridCols = "grid-cols-2";
  else if (count <= 4) gridCols = "grid-cols-2";
  else if (count <= 9) gridCols = "grid-cols-3";
  else if (count <= 16) gridCols = "grid-cols-4";
  else gridCols = "grid-cols-5";

  return (
    <div className="h-full w-full p-3 bg-black overflow-auto">
      <div className={`grid ${gridCols} gap-3 w-full`}>
        {tiles.map((t, i) => {
          const isSpeaking = speakingParticipants.some((s) => s.identity === t.participant.identity);
          const isPinned = pinnedIdentity === t.participant.identity;
          return (
            <div key={`${t.participant.identity}-${i}`} className="aspect-video">
              <UniformTile
                participant={t.participant}
                trackRef={t.trackRef}
                isPinned={isPinned}
                isSpeaking={isSpeaking}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface UniformTileProps {
  participant: Participant;
  trackRef?: TrackReferenceOrPlaceholder;
  isPinned: boolean;
  isSpeaking: boolean;
  large?: boolean;
}

const UniformTile = ({ participant, trackRef, isPinned, isSpeaking, large }: UniformTileProps) => {
  const publication = trackRef?.publication;
  const isVideoEnabled = !!publication && !publication.isMuted;
  const isMicMuted = !participant.isMicrophoneEnabled;
  const isLocal = participant.isLocal;
  const videoTrack = publication?.track;
  const displayName = participant.name || participant.identity;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div
      className={`relative w-full h-full rounded-lg overflow-hidden bg-[#062B63] transition-all ${
        isSpeaking ? "ring-2 ring-primary shadow-[0_0_20px_hsl(var(--primary)/0.4)]" : "ring-1 ring-white/10"
      }`}
    >
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
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#062B63] to-[#031633]">
          <div
            className={`rounded-full bg-white/10 flex items-center justify-center text-white font-bold ${
              large ? "size-24 text-3xl" : "size-12 sm:size-16 text-base sm:text-xl"
            }`}
          >
            {initials}
          </div>
        </div>
      )}

      {/* Bottom gradient + name */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {isMicMuted && <MicOff className="w-3 h-3 text-red-400 shrink-0" />}
          <span className="text-xs text-white font-medium truncate">
            {displayName}
            {isLocal && " (Tú)"}
          </span>
        </div>
        {isPinned && <Pin className="w-3 h-3 text-primary shrink-0" />}
      </div>

      {/* Top-left badges */}
      {isLocal && (
        <div className="absolute top-2 left-2">
          <span className="px-1.5 py-0.5 bg-primary text-[9px] font-bold text-white uppercase rounded">
            {participant.permissions?.canPublish ? "Tú" : "Tú"}
          </span>
        </div>
      )}
    </div>
  );
};

export default MeetingStage;
