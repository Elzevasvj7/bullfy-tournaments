import GenericListReport from "../GenericListReport";
import { ColumnDef } from "../DataTableATFX";
import { fmtUSD, fmtNum } from "../utils";
import { toISO, type DateRangeValue } from "../DateRangePicker";
import { useState } from "react";
import { useATFX } from "@/hooks/useATFX";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import ErrorPanel from "../ErrorPanel";
import { extractRows } from "../utils";
import ChartPanel from "../ChartPanel";

interface Props { range: DateRangeValue; category: string; report: string }

function ParticipantLookup({ action }: { action: any }) {
  const [id, setId] = useState("");
  const [submitted, setSubmitted] = useState("");
  const q = useATFX(action, { id: submitted }, { enabled: !!submitted });
  const rows = extractRows(q.data);
  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">ID del participante</Label>
          <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="Pega el ID..." />
        </div>
        <Button onClick={() => setSubmitted(id.trim())}><Search className="w-4 h-4 mr-1" />Buscar</Button>
      </CardContent></Card>
      {submitted && q.data && !q.data.ok && <ErrorPanel message={q.data.error ?? "No encontrado"} raw={q.data.raw} onRetry={() => q.refetch()} />}
      {submitted && q.data?.ok && (
        <Card><CardContent className="p-4">
          <pre className="text-xs bg-muted/30 p-3 rounded overflow-auto max-h-[60vh]">{JSON.stringify(q.data.data, null, 2)}</pre>
        </CardContent></Card>
      )}
    </div>
  );
}

const challengeCols: ColumnDef<any>[] = [
  { key: "id", label: "ID" }, { key: "created_at", label: "Fecha" },
  { key: "customer_email", label: "Cliente" }, { key: "type", label: "Tipo" },
  { key: "capital", label: "Capital", render: (r) => fmtUSD(r.capital) },
  { key: "price", label: "Precio", render: (r) => fmtUSD(r.price) },
  { key: "status", label: "Status" },
];
const participantCols: ColumnDef<any>[] = [
  { key: "id", label: "ID" }, { key: "customer_email", label: "Email" },
  { key: "challenge_type", label: "Challenge" }, { key: "phase", label: "Fase" },
  { key: "balance", label: "Balance", render: (r) => fmtUSD(r.balance) },
  { key: "equity", label: "Equity", render: (r) => fmtUSD(r.equity) },
  { key: "drawdown", label: "DD %" }, { key: "status", label: "Status" },
];
const payoutCols: ColumnDef<any>[] = [
  { key: "id", label: "ID" }, { key: "participant_email", label: "Trader" },
  { key: "amount", label: "Monto", render: (r) => fmtUSD(r.amount) },
  { key: "status", label: "Status" }, { key: "requested_at", label: "Solicitado" },
  { key: "paid_at", label: "Pagado" },
];

export default function PropReportRouter({ range, category, report }: Props) {
  const dateParams = { date_from: toISO(range.from), date_to: toISO(range.to), limit: 1000 };

  if (category === "challenges") {
    if (report === "list") return <GenericListReport action="list_challenges" payload={dateParams} columns={challengeCols} searchKeys={["customer_email", "type", "status"]} />;
    if (report === "types") return <GenericListReport action="challenge_types" columns={[
      { key: "id", label: "ID" }, { key: "name", label: "Nombre" },
      { key: "capital", label: "Capital", render: (r) => fmtUSD(r.capital) },
      { key: "price", label: "Precio", render: (r) => fmtUSD(r.price) },
      { key: "phases", label: "Fases" },
    ]} />;
    if (report === "detail") return <ParticipantLookup action="challenge_detail" />;
  }

  if (category === "participants") {
    if (report === "list") return <GenericListReport action="list_participants" payload={dateParams} columns={participantCols} searchKeys={["customer_email", "challenge_type", "status"]} />;
    if (report === "detail") return <ParticipantLookup action="participant_detail" />;
    if (report === "goals") return <ParticipantLookup action="participant_goals" />;
    if (report === "phases") return <ParticipantLookup action="participant_phases" />;
    if (report === "trades") return <ParticipantLookup action="participant_trades" />;
    if (report === "resets") return <ParticipantLookup action="participant_resets" />;
    if (report === "equity") return <ParticipantLookup action="prop_equity_curve" />;
  }

  if (category === "sales") {
    if (report === "summary") return <GenericListReport action="prop_sales_summary" payload={{ ...dateParams, group_by: "day" }} columns={[
      { key: "date", label: "Fecha" }, { key: "count", label: "Cuentas", render: (r) => fmtNum(r.count) },
      { key: "revenue", label: "Revenue", render: (r) => fmtUSD(r.revenue) },
    ]} />;
    if (report === "by_type") return <GenericListReport action="prop_sales_by_type" payload={dateParams} columns={[
      { key: "type", label: "Tipo" }, { key: "count", label: "Cuentas", render: (r) => fmtNum(r.count) },
      { key: "revenue", label: "Revenue", render: (r) => fmtUSD(r.revenue) },
    ]} />;
    if (report === "revenue") return <GenericListReport action="prop_revenue_total" payload={dateParams} columns={[
      { key: "date", label: "Fecha" }, { key: "revenue", label: "Revenue", render: (r) => fmtUSD(r.revenue) },
    ]} />;
    if (report === "conversion") return <GenericListReport action="prop_conversion_rate" payload={dateParams} columns={[
      { key: "phase", label: "Fase" }, { key: "started", label: "Iniciados" },
      { key: "passed", label: "Pasados" }, { key: "rate", label: "Tasa %" },
    ]} />;
    if (report === "arpu") return <GenericListReport action="prop_arpu_ltv" payload={dateParams} columns={[
      { key: "metric", label: "Métrica" }, { key: "value", label: "Valor", render: (r) => fmtUSD(r.value) },
    ]} />;
    if (report === "coupons") return <GenericListReport action="prop_coupons" payload={dateParams} columns={[
      { key: "code", label: "Código" }, { key: "uses", label: "Usos" },
      { key: "discount_total", label: "Descuento total", render: (r) => fmtUSD(r.discount_total) },
    ]} />;
  }

  if (category === "payouts") {
    if (report === "list") return <GenericListReport action="prop_payouts" payload={dateParams} columns={payoutCols} searchKeys={["participant_email", "status"]} />;
  }

  if (category === "trading") {
    if (report === "open") return <GenericListReport action="prop_open_trades" columns={[
      { key: "ticket", label: "Ticket" }, { key: "participant_email", label: "Trader" },
      { key: "symbol", label: "Símbolo" }, { key: "type", label: "Tipo" },
      { key: "volume", label: "Vol", render: (r) => fmtNum(r.volume) },
      { key: "profit", label: "P&L", render: (r) => fmtUSD(r.profit) },
    ]} refetchInterval={15000} />;
    if (report === "closed") return <GenericListReport action="prop_closed_trades" payload={dateParams} columns={[
      { key: "ticket", label: "Ticket" }, { key: "participant_email", label: "Trader" },
      { key: "symbol", label: "Símbolo" }, { key: "profit", label: "P&L", render: (r) => fmtUSD(r.profit) },
      { key: "closed_at", label: "Cerrado" },
    ]} />;
    if (report === "alerts") return <GenericListReport action="prop_drawdown_alerts" columns={[
      { key: "participant_email", label: "Trader" }, { key: "current_dd", label: "DD actual" },
      { key: "max_dd", label: "DD máx" }, { key: "proximity", label: "Proximidad %" },
    ]} refetchInterval={30000} />;
  }

  if (category === "funded") {
    if (report === "list") return <GenericListReport action="funded_accounts" columns={[
      { key: "id", label: "ID" }, { key: "trader_email", label: "Trader" },
      { key: "capital", label: "Capital", render: (r) => fmtUSD(r.capital) },
      { key: "profit_split", label: "Split %" }, { key: "status", label: "Status" },
    ]} />;
    if (report === "performance") return <GenericListReport action="funded_performance" payload={dateParams} columns={[
      { key: "trader_email", label: "Trader" },
      { key: "profit", label: "Profit", render: (r) => fmtUSD(r.profit) },
      { key: "house_share", label: "Casa", render: (r) => fmtUSD(r.house_share) },
    ]} />;
    if (report === "breaches") return <GenericListReport action="funded_breaches" payload={dateParams} columns={[
      { key: "trader_email", label: "Trader" }, { key: "rule", label: "Regla violada" },
      { key: "breached_at", label: "Fecha breach" },
    ]} />;
  }

  return <ErrorPanel message={`Reporte ${category}/${report} no implementado`} />;
}
