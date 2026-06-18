import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTournamentAuth } from "@/hooks/useTournamentAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export default function TournamentVersusInvite() {
  const { token: inviteToken } = useParams();
  const { user, token, loading } = useTournamentAuth();
  const nav = useNavigate();
  const [info, setInfo] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!inviteToken) return;
    supabase.from("tournament_versus").select("id, status, stake_usd, challenger:challenger_id(full_name)")
      .eq("invite_token", inviteToken).maybeSingle().then(({ data }) => setInfo(data));
  }, [inviteToken]);

  const claim = async () => {
    setBusy(true);
    const { data } = await supabase.functions.invoke("tournament-versus-claim-invite", {
      headers: { Authorization: `Bearer ${token}` }, body: { invite_token: inviteToken },
    });
    setBusy(false);
    if (!data?.ok) return toast({ title: data?.error || "Error", variant: "destructive" });
    toast({ title: "Reto vinculado" });
    nav("/tournament/versus");
  };

  if (loading) return <div className="text-gray-400">Cargando...</div>;
  if (!info) return <div className="text-gray-400">Invitación inválida o expirada.</div>;

  return (
    <Card className="max-w-md mx-auto bg-[#0a1129]/60 border-[#00E5FF]/20">
      <CardContent className="p-6 space-y-4 text-center">
        <h1 className="text-2xl font-black">¡Te han retado!</h1>
        <p><strong>{info.challenger?.full_name}</strong> te desafía 1 vs 1.</p>
        {Number(info.stake_usd) > 0 && <p className="text-[#B6FF3D] font-bold">Apuesta: ${info.stake_usd} USDT</p>}
        {!user ? (
          <Button onClick={() => nav(`/tournament/register?versus=${inviteToken}`)} className="bg-[#B6FF3D] text-black w-full">
            Crear cuenta para aceptar
          </Button>
        ) : (
          <Button onClick={claim} disabled={busy} className="bg-[#B6FF3D] text-black w-full">Vincular reto a mi cuenta</Button>
        )}
      </CardContent>
    </Card>
  );
}
