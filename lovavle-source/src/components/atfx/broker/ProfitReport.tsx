import { useATFX } from "@/hooks/useATFX";
import DataTableATFX, { ColumnDef } from "../DataTableATFX";
import { extractRows, fmtUSD } from "../utils";
import { toISO, type DateRangeValue } from "../DateRangePicker";

interface Props { range: DateRangeValue }

const cols: ColumnDef<any>[] = [
  { key: "date", label: "Fecha" },
  { key: "a_book_pnl", label: "A-Book", render: (r) => fmtUSD(r.a_book_pnl) },
  { key: "b_book_pnl", label: "B-Book", render: (r) => fmtUSD(r.b_book_pnl) },
  { key: "agent_commissions", label: "Comisiones Agente", render: (r) => fmtUSD(r.agent_commissions) },
  { key: "store_revenue", label: "Store", render: (r) => fmtUSD(r.store_revenue) },
  { key: "pamm_pnl", label: "PAMM", render: (r) => fmtUSD(r.pamm_pnl) },
  { key: "net_pnl", label: "Net P&L", render: (r) => fmtUSD(r.net_pnl) },
];

export default function ProfitReport({ range }: Props) {
  const q = useATFX("report_profit", { date_from: toISO(range.from), date_to: toISO(range.to) });
  return <DataTableATFX data={extractRows(q.data)} columns={cols} loading={q.isLoading} onRefresh={() => q.refetch()} filename="atfx-profit" />;
}
