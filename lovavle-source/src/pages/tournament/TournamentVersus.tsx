import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTournamentAuth } from "@/hooks/useTournamentAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sword, Plus, Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function TournamentVersus() {
  const { user, token, loading: authLoading } = useTournamentAuth();
  const [list, setList] = useState<any[]>([]);
  const [target, setTarget] = useState("");
  const [email, setEmail] = useState("");
  const [stake, setStake] = useState("0");
  const [duration, setDuration] = useState("1440");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("tournament_versus")
      .select("*, challenger:challenger_id(full_name, username), opponent:opponent_id(full_name, username)")
      .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .order("created_at", { ascending: false }).limit(50);
    setList(data || []);
  };
  useEffect(() => { load(); }, [user?.id]);

  // TOR-19: esperar a que el hook resuelva la sesión antes de decidir redirect
  if (authLoading) return <div className="text-muted-foreground">Cargando...</div>;
  if (!user) return <Navigate to="/tournament/login" replace />;

  const create = async () => {
    setBusy(true);
    const body: any = { stake_usd: Number(stake), duration_minutes: Number(duration), message: msg };
    if (target) body.opponent_username = target;
    else if (email) body.opponent_email = email;
    else { setBusy(false); return toast({ title: "Indica username o email", variant: "destructive" }); }
    const { data } = await supabase.functions.invoke("tournament-versus-create", {
      headers: { Authorization: `Bearer ${token}` }, body,
    });
    setBusy(false);
    if (!data?.ok) return toast({ title: data?.error || "Error", variant: "destructive" });
    if (data.invite_url) {
      navigator.clipboard.writeText(data.invite_url);
      toast({ title: "Invitación enviada", description: "Link copiado" });
    } else toast({ title: "Reto enviado" });
    setTarget(""); setEmail(""); setStake("0"); setMsg(""); load();
  };

  const respond = async (versus_id: string, decision: string) => {
    const { data } = await supabase.functions.invoke("tournament-versus-respond", {
      headers: { Authorization: `Bearer ${token}` }, body: { versus_id, decision },
    });
    if (!data?.ok) return toast({ title: data?.error || "Error", variant: "destructive" });
    toast({ title: decision === "accept" ? "Reto aceptado" : "OK" });
    load();
  };

  const cardsByStatus = (s: string) => list.filter((v) =>
    s === "pending" ? v.status === "pending"
    : s === "active" ? ["accepted","live"].includes(v.status)
    : ["finished","rejected","expired","cancelled"].includes(v.status)
  );

  const Card1 = ({ v }: { v: any }) => {
    const iAmChallenger = v.challenger_id === user.id;
    const other = iAmChallenger ? (v.opponent?.full_name || v.opponent_email || v.opponent_username_hint || "?") : v.challenger?.full_name;
    return (
      <div className="p-4 bg-[#0a1129]/60 border border-[#00E5FF]/15 rounded-lg space-y-2">
        <div className="flex justify-between items-start">
          <div>
            <Badge variant="outline" className="text-[10px]">{iAmChallenger ? "Yo reté" : "Me retaron"}</Badge>
            <div className="font-bold mt-1">{iAmChallenger ? "→" : "←"} {other}</div>
          </div>
          <Badge>{v.status}</Badge>
        </div>
        {Number(v.stake_usd) > 0 && <div className="text-[#B6FF3D] font-bold text-sm">${v.stake_usd} USDT</div>}
        {v.message && <p className="text-xs text-gray-400 italic">"{v.message}"</p>}
        {v.status === "pending" && !iAmChallenger && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => respond(v.id, "accept")} className="bg-[#B6FF3D] text-black">Aceptar</Button>
            <Button size="sm" variant="ghost" onClick={() => respond(v.id, "reject")}>Rechazar</Button>
          </div>
        )}
        {v.status === "pending" && iAmChallenger && (
          <Button size="sm" variant="ghost" onClick={() => respond(v.id, "cancel")}>Cancelar</Button>
        )}
        {v.invite_token && iAmChallenger && v.status === "pending" && (
          <button className="text-[10px] text-[#00E5FF] flex items-center gap-1"
            onClick={() => { navigator.clipboard.writeText(`https://bullfytech.online/tournament/versus/invite/${v.invite_token}`); toast({ title: "Link copiado" }); }}>
            <Copy className="h-3 w-3" /> Copiar invitación
          </button>
        )}
        {v.tournament_id && <a href={`/tournament/t/${v.tournament_id}`} className="text-xs text-[#00E5FF]">Ver torneo →</a>}
        {v.winner_id && <div className="text-xs">Ganador: <strong>{v.winner_id === user.id ? "TÚ 🏆" : other}</strong></div>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black t-display flex items-center gap-2"><Sword className="text-[#00E5FF]" /> Versus 1 vs 1</h1>

      <Card className="bg-[#0a1129]/60 border-[#00E5FF]/20">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Plus className="h-4 w-4" /> Nuevo reto</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          <div><Label>Username (@) del rival</Label><Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="@trader" /></div>
          <div><Label>O email (si no tiene cuenta)</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="rival@email.com" /></div>
          <div><Label>Apuesta USDT (0 = sin apuesta)</Label><Input type="number" min="0" value={stake} onChange={(e) => setStake(e.target.value)} /></div>
          <div><Label>Duración (minutos)</Label><Input type="number" min="15" value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
          <div className="md:col-span-2"><Label>Mensaje</Label><Textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={2} /></div>
          <Button onClick={create} disabled={busy} className="md:col-span-2 bg-[#B6FF3D] text-black">Enviar reto</Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pendientes ({cardsByStatus("pending").length})</TabsTrigger>
          <TabsTrigger value="active">En curso ({cardsByStatus("active").length})</TabsTrigger>
          <TabsTrigger value="done">Finalizados ({cardsByStatus("done").length})</TabsTrigger>
        </TabsList>
        {["pending","active","done"].map((s) => (
          <TabsContent key={s} value={s} className="grid md:grid-cols-2 gap-3">
            {cardsByStatus(s).length === 0
              ? <p className="text-sm text-gray-400 col-span-2">Sin retos.</p>
              : cardsByStatus(s).map((v) => <Card1 key={v.id} v={v} />)}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
