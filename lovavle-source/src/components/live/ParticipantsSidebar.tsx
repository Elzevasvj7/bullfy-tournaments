import { useParticipants } from "@livekit/components-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Crown, Hand } from "lucide-react";

interface ParticipantsSidebarProps {
  onInviteCoStream?: (participantIdentity: string) => void;
  onRevokeCoStream?: (participantIdentity: string) => void;
  isHost?: boolean;
  raisedHands?: Map<string, string>;
}

const ParticipantsSidebar = ({ onInviteCoStream, onRevokeCoStream, isHost, raisedHands }: ParticipantsSidebarProps) => {
  const participants = useParticipants();

  return (
    <div className="flex flex-col shrink-0 bg-background">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Users className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">Conectados ({participants.length})</span>
        {raisedHands && raisedHands.size > 0 && (
          <Badge variant="secondary" className="text-[10px] gap-1">
            <Hand className="w-2.5 h-2.5" /> {raisedHands.size}
          </Badge>
        )}
      </div>
      <ScrollArea className="flex-1 px-3 py-2">
        {participants.map((p) => {
          const isLocal = p.isLocal;
          const name = p.name || p.identity;
          const isPublisher = p.permissions?.canPublish;
          const hasHandRaised = raisedHands?.has(p.identity);
          return (
            <div key={p.identity} className="flex items-center justify-between py-1.5 group">
              <div className="flex items-center gap-2 min-w-0">
                {isPublisher && <Crown className="w-3 h-3 text-yellow-500 shrink-0" />}
                {hasHandRaised && !isPublisher && <Hand className="w-3 h-3 text-amber-500 shrink-0 animate-bounce" />}
                <span className="text-xs text-foreground truncate">
                  {name}{isLocal ? " (tú)" : ""}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {isHost && !isLocal && hasHandRaised && !isPublisher && onInviteCoStream && (
                  <button
                    onClick={() => onInviteCoStream(p.identity)}
                    className="text-[10px] text-primary hover:underline shrink-0 font-medium"
                  >
                    Aceptar
                  </button>
                )}
                {isHost && !isLocal && !isPublisher && !hasHandRaised && onInviteCoStream && (
                  <button
                    onClick={() => onInviteCoStream(p.identity)}
                    className="text-[10px] text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  >
                    Invitar
                  </button>
                )}
                {isHost && !isLocal && isPublisher && onRevokeCoStream && (
                  <button
                    onClick={() => onRevokeCoStream(p.identity)}
                    className="text-[10px] text-destructive hover:underline opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </ScrollArea>
    </div>
  );
};

export default ParticipantsSidebar;
