import { useState } from "react";
import GenericListReport from "../GenericListReport";
import { ColumnDef } from "../DataTableATFX";
import { fmtUSD, fmtNum } from "../utils";
import { toISO, type DateRangeValue } from "../DateRangePicker";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useATFX } from "@/hooks/useATFX";
import { extractRows } from "../utils";
import ErrorPanel from "../ErrorPanel";
import { Search } from "lucide-react";

interface Props { range: DateRangeValue }

// ---------- helpers shared ----------
function DetailLookup({ action, idLabel, columns }: { action: any; idLabel: string; columns: ColumnDef<any>[] }) {
  const [id, setId] = useState("");
  const [submittedId, setSubmittedId] = useState("");
  const q = useATFX(action, { id: submittedId }, { enabled: !!submittedId });

  const rows = extractRows(q.data);
  const single = q.data?.data && !Array.isArray(extractRows(q.data)) ? q.data.data : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">{idLabel}</Label>
            <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="Pega el ID..." />
          </div>
          <Button onClick={() => setSubmittedId(id.trim())} disabled={!id.trim()}>
            <Search className="w-4 h-4 mr-1" />Buscar
          </Button>
        </CardContent>
      </Card>

      {submittedId && q.data && !q.data.ok && (
        <ErrorPanel message={q.data.error ?? "No encontrado"} raw={q.data.raw} onRetry={() => q.refetch()} />
      )}
      {submittedId && q.isLoading && <Card><CardContent className="p-6 text-sm text-muted-foreground">Cargando...</CardContent></Card>}
      {submittedId && q.data?.ok && rows.length === 0 && single && (
        <Card><CardContent className="p-4">
          <pre className="text-xs bg-muted/30 p-3 rounded overflow-auto max-h-[60vh]">{JSON.stringify(single, null, 2)}</pre>
        </CardContent></Card>
      )}
    </div>
  );
}

// ---------- column sets ----------
const customerCols: ColumnDef<any>[] = [
  { key: "id", label: "ID" },
  { key: "email", label: "Email" },
  { key: "first_name", label: "Nombre" },
  { key: "last_name", label: "Apellido" },
  { key: "country", label: "País" },
  { key: "env_mode", label: "Modo" },
  { key: "created_at", label: "Registrado" },
];
const txCols: ColumnDef<any>[] = [
  { key: "id", label: "ID" },
  { key: "created_at", label: "Fecha" },
  { key: "customer_email", label: "Cliente" },
  { key: "amount", label: "Monto", render: (r) => fmtUSD(r.amount) },
  { key: "currency", label: "Moneda" },
  { key: "payment_provider", label: "Proveedor" },
  { key: "status", label: "Status" },
];
const tradesCols: ColumnDef<any>[] = [
  { key: "id", label: "Ticket" },
  { key: "customer_email", label: "Cliente" },
  { key: "account", label: "Cuenta" },
  { key: "symbol", label: "Símbolo" },
  { key: "type", label: "Tipo" },
  { key: "volume", label: "Vol", render: (r) => fmtNum(r.volume) },
  { key: "open_price", label: "Open" },
  { key: "profit", label: "P&L", render: (r) => fmtUSD(r.profit) },
];
const accountsCols: ColumnDef<any>[] = [
  { key: "id", label: "ID" },
  { key: "login", label: "Login" },
  { key: "customer_email", label: "Cliente" },
  { key: "balance", label: "Balance", render: (r) => fmtUSD(r.balance) },
  { key: "equity", label: "Equity", render: (r) => fmtUSD(r.equity) },
  { key: "leverage", label: "Leverage" },
  { key: "currency", label: "Moneda" },
  { key: "status", label: "Status" },
];
const agentsCols: ColumnDef<any>[] = [
  { key: "id", label: "ID" },
  { key: "name", label: "Agente" },
  { key: "referrals_count", label: "Referidos" },
  { key: "volume", label: "Volumen", render: (r) => fmtNum(r.volume) },
  { key: "commissions", label: "Comisiones", render: (r) => fmtUSD(r.commissions) },
];
const bonusesCols: ColumnDef<any>[] = [
  { key: "id", label: "ID" },
  { key: "customer_email", label: "Cliente" },
  { key: "type", label: "Tipo" },
  { key: "amount", label: "Monto", render: (r) => fmtUSD(r.amount) },
  { key: "status", label: "Status" },
  { key: "expires_at", label: "Expira" },
];

// ---------- public component ----------
export default function BrokerReportRouter({ range, category, report }: Props & { category: string; report: string }) {
  const dateParams = { date_from: toISO(range.from), date_to: toISO(range.to), limit: 1000 };

  // CUSTOMERS
  if (category === "customers") {
    if (report === "list") return <GenericListReport action="list_customers" payload={{ ...dateParams }} columns={customerCols} searchKeys={["email", "first_name", "last_name", "country"]} />;
    if (report === "detail") return <DetailLookup action="customer_detail" idLabel="ID del cliente" columns={customerCols} />;
    if (report === "accounts") return <DetailLookup action="customer_accounts" idLabel="ID del cliente" columns={accountsCols} />;
    if (report === "transactions") return <DetailLookup action="customer_transactions" idLabel="ID del cliente" columns={txCols} />;
    if (report === "kyc") return <DetailLookup action="customer_kyc_documents" idLabel="ID del cliente" columns={[]} />;
    if (report === "logins") return <DetailLookup action="customer_login_history" idLabel="ID del cliente" columns={[]} />;
    if (report === "notes") return <DetailLookup action="customer_notes" idLabel="ID del cliente" columns={[]} />;
  }

  // TRANSACTIONS
  if (category === "transactions") {
    if (report === "deposits") return <GenericListReport action="list_transactions" payload={{ type: "deposit", ...dateParams }} columns={txCols} searchKeys={["id", "customer_email", "status"]} />;
    if (report === "withdrawals") return <GenericListReport action="list_transactions" payload={{ type: "withdraw", ...dateParams }} columns={txCols} searchKeys={["id", "customer_email", "status"]} />;
    if (report === "transfers") return <GenericListReport action="list_internal_transfers" payload={dateParams} columns={txCols} />;
    if (report === "adjustments") return <GenericListReport action="list_manual_adjustments" payload={dateParams} columns={txCols} />;
    if (report === "commissions") return <GenericListReport action="list_commissions" payload={dateParams} columns={txCols} />;
  }

  // TRADING
  if (category === "trading") {
    if (report === "open") return <GenericListReport action="list_open_trades" columns={tradesCols} searchKeys={["customer_email", "symbol", "account"]} refetchInterval={15000} />;
    if (report === "closed") return <GenericListReport action="list_closed_trades" payload={dateParams} columns={tradesCols} />;
    if (report === "pending") return <GenericListReport action="list_pending_orders" columns={tradesCols} />;
    if (report === "volume") return <GenericListReport action="report_volume" payload={{ ...dateParams, group_by: "day" }} columns={[
      { key: "date", label: "Fecha" }, { key: "symbol", label: "Símbolo" },
      { key: "volume", label: "Volumen", render: (r) => fmtNum(r.volume) },
      { key: "trades", label: "Trades", render: (r) => fmtNum(r.trades) },
    ]} />;
    if (report === "symbols") return <GenericListReport action="list_symbols" columns={[
      { key: "symbol", label: "Símbolo" }, { key: "description", label: "Descripción" },
      { key: "spread", label: "Spread" }, { key: "swap_long", label: "Swap L" }, { key: "swap_short", label: "Swap S" },
    ]} />;
  }

  // ACCOUNTS
  if (category === "accounts") {
    if (report === "list") return <GenericListReport action="list_accounts" columns={accountsCols} searchKeys={["login", "customer_email"]} />;
    if (report === "detail") return <DetailLookup action="account_detail" idLabel="ID de cuenta" columns={accountsCols} />;
  }

  // AGENTS
  if (category === "agents") {
    if (report === "list") return <GenericListReport action="report_agents" payload={dateParams} columns={agentsCols} />;
    if (report === "detail") return <DetailLookup action="agent_referrals" idLabel="ID del agente" columns={[]} />;
    if (report === "commissions") return <DetailLookup action="agent_commissions" idLabel="ID del agente" columns={[]} />;
    if (report === "hierarchy") return <GenericListReport action="agent_hierarchy" columns={[
      { key: "id", label: "ID" }, { key: "name", label: "Nombre" }, { key: "parent_id", label: "Parent" }, { key: "level", label: "Nivel" },
    ]} />;
    if (report === "payouts") return <GenericListReport action="agent_payouts" payload={dateParams} columns={[
      { key: "id", label: "ID" }, { key: "agent_name", label: "Agente" },
      { key: "amount", label: "Monto", render: (r) => fmtUSD(r.amount) },
      { key: "paid_at", label: "Pagado" }, { key: "status", label: "Status" },
    ]} />;
  }

  // PROMOS
  if (category === "promos") {
    if (report === "bonuses") return <GenericListReport action="list_bonuses" payload={dateParams} columns={bonusesCols} />;
    if (report === "promotions") return <GenericListReport action="list_promotions" columns={[
      { key: "id", label: "ID" }, { key: "name", label: "Nombre" }, { key: "type", label: "Tipo" },
      { key: "starts_at", label: "Inicio" }, { key: "ends_at", label: "Fin" }, { key: "status", label: "Status" },
    ]} />;
    if (report === "coupons") return <GenericListReport action="list_coupons" columns={[
      { key: "code", label: "Código" }, { key: "discount", label: "Descuento" },
      { key: "usage_count", label: "Usos" }, { key: "status", label: "Status" },
    ]} />;
  }

  // FINANCIAL
  if (category === "financial") {
    if (report === "profit") return <GenericListReport action="report_profit" payload={dateParams} columns={[
      { key: "date", label: "Fecha" }, { key: "category", label: "Categoría" },
      { key: "amount", label: "Monto", render: (r) => fmtUSD(r.amount) },
    ]} />;
    if (report === "pamm") return <GenericListReport action="report_pamm" payload={dateParams} columns={[
      { key: "id", label: "ID" }, { key: "manager", label: "Manager" },
      { key: "investors", label: "Inversionistas", render: (r) => fmtNum(r.investors) },
      { key: "aum", label: "AUM", render: (r) => fmtUSD(r.aum) },
    ]} />;
    if (report === "store_revenue") return <GenericListReport action="report_store_revenue" payload={dateParams} columns={[
      { key: "date", label: "Fecha" }, { key: "product", label: "Producto" },
      { key: "units", label: "Unidades" }, { key: "revenue", label: "Revenue", render: (r) => fmtUSD(r.revenue) },
    ]} />;
  }

  // STORE
  if (category === "store") {
    if (report === "products") return <GenericListReport action="list_products" columns={[
      { key: "id", label: "ID" }, { key: "name", label: "Producto" },
      { key: "price", label: "Precio", render: (r) => fmtUSD(r.price) },
      { key: "currency", label: "Moneda" }, { key: "type", label: "Tipo" },
    ]} />;
    if (report === "orders") return <GenericListReport action="list_store_orders" payload={dateParams} columns={[
      { key: "id", label: "ID" }, { key: "customer_email", label: "Cliente" },
      { key: "product", label: "Producto" }, { key: "amount", label: "Monto", render: (r) => fmtUSD(r.amount) },
      { key: "status", label: "Status" }, { key: "created_at", label: "Fecha" },
    ]} />;
    if (report === "subscriptions") return <GenericListReport action="list_subscriptions" columns={[
      { key: "id", label: "ID" }, { key: "customer_email", label: "Cliente" },
      { key: "plan", label: "Plan" }, { key: "status", label: "Status" }, { key: "next_renewal", label: "Próx. cobro" },
    ]} />;
  }

  return <ErrorPanel message={`Reporte ${category}/${report} no implementado`} />;
}
