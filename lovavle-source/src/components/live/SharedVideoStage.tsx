import { useTracks, VideoTrack, RoomAudioRenderer } from "@livekit/components-react";
import { Track } from "livekit-client";

/**
 * Shared video stage used by both Host and Co-Host.
 * Shows only participants who are actively publishing tracks (camera or screen share).
 */
const SharedVideoStage = () => {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const publishingTracks = tracks.filter(
    (t) => t.participant.isLocal || t.publication?.track
  );

  return (
    <div className="h-full w-full relative isolate">
      <RoomAudioRenderer />
      <div
        className="grid gap-2 h-full p-2"
        style={{
          gridTemplateColumns:
            publishingTracks.length <= 1
              ? "1fr"
              : publishingTracks.length <= 4
              ? "repeat(2, 1fr)"
              : "repeat(3, 1fr)",
          gridAutoRows: "1fr",
        }}
      >
        {publishingTracks.map((trackRef) => (
          <div
            key={trackRef.participant.sid + (trackRef.source || "")}
            className="relative bg-black rounded-lg overflow-hidden"
          >
            {trackRef.publication?.track ? (
              <VideoTrack
                trackRef={trackRef as any}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <div className="flex items-center justify-center h-full bg-muted/20">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
                  {(trackRef.participant.name || trackRef.participant.identity)?.[0]?.toUpperCase() || "?"}
                </div>
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
              {trackRef.participant.name || trackRef.participant.identity}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SharedVideoStage;
