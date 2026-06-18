import { useATFX } from "@/hooks/useATFX";
import DataTableATFX, { ColumnDef } from "../DataTableATFX";
import { extractRows, fmtUSD } from "../utils";
import { toISO, type DateRangeValue } from "../DateRangePicker";

interface Props { range: DateRangeValue; type: "deposit" | "withdraw"; }

const cols: ColumnDef<any>[] = [
  { key: "id", label: "ID" },
  { key: "created_at", label: "Fecha" },
  { key: "customer_email", label: "Cliente" },
  { key: "amount", label: "Monto", render: (r) => fmtUSD(r.amount) },
  { key: "currency", label: "Moneda" },
  { key: "payment_provider", label: "Proveedor" },
  { key: "status", label: "Status" },
];

export default function TransactionsReport({ range, type }: Props) {
  const q = useATFX("list_transactions", {
    type,
    date_from: toISO(range.from),
    date_to: toISO(range.to),
    limit: 1000,
  });
  const rows = extractRows(q.data);

  return (
    <DataTableATFX
      data={rows}
      columns={cols}
      loading={q.isLoading}
      onRefresh={() => q.refetch()}
      filename={`atfx-${type}s`}
      searchKeys={["id", "customer_email", "payment_provider", "status"]}
    />
  );
}
