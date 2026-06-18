import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Search, Loader2, RefreshCw, UserCheck, UserX, KeyRound, Wallet } from "lucide-react";
import { callMT5Bridge } from "@/services/mt5BridgeApi";

interface UserInfo {
  login?: number | string;
  name?: string;
  email?: string;
  group?: string;
  leverage?: number;
  enabled?: boolean;
  [k: string]: unknown;
}
interface AccountInfo {
  balance?: number;
  equity?: number;
  margin?: number;
  margin_free?: number;
  currency?: string;
  [k: string]: unknown;
}

const MT5BridgeAccountLookup = () => {
  const [login, setLogin] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);

  const fetchAccount = async (silent = false) => {
    if (!login.trim()) {
      toast({ title: "Login requerido", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const [u, a] = await Promise.all([
        callMT5Bridge<UserInfo>({ action: "get_user", login: login.trim() }),
        callMT5Bridge<AccountInfo>({ action: "get_account", login: login.trim() }),
      ]);
      if (!u.ok) {
        toast({ title: "Cuenta no encontrada", description: u.error, variant: "destructive" });
        setUser(null); setAccount(null);
        return;
      }
      setUser((u.data as UserInfo) ?? {});
      setAccount(a.ok ? ((a.data as AccountInfo) ?? null) : null);
      if (!silent) toast({ title: "✅ Cuenta encontrada" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const runAction = async (
    label: string,
    action: "suspend" | "enable",
  ) => {
    if (!user?.login) return;
    if (!confirm(`¿Confirmas ${label} la cuenta ${user.login}?`)) return;
    setBusy(action);
    try {
      const res = await callMT5Bridge({ action, login: user.login as string });
      if (!res.ok) {
        toast({ title: `Error al ${label}`, description: res.error, variant: "destructive" });
      } else {
        toast({ title: `✅ ${label} completado` });
        await fetchAccount(true);
      }
    } finally {
      setBusy(null);
    }
  };

  const changePassword = async () => {
    if (!user?.login) return;
    const pwd = prompt("Nueva contraseña (master):");
    if (!pwd) return;
    setBusy("password");
    try {
      const res = await callMT5Bridge({
        action: "change_password",
        login: user.login as string,
        body: { password: pwd, type: "main" },
      });
      if (!res.ok) toast({ title: "Error", description: res.error, variant: "destructive" });
      else toast({ title: "✅ Contraseña actualizada" });
    } finally {
      setBusy(null);
    }
  };

  const adjustBalance = async (kind: "deposit" | "withdrawal") => {
    if (!user?.login) return;
    const amountStr = prompt(`Monto a ${kind === "deposit" ? "depositar" : "retirar"}:`);
    const amount = Number(amountStr);
    if (!amount || amount <= 0) return;
    const comment = prompt("Comentario (opcional):") || `${kind} manual`;
    setBusy(kind);
    try {
      const res = await callMT5Bridge({
        action: kind,
        login: user.login as string,
        body: { amount, comment },
      });
      if (!res.ok) toast({ title: "Error", description: res.error, variant: "destructive" });
      else { toast({ title: "✅ Operación realizada" }); await fetchAccount(true); }
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="w-5 h-5 text-primary" /> Consultar cuenta MT5
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Busca una cuenta por login para ver su estado, balance y ejecutar acciones administrativas.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <Label className="text-xs text-muted-foreground">Login MT5</Label>
            <Input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchAccount()}
              placeholder="Ej: 100123456"
              className="h-9 font-mono"
            />
          </div>
          <Button onClick={() => fetchAccount()} disabled={loading} size="sm" className="gap-1.5">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar
          </Button>
        </div>

        {user && (
          <div className="space-y-3 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold font-mono">#{String(user.login)}</span>
                {user.enabled === false ? (
                  <Badge variant="destructive">Suspendida</Badge>
                ) : (
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Activa</Badge>
                )}
              </div>
              <Button onClick={() => fetchAccount(true)} variant="ghost" size="sm" className="gap-1">
                <RefreshCw className="w-3.5 h-3.5" /> Refrescar
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/3">Campo</TableHead>
                  <TableHead>Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow><TableCell>Nombre</TableCell><TableCell>{user.name || "—"}</TableCell></TableRow>
                <TableRow><TableCell>Email</TableCell><TableCell>{user.email || "—"}</TableCell></TableRow>
                <TableRow><TableCell>Grupo</TableCell><TableCell className="font-mono text-xs">{user.group || "—"}</TableCell></TableRow>
                <TableRow><TableCell>Apalancamiento</TableCell><TableCell>1:{user.leverage ?? "—"}</TableCell></TableRow>
                {account && (
                  <>
                    <TableRow><TableCell>Balance</TableCell><TableCell className="font-mono">{account.balance?.toFixed(2) ?? "—"} {account.currency || ""}</TableCell></TableRow>
                    <TableRow><TableCell>Equity</TableCell><TableCell className="font-mono">{account.equity?.toFixed(2) ?? "—"}</TableCell></TableRow>
                    <TableRow><TableCell>Margen</TableCell><TableCell className="font-mono">{account.margin?.toFixed(2) ?? "—"}</TableCell></TableRow>
                    <TableRow><TableCell>Margen libre</TableCell><TableCell className="font-mono">{account.margin_free?.toFixed(2) ?? "—"}</TableCell></TableRow>
                  </>
                )}
              </TableBody>
            </Table>

            <div className="flex flex-wrap gap-2 pt-2">
              {user.enabled === false ? (
                <Button onClick={() => runAction("habilitar", "enable")} disabled={busy !== null} variant="outline" size="sm" className="gap-1.5">
                  {busy === "enable" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                  Habilitar
                </Button>
              ) : (
                <Button onClick={() => runAction("suspender", "suspend")} disabled={busy !== null} variant="outline" size="sm" className="gap-1.5">
                  {busy === "suspend" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                  Suspender
                </Button>
              )}
              <Button onClick={changePassword} disabled={busy !== null} variant="outline" size="sm" className="gap-1.5">
                {busy === "password" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                Cambiar contraseña
              </Button>
              <Button onClick={() => adjustBalance("deposit")} disabled={busy !== null} variant="outline" size="sm" className="gap-1.5">
                {busy === "deposit" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />}
                Depositar
              </Button>
              <Button onClick={() => adjustBalance("withdrawal")} disabled={busy !== null} variant="outline" size="sm" className="gap-1.5">
                {busy === "withdrawal" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />}
                Retirar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MT5BridgeAccountLookup;
