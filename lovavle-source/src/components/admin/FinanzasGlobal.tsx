import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, DollarSign, ShoppingBag, TrendingUp, Wallet, Download, Activity, Network, Receipt, FlaskConical,
} from "lucide-react";

// ============================================================================
// Panel global de finanzas (Bullfy admin / global_admin).
// Cruza TODOS los portales, con toggle Real/Demo: la vista 'real' y la 'demo'
// están separadas por account_kind (nunca se mezclan). Lee tablas que el admin
// ya puede leer por RLS: portal_orders, financial_events, portal_mlm_commissions,
// partner_portals.
// ============================================================================

interface OrderRow {
  id: string;
  order_number: string | null;
  total_usd: number;
  payment_gateway: string | null;
  paid_at: string | null;
  created_at: string;
  portal_id: string;
  portal_name?: string;
}

interface EventRow {
  id: string;
  occurred_at: string;
  function_name: string;
  event_type: string;
  gateway: string | null;
  portal_id: string | null;
  amount: number | null;
  currency: string | null;
  result: string;
  error_message: string | null;
  payload?: any;
  portal_name?: string;
}

interface CommissionRow {
  id: string;
  commission_amount: number;
  status: string;
  beneficiary_type: string;
  portal_id: string;
  created_at: string;
  portal_name?: string;
}

interface PortalOption { id: string; display_name: string; }

const RANGES: { key: string; label: string; days: number | null }[] = [
  { key: "7d", label: "7 días", days: 7 },
  { key: "30d", label: "30 días", days: 30 },
  { key: "90d", label: "90 días", days: 90 },
  { key: "all", label: "Todo", days: null },
];

const EVENT_LABEL: Record<string, string> = {
  order_paid: "Venta pagada",
  deposit_created: "Depósito creado",
  payment_received: "Pago recibido",
  commissions_distributed: "Comisiones repartidas",
  commissions_failed: "Comisiones fallidas",
  commissions_released: "Comisiones liberadas",
  withdrawal_completed: "Retiro completado",
  withdrawal_failed: "Retiro fallido",
};

const fmtUsd = (n: number | string | null | undefined) =>
  `$${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const gatewayLabel = (g: string | null) => {
  if (!g) return "—";
  const map: Record<string, string> = { coinsbuy: "Coinsbuy", stripe: "Stripe", stripe_gateway: "Stripe", nowpayments: "NowPayments", coinsbuy_gateway: "Coinsbuy", demo: "Demo", simulated: "Simulado" };
  return map[g] || g;
};

// Pasarelas cuyos pagos NO están confirmados (Stripe quedó deshabilitado sin
// webhook que confirme el cobro; 'simulated' es de pruebas). No cuentan como
// ingreso real confirmado.
const isUnconfirmedGw = (g: string | null) => ["stripe", "stripe_gateway", "simulated"].includes(g || "");

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map(r => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const FinanzasGlobal = () => {
  const [loading, setLoading] = useState(true);
  const [rangeKey, setRangeKey] = useState("30d");
  const [portalFilter, setPortalFilter] = useState("all");
  const [gatewayFilter, setGatewayFilter] = useState("all");
  const [accountKind, setAccountKind] = useState<"real" | "demo">("real");
  const isDemo = accountKind === "demo";

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [portals, setPortals] = useState<PortalOption[]>([]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [rangeKey, accountKind]);

  const load = async () => {
    setLoading(true);
    const days = RANGES.find(r => r.key === rangeKey)?.days ?? null;
    const fromISO = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() : null;

    let ordersQ = supabase
      .from("portal_orders")
      .select("id, order_number, total_usd, payment_gateway, paid_at, created_at, portal_id")
      .eq("payment_status", "paid")
      .eq("account_kind", accountKind)
      .order("paid_at", { ascending: false })
      .limit(2000);
    if (fromISO) ordersQ = ordersQ.gte("paid_at", fromISO);

    let eventsQ = supabase
      .from("financial_events")
      .select("id, occurred_at, function_name, event_type, gateway, portal_id, amount, currency, result, error_message, payload")
      .order("occurred_at", { ascending: false })
      .limit(2000);
    if (fromISO) eventsQ = eventsQ.gte("occurred_at", fromISO);

    let commQ = (supabase.from as any)("portal_commission_lines")
      .select("id, commission_amount:amount, status, beneficiary_type, portal_id, created_at")
      .eq("account_kind", accountKind)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (fromISO) commQ = commQ.gte("created_at", fromISO);

    const [ordersRes, eventsRes, commRes, portalsRes] = await Promise.all([
      ordersQ,
      eventsQ,
      commQ,
      supabase.from("partner_portals").select("id, display_name").order("display_name"),
    ]);

    const pmap: Record<string, string> = {};
    (portalsRes.data ?? []).forEach((p: any) => { pmap[p.id] = p.display_name; });
    setPortals((portalsRes.data ?? []) as PortalOption[]);

    setOrders(((ordersRes.data ?? []) as any[]).map(o => ({ ...o, portal_name: pmap[o.portal_id] || "—" })));
    setEvents(((eventsRes.data ?? []) as any[]).map(e => ({ ...e, portal_name: e.portal_id ? (pmap[e.portal_id] || "—") : "—" })));
    setCommissions(((commRes.data ?? []) as any[]).map(c => ({ ...c, portal_name: pmap[c.portal_id] || "—" })));
    setLoading(false);
  };

  // ── Filtros cliente (portal/pasarela) sobre lo cargado ──────────────────────
  const fOrders = useMemo(() => orders.filter(o =>
    (portalFilter === "all" || o.portal_id === portalFilter) &&
    (gatewayFilter === "all" || (o.payment_gateway || "—") === gatewayFilter)
  ), [orders, portalFilter, gatewayFilter]);

  const fEvents = useMemo(() => events.filter(e => {
    // financial_events no tiene columna account_kind; clasificamos demo por la
    // pasarela 'demo' o por payload.account_kind. En modo demo solo mostramos
    // eventos demo; en real, excluimos los demo.
    const isDemoEvent = e.gateway === "demo" || e.payload?.account_kind === "demo";
    if (isDemo ? !isDemoEvent : isDemoEvent) return false;
    return (portalFilter === "all" || e.portal_id === portalFilter) &&
      (gatewayFilter === "all" || (e.gateway || "—") === gatewayFilter);
  }), [events, portalFilter, gatewayFilter, isDemo]);

  const fComm = useMemo(() => commissions.filter(c =>
    (portalFilter === "all" || c.portal_id === portalFilter)
  ), [commissions, portalFilter]);

  // Antes de "solo-cripto", las órdenes Stripe se marcaban 'paid' SIN webhook que
  // confirmara el cobro real → NO cuentan como ingreso confirmado. Coinsbuy sí
  // (el callback verifica server-to-server). Las KPIs cuentan solo lo confirmado.
  const confirmedOrders = useMemo(
    () => fOrders.filter(o => !isUnconfirmedGw(o.payment_gateway)),
    [fOrders],
  );
  const unconfirmed = useMemo(() => {
    const u = fOrders.filter(o => isUnconfirmedGw(o.payment_gateway));
    return { count: u.length, total: u.reduce((s, o) => s + Number(o.total_usd || 0), 0) };
  }, [fOrders]);

  // ── KPIs (solo cobros CONFIRMADOS) ──────────────────────────────────────────
  const ingresos = confirmedOrders.reduce((s, o) => s + Number(o.total_usd || 0), 0);
  const ventas = confirmedOrders.length;
  const ticket = ventas > 0 ? ingresos / ventas : 0;
  const comisionesTotal = fComm.reduce((s, c) => s + Number(c.commission_amount || 0), 0);
  const neto = ingresos - comisionesTotal;

  const porPasarela = useMemo(() => {
    const m = new Map<string, { count: number; total: number }>();
    for (const o of confirmedOrders) {
      const g = o.payment_gateway || "—";
      const cur = m.get(g) || { count: 0, total: 0 };
      cur.count++; cur.total += Number(o.total_usd || 0);
      m.set(g, cur);
    }
    return Array.from(m.entries()).map(([g, v]) => ({ gateway: g, ...v })).sort((a, b) => b.total - a.total);
  }, [confirmedOrders]);

  const topPortales = useMemo(() => {
    const m = new Map<string, { name: string; count: number; total: number }>();
    for (const o of confirmedOrders) {
      const cur = m.get(o.portal_id) || { name: o.portal_name || "—", count: 0, total: 0 };
      cur.count++; cur.total += Number(o.total_usd || 0);
      m.set(o.portal_id, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [confirmedOrders]);

  const gatewaysAvail = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => set.add(o.payment_gateway || "—"));
    return Array.from(set);
  }, [orders]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle>Finanzas — Vista global</CardTitle>
              <CardDescription className="mt-1">
                Ingresos, movimientos y comisiones de <strong>todos los portales</strong> — {isDemo ? "dinero DEMO (ficticio, no retirable)" : "dinero real"}.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex rounded-lg border border-border p-0.5">
              <Button size="sm" variant={!isDemo ? "default" : "ghost"} className="h-8 px-3" onClick={() => setAccountKind("real")}>Real</Button>
              <Button size="sm" variant={isDemo ? "default" : "ghost"} className="h-8 px-3 gap-1" onClick={() => setAccountKind("demo")}>
                <FlaskConical className="w-3.5 h-3.5" /> Demo
              </Button>
            </div>
            <Select value={rangeKey} onValueChange={setRangeKey}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RANGES.map(r => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={portalFilter} onValueChange={setPortalFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los portales</SelectItem>
                {portals.map(p => <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={gatewayFilter} onValueChange={setGatewayFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda pasarela</SelectItem>
                {gatewaysAvail.map(g => <SelectItem key={g} value={g}>{gatewayLabel(g)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin inline text-primary" /></div>
        ) : (
          <Tabs defaultValue="resumen" className="space-y-4">
            <TabsList>
              <TabsTrigger value="resumen" className="gap-1.5"><TrendingUp className="w-4 h-4" /> Resumen</TabsTrigger>
              <TabsTrigger value="ingresos" className="gap-1.5"><Receipt className="w-4 h-4" /> Ingresos ({fOrders.length})</TabsTrigger>
              <TabsTrigger value="movimientos" className="gap-1.5"><Activity className="w-4 h-4" /> Movimientos ({fEvents.length})</TabsTrigger>
              <TabsTrigger value="comisiones" className="gap-1.5"><Network className="w-4 h-4" /> Comisiones ({fComm.length})</TabsTrigger>
            </TabsList>

            {/* ── RESUMEN ── */}
            <TabsContent value="resumen" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard icon={DollarSign} color="text-emerald-500" label="Ingresos" value={fmtUsd(ingresos)} />
                <KpiCard icon={ShoppingBag} color="text-blue-500" label="Ventas" value={String(ventas)} />
                <KpiCard icon={Receipt} color="text-primary" label="Ticket promedio" value={fmtUsd(ticket)} />
                <KpiCard icon={Wallet} color="text-amber-500" label="Comisiones repartidas" value={fmtUsd(comisionesTotal)} sub={`Neto: ${fmtUsd(neto)}`} />
              </div>

              {!isDemo && unconfirmed.count > 0 && (
                <div className="text-xs rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-600 px-3 py-2">
                  ⚠ "Ingresos" cuenta solo cobros <strong>confirmados</strong>. Se excluyen{" "}
                  <strong>{fmtUsd(unconfirmed.total)}</strong> en {unconfirmed.count} órden(es) <strong>Stripe sin confirmar</strong>{" "}
                  (marcadas pagadas antes del fix de solo-cripto, sin webhook que confirmara el cobro). Aparecen marcadas en la pestaña Ingresos.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Ingresos por pasarela</CardTitle></CardHeader>
                  <CardContent>
                    {porPasarela.length === 0 ? <Empty /> : (
                      <Table>
                        <TableHeader><TableRow><TableHead>Pasarela</TableHead><TableHead className="text-center">Ventas</TableHead><TableHead className="text-right">Ingresos</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {porPasarela.map(p => (
                            <TableRow key={p.gateway}>
                              <TableCell><Badge variant="outline">{gatewayLabel(p.gateway)}</Badge></TableCell>
                              <TableCell className="text-center">{p.count}</TableCell>
                              <TableCell className="text-right font-semibold">{fmtUsd(p.total)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Top portales por ingreso</CardTitle></CardHeader>
                  <CardContent>
                    {topPortales.length === 0 ? <Empty /> : (
                      <Table>
                        <TableHeader><TableRow><TableHead>Portal</TableHead><TableHead className="text-center">Ventas</TableHead><TableHead className="text-right">Ingresos</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {topPortales.map((p, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{p.name}</TableCell>
                              <TableCell className="text-center">{p.count}</TableCell>
                              <TableCell className="text-right font-semibold">{fmtUsd(p.total)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── INGRESOS (órdenes) ── */}
            <TabsContent value="ingresos" className="space-y-3">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadCsv(
                  "ingresos.csv",
                  ["Fecha", "Portal", "Orden", "Pasarela", "Monto USD"],
                  fOrders.map(o => [new Date(o.paid_at || o.created_at).toLocaleString(), o.portal_name || "", o.order_number || o.id.slice(0, 8), gatewayLabel(o.payment_gateway), Number(o.total_usd || 0).toFixed(2)]),
                )}>
                  <Download className="w-3.5 h-3.5" /> Exportar CSV
                </Button>
              </div>
              {fOrders.length === 0 ? <Empty /> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Portal</TableHead><TableHead>Orden</TableHead><TableHead>Pasarela</TableHead><TableHead className="text-right">Monto</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {fOrders.map(o => (
                      <TableRow key={o.id}>
                        <TableCell className="text-xs text-muted-foreground">{new Date(o.paid_at || o.created_at).toLocaleString()}</TableCell>
                        <TableCell><Badge variant="outline">{o.portal_name}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{o.order_number || o.id.slice(0, 8)}</TableCell>
                        <TableCell>
                          {gatewayLabel(o.payment_gateway)}
                          {isUnconfirmedGw(o.payment_gateway) && (
                            <Badge variant="outline" className="ml-2 text-[10px] text-amber-600 border-amber-500/40">no confirmado</Badge>
                          )}
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${isUnconfirmedGw(o.payment_gateway) ? "text-amber-600/70" : "text-emerald-600"}`}>{fmtUsd(o.total_usd)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* ── MOVIMIENTOS (financial_events) ── */}
            <TabsContent value="movimientos" className="space-y-3">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadCsv(
                  "movimientos.csv",
                  ["Fecha", "Tipo", "Función", "Pasarela", "Portal", "Monto", "Resultado", "Error"],
                  fEvents.map(e => [new Date(e.occurred_at).toLocaleString(), EVENT_LABEL[e.event_type] || e.event_type, e.function_name, gatewayLabel(e.gateway), e.portal_name || "", Number(e.amount || 0).toFixed(2), e.result, e.error_message || ""]),
                )}>
                  <Download className="w-3.5 h-3.5" /> Exportar CSV
                </Button>
              </div>
              {fEvents.length === 0 ? <Empty msg="Sin movimientos en el período. (financial_events registra desde que se desplegó la observabilidad.)" /> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead>Pasarela</TableHead><TableHead>Portal</TableHead><TableHead className="text-right">Monto</TableHead><TableHead className="text-center">Resultado</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {fEvents.map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs text-muted-foreground">{new Date(e.occurred_at).toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="text-sm">{EVENT_LABEL[e.event_type] || e.event_type}</div>
                          {e.error_message && <div className="text-xs text-destructive truncate max-w-[260px]">{e.error_message}</div>}
                        </TableCell>
                        <TableCell className="text-sm">{gatewayLabel(e.gateway)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{e.portal_name}</Badge></TableCell>
                        <TableCell className="text-right font-medium">{e.amount != null ? fmtUsd(e.amount) : "—"}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={e.result === "success" ? "default" : e.result === "failed" ? "destructive" : "secondary"} className="text-[10px]">{e.result}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* ── COMISIONES ── */}
            <TabsContent value="comisiones" className="space-y-3">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadCsv(
                  "comisiones.csv",
                  ["Fecha", "Portal", "Beneficiario", "Estado", "Monto"],
                  fComm.map(c => [new Date(c.created_at).toLocaleString(), c.portal_name || "", c.beneficiary_type, c.status, Number(c.commission_amount || 0).toFixed(2)]),
                )}>
                  <Download className="w-3.5 h-3.5" /> Exportar CSV
                </Button>
              </div>
              {fComm.length === 0 ? <Empty /> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Portal</TableHead><TableHead>Beneficiario</TableHead><TableHead className="text-center">Estado</TableHead><TableHead className="text-right">Monto</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {fComm.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</TableCell>
                        <TableCell><Badge variant="outline">{c.portal_name}</Badge></TableCell>
                        <TableCell className="text-sm">{c.beneficiary_type}</TableCell>
                        <TableCell className="text-center"><Badge variant="secondary" className="text-[10px]">{c.status}</Badge></TableCell>
                        <TableCell className="text-right font-semibold">{fmtUsd(c.commission_amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

const KpiCard = ({ icon: Icon, color, label, value, sub }: { icon: any; color: string; label: string; value: string; sub?: string }) => (
  <Card>
    <CardContent className="pt-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="text-2xl font-display font-bold">{value}</div>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </CardContent>
  </Card>
);

const Empty = ({ msg = "Sin datos para los filtros seleccionados." }: { msg?: string }) => (
  <div className="text-center py-10 text-sm text-muted-foreground">{msg}</div>
);

export default FinanzasGlobal;
