import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, BarChart3, Loader2, Search } from "lucide-react";
import { usePortalBranding } from "@/hooks/usePortalBranding";

interface PortalStoreAdminProps {
  portalId: string;
}

interface Order {
  id: string;
  order_number: string;
  total_usd: number;
  payment_gateway: string | null;
  payment_status: string;
  paid_at: string | null;
  created_at: string;
  partner_user_id: string;
  event_id: string | null;
}

interface LedgerEntry {
  id: string;
  entry_type: string;
  amount: number;
  currency: string;
  description: string | null;
  balance_after: number;
  created_at: string;
}

interface Commission {
  id: string;
  beneficiary_type: string;
  amount: number;
  status: string;
  created_at: string;
}

interface Buyer { nombre: string; email: string; }

const GATEWAY_LABEL: Record<string, string> = {
  stripe_gateway: "Tarjeta (Stripe)", stripe: "Tarjeta (Stripe)",
  nowpayments: "Cripto (NOWPayments)", coinsbuy: "Cripto (Coinsbuy)",
  demo: "Demo", simulated: "Simulado",
};

const PortalStoreAdmin = ({ portalId }: PortalStoreAdminProps) => {
  usePortalBranding(portalId);
  const [tab, setTab] = useState("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [buyers, setBuyers] = useState<Record<string, Buyer>>({});
  const [orderProducts, setOrderProducts] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");

  const fetchAll = async () => {
    setLoading(true);
    const [ordRes, ledRes, commRes] = await Promise.all([
      supabase.from("portal_orders").select("id, order_number, total_usd, payment_gateway, payment_status, paid_at, created_at, partner_user_id, event_id").eq("portal_id", portalId).order("created_at", { ascending: false }).limit(500),
      supabase.from("portal_ledger").select("*").eq("portal_id", portalId).order("created_at", { ascending: false }).limit(100),
      (supabase.from as any)("portal_commission_lines").select("id, beneficiary_type, amount, status, created_at").eq("portal_id", portalId).neq("beneficiary_type", "platform").order("created_at", { ascending: false }).limit(100),
    ]);
    const ords = (ordRes.data as Order[]) ?? [];
    setOrders(ords);
    setLedger((ledRes.data as LedgerEntry[]) ?? []);
    setCommissions((commRes.data as Commission[]) ?? []);

    const { data: bal } = await supabase.rpc("get_portal_ledger_balance", { _portal_id: portalId });
    setBalance(Number(bal) || 0);

    const orderIds = ords.map(o => o.id);
    const userIds = [...new Set(ords.map(o => o.partner_user_id))];
    const eventIds = [...new Set(ords.filter(o => o.event_id).map(o => o.event_id))] as string[];

    // Compradores (nombre + email).
    if (userIds.length > 0) {
      const { data: usersData } = await supabase.from("partner_users").select("id, nombre, email").in("id", userIds);
      const map: Record<string, Buyer> = {};
      (usersData ?? []).forEach((u: any) => { map[u.id] = { nombre: u.nombre || "—", email: u.email || "" }; });
      setBuyers(map);
    }

    // Productos por orden (line items + eventos).
    const prodMap: Record<string, string[]> = {};
    if (orderIds.length > 0) {
      const { data: items } = await supabase
        .from("portal_order_items")
        .select("order_id, quantity, portal_products:product_id(title)")
        .in("order_id", orderIds);
      (items ?? []).forEach((it: any) => {
        const title = it.portal_products?.title || "Producto";
        const label = it.quantity > 1 ? `${title} ×${it.quantity}` : title;
        (prodMap[it.order_id] ||= []).push(label);
      });
    }
    if (eventIds.length > 0) {
      const { data: evs } = await supabase.from("portal_events").select("id, title").in("id", eventIds);
      const evMap: Record<string, string> = {};
      (evs ?? []).forEach((e: any) => { evMap[e.id] = e.title; });
      ords.forEach(o => {
        if (o.event_id && evMap[o.event_id]) (prodMap[o.id] ||= []).push(`Evento: ${evMap[o.event_id]}`);
      });
    }
    setOrderProducts(prodMap);

    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [portalId]);

  const formatDateTime = (iso: string) => new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const paymentStatusBadge = (s: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      paid: { label: "Pagado", variant: "default" },
      pending: { label: "Pendiente", variant: "outline" },
      failed: { label: "Fallido", variant: "destructive" },
      refunded: { label: "Reembolsado", variant: "secondary" },
      cancelled: { label: "Cancelado", variant: "secondary" },
    };
    const cfg = map[s] || { label: s, variant: "outline" as const };
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  // Métodos presentes en las órdenes (para el filtro).
  const methodsPresent = useMemo(
    () => [...new Set(orders.map(o => o.payment_gateway).filter(Boolean))] as string[],
    [orders],
  );

  const filtered = useMemo(() => orders.filter(o => {
    if (filterStatus !== "all" && o.payment_status !== filterStatus) return false;
    if (filterMethod !== "all" && (o.payment_gateway || "") !== filterMethod) return false;
    if (search) {
      const s = search.toLowerCase();
      const b = buyers[o.partner_user_id];
      const prods = (orderProducts[o.id] || []).join(" ").toLowerCase();
      if (!o.order_number.toLowerCase().includes(s)
        && !(b?.nombre || "").toLowerCase().includes(s)
        && !(b?.email || "").toLowerCase().includes(s)
        && !prods.includes(s)) return false;
    }
    return true;
  }), [orders, filterStatus, filterMethod, search, buyers, orderProducts]);

  // Resumen (sobre lo filtrado).
  const paidOrders = filtered.filter(o => o.payment_status === "paid");
  const ingresos = paidOrders.reduce((s, o) => s + Number(o.total_usd || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="orders" className="gap-1.5"><ShoppingCart className="w-4 h-4" /> Ventas</TabsTrigger>
          <TabsTrigger value="ledger" className="gap-1.5"><BarChart3 className="w-4 h-4" /> Contabilidad</TabsTrigger>
        </TabsList>

        {/* ===== VENTAS / SEGUIMIENTO ===== */}
        <TabsContent value="orders" className="space-y-4">
          {/* Resumen */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{filtered.length}</p><p className="text-xs text-muted-foreground">Órdenes</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{paidOrders.length}</p><p className="text-xs text-muted-foreground">Pagadas</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">${ingresos.toFixed(2)}</p><p className="text-xs text-muted-foreground">Ingresos confirmados</p></CardContent></Card>
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar # orden, comprador o producto..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="paid">Pagado</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="failed">Fallido</SelectItem>
                <SelectItem value="refunded">Reembolsado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterMethod} onValueChange={setFilterMethod}>
              <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los métodos</SelectItem>
                {methodsPresent.map(m => (
                  <SelectItem key={m} value={m}>{GATEWAY_LABEL[m] || m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead># Orden</TableHead>
                    <TableHead>Comprador</TableHead>
                    <TableHead>Producto(s)</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin órdenes que coincidan</TableCell></TableRow>
                  ) : filtered.map(o => {
                    const b = buyers[o.partner_user_id];
                    const prods = orderProducts[o.id] || [];
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{b?.nombre || o.partner_user_id.slice(0, 8)}</div>
                          {b?.email && <div className="text-xs text-muted-foreground">{b.email}</div>}
                        </TableCell>
                        <TableCell className="text-sm max-w-[260px]">
                          {prods.length > 0 ? prods.join(", ") : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="font-mono font-bold">${Number(o.total_usd).toFixed(2)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{GATEWAY_LABEL[o.payment_gateway || ""] || o.payment_gateway || "—"}</Badge></TableCell>
                        <TableCell>{paymentStatusBadge(o.payment_status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDateTime(o.created_at)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== CONTABILIDAD ===== */}
        <TabsContent value="ledger" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Balance del portal</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold text-primary">${balance.toFixed(2)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Comisiones pendientes (fiat)</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold text-foreground">${commissions.filter(c => c.status === "pending").reduce((s, c) => s + Number(c.amount), 0).toFixed(2)}</p></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-lg">Movimientos</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sin movimientos</TableCell></TableRow>
                  ) : ledger.map(l => (
                    <TableRow key={l.id}>
                      <TableCell><Badge variant="outline" className="text-xs">{l.entry_type}</Badge></TableCell>
                      <TableCell className="text-sm">{l.description || "—"}</TableCell>
                      <TableCell className={`font-mono font-bold ${l.amount >= 0 ? "text-green-600" : "text-destructive"}`}>
                        {l.amount >= 0 ? "+" : ""}${l.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">${l.balance_after.toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(l.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {commissions.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Comisiones recientes</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Beneficiario</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map(c => (
                      <TableRow key={c.id}>
                        <TableCell><Badge variant="outline" className="text-xs">{c.beneficiary_type}</Badge></TableCell>
                        <TableCell className="font-mono font-bold">${Number(c.amount).toFixed(2)}</TableCell>
                        <TableCell><Badge variant={c.status === "available" ? "default" : "outline"}>{c.status === "available" ? "Disponible" : "Pendiente"}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDateTime(c.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PortalStoreAdmin;
