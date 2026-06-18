import { useATFX } from "@/hooks/useATFX";
import DataTableATFX, { ColumnDef } from "../DataTableATFX";
import { extractRows, fmtUSD, fmtNum } from "../utils";
import { toISO, type DateRangeValue } from "../DateRangePicker";

interface Props { range: DateRangeValue }

const cols: ColumnDef<any>[] = [
  { key: "type", label: "Tipo Challenge" },
  { key: "initial_balance", label: "Capital", render: (r) => fmtUSD(r.initial_balance) },
  { key: "count", label: "Vendidas", render: (r) => fmtNum(r.count) },
  { key: "revenue", label: "Ingreso total", render: (r) => fmtUSD(r.revenue) },
  { key: "avg_price", label: "Precio prom.", render: (r) => fmtUSD(r.avg_price) },
];

export default function SalesByTypeReport({ range }: Props) {
  const q = useATFX("prop_sales_summary", {
    date_from: toISO(range.from),
    date_to: toISO(range.to),
    group_by: "type",
  });
  return <DataTableATFX data={extractRows(q.data)} columns={cols} loading={q.isLoading} onRefresh={() => q.refetch()} filename="atfx-prop-sales-type" />;
}
