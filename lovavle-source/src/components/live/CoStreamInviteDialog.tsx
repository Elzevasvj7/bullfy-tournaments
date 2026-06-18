import { useState, useEffect } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useLiveKitReady } from "@/hooks/useLiveKitReady";
import { Video } from "lucide-react";

interface CoStreamInviteDialogProps {
  onAcceptCoStream?: () => void;
}

const CoStreamInviteDialog = ({ onAcceptCoStream }: CoStreamInviteDialogProps) => {
  const room = useRoomContext();
  const isLkReady = useLiveKitReady(room);
  const [open, setOpen] = useState(false);
  const [hostName, setHostName] = useState("");

  useEffect(() => {
    if (!room || !isLkReady) return;

    const handleData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === "costream-invite") {
          const myIdentity = room.localParticipant.identity;
          if (msg.targetIdentity === myIdentity) {
            setHostName(msg.hostName || "El host");
            setOpen(true);
          }
        }
        if (msg.type === "costream-revoke") {
          const myIdentity = room.localParticipant.identity;
          if (msg.targetIdentity === myIdentity) {
            setOpen(false);
          }
        }
      } catch {}
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room, isLkReady]);

  const handleAccept = () => {
    const data = new TextEncoder().encode(
      JSON.stringify({
        type: "costream-accept",
        viewerIdentity: room.localParticipant.identity,
        viewerName: room.localParticipant.name || room.localParticipant.identity,
      })
    );
    room.localParticipant.publishData(data, { reliable: true });
    setOpen(false);
    onAcceptCoStream?.();
  };

  const handleDecline = () => {
    const data = new TextEncoder().encode(
      JSON.stringify({
        type: "costream-decline",
        viewerIdentity: room.localParticipant.identity,
        viewerName: room.localParticipant.name || room.localParticipant.identity,
      })
    );
    room.localParticipant.publishData(data, { reliable: true });
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            Invitación a co-transmitir
          </AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-semibold text-foreground">{hostName}</span> te ha invitado a unirte como co-transmisor en el live. 
            Se activarán tu cámara y micrófono.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleDecline}>Rechazar</AlertDialogCancel>
          <AlertDialogAction onClick={handleAccept}>Aceptar y unirme</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default CoStreamInviteDialog;
