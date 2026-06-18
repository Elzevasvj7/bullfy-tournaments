/**
 * LiveEgress – Compositor page rendered by LiveKit Web Egress.
 * Route: /live-egress/:roomName
 * 
 * This page connects as a subscribe-only participant ("egress-compositor")
 * and renders the video + all visual overlays (tickers, CTAs, ads, reactions,
 * overlay assets). LiveKit captures this DOM at 1080p and streams it via RTMP.
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  VideoTrack,
  GridLayout,
  ParticipantName,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";
import ViewerCTABanner from "@/components/live/ViewerCTABanner";
import ViewerAdBanner from "@/components/live/ViewerAdBanner";
import { OverlayDisplay } from "@/components/live/OverlayManager";
import EgressTickerStrip from "@/components/live/EgressTickerStrip";
import EgressNewsTickerStrip from "@/components/live/EgressNewsTickerStrip";

const EgressStage = () => {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );
  const remoteTracks = tracks.filter((t) => !t.participant.isLocal);

  if (remoteTracks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-black text-white text-2xl">
        Esperando al host...
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      <RoomAudioRenderer />
      <GridLayout tracks={remoteTracks} style={{ height: "100%" }}>
        <EgressTile />
      </GridLayout>
    </div>
  );
};

const EgressTile = () => (
  <div className="relative w-full h-full bg-black overflow-hidden">
    <VideoTrack style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
      <ParticipantName />
    </div>
  </div>
);

const LiveEgress = () => {
  const { roomName } = useParams<{ roomName: string }>();
  const [token, setToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!roomName) return;
    const fetchToken = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/livekit-token`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              roomName,
              participantName: "egress-compositor",
              role: "egress",
            }),
          }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Token error");
        setToken(json.token);
        setLivekitUrl(json.url);
      } catch (e: any) {
        setError(e.message);
      }
    };
    fetchToken();
  }, [roomName]);

  if (error) {
    return <div className="flex items-center justify-center h-screen bg-black text-red-500 text-xl">{error}</div>;
  }
  if (!token) {
    return <div className="flex items-center justify-center h-screen bg-black text-white text-xl">Conectando compositor...</div>;
  }

  return (
    <div style={{ width: "1920px", height: "1080px", overflow: "hidden", background: "#000" }}>
      <LiveKitRoom
        serverUrl={livekitUrl}
        token={token}
        connect={true}
        style={{ width: "100%", height: "100%" }}
        options={{ adaptiveStream: false, dynacast: false }}
      >
        {/* Flex column: overlays are absolute, video fills entire canvas */}
        <div className="relative w-full h-full flex flex-col isolate">
          {/* Absolute overlays — don't displace video */}
          <ViewerCTABanner />
          <OverlayDisplay />
          <ViewerAdBanner />

          {/* Video stage takes full space */}
          <div className="flex-1 min-h-0 relative">
            <EgressStage />
            {/* Standalone tickers that fetch data directly */}
            <EgressTickerStrip />
            <EgressNewsTickerStrip />
          </div>
        </div>
      </LiveKitRoom>
    </div>
  );
};

export default LiveEgress;
