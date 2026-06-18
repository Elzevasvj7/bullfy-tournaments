import { useState } from "react";
import { useRoomContext, useParticipants } from "@livekit/components-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MicOff, Hand, UserX, Pin, PinOff, Crown } from "lucide-react";
import { toast } from "@/lib/toastUtils";

interface HostControlPanelProps {
  pinnedIdentity: string | null;
  onPinChange: (identity: string | null) => void;
}

/**
 * Host-only controls: mute all, kick, pin, lower hands, raised-hand queue.
 */
const HostControlPanel = ({ pinnedIdentity, onPinChange }: HostControlPanelProps) => {
  const room = useRoomContext();
  const participants = useParticipants();
  const [busy, setBusy] = useState(false);

  const handleMuteAll = async () => {
    setBusy(true);
    try {
      const data = new TextEncoder().encode(JSON.stringify({ type: "host-mute-all" }));
      await room.localParticipant.publishData(data, { reliable: true });
      toast.success("Solicitud de mute enviada a todos");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
    setBusy(false);
  };

  const handleLowerAllHands = async () => {
    try {
      const data = new TextEncoder().encode(JSON.stringify({ type: "host-lower-all-hands" }));
      await room.localParticipant.publishData(data, { reliable: true });
      toast.info("Manos bajadas");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const handleKick = async (identity: string) => {
    try {
      const data = new TextEncoder().encode(
        JSON.stringify({ type: "host-kick", targetIdentity: identity })
      );
      await room.localParticipant.publishData(data, { reliable: true });
      toast.info(`Solicitud de salida enviada a ${identity}`);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const remoteParticipants = participants.filter((p) => !p.isLocal);

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Crown className="w-3.5 h-3.5 text-primary" /> Controles del Host
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" onClick={handleMuteAll} disabled={busy} className="gap-1 text-xs">
            <MicOff className="w-3 h-3" /> Mute Todos
          </Button>
          <Button size="sm" variant="outline" onClick={handleLowerAllHands} className="gap-1 text-xs">
            <Hand className="w-3 h-3" /> Bajar Manos
          </Button>
        </div>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          <p className="text-[10px] text-muted-foreground uppercase">Participantes</p>
          {remoteParticipants.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Sin participantes</p>
          ) : (
            remoteParticipants.map((p) => {
              const isPinned = pinnedIdentity === p.identity;
              return (
                <div key={p.identity} className="flex items-center justify-between gap-1 text-xs py-1 border-b border-border/50">
                  <span className="truncate flex-1">{p.name || p.identity}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    title={isPinned ? "Despinearr" : "Pin"}
                    onClick={() => onPinChange(isPinned ? null : p.identity)}
                  >
                    {isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-destructive"
                    title="Sacar de la sala"
                    onClick={() => handleKick(p.identity)}
                  >
                    <UserX className="w-3 h-3" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default HostControlPanel;
