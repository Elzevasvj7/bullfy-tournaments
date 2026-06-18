import { useATFX } from "@/hooks/useATFX";
import DataTableATFX, { ColumnDef } from "../DataTableATFX";
import { extractRows, fmtUSD } from "../utils";
import { toISO, type DateRangeValue } from "../DateRangePicker";

interface Props { range: DateRangeValue }

const cols: ColumnDef<any>[] = [
  { key: "id", label: "ID" },
  { key: "created_at", label: "Fecha" },
  { key: "participant_email", label: "Participante" },
  { key: "challenge_name", label: "Challenge" },
  { key: "amount", label: "Monto", render: (r) => fmtUSD(r.amount) },
  { key: "status", label: "Status" },
];

export default function PayoutsReport({ range }: Props) {
  const q = useATFX("prop_payouts", { date_from: toISO(range.from), date_to: toISO(range.to), limit: 1000 });
  return <DataTableATFX data={extractRows(q.data)} columns={cols} loading={q.isLoading} onRefresh={() => q.refetch()} filename="atfx-prop-payouts" searchKeys={["id", "participant_email", "challenge_name", "status"]} />;
}
