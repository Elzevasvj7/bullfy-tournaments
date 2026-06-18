import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/lib/toastUtils";
import {
  Wallet,
  Network as NetworkIcon,
  Send,
  Copy,
  Check,
  Clock,
  TrendingUp,
  Users,
  Loader2,
  AlertTriangle,
  ExternalLink,
  ArrowUpRight,
  ArrowDownLeft,
  CircleDollarSign,
  Link2,
  Info,
  FlaskConical,
} from "lucide-react";
import { portalBasePath } from "@/lib/portalRouting";

interface Props {
  portalId: string;
  portalSlug: string;
  userId: string;
  userName: string;
}

interface WalletData {
  id: string;
  pending_balance: number;
  available_balance: number;
  total_earned: number;
  total_withdrawn: number;
  external_wallet_address: string | null;
  external_wallet_verified_at: string | null;
  stripe_destination: string | null;
}

interface MLMConfig {
  enabled: boolean;
  active_levels: number;
  mlm_pool_percentage: number;
  refund_window_days: number;
  withdrawal_fee_usdt: number;
  min_withdrawal_usdt: number;
}

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

interface NetworkMember {
  id: string;
  user_id: string;
  nombre: string;
  email: string;
  level: number;
  joined_at: string;
  total_commission: number;
}

interface WithdrawalRow {
  id: string;
  request_number: string | null;
  amount_requested: number;
  fee_amount: number;
  amount_net: number;
  status: string;
  destination_address: string | null;
  payout_method: "usdt_trc20" | "stripe";
  stripe_destination: string | null;
  created_at: string;
  completed_at: string | null;
  failure_reason: string | null;
}

type PayoutMethod = "usdt_trc20" | "stripe";

const TX_LABEL: Record<string, { label: string; icon: any; color: string }> = {
  commission_pending: { label: "Comisión pendiente", icon: Clock, color: "text-amber-500" },
  release_to_available: { label: "Comisión liberada", icon: TrendingUp, color: "text-emerald-500" },
  withdrawal_request: { label: "Retiro solicitado", icon: ArrowUpRight, color: "text-blue-500" },
  withdrawal_completed: { label: "Retiro completado", icon: Check, color: "text-emerald-600" },
  withdrawal_failed: { label: "Retiro fallido", icon: AlertTriangle, color: "text-destructive" },
  platform_fee: { label: "Fee plataforma", icon: CircleDollarSign, color: "text-muted-foreground" },
  refund_reversal: { label: "Reverso por refund", icon: ArrowDownLeft, color: "text-destructive" },
  manual_adjustment: { label: "Ajuste manual", icon: Info, color: "text-muted-foreground" },
  business_partner_commission_pending: { label: "Comisión socio (pendiente)", icon: Clock, color: "text-amber-500" },
  demo_purchase: { label: "Compra demo", icon: ArrowDownLeft, color: "text-muted-foreground" },
  portal_owner_earning: { label: "Ingreso por venta", icon: TrendingUp, color: "text-emerald-500" },
};

const STATUS_BADGE: Record<string, { label: string; variant: any }> = {
  pending: { label: "Pendiente", variant: "secondary" },
  processing: { label: "Procesando", variant: "secondary" },
  completed: { label: "Completado", variant: "default" },
  failed: { label: "Fallido", variant: "destructive" },
  cancelled: { label: "Cancelado", variant: "outline" },
};

// USDT TRC20 addresses start with T and are 34 chars
const TRC20_REGEX = /^T[A-Za-z0-9]{33}$/;

// Payout cripto productivo vía NOWPayments (mlm-withdrawal-process → processNowpaymentsPayout),
// con gate de aprobación del admin + aprobación manual en el dashboard de NOWPayments.
const USDT_WITHDRAWAL_ENABLED = true;

const fmtUsdt = (n: number | string) =>
  `${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;

const MLMClient = ({ portalId, portalSlug, userId, userName }: Props) => {
  const [loading, setLoading] = useState(true);
  // P7.5: dimensión real/demo. Por defecto 'real' → comportamiento idéntico al
  // de siempre. En 'demo' las consultas y el retiro operan sobre el wallet demo
  // (retiro simulado, sin destino ni payout real).
  const [accountKind, setAccountKind] = useState<"real" | "demo">("real");
  const isDemo = accountKind === "demo";
  const [config, setConfig] = useState<MLMConfig | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  // Saldos segregados por método de cobro (cripto USDT / fiat Stripe).
  const [methodBalances, setMethodBalances] = useState<{ usdt: { avail: number; pend: number }; stripe: { avail: number; pend: number } }>({
    usdt: { avail: 0, pend: 0 }, stripe: { avail: 0, pend: 0 },
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [network, setNetwork] = useState<NetworkMember[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);

  // Wallet address form
  const [walletAddress, setWalletAddress] = useState("");
  const [stripeDest, setStripeDest] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  const [savingStripe, setSavingStripe] = useState(false);

  // Withdrawal form
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>(
    USDT_WITHDRAWAL_ENABLED ? "usdt_trc20" : "stripe",
  );
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);

  // Invite link
  const [copied, setCopied] = useState(false);
  const referralLink = `${window.location.origin}${portalBasePath(portalSlug) || "/"}?ref=${userId}`;

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Config
      const { data: cfg } = await supabase
        .from("portal_mlm_config")
        .select("enabled, active_levels, mlm_pool_percentage, refund_window_days, withdrawal_fee_usdt, min_withdrawal_usdt")
        .eq("portal_id", portalId)
        .maybeSingle();
      setConfig(cfg as MLMConfig | null);

      // 2. Wallet (create if missing via RPC) — del kind seleccionado.
      // Cast: la firma con 3er arg (_account_kind) puede no estar aún en los tipos
      // generados hasta que Lovable los regenere tras la migración.
      const { data: walletId } = await (supabase.rpc as any)("get_or_create_user_wallet", {
        _portal_id: portalId,
        _user_id: userId,
        _account_kind: accountKind,
      });

      if (walletId) {
        const { data: w } = await supabase
          .from("portal_user_wallets")
          .select("id, pending_balance, available_balance, total_earned, total_withdrawn, external_wallet_address, external_wallet_verified_at, stripe_destination")
          .eq("id", walletId as string)
          .maybeSingle();

        if (w) {
          setWallet(w as WalletData);
          setWalletAddress((w as WalletData).external_wallet_address || "");
          setStripeDest((w as WalletData).stripe_destination || "");
        }

        // Saldos por método (bucket). Fase 4: el disponible/pendiente se separa por
        // riel de cobro (USDT/cripto vs Stripe/fiat). El agregado se mantiene como espejo.
        const { data: bals } = await (supabase.from as any)("portal_wallet_balances")
          .select("method, available_balance, pending_balance")
          .eq("wallet_id", walletId as string);
        const mb = { usdt: { avail: 0, pend: 0 }, stripe: { avail: 0, pend: 0 } };
        ((bals as any[]) || []).forEach((b: any) => {
          if (b.method === "usdt" || b.method === "stripe") {
            mb[b.method as "usdt" | "stripe"] = { avail: Number(b.available_balance) || 0, pend: Number(b.pending_balance) || 0 };
          }
        });
        setMethodBalances(mb);
      }

      // 3. Recent transactions (del kind seleccionado)
      const { data: txs } = await supabase
        .from("portal_wallet_transactions")
        .select("id, transaction_type, amount, description, created_at")
        .eq("user_id", userId)
        .eq("portal_id", portalId)
        .eq("account_kind", accountKind)
        .order("created_at", { ascending: false })
        .limit(30);
      setTransactions((txs as Transaction[]) || []);

      // 4. Network — direct referrals + indirect via upline_chain
      const { data: refs } = await supabase
        .from("portal_mlm_referrals")
        .select("id, user_id, sponsor_id, upline_chain, joined_at")
        .eq("portal_id", portalId)
        .contains("upline_chain", [userId])
        .order("joined_at", { ascending: false })
        .limit(500);

      if (refs && refs.length > 0) {
        const userIds = refs.map((r: any) => r.user_id);
        const { data: users } = await supabase
          .from("partner_users")
          .select("id, nombre, email")
          .in("id", userIds);

        const usersMap = new Map(((users as any[]) || []).map(u => [u.id, u]));

        // Get commissions sourced by these users where beneficiary is current user
        const { data: comms } = await (supabase.from as any)("portal_commission_lines")
          .select("source_user_id, commission_amount:amount, status")
          .eq("portal_id", portalId)
          .eq("beneficiary_user_id", userId)
          .eq("account_kind", accountKind)
          .in("source_user_id", userIds);

        const commByUser = new Map<string, number>();
        for (const c of (comms as any[]) || []) {
          if (c.status === "cancelled" || c.status === "reversed") continue;
          commByUser.set(
            c.source_user_id,
            (commByUser.get(c.source_user_id) || 0) + Number(c.commission_amount)
          );
        }

        const members: NetworkMember[] = refs.map((r: any) => {
          const u = usersMap.get(r.user_id) || { nombre: "—", email: "—" };
          // level = position of userId in chain + 1 (chain[0] is direct sponsor of r.user_id)
          const idx = (r.upline_chain as string[]).indexOf(userId);
          return {
            id: r.id,
            user_id: r.user_id,
            nombre: u.nombre,
            email: u.email,
            level: idx + 1,
            joined_at: r.joined_at,
            total_commission: commByUser.get(r.user_id) || 0,
          };
        });

        setNetwork(members);
      } else {
        setNetwork([]);
      }

      // 5. Withdrawal history (del kind seleccionado)
      const { data: wd } = await supabase
        .from("portal_withdrawal_requests")
        .select("id, request_number, amount_requested, fee_amount, amount_net, status, destination_address, payout_method, stripe_destination, created_at, completed_at, failure_reason")
        .eq("user_id", userId)
        .eq("portal_id", portalId)
        .eq("account_kind", accountKind)
        .order("created_at", { ascending: false })
        .limit(20);
      setWithdrawals((wd as WithdrawalRow[]) || []);
    } catch (e: any) {
      console.error(e);
      toast.error("Error cargando datos MLM", { description: e.message });
    } finally {
      setLoading(false);
    }
  }, [portalId, userId, accountKind]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const copyReferralLink = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Link copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  const saveWalletAddress = async () => {
    const trimmed = walletAddress.trim();
    if (!TRC20_REGEX.test(trimmed)) {
      toast.error("Dirección inválida", { description: "Debe ser una wallet USDT TRC20 válida (34 caracteres, empieza con T)" });
      return;
    }
    // No requiere wallet previo: el RPC lo crea (get_or_create). Antes el guard impedía
    // al IB guardar su dirección si su wallet aún no existía → no podía retirar.
    setSavingAddress(true);
    try {
      // Escritura server-side (las tablas de wallet tienen RLS solo-SELECT).
      const { error } = await (supabase.rpc as any)("set_partner_wallet_destination", {
        _portal_id: portalId,
        _user_id: userId,
        _usdt_address: trimmed,
        _account_kind: accountKind,
      });
      if (error) throw error;
      toast.success("Wallet actualizada");
      await loadAll();
    } catch (e: any) {
      toast.error("Error", { description: e.message });
    } finally {
      setSavingAddress(false);
    }
  };

  const saveStripeDestination = async () => {
    const trimmed = stripeDest.trim();
    // Acepta email simple o acct_xxx (Stripe Connect)
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    const acctOk = /^acct_[A-Za-z0-9]+$/.test(trimmed);
    if (!emailOk && !acctOk) {
      toast.error("Destino Stripe inválido", {
        description: "Ingresa un email válido o un ID de cuenta conectada (acct_...)",
      });
      return;
    }
    // No requiere wallet previo: el RPC lo crea (get_or_create).
    setSavingStripe(true);
    try {
      const { error } = await (supabase.rpc as any)("set_partner_wallet_destination", {
        _portal_id: portalId,
        _user_id: userId,
        _stripe_destination: trimmed,
        _account_kind: accountKind,
      });
      if (error) throw error;
      toast.success("Destino Stripe guardado");
      await loadAll();
    } catch (e: any) {
      toast.error("Error", { description: e.message });
    } finally {
      setSavingStripe(false);
    }
  };

  const requestWithdrawal = async () => {
    if (!wallet || !config) return;

    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0) {
      toast.error("Monto inválido");
      return;
    }
    if (amount < Number(config.min_withdrawal_usdt)) {
      toast.error(`Monto mínimo: ${fmtUsdt(config.min_withdrawal_usdt)}`);
      return;
    }
    const _bucket = (isDemo || payoutMethod === "usdt_trc20") ? "usdt" : "stripe";
    if (amount > methodBalances[_bucket].avail) {
      toast.error(`Saldo insuficiente en ${_bucket === "stripe" ? "Stripe" : "USDT"}`);
      return;
    }

    // Validaciones de destino/método solo en retiros REALES. Los demo son
    // simulados (sin payout) → no requieren wallet ni destino configurado.
    if (!isDemo) {
      if (payoutMethod === "usdt_trc20" && !USDT_WITHDRAWAL_ENABLED) {
        toast.error("Retiros en USDT temporalmente deshabilitados", {
          description: "Estamos habilitando el payout en cripto. Vuelve a intentarlo más adelante.",
        });
        return;
      }
      if (payoutMethod === "usdt_trc20" && !wallet.external_wallet_address) {
        toast.error("Configura primero tu wallet USDT TRC20");
        return;
      }
      if (payoutMethod === "stripe" && !wallet.stripe_destination) {
        toast.error("Configura primero tu destino Stripe");
        return;
      }
    }

    const fee = Number(config.withdrawal_fee_usdt);
    const net = +(amount - fee).toFixed(2);
    if (net <= 0) {
      toast.error("Monto neto sería 0 o negativo después del fee");
      return;
    }

    setSubmittingWithdraw(true);
    try {
      // Reserva + inserción ATÓMICAS y server-side vía RPC SECURITY DEFINER (las tablas
      // de wallet tienen RLS solo-SELECT; el saldo se valida en el servidor, no en el cliente).
      const payoutMethodToUse = isDemo ? "usdt_trc20" : payoutMethod;
      const { data: wid, error } = await (supabase.rpc as any)("create_withdrawal_request", {
        _portal_id: portalId,
        _user_id: userId,
        _amount: amount,
        _payout_method: payoutMethodToUse,
        _destination_address: !isDemo && payoutMethod === "usdt_trc20" ? wallet.external_wallet_address : null,
        _stripe_destination: !isDemo && payoutMethod === "stripe" ? wallet.stripe_destination : null,
        _account_kind: accountKind,
      });
      if (error) throw error;

      // Demo: se procesa al instante (simulado). Real: queda PENDIENTE de aprobación
      // del admin (gate) → NO se invoca el procesador aquí; lo dispara la aprobación.
      if (isDemo && wid) {
        supabase.functions
          .invoke("mlm-withdrawal-process", { body: { withdrawal_id: wid } })
          .catch((e) => console.error("Async processor invocation failed", e));
      }

      toast.success("Solicitud de retiro enviada", {
        description: isDemo
          ? "Se procesará en breve (modo demo)."
          : "Quedó en revisión. Un administrador la aprobará antes de procesar el pago.",
      });
      setWithdrawAmount("");
      await loadAll();
    } catch (e: any) {
      toast.error("Error", { description: e.message });
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!config?.enabled) {
    return (
      <Alert>
        <Info className="w-4 h-4" />
        <AlertDescription>
          El sistema MLM no está habilitado en este portal todavía. Contacta al administrador para más información.
        </AlertDescription>
      </Alert>
    );
  }

  // Group network by level
  const networkByLevel = new Map<number, NetworkMember[]>();
  for (const m of network) {
    if (!networkByLevel.has(m.level)) networkByLevel.set(m.level, []);
    networkByLevel.get(m.level)!.push(m);
  }
  const totalDirectReferrals = network.filter(m => m.level === 1).length;
  const totalNetworkSize = network.length;
  const totalEarnedFromNetwork = network.reduce((s, m) => s + m.total_commission, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <NetworkIcon className="w-6 h-6 text-primary" />
          Mi MLM
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          eWallet, red de referidos y retiros — {config.active_levels} niveles activos
        </p>
      </div>

      {/* P7.5: selector real / demo */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Vista:</span>
        <div className="inline-flex rounded-lg border border-border p-0.5">
          <Button
            size="sm"
            variant={!isDemo ? "default" : "ghost"}
            className="h-7 px-3"
            onClick={() => setAccountKind("real")}
          >
            Real
          </Button>
          <Button
            size="sm"
            variant={isDemo ? "default" : "ghost"}
            className="h-7 px-3 gap-1"
            onClick={() => setAccountKind("demo")}
          >
            <FlaskConical className="w-3.5 h-3.5" /> Demo
          </Button>
        </div>
        {isDemo && (
          <Badge variant="outline" className="text-[10px]">
            Saldo ficticio · no retirable como dinero real
          </Badge>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Disponible USDT</span>
              <Wallet className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-display font-bold text-emerald-600">
              {fmtUsdt(methodBalances.usdt.avail)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Cripto (TRC20)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Disponible Stripe</span>
              <Wallet className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-display font-bold text-blue-600">
              {fmtUsdt(methodBalances.stripe.avail)}
            </div>
            {methodBalances.stripe.pend > 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Pendiente: {fmtUsdt(methodBalances.stripe.pend)} — sujeto a confirmación de Stripe (contracargos)
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Total ganado</span>
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-display font-bold">
              {fmtUsdt(wallet?.total_earned || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Mi red</span>
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-display font-bold">{totalNetworkSize}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalDirectReferrals} directo(s)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Referral link card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Link2 className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground mb-1">Tu link de invitación</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Comparte este link. Quienes se registren con él se convierten en parte de tu red.
              </p>
              <div className="flex gap-2">
                <Input value={referralLink} readOnly className="text-xs font-mono" />
                <Button onClick={copyReferralLink} variant="default" size="sm" className="gap-1.5 shrink-0">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="wallet" className="space-y-4">
        <TabsList>
          <TabsTrigger value="wallet" className="gap-1.5">
            <Wallet className="w-4 h-4" /> Wallet
          </TabsTrigger>
          <TabsTrigger value="network" className="gap-1.5">
            <NetworkIcon className="w-4 h-4" /> Mi Red ({totalNetworkSize})
          </TabsTrigger>
          <TabsTrigger value="withdraw" className="gap-1.5">
            <Send className="w-4 h-4" /> Retiros ({withdrawals.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB WALLET */}
        <TabsContent value="wallet" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Wallet externa USDT TRC20</CardTitle>
              <CardDescription>
                Configura una única dirección TRC20 a la que se enviarán tus retiros.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Dirección USDT TRC20</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    placeholder="Tx... (34 caracteres, red TRC20)"
                    className="font-mono text-xs"
                  />
                  <Button onClick={saveWalletAddress} disabled={savingAddress} className="shrink-0">
                    {savingAddress ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                  </Button>
                </div>
                {wallet?.external_wallet_address && (
                  <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Verificada el {new Date(wallet.external_wallet_verified_at!).toLocaleDateString()}
                  </p>
                )}
              </div>
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription className="text-xs">
                  Solo se acepta la red <strong>TRON (TRC20)</strong>. Los envíos a otras redes (ERC20, BEP20) se perderán definitivamente.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Destino Stripe (alternativo)</CardTitle>
              <CardDescription>
                Para retiros vía Stripe — usa email o ID de cuenta conectada (acct_...).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Email o cuenta Stripe Connect</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    value={stripeDest}
                    onChange={(e) => setStripeDest(e.target.value)}
                    placeholder="tu@email.com   o   acct_1A2B3C..."
                    className="font-mono text-xs"
                  />
                  <Button onClick={saveStripeDestination} disabled={savingStripe} className="shrink-0">
                    {savingStripe ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                  </Button>
                </div>
                {wallet?.stripe_destination && (
                  <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Configurado: {wallet.stripe_destination}
                  </p>
                )}
              </div>
              <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription className="text-xs">
                  Los retiros vía Stripe se procesan en USD usando una transferencia directa cuando proporcionas un <strong>acct_id</strong> de Stripe Connect. Si das solo un email, será procesado manualmente por el administrador del portal.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historial de movimientos</CardTitle>
              <CardDescription>Últimas 30 transacciones de tu wallet</CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Aún no tienes movimientos
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map(tx => {
                    const meta = TX_LABEL[tx.transaction_type] || { label: tx.transaction_type, icon: Info, color: "text-muted-foreground" };
                    const Icon = meta.icon;
                    const isPositive = ["release_to_available", "commission_pending"].includes(tx.transaction_type);
                    return (
                      <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div className="flex items-center gap-3">
                          <Icon className={`w-4 h-4 ${meta.color}`} />
                          <div>
                            <div className="text-sm font-medium text-foreground">{meta.label}</div>
                            {tx.description && (
                              <div className="text-xs text-muted-foreground">{tx.description}</div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-bold ${isPositive ? "text-emerald-600" : "text-foreground"}`}>
                            {isPositive ? "+" : ""}{fmtUsdt(tx.amount)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(tx.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB NETWORK */}
        <TabsContent value="network" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mi red de referidos</CardTitle>
              <CardDescription>
                {totalNetworkSize} miembros · {fmtUsdt(totalEarnedFromNetwork)} generados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {network.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">Aún no tienes referidos</p>
                  <Button onClick={copyReferralLink} variant="outline" size="sm" className="gap-1.5">
                    <Copy className="w-3.5 h-3.5" /> Copiar link de invitación
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {Array.from(networkByLevel.keys()).sort((a, b) => a - b).map(lvl => {
                    const members = networkByLevel.get(lvl)!;
                    const levelTotal = members.reduce((s, m) => s + m.total_commission, 0);
                    return (
                      <div key={lvl} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="gap-1.5">
                            <NetworkIcon className="w-3 h-3" /> Nivel {lvl} · {members.length} miembro(s)
                          </Badge>
                          <span className="text-xs font-semibold text-emerald-600">
                            {fmtUsdt(levelTotal)} generado
                          </span>
                        </div>
                        <div className="border border-border rounded-lg overflow-hidden">
                          {members.map((m, idx) => (
                            <div
                              key={m.id}
                              className={`flex items-center justify-between p-3 ${
                                idx > 0 ? "border-t border-border" : ""
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-foreground truncate">{m.nombre}</div>
                                <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                              </div>
                              <div className="text-right shrink-0 ml-2">
                                <div className="text-sm font-bold text-emerald-600">
                                  {fmtUsdt(m.total_commission)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(m.joined_at).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB WITHDRAW */}
        <TabsContent value="withdraw" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Solicitar retiro</CardTitle>
              <CardDescription>
                Mínimo {fmtUsdt(config.min_withdrawal_usdt)} · Fee {fmtUsdt(config.withdrawal_fee_usdt)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!isDemo && !wallet?.external_wallet_address && !wallet?.stripe_destination ? (
                <Alert>
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    Primero debes configurar tu wallet USDT TRC20 o tu destino Stripe en la pestaña Wallet.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div>
                    <Label className="text-xs">Saldo disponible ({(isDemo || payoutMethod === "usdt_trc20") ? "USDT" : "Stripe"})</Label>
                    <div className="text-xl font-display font-bold text-emerald-600 mt-1">
                      {fmtUsdt(methodBalances[(isDemo || payoutMethod === "usdt_trc20") ? "usdt" : "stripe"].avail)}
                    </div>
                  </div>
                  <Separator />

                  {isDemo ? (
                    <Alert>
                      <FlaskConical className="w-4 h-4" />
                      <AlertDescription className="text-xs">
                        Retiro <strong>demo</strong>: se procesa de forma simulada al instante,
                        sin destino ni payout real. Sirve para probar el flujo de retiro.
                      </AlertDescription>
                    </Alert>
                  ) : (
                  <div>
                    <Label className="text-xs">Método de pago</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1.5">
                      <Button
                        type="button"
                        variant={payoutMethod === "usdt_trc20" ? "default" : "outline"}
                        size="sm"
                        disabled={!USDT_WITHDRAWAL_ENABLED || !wallet?.external_wallet_address}
                        onClick={() => setPayoutMethod("usdt_trc20")}
                        className="gap-1.5"
                        title={!USDT_WITHDRAWAL_ENABLED ? "Retiros en USDT temporalmente deshabilitados" : undefined}
                      >
                        <CircleDollarSign className="w-3.5 h-3.5" /> USDT TRC20
                      </Button>
                      <Button
                        type="button"
                        variant={payoutMethod === "stripe" ? "default" : "outline"}
                        size="sm"
                        disabled={!wallet?.stripe_destination}
                        onClick={() => setPayoutMethod("stripe")}
                        className="gap-1.5"
                      >
                        <CircleDollarSign className="w-3.5 h-3.5" /> Stripe
                      </Button>
                    </div>
                    {!USDT_WITHDRAWAL_ENABLED && (
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        Los retiros en USDT (TRC20) están temporalmente deshabilitados mientras
                        habilitamos el payout en cripto.
                      </p>
                    )}
                  </div>
                  )}

                  <div>
                    <Label className="text-xs">
                      Monto a retirar ({isDemo ? "USD demo" : (payoutMethod === "stripe" ? "USD" : "USDT")})
                    </Label>
                    <Input
                      type="number"
                      min={config.min_withdrawal_usdt}
                      max={methodBalances[(isDemo || payoutMethod === "usdt_trc20") ? "usdt" : "stripe"].avail}
                      step="0.01"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder={`Mínimo ${config.min_withdrawal_usdt}`}
                      className="mt-1.5"
                    />
                  </div>
                  {withdrawAmount && Number(withdrawAmount) > 0 && (
                    <div className="text-xs space-y-1 p-3 bg-muted rounded">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Solicitado</span>
                        <span className="font-medium">{fmtUsdt(withdrawAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fee plataforma</span>
                        <span className="font-medium">−{fmtUsdt(config.withdrawal_fee_usdt)}</span>
                      </div>
                      <Separator className="my-1" />
                      <div className="flex justify-between text-emerald-600 font-bold">
                        <span>Recibirás</span>
                        <span>{fmtUsdt(Math.max(0, Number(withdrawAmount) - Number(config.withdrawal_fee_usdt)))}</span>
                      </div>
                    </div>
                  )}
                  {!isDemo && (
                  <div>
                    <Label className="text-xs">
                      {payoutMethod === "stripe" ? "Destino Stripe" : "Wallet destino (TRC20)"}
                    </Label>
                    <div className="text-xs font-mono text-muted-foreground bg-muted p-2 rounded mt-1.5 break-all">
                      {payoutMethod === "stripe"
                        ? wallet?.stripe_destination
                        : wallet?.external_wallet_address}
                    </div>
                  </div>
                  )}
                  <Button
                    onClick={requestWithdrawal}
                    disabled={submittingWithdraw || !withdrawAmount}
                    className="w-full gap-2"
                  >
                    {submittingWithdraw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Solicitar retiro
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historial de retiros</CardTitle>
            </CardHeader>
            <CardContent>
              {withdrawals.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No has solicitado retiros aún
                </div>
              ) : (
                <div className="space-y-2">
                  {withdrawals.map(w => {
                    const status = STATUS_BADGE[w.status] || { label: w.status, variant: "outline" };
                    return (
                      <div key={w.id} className="border border-border rounded-lg p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-muted-foreground">
                              {w.request_number || w.id.slice(0, 8)}
                            </span>
                            <Badge variant={status.variant} className="text-[10px]">{status.label}</Badge>
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {w.payout_method === "stripe" ? "Stripe" : "USDT"}
                            </Badge>
                          </div>
                          <span className="text-sm font-bold text-foreground">{fmtUsdt(w.amount_net)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-3">
                          <span>{new Date(w.created_at).toLocaleString()}</span>
                          {w.completed_at && (
                            <span className="flex items-center gap-1 text-emerald-600">
                              <Check className="w-3 h-3" /> Completado {new Date(w.completed_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {w.failure_reason && (
                          <p className="text-xs text-destructive">⚠ {w.failure_reason}</p>
                        )}
                        <p className="text-xs font-mono text-muted-foreground/70 break-all">
                          → {w.payout_method === "stripe" ? w.stripe_destination : w.destination_address}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MLMClient;
