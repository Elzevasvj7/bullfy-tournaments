import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTournamentAuth } from "@/hooks/useTournamentAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Copy, Mail, RefreshCw, Plug, ArrowLeft, Activity, DollarSign } from "lucide-react";

// PR #8 — C2 / TOR-18: el password MT5 ya no se muestra en la UI. Se entrega
// únicamente por email al crear la cuenta y puede reenviarse con el botón
// "Reenviar al email". A nivel DB, anon/authenticated tienen REVOKE SELECT
// sobre la columna mt5_password (defensa en profundidad — la columna ni
// siquiera se pide en la query a `tournament_participants`).
export default function TournamentMT5Account() {
  const { participantId } = useParams();
  const { user, token, loading: authLoading } = useTournamentAuth();
  const [participant, setParticipant] = useState<any>(null);
  const [tournament, setTournament] = useState<any>(null);
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);

  const [status, setStatus] = useState<any>(null);
  const [, setNow] = useState(Date.now());

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const load = async () => {
    if (!participantId || !user) return;
    setLoading(true);
    const { data: p } = await supabase.from("tournament_participants")
      .select("id, user_id, mt5_login, mt5_server, tournament_id, status, current_equity, current_balance, starting_balance, mt5_suspended, mt5_deleted_at, final_balance, final_equity, final_pnl, final_pnl_pct, closed_at")
      .eq("id", participantId).maybeSingle();
    setParticipant(p);
    if (p?.tournament_id) {
      const { data: t } = await supabase.from("tournaments")
        .select("name, slug, type, starting_balance_usd, starts_at, ends_at, cleanup_at, status, cleanup_done")
        .eq("id", p.tournament_id).maybeSingle();
      setTournament(t);
      const { data: st } = await supabase.functions.invoke("tournament-trading-status", { body: { tournament_id: p.tournament_id } });
      if (st?.ok) setStatus(st);
    }
    if (p?.mt5_login) {
      const { data: inf } = await supabase.functions.invoke("tournament-mt5-info", {
        body: { participant_id: p.id },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (inf?.ok) setInfo(inf);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [participantId, user, token]);

  const provision = async (resend = false) => {
    if (!participant) return;
    setProvisioning(true);
    try {
      const { data, error } = await supabase.functions.invoke("tournament-mt5-provision", {
        body: { participant_id: participant.id, resend_email: resend },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (error || !data?.ok) { toast.error(data?.error || error?.message || "Error"); return; }
      toast.success(resend ? "Email enviado" : "Cuenta MT5 creada y enviada por email");
      await load();
    } finally { setProvisioning(false); }
  };

  const copy = (txt: string) => { navigator.clipboard.writeText(txt); toast.success("Copiado"); };

  if (authLoading || loading) return <div className="text-muted-foreground">Cargando...</div>;
  if (!user) return <Navigate to="/tournament/login" replace />;
  if (!participant) return <div>No encontrado.</div>;
  if (participant.user_id !== user.id) return <div>No autorizado.</div>;

  const acc = info?.account || {};
  const provisioned = !!participant.mt5_login;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2">
            <Link to="/tournament/dashboard"><ArrowLeft className="h-4 w-4 mr-1" />Volver</Link>
          </Button>
          <h1 className="text-2xl font-bold">Cuenta MT5 — {tournament?.name}</h1>
          <Badge variant="outline" className="mt-1 capitalize">{tournament?.type}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />Actualizar</Button>
      </div>

      {provisioned && status && <TradingWindowBanner status={status} participant={participant} />}

      {!provisioned && (
        <Card className="border-primary/40">
          <CardHeader><CardTitle>Crear mi cuenta MT5</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Aún no has creado tu cuenta MT5 para este torneo. Al crearla, recibirás las credenciales por email y podrás verlas aquí en cualquier momento.
            </p>
            <Button onClick={() => provision(false)} disabled={provisioning}>
              <Plug className="h-4 w-4 mr-1" />{provisioning ? "Creando..." : "Crear cuenta MT5"}
            </Button>
          </CardContent>
        </Card>
      )}

      {provisioned && (
        <Card className="border-primary/40">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Credenciales</CardTitle>
            <Button variant="outline" size="sm" onClick={() => provision(true)} disabled={provisioning}>
              <Mail className="h-4 w-4 mr-1" />Reenviar al email
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 font-mono text-sm">
            <Row label="Login" value={participant.mt5_login} onCopy={copy} />
            <Row label="Server" value={participant.mt5_server || "Bullfy-Trade"} onCopy={copy} />
            <p className="text-xs text-muted-foreground font-sans pt-2">
              Por seguridad, tu contraseña solo se envía por email — ya recibiste el correo al crear la cuenta.
              Si no lo encuentras, usa el botón <strong>Reenviar al email</strong> arriba.
            </p>
          </CardContent>
        </Card>
      )}

      {provisioned && (
        <div className="grid md:grid-cols-4 gap-3">
          <Stat icon={<DollarSign className="h-4 w-4" />} label="Balance" value={fmt(acc.balance ?? participant.current_balance)} />
          <Stat icon={<Activity className="h-4 w-4" />} label="Equity" value={fmt(acc.equity ?? participant.current_equity)} />
          <Stat icon={<DollarSign className="h-4 w-4" />} label="Margin" value={fmt(acc.margin)} />
          <Stat icon={<DollarSign className="h-4 w-4" />} label="Free Margin" value={fmt(acc.margin_free ?? acc.free_margin)} />
        </div>
      )}

      {provisioned && (
        <Card>
          <CardHeader><CardTitle>Posiciones abiertas</CardTitle></CardHeader>
          <CardContent>
            {(!info?.positions || info.positions.length === 0) ? (
              <p className="text-sm text-muted-foreground">Sin posiciones abiertas.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Ticket</TableHead><TableHead>Símbolo</TableHead><TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Volumen</TableHead><TableHead className="text-right">Precio</TableHead><TableHead className="text-right">P&L</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {info.positions.map((pos: any) => (
                      <TableRow key={pos.ticket || pos.position}>
                        <TableCell className="font-mono text-xs">{pos.ticket || pos.position}</TableCell>
                        <TableCell>{pos.symbol}</TableCell>
                        <TableCell>{pos.type === 0 || pos.action === "buy" ? "BUY" : "SELL"}</TableCell>
                        <TableCell className="text-right">{pos.volume}</TableCell>
                        <TableCell className="text-right">{pos.price_open ?? pos.open_price}</TableCell>
                        <TableCell className={`text-right ${Number(pos.profit) >= 0 ? "text-emerald-500" : "text-red-500"}`}>{fmt(pos.profit)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {provisioned && (
        <Card>
          <CardHeader><CardTitle>Movimientos recientes</CardTitle></CardHeader>
          <CardContent>
            {(!info?.deals || info.deals.length === 0) ? (
              <p className="text-sm text-muted-foreground">Sin movimientos aún.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Fecha</TableHead><TableHead>Ticket</TableHead><TableHead>Símbolo</TableHead>
                    <TableHead>Acción</TableHead><TableHead className="text-right">Volumen</TableHead><TableHead className="text-right">Precio</TableHead><TableHead className="text-right">P&L</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {info.deals.map((d: any) => (
                      <TableRow key={d.ticket || d.deal}>
                        <TableCell className="text-xs">{d.time ? new Date(d.time).toLocaleString() : "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{d.ticket || d.deal}</TableCell>
                        <TableCell>{d.symbol}</TableCell>
                        <TableCell>{d.action ?? d.type}</TableCell>
                        <TableCell className="text-right">{d.volume}</TableCell>
                        <TableCell className="text-right">{d.price}</TableCell>
                        <TableCell className={`text-right ${Number(d.profit) >= 0 ? "text-emerald-500" : "text-red-500"}`}>{fmt(d.profit)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function fmt(n: any) {
  const v = Number(n);
  if (!isFinite(v)) return "—";
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Row({ label, value, onCopy, extra }: { label: string; value: string; onCopy: (v: string) => void; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between bg-muted/40 rounded p-2">
      <span><span className="text-muted-foreground mr-2">{label}:</span>{value}</span>
      <div className="flex items-center gap-2">
        {extra}
        <button onClick={() => onCopy(value)} className="text-primary"><Copy className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-3 py-2">
      {icon}
      <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium">{value}</div></div>
    </div>
  );
}

function fmtCountdown(s: number) {
  if (s <= 0) return "0s";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function TradingWindowBanner({ status, participant }: { status: any; participant: any }) {
  const phase: "pending" | "open" | "closed" | "cleaned" = status.phase;
  const deleted = !!participant.mt5_deleted_at;

  let bg = "border-yellow-500/40 bg-yellow-500/5";
  let dot = "bg-yellow-500";
  let title = "Cuenta lista";
  let detail = "";

  if (deleted || phase === "cleaned") {
    bg = "border-muted-foreground/30 bg-muted/30"; dot = "bg-muted-foreground";
    title = "Cuenta MT5 cerrada";
    detail = "Tu cuenta fue eliminada del broker. Puedes revisar tu histórico abajo.";
  } else if (phase === "closed") {
    bg = "border-red-500/40 bg-red-500/5"; dot = "bg-red-500";
    title = "Torneo finalizado";
    detail = `Tu cuenta MT5 estará disponible para revisión por ${fmtCountdown(status.time_to_cleanup_seconds)} más.`;
  } else if (phase === "open") {
    bg = "border-emerald-500/40 bg-emerald-500/5"; dot = "bg-emerald-500";
    title = "Trading abierto";
    detail = `La ventana cierra en ${fmtCountdown(status.time_to_close_seconds)}.`;
  } else {
    title = "Cuenta lista — esperando inicio";
    detail = `Trading abre en ${fmtCountdown(status.time_to_open_seconds)}.`;
  }

  return (
    <div className={`rounded-lg border p-4 ${bg}`}>
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${dot} ${phase === "open" ? "animate-pulse" : ""}`} />
        <div>
          <div className="font-semibold text-sm">{title}</div>
          <div className="text-xs text-muted-foreground">{detail}</div>
        </div>
      </div>
    </div>
  );
}
