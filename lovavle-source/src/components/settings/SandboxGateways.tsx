import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, Bitcoin, CreditCard, Wifi, WifiOff, Key,
  Send, List, CheckCircle2, XCircle, ExternalLink, Copy,
  Activity, Eye, RefreshCw
} from "lucide-react";

interface TestResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

interface PaymentTransaction {
  id: string;
  order_id: string | null;
  portal_id: string;
  partner_user_id: string | null;
  gateway: string;
  gateway_action: string;
  amount: number | null;
  currency: string | null;
  gateway_reference_id: string | null;
  request_payload: any;
  response_payload: any;
  http_status: number | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

const SandboxGateways = () => {
  // Crypto state
  const [cryptoPinging, setCryptoPinging] = useState(false);
  const [cryptoPingResult, setCryptoPingResult] = useState<TestResult | null>(null);
  const [cryptoAuthing, setCryptoAuthing] = useState(false);
  const [cryptoAuthResult, setCryptoAuthResult] = useState<TestResult | null>(null);
  const [cryptoCreating, setCryptoCreating] = useState(false);
  const [cryptoCreateResult, setCryptoCreateResult] = useState<TestResult | null>(null);
  const [cryptoListing, setCryptoListing] = useState(false);
  const [cryptoListResult, setCryptoListResult] = useState<TestResult | null>(null);
  const [cryptoWalletsLoading, setCryptoWalletsLoading] = useState(false);
  const [cryptoWalletsResult, setCryptoWalletsResult] = useState<TestResult | null>(null);
  const [cryptoCurrenciesLoading, setCryptoCurrenciesLoading] = useState(false);
  const [cryptoCurrenciesResult, setCryptoCurrenciesResult] = useState<TestResult | null>(null);
  const [depositWalletId, setDepositWalletId] = useState("");
  const [depositCurrency, setDepositCurrency] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositLabel, setDepositLabel] = useState("Test Deposit");

  // Stripe state
  const [stripeChecking, setStripeChecking] = useState(false);
  const [stripeCheckResult, setStripeCheckResult] = useState<TestResult | null>(null);
  const [stripeCreating, setStripeCreating] = useState(false);
  const [stripeCreateResult, setStripeCreateResult] = useState<TestResult | null>(null);
  const [stripeListing, setStripeListing] = useState(false);
  const [stripeListResult, setStripeListResult] = useState<TestResult | null>(null);
  const [piAmount, setPiAmount] = useState("1000");
  const [piCurrency, setPiCurrency] = useState("usd");
  const [piDescription, setPiDescription] = useState("Test payment");

  // Transactions monitor state
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [selectedTx, setSelectedTx] = useState<PaymentTransaction | null>(null);
  const [txFilter, setTxFilter] = useState<"all" | "stripe" | "coinsbuy">("all");

  const callProxy = async (gateway: string, action: string, params: Record<string, any> = {}) => {
    const proxyName = gateway === "crypto" ? "coinsbuy-proxy" : "stripe-proxy";
    const { data, error } = await supabase.functions.invoke(proxyName, {
      body: { action, ...params }
    });
    if (error) throw error;
    return data;
  };

  const fetchTransactions = async () => {
    setTxLoading(true);
    let query = supabase
      .from("portal_payment_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (txFilter !== "all") {
      query = query.eq("gateway", txFilter);
    }

    const { data, error } = await query;
    if (!error && data) {
      setTransactions(data as PaymentTransaction[]);
    }
    setTxLoading(false);
  };

  useEffect(() => {
    fetchTransactions();
  }, [txFilter]);

  // ─── Crypto Tests ───
  const testCryptoPing = async () => {
    setCryptoPinging(true);
    setCryptoPingResult(null);
    try {
      const result = await callProxy("crypto", "ping");
      setCryptoPingResult({ success: result.ok, data: result.data, error: result.error, timestamp: new Date().toLocaleTimeString() });
    } catch (err: any) {
      setCryptoPingResult({ success: false, error: err.message, timestamp: new Date().toLocaleTimeString() });
    }
    setCryptoPinging(false);
  };

  const testCryptoAuth = async () => {
    setCryptoAuthing(true);
    setCryptoAuthResult(null);
    try {
      const result = await callProxy("crypto", "authenticate");
      setCryptoAuthResult({ success: result.ok, data: result.data, error: result.error, timestamp: new Date().toLocaleTimeString() });
    } catch (err: any) {
      setCryptoAuthResult({ success: false, error: err.message, timestamp: new Date().toLocaleTimeString() });
    }
    setCryptoAuthing(false);
  };

  const testCryptoCreateDeposit = async () => {
    if (!depositWalletId) {
      toast({ title: "Ingresa un Wallet ID", variant: "destructive" });
      return;
    }
    setCryptoCreating(true);
    setCryptoCreateResult(null);
    try {
      const result = await callProxy("crypto", "create_deposit", {
        wallet_id: depositWalletId,
        currency: depositCurrency,
        amount: depositAmount || undefined,
        label: depositLabel,
      });
      setCryptoCreateResult({ success: result.ok, data: result.data, error: result.error, timestamp: new Date().toLocaleTimeString() });
    } catch (err: any) {
      setCryptoCreateResult({ success: false, error: err.message, timestamp: new Date().toLocaleTimeString() });
    }
    setCryptoCreating(false);
  };

  const testCryptoListDeposits = async () => {
    setCryptoListing(true);
    setCryptoListResult(null);
    try {
      const result = await callProxy("crypto", "list_deposits");
      setCryptoListResult({ success: result.ok, data: result.data, error: result.error, timestamp: new Date().toLocaleTimeString() });
    } catch (err: any) {
      setCryptoListResult({ success: false, error: err.message, timestamp: new Date().toLocaleTimeString() });
    }
    setCryptoListing(false);
  };

  const testCryptoListWallets = async () => {
    setCryptoWalletsLoading(true);
    setCryptoWalletsResult(null);
    try {
      const result = await callProxy("crypto", "list_wallets");
      setCryptoWalletsResult({ success: result.ok, data: result.data, error: result.error, timestamp: new Date().toLocaleTimeString() });
    } catch (err: any) {
      setCryptoWalletsResult({ success: false, error: err.message, timestamp: new Date().toLocaleTimeString() });
    }
    setCryptoWalletsLoading(false);
  };

  const testCryptoListCurrencies = async () => {
    setCryptoCurrenciesLoading(true);
    setCryptoCurrenciesResult(null);
    try {
      const result = await callProxy("crypto", "list_currencies");
      setCryptoCurrenciesResult({ success: result.ok, data: result.data, error: result.error, timestamp: new Date().toLocaleTimeString() });
    } catch (err: any) {
      setCryptoCurrenciesResult({ success: false, error: err.message, timestamp: new Date().toLocaleTimeString() });
    }
    setCryptoCurrenciesLoading(false);
  };

  // ─── Stripe Tests ───
  const testStripeCheck = async () => {
    setStripeChecking(true);
    setStripeCheckResult(null);
    try {
      const result = await callProxy("card", "check_connection");
      setStripeCheckResult({ success: result.ok, data: result.data, error: result.error, timestamp: new Date().toLocaleTimeString() });
    } catch (err: any) {
      setStripeCheckResult({ success: false, error: err.message, timestamp: new Date().toLocaleTimeString() });
    }
    setStripeChecking(false);
  };

  const testStripeCreatePI = async () => {
    setStripeCreating(true);
    setStripeCreateResult(null);
    try {
      const result = await callProxy("card", "create_payment_intent", {
        amount: parseInt(piAmount),
        currency: piCurrency,
        description: piDescription,
      });
      setStripeCreateResult({ success: result.ok, data: result.data, error: result.error, timestamp: new Date().toLocaleTimeString() });
    } catch (err: any) {
      setStripeCreateResult({ success: false, error: err.message, timestamp: new Date().toLocaleTimeString() });
    }
    setStripeCreating(false);
  };

  const testStripeListPayments = async () => {
    setStripeListing(true);
    setStripeListResult(null);
    try {
      const result = await callProxy("card", "list_payment_intents");
      setStripeListResult({ success: result.ok, data: result.data, error: result.error, timestamp: new Date().toLocaleTimeString() });
    } catch (err: any) {
      setStripeListResult({ success: false, error: err.message, timestamp: new Date().toLocaleTimeString() });
    }
    setStripeListing(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado al portapapeles" });
  };

  const ResultBadge = ({ result }: { result: TestResult | null }) => {
    if (!result) return null;
    return (
      <div className={`mt-2 p-3 rounded-md border text-xs font-mono ${result.success ? "bg-green-500/10 border-green-500/30" : "bg-destructive/10 border-destructive/30"}`}>
        <div className="flex items-center gap-2 mb-1">
          {result.success ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <XCircle className="w-3.5 h-3.5 text-destructive" />}
          <span className={result.success ? "text-green-600" : "text-destructive"}>{result.success ? "Éxito" : "Error"}</span>
          <span className="text-muted-foreground ml-auto">{result.timestamp}</span>
        </div>
        {result.error && <p className="text-destructive mt-1">{result.error}</p>}
        {result.data && (
          <div className="mt-1 relative">
            <pre className="whitespace-pre-wrap break-all text-muted-foreground max-h-48 overflow-auto">
              {JSON.stringify(result.data, null, 2)}
            </pre>
            <button onClick={() => copyToClipboard(JSON.stringify(result.data, null, 2))} className="absolute top-1 right-1 text-muted-foreground hover:text-foreground">
              <Copy className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    );
  };

  const statusColor = (status: string) => {
    if (status === "success") return "default";
    if (status === "failed") return "destructive";
    return "outline";
  };

  const gatewayIcon = (gw: string) => {
    if (gw === "stripe") return <CreditCard className="w-3.5 h-3.5" />;
    return <Bitcoin className="w-3.5 h-3.5" />;
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="monitor" className="space-y-4">
        <TabsList>
          <TabsTrigger value="monitor" className="gap-1.5">
            <Activity className="w-4 h-4" /> Monitor de Pagos
          </TabsTrigger>
          <TabsTrigger value="crypto" className="gap-1.5">
            <Bitcoin className="w-4 h-4" /> Pasarela Crypto
          </TabsTrigger>
          <TabsTrigger value="card" className="gap-1.5">
            <CreditCard className="w-4 h-4" /> Pasarela Tarjeta
          </TabsTrigger>
        </TabsList>

        {/* ═══ PAYMENT MONITOR ═══ */}
        <TabsContent value="monitor" className="space-y-4 mt-0">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" /> Transacciones de Pago — eCommerce
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="flex border rounded-md overflow-hidden">
                    {(["all", "stripe", "coinsbuy"] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setTxFilter(f)}
                        className={`px-3 py-1 text-xs font-medium transition-colors ${txFilter === f ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
                      >
                        {f === "all" ? "Todas" : f === "stripe" ? "Stripe" : "Crypto"}
                      </button>
                    ))}
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={fetchTransactions} disabled={txLoading}>
                    <RefreshCw className={`w-3.5 h-3.5 ${txLoading ? "animate-spin" : ""}`} />
                    Actualizar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No hay transacciones registradas</p>
                  <p className="text-xs mt-1">Las transacciones aparecerán aquí cuando un usuario complete un checkout en un Partner Portal</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">Fecha</TableHead>
                        <TableHead>Gateway</TableHead>
                        <TableHead>Acción</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead>HTTP</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Ref. ID</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map(tx => (
                        <TableRow key={tx.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedTx(tx)}>
                          <TableCell className="text-xs font-mono">
                            {new Date(tx.created_at).toLocaleString("es-ES", {
                              day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
                            })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {gatewayIcon(tx.gateway)}
                              <span className="text-xs font-medium capitalize">{tx.gateway}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-mono">{tx.gateway_action}</TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold">
                            {tx.amount != null ? `$${tx.amount.toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell>
                            {tx.http_status ? (
                              <Badge variant={tx.http_status < 300 ? "default" : "destructive"} className="text-[10px]">
                                {tx.http_status}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusColor(tx.status)} className="text-[10px]">
                              {tx.status === "success" ? "✅ OK" : tx.status === "failed" ? "❌ Fail" : "⏳ Pending"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono max-w-[120px] truncate" title={tx.gateway_reference_id || ""}>
                            {tx.gateway_reference_id ? tx.gateway_reference_id.substring(0, 16) + "..." : "—"}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedTx(tx); }}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Summary Cards */}
          {transactions.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-4 pb-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{transactions.length}</p>
                  <p className="text-xs text-muted-foreground">Total Transacciones</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 text-center">
                  <p className="text-2xl font-bold text-green-500">{transactions.filter(t => t.status === "success").length}</p>
                  <p className="text-xs text-muted-foreground">Exitosas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 text-center">
                  <p className="text-2xl font-bold text-destructive">{transactions.filter(t => t.status === "failed").length}</p>
                  <p className="text-xs text-muted-foreground">Fallidas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 text-center">
                  <p className="text-2xl font-bold text-primary">
                    ${transactions.filter(t => t.status === "success").reduce((s, t) => s + (t.amount || 0), 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">Volumen Exitoso</p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ═══ CRYPTO SANDBOX ═══ */}
        <TabsContent value="crypto" className="space-y-4 mt-0">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Wifi className="w-4 h-4" /> Test de Conexión (Ping)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">Verifica la disponibilidad del API de Coinsbuy</p>
                <Button size="sm" onClick={testCryptoPing} disabled={cryptoPinging} className="gap-1.5">
                  {cryptoPinging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                  {cryptoPinging ? "Verificando..." : "Hacer Ping"}
                </Button>
                <ResultBadge result={cryptoPingResult} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Key className="w-4 h-4" /> Autenticación OAuth2</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">Genera un token de acceso con tus credenciales</p>
                <Button size="sm" onClick={testCryptoAuth} disabled={cryptoAuthing} className="gap-1.5">
                  {cryptoAuthing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                  {cryptoAuthing ? "Autenticando..." : "Obtener Token"}
                </Button>
                <ResultBadge result={cryptoAuthResult} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><List className="w-4 h-4" /> Wallets Disponibles</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">Obtén los IDs de wallet necesarios para crear depósitos</p>
                <Button size="sm" onClick={testCryptoListWallets} disabled={cryptoWalletsLoading} className="gap-1.5">
                  {cryptoWalletsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <List className="w-3.5 h-3.5" />}
                  {cryptoWalletsLoading ? "Consultando..." : "Listar Wallets"}
                </Button>
                <ResultBadge result={cryptoWalletsResult} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><List className="w-4 h-4" /> Monedas Disponibles</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">Obtén los IDs de monedas para el campo "Currency ID"</p>
                <Button size="sm" onClick={testCryptoListCurrencies} disabled={cryptoCurrenciesLoading} className="gap-1.5">
                  {cryptoCurrenciesLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <List className="w-3.5 h-3.5" />}
                  {cryptoCurrenciesLoading ? "Consultando..." : "Listar Monedas"}
                </Button>
                <ResultBadge result={cryptoCurrenciesResult} />
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Send className="w-4 h-4" /> Crear Depósito de Prueba</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Wallet ID *</Label>
                    <Input value={depositWalletId} onChange={(e) => setDepositWalletId(e.target.value)} placeholder="ID de wallet" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Currency ID (numérico)</Label>
                    <Input value={depositCurrency} onChange={(e) => setDepositCurrency(e.target.value)} placeholder="Ej: 1 (de Listar Monedas)" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Monto (opcional)</Label>
                    <Input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="0.001" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Etiqueta</Label>
                    <Input value={depositLabel} onChange={(e) => setDepositLabel(e.target.value)} placeholder="Test" className="h-8 text-sm" />
                  </div>
                </div>
                <Button size="sm" onClick={testCryptoCreateDeposit} disabled={cryptoCreating} className="gap-1.5">
                  {cryptoCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {cryptoCreating ? "Creando..." : "Crear Depósito"}
                </Button>
                <ResultBadge result={cryptoCreateResult} />
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><List className="w-4 h-4" /> Listar Depósitos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">Consulta los últimos depósitos del sandbox</p>
                <Button size="sm" onClick={testCryptoListDeposits} disabled={cryptoListing} className="gap-1.5">
                  {cryptoListing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <List className="w-3.5 h-3.5" />}
                  {cryptoListing ? "Consultando..." : "Listar Depósitos"}
                </Button>
                <ResultBadge result={cryptoListResult} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ STRIPE SANDBOX ═══ */}
        <TabsContent value="card" className="space-y-4 mt-0">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Wifi className="w-4 h-4" /> Test de Conexión</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">Verifica las credenciales de Stripe consultando el balance</p>
                <Button size="sm" onClick={testStripeCheck} disabled={stripeChecking} className="gap-1.5">
                  {stripeChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                  {stripeChecking ? "Verificando..." : "Verificar Conexión"}
                </Button>
                <ResultBadge result={stripeCheckResult} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><List className="w-4 h-4" /> Historial de Pagos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">Últimos PaymentIntents del entorno de prueba</p>
                <Button size="sm" onClick={testStripeListPayments} disabled={stripeListing} className="gap-1.5">
                  {stripeListing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <List className="w-3.5 h-3.5" />}
                  {stripeListing ? "Consultando..." : "Listar Pagos"}
                </Button>
                <ResultBadge result={stripeListResult} />
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="w-4 h-4" /> Crear Payment Intent de Prueba</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Monto (centavos) *</Label>
                    <Input type="number" value={piAmount} onChange={(e) => setPiAmount(e.target.value)} placeholder="1000 = $10.00" className="h-8 text-sm" />
                    <p className="text-[10px] text-muted-foreground">1000 = $10.00 USD</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Moneda</Label>
                    <Input value={piCurrency} onChange={(e) => setPiCurrency(e.target.value)} placeholder="usd" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Descripción</Label>
                    <Input value={piDescription} onChange={(e) => setPiDescription(e.target.value)} placeholder="Test payment" className="h-8 text-sm" />
                  </div>
                </div>
                <Button size="sm" onClick={testStripeCreatePI} disabled={stripeCreating} className="gap-1.5">
                  {stripeCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
                  {stripeCreating ? "Creando..." : "Crear PaymentIntent"}
                </Button>
                <ResultBadge result={stripeCreateResult} />
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  Tarjeta de prueba: 4242 4242 4242 4242 — Exp: cualquier fecha futura — CVC: cualquier 3 dígitos
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Transaction Detail Dialog */}
      <Dialog open={!!selectedTx} onOpenChange={() => setSelectedTx(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTx && gatewayIcon(selectedTx.gateway)}
              Detalle de Transacción
            </DialogTitle>
          </DialogHeader>
          {selectedTx && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Gateway</p>
                  <p className="font-medium capitalize">{selectedTx.gateway}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Acción</p>
                  <p className="font-mono text-xs">{selectedTx.gateway_action}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Monto</p>
                  <p className="font-bold">{selectedTx.amount != null ? `$${selectedTx.amount.toFixed(2)} ${selectedTx.currency?.toUpperCase()}` : "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Estado</p>
                  <Badge variant={statusColor(selectedTx.status)}>{selectedTx.status}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">HTTP Status</p>
                  <p>{selectedTx.http_status || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Fecha</p>
                  <p className="text-xs">{new Date(selectedTx.created_at).toLocaleString("es-ES")}</p>
                </div>
                {selectedTx.gateway_reference_id && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs">Gateway Reference ID</p>
                    <p className="font-mono text-xs break-all">{selectedTx.gateway_reference_id}</p>
                  </div>
                )}
                {selectedTx.error_message && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs">Error</p>
                    <p className="text-destructive text-sm">{selectedTx.error_message}</p>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-muted-foreground">Request Payload</p>
                  <button onClick={() => copyToClipboard(JSON.stringify(selectedTx.request_payload, null, 2))} className="text-muted-foreground hover:text-foreground">
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <pre className="bg-muted/50 border rounded-md p-3 text-xs font-mono whitespace-pre-wrap break-all max-h-40 overflow-auto">
                  {JSON.stringify(selectedTx.request_payload, null, 2)}
                </pre>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-muted-foreground">Response Payload</p>
                  <button onClick={() => copyToClipboard(JSON.stringify(selectedTx.response_payload, null, 2))} className="text-muted-foreground hover:text-foreground">
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <pre className="bg-muted/50 border rounded-md p-3 text-xs font-mono whitespace-pre-wrap break-all max-h-40 overflow-auto">
                  {JSON.stringify(selectedTx.response_payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SandboxGateways;
