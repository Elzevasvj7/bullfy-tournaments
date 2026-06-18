import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useTournamentAuth } from "@/hooks/useTournamentAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Loader2, Coins, Sparkles, History } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type PaymentRow = {
  id: string;
  type: string;
  amount_usd: number;
  currency: string;
  status: string;
  gateway?: string | null;
  created_at: string;
  tournament_id?: string | null;
  metadata?: any;
};

type WithdrawRow = {
  id: string;
  amount_usd: number;
  net_usd: number;
  status: string;
  wallet_address?: string | null;
  created_at: string;
  tx_hash?: string | null;
};

function describePayment(p: PaymentRow, tournamentName?: string): { label: string; sign: "+" | "-" | ""; tone: "pos" | "neg" | "neutral" } {
  const t = p.type;
  switch (t) {
    case "wallet_topup": return { label: "Depósito a wallet", sign: "+", tone: "pos" };
    case "wallet_withdrawal": return { label: "Retiro de wallet", sign: "-", tone: "neg" };
    case "entry_fee": return { label: `Inscripción · ${tournamentName ?? "Torneo"}`, sign: "-", tone: "neg" };
    case "prize_payout": {
      const pos = p?.metadata?.final_rank ? ` · #${p.metadata.final_rank}` : "";
      return { label: `Premio · ${tournamentName ?? "Torneo"}${pos}`, sign: "+", tone: "pos" };
    }
    case "refund": return { label: `Reembolso${tournamentName ? ` · ${tournamentName}` : ""}`, sign: "+", tone: "pos" };
    case "bmoney_topup": return { label: "Recarga mensual de BMoney", sign: "+", tone: "pos" };
    default: return { label: t.replace(/_/g, " "), sign: "", tone: "neutral" };
  }
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString();
}

function HistoryList({
  items, withdraws, currency, tournaments,
}: {
  items: PaymentRow[];
  withdraws?: WithdrawRow[];
  currency: "usd" | "bmoney";
  tournaments: Record<string, string>;
}) {
  const isUsd = currency === "usd";
  const merged: Array<{ key: string; date: string; node: React.ReactNode }> = [];

  items.forEach((p) => {
    const meta = describePayment(p, p.tournament_id ? tournaments[p.tournament_id] : undefined);
    const amount = isUsd
      ? `${meta.sign}$${Number(p.amount_usd).toFixed(2)}`
      : `${meta.sign}${Number(p.amount_usd).toFixed(0)} BM$`;
    merged.push({
      key: `p-${p.id}`,
      date: p.created_at,
      node: (
        <div className="flex justify-between items-start gap-3 border-b border-border/50 py-2">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{meta.label}</div>
            <div className="text-[11px] text-muted-foreground">
              {fmtDate(p.created_at)}{p.gateway ? ` · ${p.gateway}` : ""}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-sm font-bold ${meta.tone === "pos" ? "text-emerald-400" : meta.tone === "neg" ? "text-rose-400" : ""}`}>{amount}</div>
            <div className="text-[10px] capitalize text-muted-foreground">{p.status}</div>
          </div>
        </div>
      ),
    });
  });

  (withdraws ?? []).forEach((w) => {
    merged.push({
      key: `w-${w.id}`,
      date: w.created_at,
      node: (
        <div className="flex justify-between items-start gap-3 border-b border-border/50 py-2">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">Retiro USDT TRC20</div>
            <div className="text-[11px] text-muted-foreground">
              {fmtDate(w.created_at)} · Neto ${Number(w.net_usd).toFixed(2)}
              {w.wallet_address ? ` · ${w.wallet_address.slice(0, 6)}…${w.wallet_address.slice(-4)}` : ""}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-bold text-rose-400">-${Number(w.amount_usd).toFixed(2)}</div>
            <div className="text-[10px] capitalize text-muted-foreground">{w.status}</div>
          </div>
        </div>
      ),
    });
  });

  merged.sort((a, b) => b.date.localeCompare(a.date));

  if (merged.length === 0) {
    return <p className="text-xs text-muted-foreground py-4 text-center">Sin movimientos.</p>;
  }
  return <div className="space-y-0">{merged.map((m) => <div key={m.key}>{m.node}</div>)}</div>;
}

export default function TournamentWallet() {
  const { user, wallet, loading, token, refresh } = useTournamentAuth();
  const [params] = useSearchParams();
  const [depositAmt, setDepositAmt] = useState("50");
  const [wAmt, setWAmt] = useState("25");
  const [wAddr, setWAddr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [withdraws, setWithdraws] = useState<WithdrawRow[]>([]);
  const [tournaments, setTournaments] = useState<Record<string, string>>({});

  useEffect(() => {
    if (params.get("payment") === "success") {
      toast({ title: "Pago recibido", description: "Tu saldo se actualizará en breve." });
      const t = setTimeout(() => refresh(), 2500);
      return () => clearTimeout(t);
    }
  }, [params, refresh]);

  const loadHistory = async () => {
    if (!user) return;
    const [{ data: pays }, { data: ws }] = await Promise.all([
      supabase.from("tournament_payments")
        .select("id,type,amount_usd,currency,status,gateway,created_at,tournament_id,metadata")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("tournament_withdrawals")
        .select("id,amount_usd,net_usd,status,wallet_address,created_at,tx_hash")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    const list = (pays || []) as PaymentRow[];
    setPayments(list);
    setWithdraws((ws || []) as WithdrawRow[]);

    const ids = Array.from(new Set(list.map((p) => p.tournament_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: ts } = await supabase.from("tournaments").select("id,name").in("id", ids);
      const map: Record<string, string> = {};
      (ts || []).forEach((t: any) => { map[t.id] = t.name; });
      setTournaments(map);
    }
  };

  useEffect(() => { loadHistory(); }, [user, wallet]);

  if (loading) return <div className="text-muted-foreground">Cargando...</div>;
  if (!user) return <Navigate to="/tournament/login" replace />;

  // En torneos solo se cobra en cripto (decisión de producto). El depósito con
  // tarjeta (Stripe) está oculto en esta vista; Stripe sigue activo en otros
  // módulos del proyecto. Si en el futuro se reactiva, descomentar el botón
  // "Tarjeta" y restaurar el parámetro gateway.
  const startDeposit = async () => {
    setBusy("coinsbuy");
    try {
      const { data } = await supabase.functions.invoke("tournament-pay-create", {
        headers: { Authorization: `Bearer ${token}` },
        body: { gateway: "coinsbuy", type: "wallet_topup", amount_usd: Number(depositAmt) },
      });
      if (!data?.ok) throw new Error(data?.error || "Error");
      window.location.href = data.url;
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const requestWithdraw = async () => {
    setBusy("withdraw");
    try {
      const { data } = await supabase.functions.invoke("tournament-withdraw-request", {
        headers: { Authorization: `Bearer ${token}` },
        body: { amount_usd: Number(wAmt), wallet_address: wAddr.trim(), network: "TRC20" },
      });
      if (!data?.ok) throw new Error(data?.error || "Error");
      toast({ title: "Retiro solicitado", description: "Será procesado en 24-48h" });
      refresh();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const requestBmoneyTopup = async () => {
    setBusy("bmoney_topup");
    try {
      const { data } = await supabase.functions.invoke("tournament-bmoney-topup", {
        headers: { Authorization: `Bearer ${token}` },
        body: {},
      });
      if (!data?.ok) throw new Error(data?.error || "Error");
      toast({ title: "✨ BMoney recargado", description: `Nuevo saldo: ${data.balance_after} BM$` });
      refresh();
      loadHistory();
    } catch (e: any) {
      toast({ title: "No se puede recargar", description: e.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const bmBalance = Number(wallet?.bmoney_balance ?? 0);
  const bmLocked = Number(wallet?.bmoney_locked ?? 0);
  const lastTopup = wallet?.last_bmoney_topup_at ? new Date(wallet.last_bmoney_topup_at) : null;
  const cooldownReady = !lastTopup || (Date.now() - lastTopup.getTime()) >= 24 * 3600_000;
  const belowThreshold = bmBalance < 500;
  const canTopup = belowThreshold && cooldownReady;
  const nextAvailable = lastTopup ? new Date(lastTopup.getTime() + 24 * 3600_000) : null;

  const usdPayments = payments.filter((p) => (p.currency ?? "usd") === "usd");
  const bmPayments = payments.filter((p) => p.currency === "bmoney");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ───────────── WALLET REAL (USD) ───────────── */}
      <Card className="border-[#00E5FF]/30 bg-gradient-to-b from-[#00E5FF]/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#00E5FF]">
            <Sparkles className="h-5 w-5" /> Wallet Real · USD
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/50 p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Disponible</p>
              <p className="text-3xl font-bold">${Number(wallet?.balance_usd ?? 0).toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Bloqueado</p>
              <p className="text-3xl font-bold">${Number(wallet?.locked_usd ?? 0).toFixed(2)}</p>
            </div>
          </div>

          {/* Depositar */}
          <div className="rounded-lg border border-border/50 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"><ArrowDownToLine className="h-3.5 w-3.5" /> Depositar</div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-[10px]">Monto USD</Label>
                <Input type="number" min={1} value={depositAmt} onChange={(e) => setDepositAmt(e.target.value)} />
              </div>
            </div>
            <Button size="sm" onClick={startDeposit} disabled={!!busy} className="w-full">
              {busy === "coinsbuy" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Depositar con USDT"}
            </Button>
            <p className="text-[10px] text-muted-foreground">
              Los depósitos se procesan en USDT TRC20 vía Coinsbuy.
            </p>
          </div>

          {/* Retirar */}
          <div className="rounded-lg border border-border/50 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"><ArrowUpFromLine className="h-3.5 w-3.5" /> Retirar (USDT TRC20)</div>
            <div>
              <Label className="text-[10px]">Monto USD (mín. 25)</Label>
              <Input type="number" min={25} value={wAmt} onChange={(e) => setWAmt(e.target.value)} />
            </div>
            <div>
              <Label className="text-[10px]">Wallet USDT TRC20</Label>
              <Input value={wAddr} onChange={(e) => setWAddr(e.target.value)} placeholder="T..." />
            </div>
            <p className="text-[10px] text-muted-foreground">Comisión 2%. Procesamiento 24-48h.</p>
            <Button size="sm" onClick={requestWithdraw} disabled={!!busy || !wAddr} className="w-full">
              {busy === "withdraw" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Solicitar retiro"}
            </Button>
          </div>

          {/* Historial USD */}
          <div className="rounded-lg border border-border/50 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-2"><History className="h-3.5 w-3.5" /> Historial USD</div>
            <HistoryList items={usdPayments} withdraws={withdraws} currency="usd" tournaments={tournaments} />
          </div>
        </CardContent>
      </Card>

      {/* ───────────── WALLET BMONEY ───────────── */}
      <Card className="border-[#B6FF3D]/30 bg-gradient-to-b from-[#B6FF3D]/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#B6FF3D]">
            <Coins className="h-5 w-5" /> Wallet BMoney · Ficticio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/50 p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Disponible</p>
              <p className="text-3xl font-bold">{bmBalance.toFixed(0)} <span className="text-xs">BM$</span></p>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Bloqueado</p>
              <p className="text-3xl font-bold">{bmLocked.toFixed(0)} <span className="text-xs">BM$</span></p>
            </div>
          </div>

          {/* Recargar BMoney */}
          <div className="rounded-lg border border-border/50 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
              <Wallet className="h-3.5 w-3.5" /> Recarga
            </div>
            <Button
              size="sm"
              onClick={requestBmoneyTopup}
              disabled={!canTopup || busy === "bmoney_topup"}
              className="w-full"
              variant={canTopup ? "default" : "outline"}
            >
              {busy === "bmoney_topup" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Recargar a 2.000 BM$"}
            </Button>
            <p className="text-[10px] text-muted-foreground">
              {!belowThreshold && "Disponible cuando tu saldo baje de 500 BM$."}
              {belowThreshold && !cooldownReady && nextAvailable && `Próxima recarga: ${nextAvailable.toLocaleString()}`}
              {canTopup && "Solo 1 recarga cada 24h."}
            </p>
            <p className="text-[10px] text-muted-foreground italic">BMoney no es retirable ni convertible a USD.</p>
          </div>

          {/* Historial BMoney */}
          <div className="rounded-lg border border-border/50 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-2"><History className="h-3.5 w-3.5" /> Historial BMoney</div>
            <HistoryList items={bmPayments} currency="bmoney" tournaments={tournaments} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
