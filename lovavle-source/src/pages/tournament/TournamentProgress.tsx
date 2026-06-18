import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTournamentAuth } from "@/hooks/useTournamentAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Trophy, Flame, Users, Award, Copy, Share2, Sparkles, Lock, CheckCircle2, Coins, AlertTriangle, Plus,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

const ICONS: Record<string, any> = {
  flag: Trophy, trophy: Trophy, award: Award, zap: Flame, users: Users,
  star: Sparkles, "check-circle": CheckCircle2, "dollar-sign": Coins, shield: Award,
};

export default function TournamentProgress() {
  const { user, token, loading: authLoading } = useTournamentAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    const { data: d } = await supabase.functions.invoke("tournament-progress", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (d?.ok) setData(d);
    setLoading(false);
  };

  useEffect(() => { load(); }, [token]);

  // TOR-19: esperar a que el hook resuelva la sesión antes de decidir redirect
  if (authLoading) return <div className="text-muted-foreground">Cargando...</div>;
  if (!user) return <Navigate to="/tournament/login" replace />;

  const referralLink = `https://bullfytech.online/tournament/register?ref=${user.referral_code || ""}`;
  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success("Link de invitación copiado");
  };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "Únete a Bullfy Tournament", url: referralLink }); }
      catch { /* cancel */ }
    } else copyLink();
  };

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Sparkles className="h-5 w-5 text-primary" /></div>
            <div>
              <div className="text-2xl font-bold">{stats?.bullfy_points ?? 0}</div>
              <div className="text-xs text-muted-foreground">Bullfy Points</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10"><Flame className="h-5 w-5 text-orange-500" /></div>
            <div>
              <div className="text-2xl font-bold">{stats?.daily_streak ?? 0}</div>
              <div className="text-xs text-muted-foreground">Racha diaria</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10"><Award className="h-5 w-5 text-emerald-500" /></div>
            <div>
              <div className="text-2xl font-bold">{stats?.achievements_unlocked ?? 0}<span className="text-sm text-muted-foreground">/{stats?.achievements_total ?? 0}</span></div>
              <div className="text-xs text-muted-foreground">Logros</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10"><Users className="h-5 w-5 text-blue-500" /></div>
            <div>
              <div className="text-2xl font-bold">{stats?.referrals_qualified ?? 0}<span className="text-sm text-muted-foreground">/{stats?.referrals_total ?? 0}</span></div>
              <div className="text-xs text-muted-foreground">Referidos</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Share2 className="h-5 w-5 text-primary" />Tu link de invitación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Comparte tu código y gana <strong>200 Bullfy Points</strong> cuando tu invitado complete su primer torneo.
          </p>
          <div className="flex gap-2">
            <Input value={referralLink} readOnly className="font-mono text-xs" />
            <Button variant="outline" onClick={copyLink}><Copy className="h-4 w-4" /></Button>
            <Button onClick={share}><Share2 className="h-4 w-4 mr-2" />Compartir</Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Tu código:</span>
            <Badge variant="outline" className="font-mono text-base">{user.referral_code || "—"}</Badge>
          </div>
        </CardContent>
      </Card>

      <PublicProfileCard onUpdated={load} />

      <Tabs defaultValue="achievements">
        <TabsList>
          <TabsTrigger value="achievements">Logros</TabsTrigger>
          <TabsTrigger value="history">Historial de puntos</TabsTrigger>
          <TabsTrigger value="referrals">Mis referidos</TabsTrigger>
          <TabsTrigger value="disputes">Mis disputas</TabsTrigger>
        </TabsList>

        <TabsContent value="achievements" className="mt-4">
          {loading ? <p className="text-muted-foreground">Cargando…</p> : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {(data?.achievements || []).map((a: any) => {
                const Icon = ICONS[a.icon] || Trophy;
                return (
                  <Card key={a.id} className={a.unlocked ? "border-primary/50" : "opacity-60"}>
                    <CardContent className="p-4 flex gap-3">
                      <div className={`p-2 rounded-lg ${a.unlocked ? "bg-primary/10" : "bg-muted"} h-fit`}>
                        {a.unlocked ? <Icon className="h-5 w-5 text-primary" /> : <Lock className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-sm">{a.name}</h4>
                          <Badge variant="outline" className="text-xs shrink-0">+{a.reward_points} BP</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{a.description}</p>
                        {a.unlocked && a.unlocked_at && (
                          <p className="text-[10px] text-primary mt-1">Desbloqueado {new Date(a.unlocked_at).toLocaleDateString()}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {(data?.ledger || []).length === 0 ? (
                <p className="p-4 text-muted-foreground text-sm">Sin movimientos todavía.</p>
              ) : (
                <div className="divide-y divide-border">
                  {(data?.ledger || []).map((l: any) => (
                    <div key={l.id} className="flex items-center justify-between p-3">
                      <div>
                        <div className="text-sm font-medium capitalize">{l.reason.replace(/_/g, " ")}</div>
                        <div className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</div>
                      </div>
                      <Badge variant={l.delta >= 0 ? "default" : "destructive"} className="font-mono">
                        {l.delta >= 0 ? "+" : ""}{l.delta} BP
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="referrals" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {(data?.referrals || []).length === 0 ? (
                <p className="p-4 text-muted-foreground text-sm">Aún no has invitado a nadie. ¡Comparte tu link!</p>
              ) : (
                <div className="divide-y divide-border">
                  {(data?.referrals || []).map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between p-3">
                      <div>
                        <div className="text-sm font-medium">{r.referred_name || "Usuario"}</div>
                        <div className="text-xs text-muted-foreground">Se unió {new Date(r.referred_joined_at || r.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.status === "rewarded" && <Badge>+{r.reward_points} BP</Badge>}
                        <Badge variant="outline" className="capitalize">{r.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disputes" className="mt-4">
          <DisputesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const DISPUTE_CATEGORIES = [
  { value: "disqualification", label: "Descalificación injusta" },
  { value: "prize_not_paid", label: "Premio no pagado" },
  { value: "wrong_rank", label: "Ranking incorrecto" },
  { value: "technical_issue", label: "Problema técnico" },
  { value: "kyc_rejected", label: "KYC rechazado" },
  { value: "other", label: "Otro" },
];

function DisputesPanel() {
  const { token } = useTournamentAuth();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ category: "", subject: "", description: "", tournament_id: "" });

  const load = async () => {
    if (!token) return;
    setLoading(true);
    const { data } = await supabase.functions.invoke("tournament-dispute", {
      headers: { Authorization: `Bearer ${token}` },
      body: { action: "list" },
    });
    if (data?.ok) setList(data.disputes || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [token]);

  const submit = async () => {
    if (!form.category || !form.subject || !form.description) {
      toast.error("Completa categoría, asunto y descripción"); return;
    }
    setSubmitting(true);
    const { data } = await supabase.functions.invoke("tournament-dispute", {
      headers: { Authorization: `Bearer ${token}` },
      body: {
        action: "create",
        category: form.category,
        subject: form.subject,
        description: form.description,
        tournament_id: form.tournament_id || null,
      },
    });
    if (data?.ok) {
      toast.success("Disputa enviada. Te responderemos pronto.");
      setOpen(false);
      setForm({ category: "", subject: "", description: "", tournament_id: "" });
      load();
    } else toast.error(data?.error || "Error al enviar");
    setSubmitting(false);
  };

  const statusColor = (s: string) =>
    s === "resolved" ? "default" : s === "in_review" ? "secondary" : s === "rejected" ? "destructive" : "outline";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">¿Tienes un problema? Abre una disputa y nuestro equipo la revisará.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Nueva disputa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Abrir nueva disputa</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Categoría</label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                  <SelectContent>
                    {DISPUTE_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Asunto (máx. 200)</label>
                <Input maxLength={200} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Descripción (máx. 2000)</label>
                <Textarea rows={5} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tournament ID (opcional)</label>
                <Input value={form.tournament_id} onChange={(e) => setForm({ ...form, tournament_id: e.target.value })} placeholder="UUID del torneo si aplica" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={submit} disabled={submitting}>{submitting ? "Enviando…" : "Enviar disputa"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-4 text-muted-foreground text-sm">Cargando…</p>
          ) : list.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Sin disputas. Si todo va bien, ¡así debe seguir!
            </div>
          ) : (
            <div className="divide-y divide-border">
              {list.map((d) => (
                <div key={d.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm">{d.subject}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {DISPUTE_CATEGORIES.find((c) => c.value === d.category)?.label || d.category} ·{" "}
                        {new Date(d.created_at).toLocaleString()}
                      </div>
                    </div>
                    <Badge variant={statusColor(d.status) as any} className="capitalize shrink-0">{d.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{d.description}</p>
                  {d.admin_response && (
                    <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                      <div className="text-xs font-semibold text-primary mb-1">Respuesta del equipo</div>
                      <p className="text-sm whitespace-pre-wrap">{d.admin_response}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PublicProfileCard({ onUpdated }: { onUpdated: () => void }) {
  const { user, token, refresh } = useTournamentAuth();
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [pub, setPub] = useState(user?.public_profile ?? true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setUsername(user?.username || "");
    setBio(user?.bio || "");
    setPub(user?.public_profile ?? true);
  }, [user?.username, user?.bio, user?.public_profile]);

  const profileUrl = `https://bullfytech.online/tournament/p/${user?.username || ""}`;
  const copyProfile = () => { navigator.clipboard.writeText(profileUrl); toast.success("Link de perfil copiado"); };

  const save = async () => {
    setSaving(true);
    const { data } = await supabase.functions.invoke("tournament-profile-update", {
      headers: { Authorization: `Bearer ${token}` },
      body: { username, bio, public_profile: pub },
    });
    if (data?.ok) {
      toast.success("Perfil actualizado");
      setEditing(false);
      await refresh();
      onUpdated();
    } else toast.error(data?.error || "Error");
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Mi perfil público</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!editing ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline" className="font-mono">@{user?.username || "—"}</Badge>
              <Badge variant={pub ? "default" : "secondary"}>{pub ? "Público" : "Privado"}</Badge>
              <Button size="sm" variant="outline" onClick={() => window.open(profileUrl, "_blank")}>Ver perfil</Button>
              <Button size="sm" variant="outline" onClick={copyProfile}><Copy className="h-3 w-3 mr-1" />Copiar link</Button>
              <Button size="sm" onClick={() => setEditing(true)}>Editar</Button>
            </div>
            {user?.bio && <p className="text-sm text-muted-foreground">{user.bio}</p>}
          </>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Username (3-24, alfanumérico)</label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={24} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Bio (máx. 280)</label>
              <Input value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} placeholder="Cuéntale al mundo quién eres..." />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} />
              Perfil público (visible para cualquiera)
            </label>
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
              <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
