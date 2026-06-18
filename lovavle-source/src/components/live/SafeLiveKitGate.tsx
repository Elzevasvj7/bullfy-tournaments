import { type ReactNode } from "react";
import { useRoomContext } from "@livekit/components-react";
import { Loader2 } from "lucide-react";
import { useLiveKitReady } from "@/hooks/useLiveKitReady";

interface SafeLiveKitGateProps {
  children: ReactNode;
  /** Optional label shown while connecting */
  label?: string;
}

/**
 * SafeLiveKitGate — MUST be rendered as the only direct child of <LiveKitRoom>.
 *
 * It blocks the entire LiveKit subtree (every hook like useLocalParticipant /
 * useParticipants / useTracks, every component like RoomAudioRenderer, ControlBar,
 * MeetingStage, BroadcastStage, viewer banners, etc.) until the underlying Room
 * engine is fully connected.
 *
 * Why this is mandatory:
 * Multiple LiveKit hooks/components touch `room.engine` / `room.localParticipant`
 * synchronously on mount. If they render during the transition between
 * "LiveKitRoom mounted" and "Room.state === connected", the SDK crashes with
 * the minified error: `null is not an object (evaluating 'ye.room')`.
 *
 * That crash regressed every time a new LiveKit hook/component was added inside
 * the viewer/host shells (especially after the SMS verification step in the
 * public guest flow). The previous fix only protected our own `room.on(...)`
 * listeners, but not the third-party hooks. This gate fixes it once and for all
 * by deferring the entire subtree.
 */
const SafeLiveKitGate = ({ children, label = "Conectando al stream..." }: SafeLiveKitGateProps) => {
  const room = useRoomContext();
  const isReady = useLiveKitReady(room);

  if (!isReady) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-black text-white/80 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
        <p className="text-sm">{label}</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default SafeLiveKitGate;