import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Shield, Loader2, Eye, Check, X, AlertTriangle, MessageSquare, Activity, Coins, Save, Users, LogIn, Search, Copy, Wallet, ShieldCheck, ArrowLeft, Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

export default function TournamentAdmin() {
  const { user, loading, isGlobalAdmin } = useAuth() as any;
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [kycs, setKycs] = useState<any[]>([]);
  const [withdraws, setWithdraws] = useState<any[]>([]);
  const [flags, setFlags] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [bpConfig, setBpConfig] = useState<any>(null);
  const [ecoConfig, setEcoConfig] = useState<any>(null);
  const [tUsers, setTUsers] = useState<any[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [verifs, setVerifs] = useState<any[]>([]);

  const loadVerifs = async () => {
    const { data } = await supabase.functions.invoke("tournament-admin-action", {
      body: { action: "list_user_verifications", target_id: "_" },
    });
    if (data?.ok) setVerifs(data.verifications || []);
  };
  const viewVerifDoc = async (path: string) => {
    const { data } = await supabase.functions.invoke("tournament-admin-action", {
      body: { action: "signed_verif_url", target_id: "_", payload: { path } },
    });
    if (data?.ok && data.url) window.open(data.url, "_blank");
  };
  const reviewVerif = async (id: string, decision: "approve" | "reject", opts: { notes?: string; refund?: boolean } = {}) => {
    setBusy(id + "review_verif");
    try {
      const { data } = await supabase.functions.invoke("tournament-admin-action", {
        body: { action: "review_user_verification", target_id: id, payload: { decision, ...opts } },
      });
      if (!data?.ok) throw new Error(data?.error || "Error");
      toast({ title: decision === "approve" ? "✅ Verificación aprobada" : "❌ Verificación rechazada" });
      await loadVerifs();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const loadUsers = async (q = "") => {
    const { data } = await supabase.functions.invoke("tournament-admin-action", {
      body: { action: "list_tournament_users", target_id: "_", payload: { q } },
    });
    if (data?.ok) setTUsers(data.users || []);
  };
  const forceLogin = async (userId: string, email: string) => {
    setBusy(userId + "force_login");
    try {
      const { data } = await supabase.functions.invoke("tournament-admin-action", {
        body: { action: "force_login", target_id: userId },
      });
      if (!data?.ok) throw new Error(data?.error || "Error");
      const url = `${window.location.origin}/tournament/impersonate#token=${data.token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      toast({ title: "🔑 Acceso generado", description: `URL copiada. Compartir con ${email} (válida 30 días).` });
      prompt("Copia este enlace de acceso (válido 30 días):", url);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setBusy(null); }
  };
  const editContact = async (u: any) => {
    const email = prompt("Email:", u.email || "");
    if (email === null) return;
    const phone = prompt("Teléfono:", u.phone || "");
    if (phone === null) return;
    setBusy(u.id + "update_user_contact");
    try {
      const { data } = await supabase.functions.invoke("tournament-admin-action", {
        body: { action: "update_user_contact", target_id: u.id, payload: { email, phone } },
      });
      if (!data?.ok) throw new Error(data?.error || "Error");
      toast({ title: "✅ Contacto actualizado" });
      await loadUsers(userQuery);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const loadBpConfig = async () => {
    const { data } = await supabase.functions.invoke("tournament-admin-action", { body: { action: "get_bp_config" } });
    if (data?.ok) setBpConfig(data.config);
  };
  const saveBpConfig = async () => {
    if (!bpConfig) return;
    setBusy("bp_config");
    try {
      const { data } = await supabase.functions.invoke("tournament-admin-action", { body: { action: "update_bp_config", payload: bpConfig } });
      if (!data?.ok) throw new Error(data?.error || "Error");
      toast({ title: "✅ Configuración BP actualizada" });
      await loadBpConfig();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setBusy(null); }
  };
  const loadEcoConfig = async () => {
    const { data } = await supabase.functions.invoke("tournament-admin-action", { body: { action: "get_economy_config" } });
    if (data?.ok) setEcoConfig(data.config);
  };
  const saveEcoConfig = async () => {
    if (!ecoConfig) return;
    setBusy("eco_config");
    try {
      const { data } = await supabase.functions.invoke("tournament-admin-action", { body: { action: "update_economy_config", payload: ecoConfig } });
      if (!data?.ok) throw new Error(data?.error || "Error");
      toast({ title: "✅ Economía & Reglas actualizadas" });
      await loadEcoConfig();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const load = async () => {
    const [t, k, w, f, d] = await Promise.all([
      supabase.from("tournaments").select("id,name,type,modality,status,approval_status,created_at,participants_count,max_participants,prize_pool_usd")
        .order("created_at", { ascending: false }).limit(50),
      supabase.from("tournament_kyc_documents").select("id,user_id,doc_type,status,created_at,tournament_users(full_name,email)")
        .eq("status", "pending").order("created_at"),
      supabase.from("tournament_withdrawals").select("id,user_id,amount_usd,net_usd,wallet_address,status,created_at,tournament_users(full_name,email)")
        .in("status", ["pending", "approved"]).order("created_at"),
      supabase.from("tournament_fraud_flags").select("id,tournament_id,flag_type,severity,status,user_ids,participant_ids,evidence,description,detected_at")
        .eq("status", "pending").order("detected_at", { ascending: false }).limit(50),
      supabase.from("tournament_disputes").select("id,user_id,tournament_id,category,status,subject,description,created_at,tournament_users(full_name,email)")
        .in("status", ["pending","in_review"]).order("created_at").limit(50),
    ]);
    setTournaments(t.data || []);
    setKycs(k.data || []);
    setWithdraws(w.data || []);
    setFlags(f.data || []);
    setDisputes(d.data || []);
    setKpis({
      activeTournaments: (t.data || []).filter((x: any) => x.status === "running").length,
      pendingFlags: (f.data || []).length,
      pendingDisputes: (d.data || []).length,
      pendingKyc: (k.data || []).length,
      pendingWithdraws: (w.data || []).length,
    });
  };
  useEffect(() => { if (user) { load(); loadBpConfig(); loadEcoConfig(); loadUsers(); loadVerifs(); } }, [user]);

  if (loading) return <div className="text-muted-foreground">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  // PR #8 — D8: pantalla de "sin permisos" con layout consistente en vez de
  // texto plano. Mantiene el gate funcional pero la UX deja claro al usuario
  // que está autenticado pero no autorizado para esta sección, con un camino
  // de salida (botón al dashboard).
  if (!isGlobalAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-destructive/40">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
              <Lock className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Acceso restringido</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              El panel de administración de Torneos está reservado para administradores globales.
              Si crees que deberías tener acceso, contáctate con el equipo.
            </p>
            <Button asChild variant="outline">
              <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" /> Volver al dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const act = async (action: string, target_id: string, payload: any = {}) => {
    setBusy(target_id + action);
    try {
      const { data } = await supabase.functions.invoke("tournament-admin-action", {
        body: { action, target_id, payload },
      });
      if (!data?.ok) throw new Error(data?.error || "Error");
      toast({ title: "✅ Acción ejecutada" });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const viewDoc = async (id: string) => {
    const { data } = await supabase.functions.invoke("tournament-admin-action", {
      body: { action: "signed_kyc_url", target_id: id },
    });
    if (data?.ok && data.url) window.open(data.url, "_blank");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="h-6 w-6" />Tournament Admin</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Torneos activos" value={kpis.activeTournaments || 0} />
        <KpiCard label="Flags pendientes" value={kpis.pendingFlags || 0} accent={kpis.pendingFlags > 0} />
        <KpiCard label="Disputas abiertas" value={kpis.pendingDisputes || 0} accent={kpis.pendingDisputes > 0} />
        <KpiCard label="KYC pendientes" value={kpis.pendingKyc || 0} />
        <KpiCard label="Retiros pendientes" value={kpis.pendingWithdraws || 0} />
      </div>

      <Tabs defaultValue="tournaments">
        <TabsList>
          <TabsTrigger value="tournaments">Torneos ({tournaments.length})</TabsTrigger>
          <TabsTrigger value="kyc">KYC ({kycs.length})</TabsTrigger>
          <TabsTrigger value="withdraws">Retiros ({withdraws.length})</TabsTrigger>
          <TabsTrigger value="flags"><AlertTriangle className="h-4 w-4 mr-1" />Fraude ({flags.length})</TabsTrigger>
          <TabsTrigger value="disputes"><MessageSquare className="h-4 w-4 mr-1" />Disputas ({disputes.length})</TabsTrigger>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-1" />Usuarios</TabsTrigger>
          <TabsTrigger value="bp_config"><Coins className="h-4 w-4 mr-1" />Bullfy Points</TabsTrigger>
          <TabsTrigger value="economy"><Wallet className="h-4 w-4 mr-1" />Economía & Reglas</TabsTrigger>
          <TabsTrigger value="verifications"><ShieldCheck className="h-4 w-4 mr-1" />Verificaciones ({verifs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="verifications">
          <Card><CardContent className="pt-6 space-y-2">
            {verifs.length === 0 && <p className="text-muted-foreground text-sm">Sin solicitudes pendientes.</p>}
            {verifs.map((v: any) => (
              <div key={v.id} className="border rounded p-3 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="font-medium">{v.tournament_users?.full_name} <span className="text-xs text-muted-foreground">@{v.tournament_users?.username || "—"} · {v.tournament_users?.email}</span></div>
                    <div className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString()}</div>
                  </div>
                  <Badge variant="outline">{v.status}</Badge>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {v.id_front_url && <Button size="sm" variant="outline" onClick={() => viewVerifDoc(v.id_front_url)}><Eye className="h-3 w-3 mr-1" />Frente ID</Button>}
                  {v.id_back_url && <Button size="sm" variant="outline" onClick={() => viewVerifDoc(v.id_back_url)}><Eye className="h-3 w-3 mr-1" />Reverso ID</Button>}
                  {v.selfie_url && <Button size="sm" variant="outline" onClick={() => viewVerifDoc(v.selfie_url)}><Eye className="h-3 w-3 mr-1" />Selfie + ID</Button>}
                </div>
                <div className="flex gap-1 justify-end">
                  <Button size="sm" onClick={() => reviewVerif(v.id, "approve")} disabled={busy === v.id + "review_verif"}>
                    {busy === v.id + "review_verif" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" />Aprobar</>}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => {
                    const notes = prompt("Motivo del rechazo:") || "";
                    const refund = confirm("¿Reembolsar los $25 USDT al usuario? Aceptar = sí, Cancelar = no.");
                    reviewVerif(v.id, "reject", { notes, refund });
                  }}><X className="h-4 w-4 mr-1" />Rechazar</Button>
                </div>
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="tournaments">
          <Card><CardContent className="pt-6 space-y-2">
            {tournaments.map(t => (
              <div key={t.id} className="border rounded p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{t.name} <Badge variant="outline">{t.type}</Badge> <Badge variant="outline">{t.modality}</Badge></div>
                  <div className="text-xs text-muted-foreground">
                    {t.participants_count}/{t.max_participants} · pool ${t.prize_pool_usd} · status: {t.status} · approval: {t.approval_status}
                  </div>
                </div>
                <div className="flex gap-1 flex-wrap justify-end">
                  {t.approval_status === "pending" && (
                    <>
                      <Button size="sm" onClick={() => act("approve_tournament", t.id)} disabled={busy?.includes(t.id)}>
                        {busy === t.id + "approve_tournament" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => {
                        const reason = prompt("Motivo:") || "policy";
                        act("reject_tournament", t.id, { reason });
                      }}><X className="h-4 w-4" /></Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" onClick={() => {
                    const name = prompt("Nuevo nombre:", t.name);
                    if (name === null) return;
                    const status = prompt("Status (draft/scheduled/registration/running/finished/cancelled):", t.status) || t.status;
                    const max = prompt("Max participantes:", String(t.max_participants ?? ""));
                    const pool = prompt("Prize pool USD:", String(t.prize_pool_usd ?? ""));
                    const payload: any = { name, status };
                    if (max !== null && max !== "") payload.max_participants = Number(max);
                    if (pool !== null && pool !== "") payload.prize_pool_usd = Number(pool);
                    act("update_tournament", t.id, payload);
                  }}>Editar</Button>
                  <Button size="sm" variant="destructive" onClick={() => {
                    if (!confirm(`¿Eliminar "${t.name}" y TODOS sus datos (participantes, pagos, chat, highlights)? Esta acción es irreversible.`)) return;
                    act("delete_tournament", t.id);
                  }}>Eliminar</Button>
                </div>
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="kyc">
          <Card><CardContent className="pt-6 space-y-2">
            {kycs.map(k => (
              <div key={k.id} className="border rounded p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{k.tournament_users?.full_name} ({k.tournament_users?.email})</div>
                  <div className="text-xs text-muted-foreground">{k.doc_type} · {new Date(k.created_at).toLocaleString()}</div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => viewDoc(k.id)}><Eye className="h-4 w-4" /></Button>
                  <Button size="sm" onClick={() => act("approve_kyc", k.user_id)}>
                    {busy === k.user_id + "approve_kyc" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => {
                    const notes = prompt("Motivo de rechazo:") || "";
                    act("reject_kyc", k.user_id, { notes });
                  }}><X className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
            {kycs.length === 0 && <p className="text-muted-foreground text-sm">Sin pendientes.</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="withdraws">
          <Card><CardContent className="pt-6 space-y-2">
            {withdraws.map(w => (
              <div key={w.id} className="border rounded p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{w.tournament_users?.full_name} — ${w.amount_usd} → ${w.net_usd}</div>
                  <div className="text-xs text-muted-foreground font-mono">{w.wallet_address}</div>
                  <Badge variant="outline">{w.status}</Badge>
                </div>
                <div className="flex gap-1">
                  {w.status === "pending" && (
                    <Button size="sm" onClick={() => act("approve_withdrawal", w.id)}>Aprobar</Button>
                  )}
                  {w.status === "approved" && (
                    <Button size="sm" onClick={() => {
                      const tx = prompt("TX hash:") || "";
                      if (tx) act("mark_paid_withdrawal", w.id, { tx_hash: tx });
                    }}>Marcar pagado</Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => {
                    const reason = prompt("Motivo:") || "";
                    act("reject_withdrawal", w.id, { reason });
                  }}>Rechazar</Button>
                </div>
              </div>
            ))}
            {withdraws.length === 0 && <p className="text-muted-foreground text-sm">Sin retiros.</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="flags">
          <Card><CardContent className="pt-6 space-y-2">
            {flags.map((f: any) => (
              <div key={f.id} className="border rounded p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={f.severity === "high" ? "destructive" : "outline"}>{f.severity}</Badge>
                      <Badge variant="outline">{f.flag_type}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(f.detected_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm mt-1">{f.description}</p>
                    <pre className="text-xs text-muted-foreground bg-muted/30 p-2 rounded mt-1 overflow-x-auto">{JSON.stringify(f.evidence, null, 2)}</pre>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="destructive" onClick={() => {
                      if (!confirm("Confirmar fraude y descalificar a los participantes implicados?")) return;
                      const notes = prompt("Notas:") || "";
                      act("confirm_flag", f.id, { notes });
                    }}>Confirmar</Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      const notes = prompt("Razón para descartar:") || "";
                      act("dismiss_flag", f.id, { notes });
                    }}>Descartar</Button>
                  </div>
                </div>
              </div>
            ))}
            {flags.length === 0 && <p className="text-muted-foreground text-sm">Sin alertas pendientes.</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="disputes">
          <Card><CardContent className="pt-6 space-y-2">
            {disputes.map((d: any) => (
              <div key={d.id} className="border rounded p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{d.category}</Badge>
                  <Badge variant={d.status === "pending" ? "destructive" : "outline"}>{d.status}</Badge>
                  <span className="text-xs text-muted-foreground">{d.tournament_users?.full_name} ({d.tournament_users?.email})</span>
                </div>
                <div className="font-medium text-sm">{d.subject}</div>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{d.description}</p>
                <div className="flex gap-1">
                  <Button size="sm" onClick={() => {
                    const response = prompt("Respuesta al usuario:") || "";
                    if (response) act("resolve_dispute", d.id, { status: "resolved", response });
                  }}>Resolver</Button>
                  <Button size="sm" variant="destructive" onClick={() => {
                    const response = prompt("Razón de rechazo:") || "";
                    if (response) act("resolve_dispute", d.id, { status: "rejected", response });
                  }}>Rechazar</Button>
                </div>
              </div>
            ))}
            {disputes.length === 0 && <p className="text-muted-foreground text-sm">Sin disputas abiertas.</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="users">
          <Card><CardContent className="pt-6 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Buscar por email, teléfono, nombre o username..."
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") loadUsers(userQuery); }}
                />
              </div>
              <Button onClick={() => loadUsers(userQuery)} variant="outline">Buscar</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Los usuarios del torneo usan login por OTP (email/SMS) — no tienen contraseña. Usa <b>"Entrar como"</b> para generar un enlace mágico que les da acceso sin OTP por 30 días.
            </p>
            {tUsers.map((u) => (
              <div key={u.id} className="border rounded p-3 flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="font-medium flex items-center gap-2 flex-wrap">
                    {u.full_name || "(sin nombre)"}
                    {u.username && <span className="text-xs text-muted-foreground">@{u.username}</span>}
                    {u.is_elite && <Badge variant="outline">ELITE</Badge>}
                    {u.banned_at && <Badge variant="destructive">BANNED</Badge>}
                    <Badge variant="outline">{u.kyc_status || "no_kyc"}</Badge>
                    <Badge variant="outline">{u.bullfy_points || 0} BP</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {u.email} · {u.phone || "sin tel"} · {u.country || "—"}
                  </div>
                </div>
                <div className="flex gap-1 flex-wrap">
                  <Button size="sm" onClick={() => forceLogin(u.id, u.email)} disabled={busy === u.id + "force_login"}>
                    {busy === u.id + "force_login" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <LogIn className="h-4 w-4 mr-1" />}
                    Entrar como
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => editContact(u)} disabled={busy === u.id + "update_user_contact"}>
                    Editar contacto
                  </Button>
                  {u.banned_at ? (
                    <Button size="sm" variant="outline" onClick={() => act("unban_user", u.id).then(() => loadUsers(userQuery))}>
                      Desbanear
                    </Button>
                  ) : (
                    <Button size="sm" variant="destructive" onClick={() => {
                      const reason = prompt("Motivo del ban (esto eliminará su avatar 3D de Avaturn):") || "policy";
                      act("ban_user", u.id, { reason }).then(() => loadUsers(userQuery));
                    }}>Banear</Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => {
                    if (!confirm(`¿BORRAR la cuenta de ${u.full_name || u.email}?\n\nSe eliminará:\n• Avatar 3D (Avaturn)\n• KYC, pagos, retiros, wallet\n• Participaciones, snapshots, BP\n• Cuentas MT5, chat, disputas\n\nEsta acción es IRREVERSIBLE.`)) return;
                    if (prompt(`Escribe BORRAR para confirmar:`) !== "BORRAR") return;
                    act("delete_user", u.id).then(() => loadUsers(userQuery));
                  }}>Borrar cuenta</Button>
                </div>
              </div>
            ))}
            {tUsers.length === 0 && <p className="text-muted-foreground text-sm">Sin resultados.</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="bp_config">
          <Card><CardContent className="pt-6 space-y-4">
            <div>
              <h3 className="font-semibold flex items-center gap-2"><Coins className="h-4 w-4" /> Reglas globales de Bullfy Points</h3>
              <p className="text-xs text-muted-foreground">Estas variables aplican a todos los torneos. Los creadores ya no eligen BP por torneo.</p>
            </div>
            {!bpConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { k: "join_base_points", label: "Puntos base por inscripción", hint: "Otorgados al inscribirse en cualquier torneo." },
                    { k: "paid_multiplier", label: "Multiplicador torneo pagado", hint: "Se multiplica si entry_fee > 0." },
                    { k: "elite_multiplier", label: "Multiplicador torneo Élite", hint: "Se multiplica si tipo=elite o entry_fee >= umbral." },
                    { k: "elite_entry_fee_threshold", label: "Umbral USD para Élite", hint: "Entry fee mínimo para considerar el torneo Élite." },
                    { k: "win_first_place_points", label: "Puntos por ganar 1er lugar", hint: "Otorgados al usuario con final_rank=1." },
                    { k: "daily_streak_base_points", label: "Puntos por racha diaria", hint: "Base de puntos por login/día seguido." },
                    { k: "referral_first_deposit_points", label: "Puntos por referido (primer depósito)", hint: "Otorgados al referidor cuando su referido deposita." },
                  ].map(({ k, label, hint }) => (
                    <div key={k} className="space-y-1">
                      <Label>{label}</Label>
                      <Input type="number" step="0.1" value={bpConfig[k] ?? ""}
                        onChange={(e) => setBpConfig({ ...bpConfig, [k]: e.target.value })} />
                      <p className="text-xs text-muted-foreground">{hint}</p>
                    </div>
                  ))}
                </div>
                <Button onClick={saveBpConfig} disabled={busy === "bp_config"}>
                  {busy === "bp_config" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Guardar configuración
                </Button>
                {bpConfig.updated_at && <p className="text-xs text-muted-foreground">Última actualización: {new Date(bpConfig.updated_at).toLocaleString()}</p>}
              </>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="economy">
          <Card><CardContent className="pt-6 space-y-4">
            <div>
              <h3 className="font-semibold flex items-center gap-2"><Wallet className="h-4 w-4" /> Economía & Reglas globales</h3>
              <p className="text-xs text-muted-foreground">Parámetros que rigen ambas ligas (BMoney y Élite). Aplican a torneos creados a partir de su modificación.</p>
            </div>
            {!ecoConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { k: "bmoney_starting_balance", label: "BMoney inicial nuevos usuarios (BM$)", hint: "Saldo BMoney que recibe cada nuevo usuario." },
                    { k: "bmoney_topup_threshold", label: "Umbral para recarga BMoney (BM$)", hint: "El usuario puede recargar si su saldo BMoney es menor a este valor." },
                    { k: "bmoney_topup_amount", label: "Monto de recarga BMoney (BM$)", hint: "Valor al que se reinicia el saldo BMoney." },
                    { k: "bmoney_topup_cooldown_hours", label: "Cooldown de recarga (horas)", hint: "Tiempo mínimo entre recargas BMoney." },
                    { k: "max_tournaments_per_user_per_day", label: "Máx. torneos creados por usuario/día", hint: "Aplica a ambas ligas." },
                    { k: "house_fee_pct_default", label: "Fee Bullfy por defecto (%)", hint: "Porcentaje retenido del prize pool." },
                    { k: "bp_multiplier_bmoney", label: "Multiplicador BP – Liga BMoney", hint: "Se aplica a los puntos ganados en torneos BMoney." },
                    { k: "bp_multiplier_elite", label: "Multiplicador BP – Liga Élite", hint: "Se aplica a los puntos ganados en torneos Élite." },
                    { k: "elite_min_deposit_usd", label: "Depósito mínimo Élite (USD)", hint: "Requerido para acceder a la liga Élite." },
                  ].map(({ k, label, hint }) => (
                    <div key={k} className="space-y-1">
                      <Label>{label}</Label>
                      <Input type="number" step="0.01" value={ecoConfig[k] ?? ""}
                        onChange={(e) => setEcoConfig({ ...ecoConfig, [k]: e.target.value })} />
                      <p className="text-xs text-muted-foreground">{hint}</p>
                    </div>
                  ))}
                  <div className="space-y-1 flex items-center gap-3 pt-6">
                    <Switch checked={!!ecoConfig.elite_kyc_required}
                      onCheckedChange={(v) => setEcoConfig({ ...ecoConfig, elite_kyc_required: v })} />
                    <div>
                      <Label>KYC obligatorio para Élite</Label>
                      <p className="text-xs text-muted-foreground">Si está activo, sólo usuarios con KYC aprobado pueden inscribirse en torneos Élite con dinero real.</p>
                    </div>
                  </div>
                </div>
                <Button onClick={saveEcoConfig} disabled={busy === "eco_config"}>
                  {busy === "eco_config" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Guardar Economía & Reglas
                </Button>
                {ecoConfig.updated_at && <p className="text-xs text-muted-foreground">Última actualización: {new Date(ecoConfig.updated_at).toLocaleString()}</p>}
              </>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${accent ? "border-destructive/50 bg-destructive/5" : "bg-muted/30"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold flex items-center gap-1">
        {accent && <Activity className="h-4 w-4 text-destructive" />}
        {value}
      </div>
    </div>
  );
}
