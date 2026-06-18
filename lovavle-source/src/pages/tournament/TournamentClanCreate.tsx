import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useTournamentAuth } from "@/hooks/useTournamentAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Shield } from "lucide-react";

export default function TournamentClanCreate() {
  const { user, token, refresh, loading: authLoading } = useTournamentAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  // TOR-19: esperar a que el hook resuelva la sesión antes de decidir redirect
  if (authLoading) return <div className="text-muted-foreground">Cargando...</div>;
  if (!user) return <Navigate to="/tournament/login" replace />;
  if (user.clan_id) return <Navigate to={`/tournament/clans/${user.clan_id}`} replace />;

  const submit = async () => {
    setBusy(true);
    const { data } = await supabase.functions.invoke("tournament-clan-create", {
      headers: { Authorization: `Bearer ${token}` },
      body: { name, tag, description },
    });
    setBusy(false);
    if (!data?.ok) { toast({ title: data?.error || "Error", variant: "destructive" }); return; }
    toast({ title: "Clan creado", description: `Código: ${data.clan.invite_code}` });
    refresh();
    nav(`/tournament/clans/${data.clan.id}`);
  };

  return (
    <Card className="max-w-xl bg-[#0a1129]/60 border-[#00E5FF]/20">
      <CardHeader><CardTitle className="flex items-center gap-2"><Shield /> Crear clan</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} /></div>
        <div><Label>Tag (2-6 chars, A-Z 0-9)</Label><Input value={tag} onChange={(e) => setTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} maxLength={6} className="font-mono uppercase" /></div>
        <div><Label>Descripción</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
        <div className="text-xs text-gray-400">El clan es gratis. Verificarlo cuesta <span className="text-[#00E5FF] font-bold">$100 USDT</span> (insignia y prestigio).</div>
        <Button onClick={submit} disabled={busy || !name || !tag} className="w-full bg-[#B6FF3D] text-black hover:brightness-110">Crear</Button>
      </CardContent>
    </Card>
  );
}
