import { useATFX } from "@/hooks/useATFX";
import DataTableATFX, { ColumnDef } from "../DataTableATFX";
import { extractRows, fmtUSD, fmtNum } from "../utils";
import { toISO, type DateRangeValue } from "../DateRangePicker";

interface Props { range: DateRangeValue }

const cols: ColumnDef<any>[] = [
  { key: "id", label: "ID" },
  { key: "created_at", label: "Fecha" },
  { key: "challenge_name", label: "Challenge" },
  { key: "type", label: "Tipo" },
  { key: "initial_balance", label: "Capital", render: (r) => fmtUSD(r.initial_balance) },
  { key: "price", label: "Precio", render: (r) => fmtUSD(r.price) },
  { key: "customer_email", label: "Cliente" },
  { key: "status", label: "Status" },
];

export default function ChallengesReport({ range }: Props) {
  const q = useATFX("list_challenges", {
    date_from: toISO(range.from),
    date_to: toISO(range.to),
    limit: 1000,
  });
  return <DataTableATFX data={extractRows(q.data)} columns={cols} loading={q.isLoading} onRefresh={() => q.refetch()} filename="atfx-prop-challenges" searchKeys={["id", "challenge_name", "type", "customer_email", "status"]} />;
}
