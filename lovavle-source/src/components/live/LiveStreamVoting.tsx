import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/lib/toastUtils";
import { Star } from "lucide-react";

interface LiveStreamVotingProps {
  roomId: string;
  roomTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LiveStreamVoting = ({ roomId, roomTitle, open, onOpenChange }: LiveStreamVotingProps) => {
  const { user, profile } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyVoted, setAlreadyVoted] = useState(false);

  useEffect(() => {
    if (open && user) {
      checkExistingVote();
    }
  }, [open, user]);

  const checkExistingVote = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("live_stream_votes")
      .select("id, rating")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setAlreadyVoted(true);
      setRating(data.rating);
    }
  };

  const handleSubmit = async () => {
    if (!user || rating === 0) return;
    setSubmitting(true);

    const { error } = await supabase.from("live_stream_votes").insert({
      room_id: roomId,
      user_id: user.id,
      user_name: profile?.nombre || "Anónimo",
      rating,
    });

    if (error) {
      if (error.code === "23505") {
        toast.info("Ya votaste en este stream");
      } else {
        toast.error("Error: " + error.message);
      }
    } else {
      toast.success("¡Gracias por tu voto!");
      setAlreadyVoted(true);
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Califica el Stream</DialogTitle>
        </DialogHeader>
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">{roomTitle}</p>

          {alreadyVoted ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-1">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star key={s} className={`w-8 h-8 ${s <= rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`} />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">Ya enviaste tu calificación</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-1">
                {[1, 2, 3, 4, 5].map(s => (
                  <button
                    key={s}
                    onMouseEnter={() => setHoveredStar(s)}
                    onMouseLeave={() => setHoveredStar(0)}
                    onClick={() => setRating(s)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-10 h-10 ${
                        s <= (hoveredStar || rating)
                          ? "text-yellow-500 fill-yellow-500"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                {rating === 0 ? "Selecciona una calificación" : `${rating} estrella${rating > 1 ? "s" : ""}`}
              </p>
              <Button onClick={handleSubmit} disabled={submitting || rating === 0} className="w-full">
                {submitting ? "Enviando..." : "Enviar Calificación"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LiveStreamVoting;
