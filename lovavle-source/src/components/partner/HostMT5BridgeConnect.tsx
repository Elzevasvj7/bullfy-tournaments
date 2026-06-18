import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hashPassword } from "@/lib/partnerPassword";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/lib/toastUtils";
import { usePortalBrand, brandText } from "@/lib/portalBrand";
import {
  Plug,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  RefreshCw,
  Unplug,
  Wallet,
  TrendingUp,
  Activity,
} from "lucide-react";

interface Props {
  portalId: string;
  ibId: string;
  adminEmail: string;
  adminName?: string;
}

interface BridgeAccount {
  id: string;
  mt_login: string | null;
  broker_server: string | null;
  account_label: string | null;
  connection_status: string;
  notes: string | null;
}

interface AccountStatus {
  connected: boolean;
  status: string;
  balance: number | null;
  equity: number | null;
  currency: string | null;
  positions: Array<{
    id: string;
    symbol: string;
    type: string;
    volume: number | null;
    open_price: number | null;
    current_price: number | null;
    profit: number | null;
  }>;
}

const DEFAULT_SERVER = "Bullfy-Trade";

const fmtMoney = (v: number | null, cur: string | null) =>
  v == null ? "—" : `${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur ?? ""}`.trim();

const HostMT5BridgeConnect = ({ portalId, ibId: _ibId, adminEmail, adminName }: Props) => {
  const { isWhiteLabel } = usePortalBrand();
  const [hostId, setHostId] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [account, setAccount] = useState<BridgeAccount | null>(null);
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [mtLogin, setMtLogin] = useState("");
  const [mtPassword, setMtPassword] = useState("");
  const [brokerServer, setBrokerServer] = useState(DEFAULT_SERVER);
  const [showPassword, setShowPassword] = useState(false);
  const pollRef = useRef<number | null>(null);

  const initHost = useCallback(async () => {
    setInitError(null);
    const email = adminEmail.toLowerCase();
    const { data: existing, error: selErr } = await supabase
      .from("partner_users")
      .select("id, is_host")
      .eq("portal_id", portalId)
      .ilike("email", email)
      .maybeSingle();

    if (selErr) { setInitError(selErr.message); return null; }

    if (existing?.id) {
      if (!existing.is_host) {
        await supabase
          .from("partner_users")
          .update({ is_host: true, status: "approved", tier: "host" } as any)
          .eq("id", existing.id);
      }
      setHostId(existing.id);
      return existing.id;
    }

    const randomPass = crypto.randomUUID() + crypto.randomUUID();
    const { data: created, error: insErr } = await supabase
      .from("partner_users")
      .insert({
        portal_id: portalId,
        email,
        nombre: adminName || email.split("@")[0],
        status: "approved",
        tier: "host",
        is_host: true,
        password_hash: await hashPassword(randomPass),
      } as any)
      .select("id")
      .maybeSingle();

    if (insErr || !created?.id) {
      setInitError(insErr?.message || "No se pudo crear el registro de host.");
      return null;
    }
    setHostId(created.id);
    return created.id;
  }, [portalId, adminEmail, adminName]);

  const loadAccount = useCallback(async (huid: string) => {
    const { data } = await supabase
      .from("trading_room_accounts")
      .select("id, mt_login, broker_server, account_label, connection_status, notes")
      .eq("portal_id", portalId)
      .eq("partner_user_id", huid)
      .eq("provider", "bridge")
      .maybeSingle();
    setAccount((data as BridgeAccount) || null);
    if (data?.mt_login) setMtLogin(data.mt_login);
    if (data?.broker_server) setBrokerServer(data.broker_server);
  }, [portalId]);

  const fetchStatus = useCallback(async (huid: string, silent = false) => {
    if (!silent) setStatusLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("trading-room-client", {
        body: { action: "get_account_status", portal_id: portalId, partner_user_id: huid },
      });
      if (error) throw error;
      if (data?.ok) setStatus(data as AccountStatus);
    } catch (_e) { /* silent */ }
    finally { if (!silent) setStatusLoading(false); }
  }, [portalId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const id = await initHost();
      if (id) {
        await loadAccount(id);
        await fetchStatus(id);
      }
      setLoading(false);
    })();
  }, [initHost, loadAccount, fetchStatus]);

  // Poll status every 10s when account exists
  useEffect(() => {
    if (!hostId || !account) return;
    pollRef.current = window.setInterval(() => fetchStatus(hostId, true), 10000);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [hostId, account, fetchStatus]);

  const handleConnect = async () => {
    if (!hostId) { toast.error("Host no inicializado"); return; }
    if (!mtLogin.trim() || !mtPassword.trim()) {
      toast.error("Ingresa login y contraseña");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("trading-room-client", {
        body: {
          action: "save_account",
          portal_id: portalId,
          partner_user_id: hostId,
          provider: "bridge",
          mt_login: mtLogin.trim(),
          mt_password: mtPassword,
          broker_server: brokerServer.trim() || DEFAULT_SERVER,
          selected_session_key: "stream_only",
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Error al conectar");
      toast.success("Cuenta MT5 conectada");
      setMtPassword("");
      await loadAccount(hostId);
      await fetchStatus(hostId);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!account) return;
    if (!confirm("¿Desconectar la cuenta MT5?")) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("trading_room_accounts")
        .delete()
        .eq("id", account.id);
      if (error) throw error;
      setAccount(null);
      setStatus(null);
      setMtLogin("");
      toast.success("Cuenta desconectada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
          Cargando...
        </CardContent>
      </Card>
    );
  }

  if (initError) {
    return (
      <Card>
        <CardContent className="py-8 space-y-3">
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <div>
              <p className="font-medium">No se pudo inicializar el host</p>
              <p className="text-xs opacity-80">{initError}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => initHost()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Live status takes precedence over stored connection_status
  const liveOk = !!status?.connected && (status.balance !== null || status.equity !== null);
  const isConnected = liveOk;
  const statusLabel = !account ? "no conectada"
    : liveOk ? "Conectada"
    : (status?.status || account.connection_status || "desconectada");

  return (
    <div className="space-y-4 max-w-3xl">
      {account && (
        <>
          {/* Status + metrics */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Plug className="w-4 h-4 text-primary" /> Estado de la cuenta
                </span>
                <div className="flex items-center gap-2">
                  <Badge
                    className={isConnected
                      ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 gap-1"
                      : "bg-destructive/15 text-destructive border border-destructive/30 gap-1"}
                  >
                    <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-destructive"} animate-pulse`} />
                    {statusLabel}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => hostId && fetchStatus(hostId)}
                    disabled={statusLoading}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${statusLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Wallet className="w-3.5 h-3.5" /> Balance
                  </div>
                  <div className="text-xl font-semibold tabular-nums">
                    {fmtMoney(status?.balance ?? null, status?.currency ?? null)}
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <TrendingUp className="w-3.5 h-3.5" /> Equity
                  </div>
                  <div className="text-xl font-semibold tabular-nums">
                    {fmtMoney(status?.equity ?? null, status?.currency ?? null)}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Login MT5</span>
                  <span className="font-mono">{account.mt_login}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Servidor</span>
                  <span className="font-mono">{account.broker_server}</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={saving}
                className="w-full"
              >
                <Unplug className="w-3.5 h-3.5 mr-1.5" /> Desconectar
              </Button>
            </CardContent>
          </Card>

          {/* Open positions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Órdenes abiertas
                <Badge variant="secondary" className="ml-1">{status?.positions?.length ?? 0}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!status?.positions?.length ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No hay órdenes abiertas.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ticket</TableHead>
                        <TableHead>Símbolo</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Vol.</TableHead>
                        <TableHead className="text-right">Apertura</TableHead>
                        <TableHead className="text-right">Actual</TableHead>
                        <TableHead className="text-right">P/L</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {status.positions.map((p) => {
                        const isBuy = p.type?.includes("BUY");
                        const profit = p.profit ?? 0;
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono text-xs">{p.id}</TableCell>
                            <TableCell className="font-medium">{p.symbol}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={isBuy ? "text-emerald-600 border-emerald-500/30" : "text-destructive border-destructive/30"}>
                                {isBuy ? "BUY" : "SELL"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{p.volume?.toFixed(2) ?? "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{p.open_price?.toFixed(5) ?? "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{p.current_price?.toFixed(5) ?? "—"}</TableCell>
                            <TableCell className={`text-right tabular-nums font-medium ${profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                              {profit >= 0 ? "+" : ""}{profit.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Connect form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plug className="w-4 h-4 text-primary" />
            {account ? "Actualizar conexión" : brandText(isWhiteLabel, "Conectar cuenta MT5 Bullfy")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {brandText(isWhiteLabel, "Ingresa el ID y la contraseña master de tu cuenta MT5 Bullfy.")}
            Servicio gratuito para hosts del portal.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="mt-login">ID de cuenta MT5</Label>
            <Input
              id="mt-login"
              placeholder="Ej. 12345678"
              value={mtLogin}
              onChange={(e) => setMtLogin(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mt-pass">Contraseña Master</Label>
            <div className="relative">
              <Input
                id="mt-pass"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={mtPassword}
                onChange={(e) => setMtPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mt-server">Servidor</Label>
            <Input
              id="mt-server"
              value={brokerServer}
              onChange={(e) => setBrokerServer(e.target.value)}
              placeholder={DEFAULT_SERVER}
              className="font-mono text-sm"
            />
          </div>
          <Button onClick={handleConnect} disabled={saving} className="w-full">
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Plug className="w-4 h-4 mr-2" />
            )}
            {account ? "Actualizar" : "Conectar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default HostMT5BridgeConnect;
