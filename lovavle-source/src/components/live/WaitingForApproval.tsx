import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, DoorOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WaitingForApprovalProps {
  requestId: string;
  guestName: string;
  roomTitle: string;
  onApproved: () => void;
  onRejected: () => void;
  onExit?: () => void;
}

/**
 * Guest-side waiting screen while the host reviews the join request.
 * Subscribes to the specific request row and reacts to status changes.
 */
const WaitingForApproval = ({ requestId, guestName, roomTitle, onApproved, onRejected, onExit }: WaitingForApprovalProps) => {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const firedRef = useRef(false);

  useEffect(() => {
    let polling: ReturnType<typeof setInterval> | null = null;

    const handleResolved = (s: "approved" | "rejected") => {
      if (firedRef.current) return;
      firedRef.current = true;
      setStatus(s);
      if (polling) { clearInterval(polling); polling = null; }
      if (s === "approved") onApproved();
      else onRejected();
    };

    const check = async () => {
      if (firedRef.current) return;
      const { data } = await supabase
        .from("live_room_join_requests" as any)
        .select("status")
        .eq("id", requestId)
        .maybeSingle();
      const newStatus = (data as any)?.status as "pending" | "approved" | "rejected" | undefined;
      if (newStatus && newStatus !== "pending") handleResolved(newStatus);
    };

    check();

    const channel = supabase
      .channel(`join-request-${requestId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_room_join_requests", filter: `id=eq.${requestId}` },
        (payload: any) => {
          const s = payload.new?.status;
          if (s === "approved" || s === "rejected") handleResolved(s);
        }
      )
      .subscribe();

    // Polling fallback every 4s in case Realtime drops
    polling = setInterval(check, 4000);

    return () => {
      supabase.removeChannel(channel);
      if (polling) clearInterval(polling);
    };
  }, [requestId, onApproved, onRejected]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              {status === "rejected" ? (
                <X className="w-8 h-8 text-destructive" />
              ) : (
                <DoorOpen className="w-8 h-8 text-primary" />
              )}
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            {status === "rejected" ? "Acceso denegado" : "En sala de espera"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {status === "pending" && (
            <>
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  El host está revisando tu solicitud para entrar a <strong>{roomTitle}</strong>.
                </p>
                <p className="text-xs text-muted-foreground">Esto puede tomar unos momentos…</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Te uniste como</p>
                <p className="text-sm font-medium">{guestName}</p>
              </div>
            </>
          )}
          {status === "rejected" && (
            <>
              <p className="text-sm text-muted-foreground">
                El host no aprobó tu solicitud de entrada a <strong>{roomTitle}</strong>.
              </p>
              <Button
                variant="outline"
                onClick={() => onExit ? onExit() : (window.location.href = "https://www.bullfy.com")}
                className="w-full"
              >
                Salir
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WaitingForApproval;
