import { useState, useCallback, useEffect } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { Button } from "@/components/ui/button";
import { Hand } from "lucide-react";
import { toast } from "@/lib/toastUtils";
import { cn } from "@/lib/utils";
import { useLiveKitReady } from "@/hooks/useLiveKitReady";

interface RaiseHandButtonProps {
  className?: string;
}

const RaiseHandButton = ({ className }: RaiseHandButtonProps) => {
  const [raised, setRaised] = useState(false);
  const lkRoom = useRoomContext();
  const isLkReady = useLiveKitReady(lkRoom);

  const toggle = useCallback(() => {
    const newState = !raised;
    setRaised(newState);

    const data = new TextEncoder().encode(
      JSON.stringify({
        type: newState ? "hand-raise" : "hand-lower",
        identity: lkRoom.localParticipant.identity,
        name: lkRoom.localParticipant.name || lkRoom.localParticipant.identity,
      })
    );
    lkRoom.localParticipant.publishData(data, { reliable: true });

    if (newState) {
      toast.info("✋ Has levantado la mano. El host puede invitarte a co-transmitir.");
    } else {
      toast.info("Has bajado la mano.");
    }
  }, [raised, lkRoom]);

  // Auto-lower hand if accepted as co-host
  useEffect(() => {
    if (!lkRoom || !isLkReady) return;

    const handleData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (
          msg.type === "costream-invite" &&
          msg.targetIdentity === lkRoom.localParticipant.identity
        ) {
          setRaised(false);
        }
      } catch {}
    };
    lkRoom.on(RoomEvent.DataReceived, handleData);
    return () => { lkRoom.off(RoomEvent.DataReceived, handleData); };
  }, [lkRoom, isLkReady]);

  return (
    <Button
      variant={raised ? "default" : "outline"}
      size="icon"
      onClick={toggle}
      aria-label={raised ? "Bajar mano" : "Levantar mano"}
      title={raised ? "Bajar mano" : "Levantar mano"}
      className={cn(
        "transition-all h-10 w-10 shrink-0",
        raised && "bg-amber-500 hover:bg-amber-600 text-white border-amber-500",
        className
      )}
    >
      <Hand className={cn("w-5 h-5", raised && "animate-bounce")} />
    </Button>
  );
};

export default RaiseHandButton;
