import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, BarChart3, X, Loader2 } from "lucide-react";
import { toast } from "@/lib/toastUtils";

interface MeetingPollsProps {
  roomId: string;
  isHost: boolean;
  /** Optional voter id to allow anonymous viewers (e.g. LiveKit identity) to vote when they have no auth user. */
  voterId?: string;
}

interface Poll {
  id: string;
  question: string;
  options: string[];
  votes: Record<string, string>;
  closed_at: string | null;
  created_at: string;
}

const MeetingPolls = ({ roomId, isHost, voterId }: MeetingPollsProps) => {
  const { user } = useAuth();
  const effectiveVoterId = user?.id || voterId || null;
  const [polls, setPolls] = useState<Poll[]>([]);
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState("");
  const [opts, setOpts] = useState<string[]>(["", ""]);

  const fetchPolls = async () => {
    const { data } = await supabase
      .from("live_meeting_polls")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false });
    setPolls(
      (data || []).map((p: any) => ({
        ...p,
        options: Array.isArray(p.options) ? p.options : [],
        votes: p.votes || {},
      }))
    );
  };

  useEffect(() => {
    fetchPolls();
    const channel = supabase
      .channel(`polls-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_meeting_polls", filter: `room_id=eq.${roomId}` },
        () => fetchPolls()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const handleCreate = async () => {
    const validOpts = opts.filter((o) => o.trim());
    if (!question.trim() || validOpts.length < 2) {
      toast.error("Pregunta + 2 opciones mínimo");
      return;
    }
    const { error } = await supabase.from("live_meeting_polls").insert({
      room_id: roomId,
      question: question.trim(),
      options: validOpts,
      votes: {},
      created_by: user?.id,
    });
    if (error) {
      toast.error("Error: " + error.message);
    } else {
      setQuestion("");
      setOpts(["", ""]);
      setCreating(false);
      toast.success("Encuesta creada");
    }
  };

  const handleVote = async (poll: Poll, option: string) => {
    if (!effectiveVoterId || poll.closed_at) return;
    // Optimistic update so the viewer sees their selection immediately
    setPolls((prev) =>
      prev.map((p) =>
        p.id === poll.id ? { ...p, votes: { ...p.votes, [effectiveVoterId]: option } } : p
      )
    );
    try {
      const { data, error } = await supabase.functions.invoke("submit-poll-vote", {
        body: { poll_id: poll.id, voter_id: effectiveVoterId, option },
      });
      if (error) throw error;
      if (data && data.ok === false) throw new Error(data.error || "No se pudo registrar el voto");
    } catch (err: any) {
      toast.error("Error al votar: " + (err?.message || "desconocido"));
      fetchPolls();
    }
  };

  const handleClose = async (pollId: string) => {
    await supabase.from("live_meeting_polls").update({ closed_at: new Date().toISOString() }).eq("id", pollId);
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5 text-primary" /> Encuestas
        </CardTitle>
        {isHost && !creating && (
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setCreating(true)}>
            <Plus className="w-3 h-3" /> Nueva
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {creating && (
          <div className="space-y-2 p-2 bg-secondary/30 rounded">
            <Input
              placeholder="Pregunta..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="h-8 text-xs"
            />
            {opts.map((o, i) => (
              <div key={i} className="flex gap-1">
                <Input
                  placeholder={`Opción ${i + 1}`}
                  value={o}
                  onChange={(e) =>
                    setOpts((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))
                  }
                  className="h-7 text-xs"
                />
                {opts.length > 2 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => setOpts((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs w-full"
              onClick={() => setOpts((prev) => [...prev, ""])}
              disabled={opts.length >= 6}
            >
              + Agregar opción
            </Button>
            <div className="flex gap-1">
              <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleCreate}>
                Publicar
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
        {polls.length === 0 && !creating && (
          <p className="text-xs text-muted-foreground py-2 text-center">Sin encuestas activas</p>
        )}
        {polls.map((poll) => {
          const totalVotes = Object.keys(poll.votes).length;
          const myVote = effectiveVoterId ? poll.votes[effectiveVoterId] : null;
          const isClosed = !!poll.closed_at;
          return (
            <div key={poll.id} className="p-2 bg-secondary/20 rounded space-y-1">
              <div className="flex items-start justify-between gap-1">
                <p className="text-xs font-medium flex-1">{poll.question}</p>
                {isHost && !isClosed && (
                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => handleClose(poll.id)}>
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
              {poll.options.map((opt) => {
                const count = Object.values(poll.votes).filter((v) => v === opt).length;
                const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
                return (
                  <button
                    key={opt}
                    disabled={isClosed || !effectiveVoterId}
                    onClick={() => handleVote(poll, opt)}
                    className={`w-full text-left text-xs p-1.5 rounded border transition-colors relative overflow-hidden ${
                      myVote === opt ? "border-primary bg-primary/10" : "border-border hover:bg-secondary/40"
                    } ${isClosed ? "cursor-default" : "cursor-pointer"}`}
                  >
                    <div
                      className="absolute inset-0 bg-primary/20"
                      style={{ width: `${pct}%` }}
                    />
                    <span className="relative flex justify-between">
                      <span>{opt}</span>
                      <span className="text-muted-foreground">{count} ({pct.toFixed(0)}%)</span>
                    </span>
                  </button>
                );
              })}
              <p className="text-[10px] text-muted-foreground">
                {totalVotes} voto{totalVotes !== 1 ? "s" : ""} {isClosed && "• Cerrada"}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default MeetingPolls;
