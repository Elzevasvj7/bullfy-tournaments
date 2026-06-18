import { useEffect, useState } from "react";
import { useRoomContext, useParticipants } from "@livekit/components-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Loader2, X } from "lucide-react";
import { toast } from "@/lib/toastUtils";

interface BreakoutRoomsManagerProps {
  parentRoomId: string;
  hostId: string;
}

interface BreakoutRoom {
  id: string;
  title: string;
  livekit_room_name: string;
  status: string;
}

const BreakoutRoomsManager = ({ parentRoomId, hostId }: BreakoutRoomsManagerProps) => {
  const room = useRoomContext();
  const participants = useParticipants();
  const [breakouts, setBreakouts] = useState<BreakoutRoom[]>([]);
  const [count, setCount] = useState(2);
  const [mode, setMode] = useState<"manual" | "random" | "hybrid">("random");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchBreakouts = async () => {
    const { data } = await supabase
      .from("live_rooms")
      .select("id, title, livekit_room_name, status")
      .eq("breakout_parent_id", parentRoomId)
      .neq("status", "ended");
    setBreakouts(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchBreakouts();
    const channel = supabase
      .channel(`breakouts-${parentRoomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_rooms", filter: `breakout_parent_id=eq.${parentRoomId}` },
        () => fetchBreakouts()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [parentRoomId]);

  const handleCreate = async () => {
    if (count < 1 || count > 20) {
      toast.error("Cantidad inválida (1-20)");
      return;
    }
    setCreating(true);
    try {
      const remoteParticipants = participants.filter((p) => !p.isLocal);
      const rooms: BreakoutRoom[] = [];
      const assignments: { breakoutRoomId: string; identity: string }[] = [];

      for (let i = 1; i <= count; i++) {
        const roomName = `${room.name}-bo-${i}-${Date.now().toString(36)}`;
        const { data: created, error } = await supabase
          .from("live_rooms")
          .insert({
            title: `Breakout ${i}`,
            host_id: hostId,
            livekit_room_name: roomName,
            status: "live",
            room_type: "meeting",
            breakout_parent_id: parentRoomId,
            started_at: new Date().toISOString(),
          })
          .select("id, title, livekit_room_name, status")
          .single();
        if (error) throw error;
        rooms.push(created as BreakoutRoom);
      }

      // Auto-assign random/hybrid
      if (mode === "random" || mode === "hybrid") {
        const shuffled = [...remoteParticipants].sort(() => Math.random() - 0.5);
        shuffled.forEach((p, idx) => {
          const target = rooms[idx % rooms.length];
          assignments.push({ breakoutRoomId: target.id, identity: p.identity });
        });
        if (assignments.length > 0) {
          await supabase.from("live_breakout_assignments").insert(
            assignments.map((a) => ({
              parent_room_id: parentRoomId,
              breakout_room_id: a.breakoutRoomId,
              participant_identity: a.identity,
            }))
          );
          // Notify each participant via LiveKit data channel
          for (const a of assignments) {
            const target = rooms.find((r) => r.id === a.breakoutRoomId);
            if (!target) continue;
            const data = new TextEncoder().encode(
              JSON.stringify({
                type: "breakout-assign",
                targetIdentity: a.identity,
                breakoutRoomName: target.livekit_room_name,
                breakoutTitle: target.title,
              })
            );
            await room.localParticipant.publishData(data, { reliable: true });
          }
        }
      }

      toast.success(`${count} breakout rooms creadas`);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
    setCreating(false);
  };

  const handleCloseAll = async () => {
    if (!confirm("¿Cerrar todas las breakout rooms?")) return;
    await supabase
      .from("live_rooms")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("breakout_parent_id", parentRoomId)
      .neq("status", "ended");
    toast.success("Breakouts cerradas");
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-primary" /> Breakout Rooms
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : breakouts.length === 0 ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">Cantidad</label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Modo</label>
                <Select value={mode} onValueChange={(v: any) => setMode(v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="random">Aleatorio</SelectItem>
                    <SelectItem value="hybrid">Híbrido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button size="sm" className="w-full gap-1.5 text-xs" onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Crear Breakouts
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-1">
              {breakouts.map((b) => (
                <div key={b.id} className="text-xs flex items-center justify-between p-1.5 bg-secondary/30 rounded">
                  <span>{b.title}</span>
                  <span className="text-muted-foreground text-[10px]">{b.status}</span>
                </div>
              ))}
            </div>
            <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs text-destructive" onClick={handleCloseAll}>
              <X className="w-3 h-3" /> Cerrar Todas
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default BreakoutRoomsManager;
