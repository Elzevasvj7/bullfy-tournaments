import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTournamentAuth } from "@/hooks/useTournamentAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldCheck, Copy, LogOut, Crown, Sword, Swords } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function TournamentClanDetail() {
  // La ruta define el param como :clanId; aliasamos a id para mantener el resto del código.
  const { clanId: id } = useParams();
  const { user, token, refresh } = useTournamentAuth();
  const [clan, setClan] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [wars, setWars] = useState<any[]>([]);
  const [warClans, setWarClans] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [chal, setChal] = useState({ code: "", stake: 0, minP: 3, duration: 1440, message: "" });
  // PR #7 A5: invite_code ya no es legible con anon key (REVOKE SELECT en
  // columna). Se fetchea aparte via Edge Function que valida membresía.
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  const load = async () => {
    // Columnas explícitas — antes era select("*") pero anon ya no tiene
    // privilegio sobre invite_code y * dispara permission denied.
    const { data: c } = await supabase.from("tournament_clans")
      .select("id, name, tag, description, logo_url, banner_url, owner_id, is_public, is_verified, verified_at, members_count, total_wars, wars_won, rating, total_score, created_at")
      .eq("id", id!).maybeSingle();
    setClan(c);
    const { data: ms } = await supabase.from("tournament_clan_members")
      .select("id, role, joined_at, user_id, tournament_users:user_id(full_name, username, avatar_url, is_verified_user)")
      .eq("clan_id", id!).is("left_at", null).order("role").order("joined_at");
    setMembers(ms || []);
    const { data: ws } = await supabase.from("tournament_clan_wars")
      .select("id, status, stake_usd, challenger_clan_id, defender_clan_id, winner_clan_id, created_at, tournament_id")
      .or(`challenger_clan_id.eq.${id},defender_clan_id.eq.${id}`)
      .order("created_at", { ascending: false }).limit(20);
    const warList = ws || [];
    setWars(warList);
    const otherIds = Array.from(new Set(warList.flatMap((w: any) => [w.challenger_clan_id, w.defender_clan_id]).filter((x) => x !== id)));
    if (otherIds.length) {
      const { data: cs } = await supabase.from("tournament_clans").select("id, name, tag, is_verified").in("id", otherIds);
      setWarClans(Object.fromEntries((cs || []).map((c: any) => [c.id, c])));
    }
  };
  useEffect(() => { if (id) load(); }, [id]);

  const myRole = members.find((m) => m.user_id === user?.id)?.role;
  const canManage = myRole === "owner" || myRole === "officer";
  const isMine = !!myRole;

  // PR #7 A5: fetch del invite_code via Edge Function (valida membresía).
  // Se hace solo cuando se confirma que el usuario puede gestionar (owner/officer),
  // que son los únicos que ven el panel de "Gestión" donde se muestra el código.
  // IMPORTANTE: este useEffect debe quedar antes del early-return de !clan
  // para no violar las rules of hooks.
  useEffect(() => {
    if (!canManage || !token || !id || inviteCode !== null) return;
    (async () => {
      const { data } = await supabase.functions.invoke("tournament-clan-get-invite-code", {
        headers: { Authorization: `Bearer ${token}` },
        body: { clan_id: id },
      });
      if (data?.ok && data.invite_code) setInviteCode(data.invite_code);
    })();
  }, [canManage, token, id, inviteCode]);

  if (!clan) return <div className="text-gray-400">Cargando...</div>;

  const callManage = async (action: string, target_user_id?: string, payload?: any) => {
    setBusy(true);
    const { data } = await supabase.functions.invoke("tournament-clan-manage", {
      headers: { Authorization: `Bearer ${token}` },
      body: { action, clan_id: id, target_user_id, payload },
    });
    setBusy(false);
    if (!data?.ok) { toast({ title: data?.error || "Error", variant: "destructive" }); return; }
    toast({ title: "OK" });
    load();
  };

  const leave = async () => {
    if (!confirm("¿Salir del clan? Cooldown de 7 días para unirte a otro.")) return;
    const { data } = await supabase.functions.invoke("tournament-clan-leave", { headers: { Authorization: `Bearer ${token}` } });
    if (!data?.ok) return toast({ title: data?.error || "Error", variant: "destructive" });
    toast({ title: "Saliste del clan" }); refresh(); load();
  };

  const verify = async () => {
    if (!confirm("Verificar clan por $100 USDT?")) return;
    const { data } = await supabase.functions.invoke("tournament-clan-verify", {
      headers: { Authorization: `Bearer ${token}` }, body: { clan_id: id },
    });
    if (!data?.ok) return toast({ title: data?.error || "Error", variant: "destructive" });
    toast({ title: "¡Clan verificado!" }); load(); refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="bg-[#0a1129]/60 border-[#00E5FF]/20">
        <CardContent className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {clan.logo_url
              ? <img src={clan.logo_url} className="w-16 h-16 rounded-lg object-cover" />
              : <div className="w-16 h-16 rounded-lg bg-[#00E5FF]/20 flex items-center justify-center font-black text-[#00E5FF]">{clan.tag}</div>}
            <div>
              <h1 className="text-2xl font-black flex items-center gap-2">
                {clan.name}
                {clan.is_verified && <ShieldCheck className="h-5 w-5 text-[#00E5FF]" />}
                <Badge variant="outline">[{clan.tag}]</Badge>
              </h1>
              <p className="text-sm text-gray-400">{clan.description || "Sin descripción"}</p>
              <div className="flex gap-3 text-xs mt-1">
                <span>👥 {clan.members_count}</span>
                <span>🏆 {clan.wars_won}/{clan.total_wars}</span>
                <span className="text-[#B6FF3D] font-bold">{clan.rating} RATING</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {isMine && (
              <Button variant="outline" size="sm" onClick={leave} className="border-red-500/50 text-red-400">
                <LogOut className="h-3 w-3 mr-1" /> Salir
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {canManage && (
        <Card className="bg-[#0a1129]/60 border-[#B6FF3D]/20">
          <CardHeader><CardTitle className="text-sm">Gestión</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-2 text-xs">
              Código:
              <code className="bg-black/40 px-2 py-1 rounded font-mono">{inviteCode || "—"}</code>
              {inviteCode && (
                <button onClick={() => { navigator.clipboard.writeText(inviteCode); toast({ title: "Copiado" }); }}>
                  <Copy className="h-3 w-3" />
                </button>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={async () => {
              await callManage("regenerate_code");
              // Forzar refetch del código tras regenerar.
              setInviteCode(null);
            }}>Regenerar código</Button>
            {!clan.is_verified && myRole === "owner" && (
              <Button size="sm" onClick={verify} className="bg-[#00E5FF] text-black"><ShieldCheck className="h-3 w-3 mr-1" /> Verificar ($100 USDT)</Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="bg-[#0a1129]/60 border-[#00E5FF]/20">
        <CardHeader><CardTitle className="text-sm">Miembros ({members.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y divide-white/5">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  {m.role === "owner" && <Crown className="h-4 w-4 text-[#B6FF3D]" />}
                  {m.role === "officer" && <Shield className="h-4 w-4 text-[#00E5FF]" />}
                  <span className="font-medium">{m.tournament_users?.full_name}</span>
                  {m.tournament_users?.is_verified_user && <ShieldCheck className="h-3 w-3 text-[#00E5FF]" />}
                  <Badge variant="outline" className="text-[10px]">{m.role}</Badge>
                </div>
                {canManage && m.user_id !== user?.id && (
                  <div className="flex gap-1">
                    {myRole === "owner" && m.role === "member" && <Button size="sm" variant="ghost" onClick={() => callManage("promote", m.user_id)}>Promover</Button>}
                    {myRole === "owner" && m.role === "officer" && <Button size="sm" variant="ghost" onClick={() => callManage("demote", m.user_id)}>Degradar</Button>}
                    {m.role !== "owner" && <Button size="sm" variant="ghost" className="text-red-400" onClick={() => callManage("kick", m.user_id)}>Expulsar</Button>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {canManage && (
        <Card className="bg-[#0a1129]/60 border-[#B6FF3D]/20">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Swords className="h-4 w-4 text-[#B6FF3D]" /> Retar a otro clan</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label className="text-[10px]">Código del clan rival</Label>
              <Input placeholder="BULL-XXXXXXXX" value={chal.code} onChange={(e) => setChal({ ...chal, code: e.target.value.toUpperCase() })} className="font-mono uppercase" />
            </div>
            <div><Label className="text-[10px]">Apuesta USDT (opcional)</Label>
              <Input type="number" min={0} value={chal.stake} onChange={(e) => setChal({ ...chal, stake: Number(e.target.value) })} />
            </div>
            <div><Label className="text-[10px]">Mín. participantes por clan (3-10)</Label>
              <Input type="number" min={3} max={10} value={chal.minP} onChange={(e) => setChal({ ...chal, minP: Number(e.target.value) })} />
            </div>
            <div><Label className="text-[10px]">Duración (minutos, 60-10080)</Label>
              <Input type="number" min={60} max={10080} value={chal.duration} onChange={(e) => setChal({ ...chal, duration: Number(e.target.value) })} />
            </div>
            <div className="sm:col-span-2"><Label className="text-[10px]">Mensaje (opcional)</Label>
              <Input value={chal.message} onChange={(e) => setChal({ ...chal, message: e.target.value })} />
            </div>
            <Button
              disabled={busy || !chal.code}
              onClick={async () => {
                setBusy(true);
                // PR #7 A5: ya no podemos resolver el código en frontend
                // (REVOKE SELECT en invite_code). El Edge Function
                // tournament-clan-war-challenge ahora acepta
                // defender_invite_code y resuelve internamente con
                // service_role.
                const { data } = await supabase.functions.invoke("tournament-clan-war-challenge", {
                  headers: { Authorization: `Bearer ${token}` },
                  body: {
                    defender_invite_code: chal.code.trim(),
                    stake_usd: chal.stake,
                    min_participants: chal.minP,
                    duration_minutes: chal.duration,
                    message: chal.message,
                  },
                });
                setBusy(false);
                if (!data?.ok) return toast({ title: data?.error || "Error", variant: "destructive" });
                toast({ title: "Reto enviado" });
                setChal({ code: "", stake: 0, minP: 3, duration: 1440, message: "" });
                load();
              }}
              className="bg-[#B6FF3D] text-black sm:col-span-2"
            ><Swords className="h-4 w-4 mr-1" /> Enviar reto</Button>
          </CardContent>
        </Card>
      )}

      <Card className="bg-[#0a1129]/60 border-[#00E5FF]/20">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Sword className="h-4 w-4" /> Guerras</CardTitle></CardHeader>
        <CardContent>
          {wars.length === 0 ? <p className="text-xs text-gray-400">Sin guerras todavía.</p> : (
            <div className="space-y-2 text-sm">
              {wars.map((w) => {
                const isDefender = w.defender_clan_id === id;
                const otherId = isDefender ? w.challenger_clan_id : w.defender_clan_id;
                const other = warClans[otherId];
                const isWinner = w.winner_clan_id === id;
                return (
                  <div key={w.id} className="flex items-center justify-between p-2 bg-black/20 rounded gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={w.status === "finished" ? "default" : "secondary"} className="text-[10px]">{w.status}</Badge>
                        <span className="text-[11px] text-gray-400">{isDefender ? "vs ataque de" : "vs"}</span>
                        <span className="font-bold">{other?.name || "—"}</span>
                        {other?.is_verified && <ShieldCheck className="h-3 w-3 text-[#00E5FF]" />}
                        {w.stake_usd > 0 && <span className="text-[#B6FF3D]">${w.stake_usd} USDT</span>}
                        {w.status === "finished" && (
                          <Badge className={isWinner ? "bg-[#B6FF3D] text-black" : "bg-red-500/40"}>{isWinner ? "GANADO" : "PERDIDO"}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {w.tournament_id && <Link to={`/tournament/t/${w.tournament_id}`} className="text-xs text-[#00E5FF]">Ver →</Link>}
                      {canManage && isDefender && w.status === "pending" && (
                        <>
                          <Button size="sm" disabled={busy} className="bg-[#B6FF3D] text-black h-7"
                            onClick={async () => {
                              setBusy(true);
                              const { data } = await supabase.functions.invoke("tournament-clan-war-respond", {
                                headers: { Authorization: `Bearer ${token}` }, body: { war_id: w.id, decision: "accept" },
                              });
                              setBusy(false);
                              if (!data?.ok) return toast({ title: data?.error || "Error", variant: "destructive" });
                              toast({ title: "Reto aceptado" }); load();
                            }}>Aceptar</Button>
                          <Button size="sm" variant="ghost" disabled={busy} className="text-red-400 h-7"
                            onClick={async () => {
                              setBusy(true);
                              const { data } = await supabase.functions.invoke("tournament-clan-war-respond", {
                                headers: { Authorization: `Bearer ${token}` }, body: { war_id: w.id, decision: "reject" },
                              });
                              setBusy(false);
                              if (!data?.ok) return toast({ title: data?.error || "Error", variant: "destructive" });
                              toast({ title: "Reto rechazado" }); load();
                            }}>Rechazar</Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
